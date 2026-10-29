import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ParticipantStats } from '../types';
import {
  calculateLocalParticipantStats,
  getLocalAttempts,
  saveLocalAttempt,
  setStoredParticipantLabel,
  LocalAttemptRecord,
} from './participant';
import { calculateQuestionScore, calculateTotalScore, calculateAccuracy } from '../utils/scoring';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseUrl = rawUrl ? String(rawUrl).trim().replace(/^["']|["']$/g, '') : '';
const supabaseAnonKey = rawAnonKey ? String(rawAnonKey).trim().replace(/^["']|["']$/g, '') : '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project') &&
    supabaseUrl.startsWith('https://') &&
    supabaseAnonKey.length > 20
  );
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;

/**
 * Initialize participant in Supabase with cryptographic secret verification or fallback to local storage
 */
export const initParticipantSession = async (
  participantId: string,
  secretToken: string
): Promise<{ label: string; stats: ParticipantStats; isRemote: boolean }> => {
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('register_or_get_participant', {
        p_id: participantId,
        p_secret_token: secretToken,
      });

      if (!error && data) {
        const label = data.label || 'Student 1';
        setStoredParticipantLabel(label);

        // Fetch remote stats authenticated by secret token
        const { data: statsData } = await supabase.rpc('get_participant_stats', {
          p_participant_id: participantId,
          p_secret_token: secretToken,
        });

        const stats: ParticipantStats = {
          totalAttempts: statsData?.total_attempts || 0,
          latestScore: statsData?.latest_score !== undefined ? Number(statsData.latest_score) : null,
          bestScore: statsData?.best_score !== undefined ? Number(statsData.best_score) : null,
          latestAccuracy: statsData?.latest_accuracy !== undefined ? Number(statsData.latest_accuracy) : null,
          bestAccuracy: statsData?.best_accuracy !== undefined ? Number(statsData.best_accuracy) : null,
          latestDurationSeconds: statsData?.latest_duration_seconds || null,
          latestCompletedAt: statsData?.latest_completed_at || null,
        };

        return { label, stats, isRemote: true };
      }
    } catch (err) {
      console.warn('Supabase participant initialization failed, using local fallback:', err);
    }
  }

  // Fallback mode (Supabase unconfigured or offline)
  const localStats = calculateLocalParticipantStats(participantId);
  return {
    label: 'Student 1',
    stats: localStats,
    isRemote: false,
  };
};

/**
 * Start a new attempt authenticated by secret token
 */
export const startAttemptRecord = async (
  attemptId: string,
  participantId: string,
  secretToken: string,
  quizVersion = 'v1.0'
): Promise<{ attemptNumber: number; isRemote: boolean }> => {
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('start_quiz_attempt', {
        p_id: attemptId,
        p_participant_id: participantId,
        p_secret_token: secretToken,
        p_quiz_version: quizVersion,
      });

      if (!error && data) {
        return { attemptNumber: data.attempt_number, isRemote: true };
      }
    } catch (err) {
      console.warn('Supabase start attempt failed, falling back locally:', err);
    }
  }

  // Local fallback: count local completed + current attempts
  const localAttempts = getLocalAttempts().filter((a) => a.participantId === participantId);
  const nextAttemptNum = localAttempts.length + 1;

  const localRecord: LocalAttemptRecord = {
    id: attemptId,
    participantId,
    attemptNumber: nextAttemptNum,
    quizVersion,
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    durationSeconds: 0,
    score: 0,
    maxScore: 10,
    accuracy: 0,
    correctCount: 0,
    incorrectCount: 0,
    questionResults: {},
  };
  saveLocalAttempt(localRecord);

  return { attemptNumber: nextAttemptNum, isRemote: false };
};

/**
 * Save question result validated by secret token and attempt ownership
 */
