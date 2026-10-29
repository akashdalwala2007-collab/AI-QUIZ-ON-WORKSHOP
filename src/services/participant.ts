/**
 * Anonymous Participant Management
 * 
 * Requirements:
 * - Generates cryptographically secure random UUID and matching secret token.
 * - Persisted in browser storage (localStorage) for repeat attempts.
 * - Zero PII: No names, roll numbers, emails, phone numbers, or device fingerprints.
 * - Secret token authenticates the participant to prevent ID impersonation on Supabase.
 * - Active attempt ID preserved in sessionStorage to prevent accidental reloads creating duplicate records.
 */

const PARTICIPANT_ID_KEY = 'anonymous_quiz_participant_id';
const PARTICIPANT_SECRET_KEY = 'anonymous_quiz_participant_secret';
const PARTICIPANT_LABEL_KEY = 'anonymous_quiz_participant_label';
const ACTIVE_ATTEMPT_ID_KEY = 'anonymous_quiz_active_attempt_id';
const LOCAL_ATTEMPTS_KEY = 'anonymous_quiz_local_attempts';

export interface LocalAttemptRecord {
  id: string;
  participantId: string;
  attemptNumber: number;
  quizVersion: string;
  status: 'in_progress' | 'completed';
  startedAt: string;
  completedAt?: string;
  durationSeconds: number;
  score: number;
  maxScore: number;
  accuracy: number;
  correctCount: number;
  incorrectCount: number;
  questionResults: Record<number, {
    questionId: number;
    submissions: number;
    score: number;
    category?: string;
  }>;
}

/**
 * Generate or retrieve the anonymous participant UUID
 */
export const getOrCreateParticipantId = (): string => {
  try {
    let id = localStorage.getItem(PARTICIPANT_ID_KEY);
    if (!id || !isValidUUID(id)) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : generateFallbackUUID();
      localStorage.setItem(PARTICIPANT_ID_KEY, id);
    }
    return id;
  } catch {
    return generateFallbackUUID();
  }
};

/**
 * Generate or retrieve the cryptographically secure secret token for participant authentication
 */
export const getOrCreateParticipantSecret = (): string => {
  try {
    let secret = localStorage.getItem(PARTICIPANT_SECRET_KEY);
    if (!secret || secret.length < 32) {
      const part1 = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : generateFallbackUUID();
      const part2 = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : generateFallbackUUID();
      secret = `${part1.replace(/-/g, '')}${part2.replace(/-/g, '')}`;
      localStorage.setItem(PARTICIPANT_SECRET_KEY, secret);
    }
    return secret;
  } catch {
    return `${generateFallbackUUID().replace(/-/g, '')}${generateFallbackUUID().replace(/-/g, '')}`;
  }
};

/**
 * Retrieve current display label (defaults to 'Student 1' if not yet fetched)
 */
export const getStoredParticipantLabel = (): string => {
  try {
    return localStorage.getItem(PARTICIPANT_LABEL_KEY) || 'Student 1';
  } catch {
    return 'Student 1';
  }
};

/**
 * Save persistent display label once assigned by Supabase
 */
export const setStoredParticipantLabel = (label: string): void => {
  try {
    localStorage.setItem(PARTICIPANT_LABEL_KEY, label);
  } catch {
    // ignore
  }
};

/**
 * Active Attempt ID Management: prevents browser refreshes from spawning multiple orphan attempts
 */
export const getActiveAttemptId = (): string | null => {
  try {
    return sessionStorage.getItem(ACTIVE_ATTEMPT_ID_KEY) || localStorage.getItem(ACTIVE_ATTEMPT_ID_KEY);
  } catch {
    return null;
  }
};

export const setActiveAttemptId = (id: string): void => {
  try {
    sessionStorage.setItem(ACTIVE_ATTEMPT_ID_KEY, id);
    localStorage.setItem(ACTIVE_ATTEMPT_ID_KEY, id);
  } catch {
    // ignore
  }
};

export const clearActiveAttemptId = (): void => {
  try {
    sessionStorage.removeItem(ACTIVE_ATTEMPT_ID_KEY);
    localStorage.removeItem(ACTIVE_ATTEMPT_ID_KEY);
  } catch {
    // ignore
  }
};

/**
 * Get all local attempts from localStorage (used for offline tracking and fallback)
 */
export const getLocalAttempts = (): LocalAttemptRecord[] => {
  try {
    const raw = localStorage.getItem(LOCAL_ATTEMPTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * Save an attempt to local storage
 */
export const saveLocalAttempt = (attempt: LocalAttemptRecord): void => {
  try {
    const attempts = getLocalAttempts();
    const existingIndex = attempts.findIndex((a) => a.id === attempt.id);
    if (existingIndex >= 0) {
      attempts[existingIndex] = attempt;
    } else {
      attempts.push(attempt);
    }
    localStorage.setItem(LOCAL_ATTEMPTS_KEY, JSON.stringify(attempts));
  } catch (err) {
    console.warn('Failed to save attempt to localStorage:', err);
  }
};

/**
 * Calculate latest and best attempt stats from local storage (Offline Option C)
 */
export const calculateLocalParticipantStats = (participantId: string) => {
  const attempts = getLocalAttempts()
    .filter((a) => a.participantId === participantId && a.status === 'completed');

  if (attempts.length === 0) {
    return {
      totalAttempts: 0,
      latestScore: null,
      bestScore: null,
      latestAccuracy: null,
      bestAccuracy: null,
      latestDurationSeconds: null,
      latestCompletedAt: null,
    };
  }

  // Sort by completedAt descending for latest
  const sortedByTime = [...attempts].sort((a, b) => {
    return new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime();
  });
  const latest = sortedByTime[0];

  // Sort by score desc, then duration asc for best
  const sortedByBest = [...attempts].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.durationSeconds - b.durationSeconds;
  });
  const best = sortedByBest[0];

  return {
    totalAttempts: attempts.length,
    latestScore: latest.score,
    bestScore: best.score,
    latestAccuracy: latest.accuracy,
    bestAccuracy: best.accuracy,
    latestDurationSeconds: latest.durationSeconds,
    latestCompletedAt: latest.completedAt || null,
  };
};

function isValidUUID(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

function generateFallbackUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
