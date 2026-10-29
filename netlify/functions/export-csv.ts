import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

interface NetlifyEvent {
  httpMethod: string;
  headers: Record<string, string | undefined>;
  queryStringParameters: Record<string, string | undefined> | null;
  body: string | null;
}

interface NetlifyResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

/**
 * Timing-safe string comparison to mitigate side-channel timing attacks
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Formula Injection Protection:
 * Spreadsheet software (Excel, Google Sheets) interprets cells starting with
 * '=', '+', '-', '@', '\t', '\r' as formulas. Prepending a single quote (') disables formula execution.
 */
function sanitizeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);

  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Safely extracts detailed error message from PostgrestError or Error objects
 */
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'object' && err !== null) {
    const pg = err as Record<string, unknown>;
    const msg = pg.message || pg.error || pg.error_description || pg.details;
    const code = pg.code ? ` (PostgreSQL Code: ${pg.code})` : '';
    const hint = pg.hint ? ` - Hint: ${pg.hint}` : '';
    if (msg) {
      return `${String(msg)}${code}${hint}`;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err || 'Unknown database query failure');
}

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  // Only accept GET or POST
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed. Use GET or POST with authentication headers.' }),
    };
  }

  // 1. FAIL CLOSED: Verify Server Environment Configuration
  const configuredAdminKey = process.env.QUIZ_ADMIN_KEY;
  if (!configuredAdminKey || configuredAdminKey.trim().length === 0) {
    console.error('[export-csv] Configuration error: QUIZ_ADMIN_KEY is not defined.');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Server security configuration error: Admin export passcode is not configured on the server.',
      }),
    };
  }

  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabaseUrl = rawUrl ? String(rawUrl).trim().replace(/^["']|["']$/g, '') : '';
  const serviceRoleKey = rawServiceKey ? String(rawServiceKey).trim().replace(/^["']|["']$/g, '') : '';

  if (!supabaseUrl || !serviceRoleKey || serviceRoleKey.length === 0) {
    console.error('[export-csv] Configuration error: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL is missing.');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Server configuration error: Database service role credentials are missing.',
      }),
    };
  }

  // 2. DISALLOW SECRETS IN URL QUERY PARAMETERS (CWE-598 Prevention)
  if (event.queryStringParameters?.key || event.queryStringParameters?.admin_key) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error:
          'Security policy violation: Passcodes must never be transmitted via URL query parameters. Use the x-admin-key or Authorization header.',
      }),
    };
  }

  // 3. EXTRACT PASSCODE ONLY FROM HEADERS OR POST BODY
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const customHeader = event.headers['x-admin-key'] || event.headers['X-Admin-Key'];

  let suppliedKey = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    suppliedKey = authHeader.substring(7).trim();
  } else if (customHeader) {
    suppliedKey = customHeader.trim();
  } else if (event.httpMethod === 'POST' && event.body) {
    try {
      const parsed = JSON.parse(event.body);
      if (parsed.adminKey && typeof parsed.adminKey === 'string') {
        suppliedKey = parsed.adminKey.trim();
      }
    } catch {
      // ignore JSON parse error
    }
  }

  // 4. TIMING-SAFE AUTHENTICATION
  if (!suppliedKey || !safeEqual(suppliedKey, configuredAdminKey.trim())) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Unauthorized: Invalid or missing administrator access key.',
      }),
    };
  }

  // 5. CONNECT TO SUPABASE USING SERVICE-ROLE KEY (Bypasses RLS strictly on the backend)
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  try {
    let attemptsData: Array<Record<string, unknown>> = [];
    let participantsData: Array<Record<string, unknown>> = [];
    let questionsData: Array<Record<string, unknown>> = [];

    // Attempt 1: Fetch flat tables directly (fast, decoupled, immune to PostgREST relationship naming issues)
    const [attRes, partRes, questRes] = await Promise.all([
      supabase.from('attempts').select('*').order('started_at', { ascending: false }),
      supabase.from('participants').select('id, participant_number, label'),
      supabase.from('question_results').select('*').order('question_number', { ascending: true }),
    ]);

    if (!attRes.error && !partRes.error && !questRes.error) {
      attemptsData = attRes.data || [];
      participantsData = partRes.data || [];
      questionsData = questRes.data || [];
    } else {
      // Log the exact error for server diagnosis
      console.warn('[export-csv] Direct table query error:', {
        attemptsError: extractErrorMessage(attRes.error),
        participantsError: extractErrorMessage(partRes.error),
        questionsError: extractErrorMessage(questRes.error),
      });

      // Attempt 2: Fall back to trusted SECURITY DEFINER export RPC if table SELECT permissions were revoked
      const rpcRes = await supabase.rpc('get_all_quiz_records_for_export');
      if (!rpcRes.error && rpcRes.data) {
        attemptsData = rpcRes.data.attempts || [];
        participantsData = rpcRes.data.participants || [];
        questionsData = rpcRes.data.question_results || [];
      } else {
        // Both approaches failed; log and throw the specific database error
        const primaryError = attRes.error || partRes.error || questRes.error || rpcRes.error;
        console.error('[export-csv] All database export queries failed:', {
          directAttempts: extractErrorMessage(attRes.error),
          directParticipants: extractErrorMessage(partRes.error),
          directQuestions: extractErrorMessage(questRes.error),
          fallbackRpc: extractErrorMessage(rpcRes.error),
        });
        throw primaryError;
      }
    }

    // Map participants by ID for instant O(1) label resolution
    const participantMap = new Map<string, { id: string; participant_number: number; label: string }>();
    for (const p of participantsData) {
      const id = String(p.id || '');
      const num = Number(p.participant_number || 0);
      const label = String(p.label || `Student ${id.substring(0, 6)}`);
      participantMap.set(id, { id, participant_number: num, label });
    }

    // Map attempts by ID for question result joining
    const attemptMap = new Map<string, { attempt_number: number; studentLabel: string }>();
    const participantStatsMap = new Map<string, { latestScore: number; bestScore: number }>();

    for (const a of attemptsData) {
      const pid = String(a.participant_id || '');
      const p = participantMap.get(pid);
      const studentLabel = p?.label || `Student ${pid.substring(0, 6)}`;
      const attNum = Number(a.attempt_number || 1);

      attemptMap.set(String(a.id || ''), {
        attempt_number: attNum,
        studentLabel,
      });

      if (a.status === 'completed') {
        const score = Number(a.score || 0);
        const current = participantStatsMap.get(pid);
        if (!current) {
          participantStatsMap.set(pid, { latestScore: score, bestScore: score });
        } else if (score > current.bestScore) {
          current.bestScore = score;
        }
      }
    }

    // Assemble sanitized CSV
    const csvLines: string[] = [];

    // --- SECTION 1: ATTEMPT SUMMARY ---
    csvLines.push('=== ATTEMPT-LEVEL ASSESSMENT SUMMARY ===');
    const attemptHeaders = [
      'Anonymous Student Label',
      'Anonymous Participant ID',
      'Attempt ID',
      'Attempt Number',
      'Quiz Version',
      'Start Timestamp (UTC)',
      'Completion Timestamp (UTC)',
      'Completion Status',
      'Score (out of 10)',
      'Maximum Score',
      'Accuracy (%)',
      'Correct Count',
      'Incorrect Retry Count',
      'Duration (seconds)',
      'Participant Best Score',
    ];
    csvLines.push(attemptHeaders.map(sanitizeCsvValue).join(','));

    if (attemptsData.length > 0) {
      for (const a of attemptsData) {
        const pid = String(a.participant_id || '');
        const p = participantMap.get(pid);
        const studentLabel = p?.label || `Student ${pid.substring(0, 6)}`;
        const stats = participantStatsMap.get(pid);

        const row = [
          studentLabel,
          pid,
          String(a.id || ''),
          Number(a.attempt_number || 1),
          String(a.quiz_version || 'v1.0'),
          String(a.started_at || ''),
          a.completed_at ? String(a.completed_at) : 'Incomplete',
          String(a.status || 'in_progress'),
          Number(a.score || 0).toFixed(2),
          Number(a.max_score || 10).toFixed(2),
          Number(a.accuracy || 0).toFixed(1),
          Number(a.correct_count || 0),
          Number(a.incorrect_count || 0),
          Number(a.duration_seconds || 0),
          stats ? stats.bestScore.toFixed(2) : Number(a.score || 0).toFixed(2),
        ];
        csvLines.push(row.map(sanitizeCsvValue).join(','));
      }
    } else {
      csvLines.push('"No attempt records found in database"');
    }

    csvLines.push('');
    csvLines.push('');

    // --- SECTION 2: QUESTION BREAKDOWN ---
    csvLines.push('=== QUESTION-LEVEL ATTEMPT BREAKDOWN ===');
    const questionHeaders = [
      'Anonymous Student Label',
      'Attempt ID',
      'Attempt Number',
      'Question Number',
      'Question Category',
      'Is Correct',
      'Submissions Required',
      'Marks Awarded',
      'Time Spent (seconds)',
      'Answered Timestamp (UTC)',
    ];
    csvLines.push(questionHeaders.map(sanitizeCsvValue).join(','));

    if (questionsData.length > 0) {
      for (const q of questionsData) {
        const attId = String(q.attempt_id || '');
        const att = attemptMap.get(attId);
        const studentLabel = att?.studentLabel || 'Student';
        const attemptNumber = att?.attempt_number || 1;

        const row = [
          studentLabel,
          attId,
          attemptNumber,
          `Question ${q.question_number || 1}`,
          String(q.question_category || 'General'),
          q.is_correct ? 'Correct' : 'Incorrect',
          Number(q.submissions_required || 1),
          Number(q.score_awarded || 0).toFixed(2),
          Number(q.time_spent_seconds || 0),
          String(q.answered_at || ''),
        ];
        csvLines.push(row.map(sanitizeCsvValue).join(','));
      }
    } else {
      csvLines.push('"No question-level records found in database"');
    }

    const csvContent = csvLines.join('\r\n');
    const dateStr = new Date().toISOString().split('T')[0];

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="quiz_results_${dateStr}.csv"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': '*',
      },
      body: csvContent,
    };
  } catch (err: unknown) {
    const errorDetails = extractErrorMessage(err);
    console.error('[export-csv] Unhandled database query error during export:', {
      error: errorDetails,
      raw: err,
    });
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Database error during export: Database query failure. Please check server logs or verify database permissions.',
      }),
    };
  }
};
