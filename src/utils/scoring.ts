/**
 * Quiz Scoring Utility - Phase 3 Graduated Submission Rules
 * 
 * Rules:
 * - Correct on 1st submission: 1.0 mark
 * - Correct on 2nd submission: 0.8 marks
 * - Correct on 3rd submission: 0.6 marks
 * - Correct on 4th submission: 0.4 marks
 * - Correct on 5th submission: 0.2 marks
 * - Correct on 6th or later:   0.0 marks
 * 
 * Maximum score: 10.0 marks for 10 questions.
 * Accuracy: (Correct final answers / Total questions answered) * 100
 */

export const calculateQuestionScore = (submissions: number): number => {
  if (submissions <= 1) return 1.0;
  if (submissions === 2) return 0.8;
  if (submissions === 3) return 0.6;
  if (submissions === 4) return 0.4;
  if (submissions === 5) return 0.2;
  return 0.0;
};

export const calculateTotalScore = (
  results: { scoreAwarded: number }[]
): number => {
  const sum = results.reduce((acc, curr) => acc + curr.scoreAwarded, 0);
  return Math.round(sum * 100) / 100;
};

export const calculateAccuracy = (
  correctCount: number,
  totalQuestions: number
): number => {
  if (totalQuestions <= 0) return 0;
  return Math.round((correctCount / totalQuestions) * 100);
};

export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
};
