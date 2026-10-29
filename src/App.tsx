import React, { useState, useEffect, useRef } from 'react';
import { QUIZ_CONFIG } from './config/quizConfig';
import { Question, ParticipantStats } from './types';
import { VSCodeStatusBar } from './components/VSCodeStatusBar';
import { VideoPlayer } from './components/VideoPlayer';
import { IntroVideoPlayer } from './components/IntroVideoPlayer';
import { QuizPopup } from './components/QuizPopup';
import { CompletionScreen, QuestionBreakdownItem } from './components/CompletionScreen';
import { ReviewModal } from './components/ReviewModal';
import { AdminExportModal } from './components/AdminExportModal';
import {
  getOrCreateParticipantId,
  getOrCreateParticipantSecret,
  getStoredParticipantLabel,
  getActiveAttemptId,
  setActiveAttemptId,
  clearActiveAttemptId,
} from './services/participant';
import {
  initParticipantSession,
  startAttemptRecord,
  recordQuestionSubmission,
  finalizeAttemptRecord,
} from './services/supabase';
import { calculateQuestionScore, calculateTotalScore, calculateAccuracy } from './utils/scoring';

export const App: React.FC = () => {
  // Participant & Cryptographic Secret Authentication
  const [participantId] = useState<string>(() => getOrCreateParticipantId());
  const participantSecretRef = useRef<string>(getOrCreateParticipantSecret());
  const [participantLabel, setParticipantLabel] = useState<string>(() => getStoredParticipantLabel());

  // Attempt Lifecycle: Resumes active in-progress attempt across refreshes to prevent orphan records
  const [attemptId, setAttemptId] = useState<string>(() => {
    const existing = getActiveAttemptId();
    if (existing) return existing;
    const fresh =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `att-${Date.now()}`;
    setActiveAttemptId(fresh);
    return fresh;
  });

  const [attemptNumber, setAttemptNumber] = useState<number>(1);
  const [participantStats, setParticipantStats] = useState<ParticipantStats>({
    totalAttempts: 0,
    latestScore: null,
    bestScore: null,
    latestAccuracy: null,
    bestAccuracy: null,
    latestDurationSeconds: null,
    latestCompletedAt: null,
  });

  // Quiz Interaction State
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<number[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [attemptsPerQuestion, setAttemptsPerQuestion] = useState<Record<number, number>>({});
  const [questionResultsMap, setQuestionResultsMap] = useState<
    Record<number, QuestionBreakdownItem>
  >({});

  // Lifecycle State
  const [showIntro, setShowIntro] = useState(true);
  const [mainVideoAutoPlay, setMainVideoAutoPlay] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isAdminExportOpen, setIsAdminExportOpen] = useState(false);
  const [seekTargetTime, setSeekTargetTime] = useState<number | null>(null);
  const [syncedToSupabase, setSyncedToSupabase] = useState(false);

  // Timing & Finalization Guard (prevents race-condition double finalization)
  const sessionStartTimeRef = useRef<number>(Date.now());
  const isFinalizingRef = useRef<boolean>(false);
  const [finalDurationSeconds, setFinalDurationSeconds] = useState(0);

  // Transition from Intro Video to Main Interactive Quiz Experience
  const handleIntroComplete = () => {
    setShowIntro(false);
    setMainVideoAutoPlay(true);
    sessionStartTimeRef.current = Date.now();
  };

  const totalQuestions = QUIZ_CONFIG.questions.length;
  const completedCount = answeredQuestionIds.length;

  // Initialize Anonymous Participant on mount
  useEffect(() => {
    let mounted = true;

    const setupSession = async () => {
      const res = await initParticipantSession(participantId, participantSecretRef.current);
      if (mounted) {
        setParticipantLabel(res.label);
        setParticipantStats(res.stats);

        // Start initial attempt record
        const startRes = await startAttemptRecord(
          attemptId,
          participantId,
          participantSecretRef.current,
          'v1.0'
        );
        if (mounted) {
          setAttemptNumber(startRes.attemptNumber);
        }
      }
    };

    setupSession();

    return () => {
      mounted = false;
    };
  }, [participantId, attemptId]);

  // When a question checkpoint is reached during video playback
  const handleTriggerQuestion = (question: Question) => {
    setActiveQuestion(question);
  };

  // Track attempt submissions for the active question
  const handleAttempt = (questionId: number) => {
    setAttemptsPerQuestion((prev) => ({
      ...prev,
      [questionId]: (prev[questionId] || 0) + 1,
    }));
  };

  // When student submits the correct answer
  const handleAnswerCorrect = (questionId: number) => {
    if (!answeredQuestionIds.includes(questionId)) {
      setAnsweredQuestionIds((prev) => [...prev, questionId]);

      // Calculate score for this question using Phase 3 graduated submission rules
      const submissions = (attemptsPerQuestion[questionId] || 0) + 1;
      const score = calculateQuestionScore(submissions);
      const questionIndex = QUIZ_CONFIG.questions.findIndex((q) => q.id === questionId);
      const questionConfig = QUIZ_CONFIG.questions[questionIndex];

      const item: QuestionBreakdownItem = {
        questionId,
        questionNumber: questionIndex + 1,
        category: questionConfig?.category,
        submissions,
        score,
      };

      setQuestionResultsMap((prev) => ({
        ...prev,
        [questionId]: item,
      }));

      // Asynchronously record question result authenticated by secret token
      recordQuestionSubmission({
        attemptId,
        secretToken: participantSecretRef.current,
        questionId,
        questionNumber: questionIndex + 1,
        category: questionConfig?.category,
        submissions,
        timeSpent: 0,
      });
    }
  };

  // When student clicks "CONTINUE VIDEO" after answering correctly
  const handleContinue = () => {
    setActiveQuestion(null);
  };

  // Video playback reaches the end
  const handleVideoEnded = async () => {
    if (completedCount === totalQuestions && !isCompleted && !isFinalizingRef.current) {
      isFinalizingRef.current = true;
      const duration = Math.max(1, Math.round((Date.now() - sessionStartTimeRef.current) / 1000));
      setFinalDurationSeconds(duration);

      // Finalize attempt in Supabase & local storage
      const result = await finalizeAttemptRecord({
        attemptId,
        participantId,
        secretToken: participantSecretRef.current,
        durationSeconds: duration,
        questionResults: questionResultsMap,
      });

      // Clear active attempt from session storage so next session starts clean
      clearActiveAttemptId();

      setParticipantStats(result.stats);
      setSyncedToSupabase(result.syncedToSupabase);
      setIsCompleted(true);
    }
  };

  // Restart video and start a brand new attempt (preserving previous attempts)
  const handleRestart = async () => {
    const nextAttemptId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `att-${Date.now()}`;

    setActiveAttemptId(nextAttemptId);
    setAttemptId(nextAttemptId);
    setAnsweredQuestionIds([]);
    setActiveQuestion(null);
    setAttemptsPerQuestion({});
    setQuestionResultsMap({});
    setIsCompleted(false);
    isFinalizingRef.current = false;
    setSeekTargetTime(0);
    setMainVideoAutoPlay(true);
    sessionStartTimeRef.current = Date.now();

    // Register new attempt in database
    const startRes = await startAttemptRecord(
      nextAttemptId,
      participantId,
      participantSecretRef.current,
      'v1.0'
    );
    setAttemptNumber(startRes.attemptNumber);
  };

  // Computed metrics for results screen
  const questionBreakdownList: QuestionBreakdownItem[] = Object.values(questionResultsMap).sort(
    (a, b) => a.questionNumber - b.questionNumber
  );

  const finalScore = calculateTotalScore(
    questionBreakdownList.map((q) => ({ scoreAwarded: q.score }))
  );
  const finalAccuracy = calculateAccuracy(completedCount, totalQuestions);
  const totalSubmissionsSum = Object.values(attemptsPerQuestion).reduce(
    (acc, val) => acc + val,
    0
  );
  const totalRetries = Math.max(0, totalSubmissionsSum - completedCount);

  const activeQuestionIndex = activeQuestion
    ? QUIZ_CONFIG.questions.findIndex((q) => q.id === activeQuestion.id)
    : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#1e1e1e',
        overflow: 'hidden',
      }}
    >
      {/* Main Workspace: Center Video Editor */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
        {/* Video Player Canvas */}
        <main
          style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#000000',
            overflow: 'hidden',
          }}
        >
          {showIntro ? (
            <IntroVideoPlayer
              introSrc={QUIZ_CONFIG.introVideoSrc}
              onComplete={handleIntroComplete}
            />
          ) : (
            <VideoPlayer
              videoSrc={QUIZ_CONFIG.videoSrc}
              questions={QUIZ_CONFIG.questions}
              answeredQuestionIds={answeredQuestionIds}
              activeQuestion={activeQuestion}
              onTriggerQuestion={handleTriggerQuestion}
              onVideoEnded={handleVideoEnded}
              seekTargetTime={seekTargetTime}
              onSeekCompleted={() => setSeekTargetTime(null)}
              autoPlay={mainVideoAutoPlay}
            />
          )}

          {/* VS Code-Inspired Slide-Up Quiz Popup */}
          {activeQuestion && (
            <QuizPopup
              question={activeQuestion}
              questionIndex={activeQuestionIndex ?? 0}
              totalQuestions={totalQuestions}
              completedCount={completedCount}
              onAnswerCorrect={handleAnswerCorrect}
              onContinue={handleContinue}
              onAttempt={handleAttempt}
            />
          )}

          {/* Final Results Screen with graduated scoring & latest/best tracking */}
          {isCompleted && (
            <CompletionScreen
              participantLabel={participantLabel}
              attemptNumber={attemptNumber}
              score={finalScore}
              maxScore={10}
              accuracy={finalAccuracy}
              correctCount={completedCount}
              incorrectCount={totalRetries}
              durationSeconds={finalDurationSeconds}
              questionBreakdown={questionBreakdownList}
              latestScore={participantStats.latestScore}
              bestScore={participantStats.bestScore}
              totalAttempts={participantStats.totalAttempts}
              syncedToSupabase={syncedToSupabase}
              onRestart={handleRestart}
              onReview={() => setIsReviewModalOpen(true)}
            />
          )}
        </main>
      </div>

      {/* VS Code Bottom Status Bar with Participant Label & Admin Export */}
      <VSCodeStatusBar
        completedCount={completedCount}
        totalQuestions={totalQuestions}
        currentTimeFormatted="00:00"
        durationFormatted="14:14"
        isLocked={completedCount < totalQuestions}
        participantLabel={participantLabel}
        onOpenAdminExport={() => setIsAdminExportOpen(true)}
      />

      {/* Question Review Modal */}
      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        questions={QUIZ_CONFIG.questions}
        answeredQuestionIds={answeredQuestionIds}
        onSeekTo={(ts) => setSeekTargetTime(ts)}
      />

      {/* Protected Admin CSV Export Modal */}
      <AdminExportModal
        isOpen={isAdminExportOpen}
        onClose={() => setIsAdminExportOpen(false)}
      />
    </div>
  );
};

export default App;
