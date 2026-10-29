import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy,
  RotateCcw,
  BookOpen,
  Award,
  CheckCircle2,
  Clock,
  Sparkles,
  Database,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Target,
} from 'lucide-react';
import { formatDuration } from '../utils/scoring';

export interface QuestionBreakdownItem {
  questionId: number;
  questionNumber: number;
  category?: string;
  submissions: number;
  score: number;
}

interface CompletionScreenProps {
  participantLabel: string;
  attemptNumber: number;
  score: number;
  maxScore: number;
  accuracy: number;
  correctCount: number;
  incorrectCount: number;
  durationSeconds: number;
  questionBreakdown: QuestionBreakdownItem[];
  latestScore: number | null;
  bestScore: number | null;
  totalAttempts: number;
  syncedToSupabase: boolean;
  onRestart: () => void;
  onReview: () => void;
}

export const CompletionScreen: React.FC<CompletionScreenProps> = ({
  participantLabel,
  attemptNumber,
  score,
  maxScore,
  accuracy,
  correctCount,
  incorrectCount,
  durationSeconds,
  questionBreakdown,
  latestScore,
  bestScore,
  totalAttempts,
  syncedToSupabase,
  onRestart,
  onReview,
}) => {
  const [showQuestionDetails, setShowQuestionDetails] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(15, 15, 16, 0.94)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '92vh',
          backgroundColor: '#252526',
          border: '1px solid #3e3e42',
          borderRadius: '10px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            backgroundColor: '#1e1e1e',
            borderBottom: '1px solid #3e3e42',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} color="#007acc" />
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: '#d4d4d4',
                fontFamily: 'var(--font-code)',
                textTransform: 'uppercase',
              }}
            >
              FINAL ASSESSMENT RESULTS
            </span>
          </div>

          {/* Sync Status Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: syncedToSupabase
                ? 'rgba(46, 160, 67, 0.15)'
                : 'rgba(217, 119, 6, 0.15)',
              color: syncedToSupabase ? '#4ec9b0' : '#f59e0b',
              border: `1px solid ${
                syncedToSupabase
                  ? 'rgba(78, 201, 176, 0.3)'
                  : 'rgba(245, 158, 11, 0.3)'
              }`,
            }}
          >
            {syncedToSupabase ? (
              <>
                <Database size={13} />
                <span>Saved to Supabase</span>
              </>
            ) : (
              <>
                <AlertCircle size={13} />
                <span>Saved Locally (Pending Sync)</span>
              </>
            )}
          </div>
        </div>

        {/* Scrollable Main Body */}
        <div
          style={{
            padding: '24px 28px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Header Trophy & Title */}
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(78, 201, 176, 0.15)',
                border: '2px solid #4ec9b0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
              }}
            >
              <Trophy size={32} color="#4ec9b0" />
            </div>

            <h1
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: '#ffffff',
                marginBottom: '6px',
              }}
            >
              Assessment Completed!
            </h1>

            {/* Participant & Attempt Badges */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                marginTop: '6px',
              }}
            >
              <span
                style={{
                  backgroundColor: '#007acc',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: '4px',
                  fontFamily: 'var(--font-code)',
                }}
              >
                {participantLabel}
              </span>
              <span
                style={{
                  backgroundColor: '#333333',
                  color: '#d4d4d4',
                  fontSize: '12px',
                  fontWeight: 500,
                  padding: '3px 10px',
                  borderRadius: '4px',
                  fontFamily: 'var(--font-code)',
                }}
              >
                Attempt #{attemptNumber}
              </span>
              <span
                style={{
                  backgroundColor: 'rgba(46, 160, 67, 0.2)',
                  color: '#4ec9b0',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: '4px',
                  border: '1px solid rgba(78, 201, 176, 0.4)',
                }}
              >
                Status: Completed
              </span>
            </div>
          </div>

          {/* Core Score Metrics Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
            }}
          >
            {/* Score */}
            <div
              style={{
                backgroundColor: '#1e1e1e',
                border: '1px solid #3e3e42',
                borderRadius: '6px',
                padding: '12px 10px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  color: '#4ec9b0',
                  fontFamily: 'var(--font-code)',
                }}
              >
                {score.toFixed(1)} / {maxScore}
              </div>
              <div style={{ fontSize: '11px', color: '#858585', marginTop: '2px' }}>
                Score (Graduated)
              </div>
            </div>

            {/* Accuracy */}
            <div
              style={{
                backgroundColor: '#1e1e1e',
                border: '1px solid #3e3e42',
                borderRadius: '6px',
                padding: '12px 10px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  color: '#007acc',
                  fontFamily: 'var(--font-code)',
                }}
              >
                {accuracy}%
              </div>
              <div style={{ fontSize: '11px', color: '#858585', marginTop: '2px' }}>
                Accuracy Rate
              </div>
            </div>

            {/* Duration */}
            <div
              style={{
                backgroundColor: '#1e1e1e',
                border: '1px solid #3e3e42',
                borderRadius: '6px',
                padding: '12px 10px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  color: '#ffd166',
                  fontFamily: 'var(--font-code)',
                }}
              >
                {formatDuration(durationSeconds)}
              </div>
              <div style={{ fontSize: '11px', color: '#858585', marginTop: '2px' }}>
                Completion Time
              </div>
            </div>
          </div>

          {/* Submissions & Historical Comparison (Latest vs Best) */}
          <div
            style={{
              backgroundColor: '#1e1e1e',
              border: '1px solid #333333',
              borderRadius: '6px',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cccccc' }}>
              <span>Correct Questions Finalized:</span>
              <strong style={{ color: '#4ec9b0' }}>{correctCount} / 10</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cccccc' }}>
              <span>Total Submissions Required:</span>
              <span style={{ color: '#d4d4d4' }}>
                {correctCount + incorrectCount} ({incorrectCount} retry attempts)
              </span>
            </div>

            <div
              style={{
                height: '1px',
                backgroundColor: '#2e2e2e',
                margin: '4px 0',
              }}
            />

            {/* Latest & Best Stats */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#9da3ae' }}>
                <Clock size={13} />
                <span>Latest Attempt Score:</span>
              </div>
              <strong style={{ color: '#ffffff', fontFamily: 'var(--font-code)' }}>
                {latestScore !== null ? `${latestScore.toFixed(1)} / 10` : `${score.toFixed(1)} / 10`}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#9da3ae' }}>
                <Sparkles size={13} color="#ffd166" />
                <span>Best Attempt Score:</span>
              </div>
              <strong style={{ color: '#ffd166', fontFamily: 'var(--font-code)' }}>
                {bestScore !== null ? `${bestScore.toFixed(1)} / 10` : `${score.toFixed(1)} / 10`}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#9da3ae' }}>
                <Target size={13} />
                <span>Total Historical Attempts:</span>
              </div>
              <span style={{ color: '#d4d4d4', fontFamily: 'var(--font-code)' }}>
                {Math.max(attemptNumber, totalAttempts)}
              </span>
            </div>
          </div>

          {/* Toggleable Question-Wise Results Breakdown */}
          <div style={{ border: '1px solid #3e3e42', borderRadius: '6px', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setShowQuestionDetails(!showQuestionDetails)}
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: '#202022',
                border: 'none',
                color: '#d4d4d4',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
            >
              <span>Question-by-Question Marks Breakdown</span>
              {showQuestionDetails ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {showQuestionDetails && (
              <div
                style={{
                  maxHeight: '180px',
                  overflowY: 'auto',
                  backgroundColor: '#1a1a1c',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                {questionBreakdown.map((q) => (
                  <div
                    key={q.questionId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      backgroundColor: '#252528',
                      fontSize: '11px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={13} color="#4ec9b0" />
                      <span style={{ fontWeight: 600, color: '#ffffff' }}>
                        Q{q.questionNumber}
                      </span>
                      {q.category && (
                        <span style={{ color: '#858585' }}>({q.category})</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ color: '#9da3ae' }}>
                        {q.submissions} {q.submissions === 1 ? 'submission' : 'submissions'}
                      </span>
                      <span
                        style={{
                          fontWeight: 700,
                          color: q.score === 1.0 ? '#4ec9b0' : q.score >= 0.6 ? '#ffd166' : '#f14c4c',
                          fontFamily: 'var(--font-code)',
                        }}
                      >
                        +{q.score.toFixed(1)} pts
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons: Try Again & Review Questions */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '4px' }}>
            <button
              onClick={onRestart}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: '#2ea043',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '12px 20px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(46, 160, 67, 0.4)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#388a34';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#2ea043';
              }}
            >
              <RotateCcw size={15} />
              <span>Try Again (New Attempt)</span>
            </button>

            <button
              onClick={onReview}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: '#2d2d2d',
                color: '#d4d4d4',
                border: '1px solid #3e3e42',
                borderRadius: '6px',
                padding: '12px 20px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#007acc';
                e.currentTarget.style.backgroundColor = 'rgba(0, 122, 204, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#3e3e42';
                e.currentTarget.style.backgroundColor = '#2d2d2d';
              }}
            >
              <BookOpen size={15} />
              <span>Review Questions</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
