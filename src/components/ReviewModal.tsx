import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, CheckCircle, Clock, BookOpen, Play } from 'lucide-react';
import { Question } from '../types';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  answeredQuestionIds: number[];
  onSeekTo: (timestamp: number) => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  questions,
  answeredQuestionIds,
  onSeekTo,
}) => {
  const [selectedIdx, setSelectedIdx] = useState(0);

  if (!isOpen) return null;

  const currentQ = questions[selectedIdx];
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '20px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        style={{
          width: '100%',
          maxWidth: '850px',
          height: '560px',
          backgroundColor: '#252526',
          border: '1px solid #3e3e42',
          borderRadius: '8px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: '#1e1e1e',
            borderBottom: '1px solid #3e3e42',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={18} color="#007acc" />
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#d4d4d4',
                fontFamily: 'var(--font-code)',
              }}
            >
              Quiz Checkpoints Review (10 Questions)
            </span>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#858585',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content columns */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left question list */}
          <div
            style={{
              width: '280px',
              borderRight: '1px solid #3e3e42',
              backgroundColor: '#1e1e1e',
              overflowY: 'auto',
            }}
          >
            {questions.map((q, idx) => {
              const isSelected = selectedIdx === idx;
              const isCompleted = answeredQuestionIds.includes(q.id);

              return (
                <div
                  key={q.id}
                  onClick={() => setSelectedIdx(idx)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #2d2d30',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? '#252526' : 'transparent',
                    borderLeft: isSelected ? '3px solid #007acc' : '3px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '11px',
                        fontFamily: 'var(--font-code)',
                        color: isSelected ? '#007acc' : '#858585',
                        fontWeight: 600,
                      }}
                    >
                      QUESTION {String(idx + 1).padStart(2, '0')}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#d4d4d4',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '180px',
                        marginTop: '2px',
                      }}
                    >
                      {q.question}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        color: '#6e7681',
                        fontFamily: 'var(--font-code)',
                      }}
                    >
                      {formatTime(q.timestamp)}
                    </span>
                    {isCompleted ? (
                      <CheckCircle size={14} color="#4ec9b0" />
                    ) : (
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: '#555555',
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Question Detail */}
          <div
            style={{
              flex: 1,
              padding: '24px',
              overflowY: 'auto',
              backgroundColor: '#252526',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-code)',
                    backgroundColor: 'rgba(0, 122, 204, 0.2)',
                    color: '#007acc',
                    padding: '2px 8px',
                    borderRadius: '3px',
                    fontWeight: 600,
                  }}
                >
                  QUESTION {String(selectedIdx + 1).padStart(2, '0')}
                </span>

                <span
                  style={{
                    fontSize: '11px',
                    color: '#9da3ae',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontFamily: 'var(--font-code)',
                  }}
                >
                  <Clock size={12} />
                  Timestamp: {formatTime(currentQ.timestamp)}
                </span>
              </div>

              <button
                onClick={() => {
                  onSeekTo(currentQ.timestamp);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#2d2d2d',
                  border: '1px solid #3e3e42',
                  color: '#d4d4d4',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
                title="Jump to this question in video"
              >
                <Play size={12} fill="#007acc" color="#007acc" />
                <span>Jump in Video</span>
              </button>
            </div>

            <h3
              style={{
                fontSize: '17px',
                color: '#ffffff',
                lineHeight: 1.4,
                marginBottom: '20px',
              }}
            >
              {currentQ.question}
            </h3>

            {/* Options display */}
            {currentQ.options && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {currentQ.options.map((opt) => {
                  const isCorrect = opt.label === currentQ.correctAnswer;
                  return (
                    <div
                      key={opt.label}
                      style={{
                        padding: '10px 14px',
                        backgroundColor: isCorrect ? 'rgba(78, 201, 176, 0.12)' : '#1e1e1e',
                        border: `1px solid ${isCorrect ? '#4ec9b0' : '#3e3e42'}`,
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color: isCorrect ? '#4ec9b0' : '#858585',
                            fontFamily: 'var(--font-code)',
                            fontSize: '12px',
                          }}
                        >
                          {opt.label})
                        </span>
                        <span style={{ fontSize: '14px', color: isCorrect ? '#ffffff' : '#d4d4d4' }}>
                          {opt.text}
                        </span>
                      </div>

                      {isCorrect && (
                        <span
                          style={{
                            fontSize: '11px',
                            color: '#4ec9b0',
                            fontFamily: 'var(--font-code)',
                            fontWeight: 600,
                          }}
                        >
                          Correct Answer
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {currentQ.type === 'one_word' && (
              <div
                style={{
                  padding: '14px',
                  backgroundColor: 'rgba(78, 201, 176, 0.12)',
                  border: '1px solid #4ec9b0',
                  borderRadius: '6px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ fontSize: '11px', color: '#4ec9b0', fontFamily: 'var(--font-code)', marginBottom: '4px' }}>
                  EXPECTED ONE-WORD ANSWER
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', fontFamily: 'var(--font-code)' }}>
                  "{currentQ.correctAnswer}"
                </div>
              </div>
            )}

            {/* Explanation box */}
            <div
              style={{
                backgroundColor: '#1e1e1e',
                border: '1px solid #333333',
                borderRadius: '6px',
                padding: '14px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  color: '#9da3ae',
                  fontFamily: 'var(--font-code)',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                }}
              >
                Explanation & Learning Note:
              </div>
              <p style={{ fontSize: '13px', color: '#d4d4d4', lineHeight: 1.5 }}>
                {currentQ.explanation}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