export const recordQuestionSubmission = async (params: {
  attemptId: string;
  secretToken: string;
  questionId: number;
  questionNumber: number;
  category?: string;
  submissions: number;
  timeSpent: number;
}): Promise<void> => {
  const {
    attemptId,
    secretToken,
    questionId,
    questionNumber,
    category,
    submissions,
    timeSpent,
  } = params;

  const scoreAwarded = calculateQuestionScore(submissions);

  // Always update local storage attempt record
  const localAttempts = getLocalAttempts();
  const attempt = localAttempts.find((a) => a.id === attemptId);
  if (attempt) {
    attempt.questionResults[questionId] = {
      questionId,
      submissions,
      score: scoreAwarded,
      category,
    };
    saveLocalAttempt(attempt);
  }

  // Sync to Supabase if available
  if (supabase) {
    try {
      await supabase.rpc('record_question_result', {
        p_attempt_id: attemptId,
        p_secret_token: secretToken,
        p_question_id: questionId,
        p_question_number: questionNumber,
        p_category: category || 'General',
        p_submissions: submissions,
        p_time_spent: timeSpent,
      });
    } catch (err) {
      console.warn(`Supabase question recording failed for Q${questionId}:`, err);
    }
  }
};

/**
 * Finalize completed attempt with database-side validation
 */
export const finalizeAttemptRecord = async (params: {
  attemptId: string;
  participantId: string;
  secretToken: string;
  durationSeconds: number;
  questionResults: Record<number, {
    questionId: number;
    submissions: number;
    score: number;
    category?: string;
  }>;
}): Promise<{
  score: number;
  accuracy: number;
  stats: ParticipantStats;
  syncedToSupabase: boolean;
}> => {
  const { attemptId, participantId, secretToken, durationSeconds, questionResults } = params;

  // Calculate local verified score
  const resultsList = Object.values(questionResults).map((r) => ({
    scoreAwarded: r.score,
  }));
  const localScore = calculateTotalScore(resultsList);
  const correctCount = Object.keys(questionResults).length;
  const localAccuracy = calculateAccuracy(correctCount, 10);

  // Save to local storage
  const attempts = getLocalAttempts();
  const existing = attempts.find((a) => a.id === attemptId);
  if (existing) {
    existing.status = 'completed';
    existing.completedAt = new Date().toISOString();
    existing.durationSeconds = durationSeconds;
    existing.score = localScore;
    existing.accuracy = localAccuracy;
    existing.correctCount = correctCount;
    saveLocalAttempt(existing);
  }

  // If Supabase is connected, finalize on database
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('finalize_quiz_attempt', {
        p_attempt_id: attemptId,
        p_secret_token: secretToken,
      });

      if (!error && data) {
        // Fetch updated remote stats
        const { data: statsData } = await supabase.rpc('get_participant_stats', {
          p_participant_id: participantId,
          p_secret_token: secretToken,
        });

        const remoteStats: ParticipantStats = {
          totalAttempts: statsData?.total_attempts || 1,
          latestScore: statsData?.latest_score !== undefined ? Number(statsData.latest_score) : data.score,
          bestScore: statsData?.best_score !== undefined ? Number(statsData.best_score) : data.score,
          latestAccuracy: statsData?.latest_accuracy !== undefined ? Number(statsData.latest_accuracy) : data.accuracy,
          bestAccuracy: statsData?.best_accuracy !== undefined ? Number(statsData.best_accuracy) : data.accuracy,
          latestDurationSeconds: statsData?.latest_duration_seconds || durationSeconds,
          latestCompletedAt: statsData?.latest_completed_at || new Date().toISOString(),
        };

        return {
          score: Number(data.score),
          accuracy: Number(data.accuracy),
          stats: remoteStats,
          syncedToSupabase: true,
        };
      }
    } catch (err) {
      console.warn('Supabase finalize attempt failed, returning local state:', err);
    }
  }

  // Fallback to local stats
  const localStats = calculateLocalParticipantStats(participantId);
  return {
    score: localScore,
    accuracy: localAccuracy,
    stats: localStats,
    syncedToSupabase: false,
  };
};
