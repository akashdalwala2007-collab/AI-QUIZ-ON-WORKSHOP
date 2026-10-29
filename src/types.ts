export type QuestionType = 'mcq' | 'true_false' | 'one_word';

export interface QuizOption {
  label: string;
  text: string;
}

export interface Question {
  id: number;
  type: QuestionType;
  timestamp: number; // in seconds
  question: string;
  options?: QuizOption[];
  correctAnswer: string; // for mcq/tf: option label like 'B' or full text; for one_word: exact string
  explanation: string;
  category?: string;
}

export interface QuizProgress {
  answeredQuestionIds: number[];
  currentQuestionId: number | null;
  attemptsPerQuestion: Record<number, number>;
  totalAttempts: number;
  isCompleted: boolean;
}

export interface AnonymousParticipant {
  id: string; // UUID
  participantNumber: number;
  label: string; // 'Student 1', 'Student 2', etc.
  createdAt: string;
}

export type AttemptStatus = 'in_progress' | 'completed' | 'abandoned';

export interface QuizAttempt {
  id: string; // UUID
  participantId: string;
  attemptNumber: number;
  quizVersion: string;
  status: AttemptStatus;
  startedAt: string;
  completedAt?: string;
  durationSeconds: number;
  score: number; // e.g. 9.20
  maxScore: number; // 10.00
  accuracy: number; // percentage, e.g. 100.00
  correctCount: number;
  incorrectCount: number;
  totalSubmissions: number;
}

export interface QuestionAttemptResult {
  id?: string;
  attemptId: string;
  questionId: number;
  questionNumber: number;
  category?: string;
  isCorrect: boolean;
  submissionsRequired: number; // 1, 2, 3, etc.
  scoreAwarded: number; // 1.0, 0.8, 0.6, 0.4, 0.2, 0.0
  timeSpentSeconds: number;
  answeredAt: string;
}

export interface ParticipantStats {
  totalAttempts: number;
  latestScore: number | null;
  bestScore: number | null;
  latestAccuracy: number | null;
  bestAccuracy: number | null;
  latestDurationSeconds: number | null;
  latestCompletedAt: string | null;
}
