import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Question } from '../types';
import { CheckCircle2, XCircle, Play, Sparkles, Send, HelpCircle } from 'lucide-react';

interface QuizPopupProps {
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  completedCount: number;
  onAnswerCorrect: (questionId: number) => void;
  onContinue: () => void;
  onAttempt: (questionId: number) => void;
}

export const QuizPopup: React.FC<QuizPopupProps> = ({
  question,
  questionIndex,
  totalQuestions,
  completedCount,
  onAnswerCorrect,
  onContinue,
  onAttempt,
}) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  // Reset local state when a new question is loaded
  useEffect(() => {
    setSelectedOption(null);
    setTextInput('');
    setSubmitted(false);
    setIsCorrect(null);
    setFeedbackMessage('');
  }, [question.id]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isCorrect) return; // already solved

    onAttempt(question.id);

    if (question.type === 'mcq' || question.type === 'true_false') {
      if (!selectedOption) {
        setFeedbackMessage('Please select an option before submitting.');
        setIsCorrect(false);
        setSubmitted(true);
        return;
      }

      // Check if selected option matches correctAnswer (e.g. 'B' or 'A')
      const matches = selectedOption.trim().toUpperCase() === question.correctAnswer.trim().toUpperCase();

      if (matches) {
        setIsCorrect(true);
        setFeedbackMessage('Correct answer!');
        setSubmitted(true);
        onAnswerCorrect(question.id);
      } else {
        setIsCorrect(false);
        setFeedbackMessage('Incorrect answer. Please try again.');
        setSubmitted(true);
      }
    } else if (question.type === 'one_word') {
      const normalizedInput = textInput.trim().toLowerCase();
      const normalizedExpected = question.correctAnswer.trim().toLowerCase();

      if (!normalizedInput) {
        setFeedbackMessage('Please type an answer before submitting.');
        setIsCorrect(false);
        setSubmitted(true);
        return;
      }

      if (normalizedInput === normalizedExpected) {
        setIsCorrect(true);
        setFeedbackMessage('Correct answer!');
        setSubmitted(true);
        onAnswerCorrect(question.id);
      } else {
        setIsCorrect(false);
        setFeedbackMessage('Incorrect answer. Please try again.');
        setSubmitted(true);
      }
    }
  };

  const handleSelectCard = (label: string) => {
    if (isCorrect) return; // locked once correct
    setSelectedOption(label);
    if (submitted && !isCorrect) {
      // Clear error state on new selection attempt
      setSubmitted(false);
      setIsCorrect(null);
      setFeedbackMessage('');
    }
  };

  // Formatted question number, e.g. "QUESTION 03 / 10"
  const questionNumberFormatted = `QUESTION ${String(questionIndex + 1).padStart(2, '0')} / ${String(totalQuestions).padStart(2, '0')}`;
  const progressPercent = Math.round((completedCount / totalQuestions) * 100);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(15, 15, 16, 0.78)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 40,
        padding: '20px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: '100%',
          maxWidth: '680px',
          backgroundColor: '#252526',
          border: '1px solid #3e3e42',
          borderRadius: '8px',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* VS Code Window Header for Quiz */}
        <div
          style={{
            backgroundColor: '#1e1e1e',
            borderBottom: '1px solid #3e3e42',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                backgroundColor: '#007acc',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                padding: '3px 8px',
                borderRadius: '3px',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-code)',
              }}
            >
              INTERACTIVE QUIZ
            </span>

            <span
              style={{
                color: '#9da3ae',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.05em',
                fontFamily: 'var(--font-code)',
              }}
            >
              {questionNumberFormatted}
            </span>
          </div>

          {/* Progress Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#858585', fontFamily: 'var(--font-code)' }}>
              {completedCount} of {totalQuestions} Done ({progressPercent}%)
            </span>
            <div
              style={{
                width: '70px',
                height: '6px',
                backgroundColor: '#3e3e42',
                borderRadius: '3px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  backgroundColor: '#007acc',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px 28px', backgroundColor: '#252526' }}>
          {/* Category Tag */}
          {question.category && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                color: '#4ec9b0',
                backgroundColor: 'rgba(78, 201, 176, 0.1)',
                border: '1px solid rgba(78, 201, 176, 0.25)',
                padding: '2px 8px',
                borderRadius: '4px',
                marginBottom: '12px',
                fontFamily: 'var(--font-code)',
              }}
            >
              <Sparkles size={12} />
              <span>{question.category}</span>
            </div>
          )}

          {/* Question Text */}
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#d4d4d4',
              lineHeight: 1.45,
              marginBottom: '20px',
            }}
          >
            {question.question}
          </h2>

          {/* Options Display according to Question Type */}
          {(question.type === 'mcq' || question.type === 'true_false') && question.options && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: question.type === 'true_false' ? '1fr 1fr' : '1fr',
                gap: '10px',
                marginBottom: '20px',
              }}
            >
              {question.options.map((opt) => {
                const isSelected = selectedOption === opt.label;
                const isCardCorrect = isCorrect && isSelected;

                let cardBg = '#1e1e1e';
                let borderColor = '#3e3e42';
                let textColor = '#d4d4d4';

                if (isSelected) {
                  cardBg = 'rgba(0, 122, 204, 0.18)';
                  borderColor = '#007acc';
                }

                if (isCardCorrect) {
                  cardBg = 'rgba(78, 201, 176, 0.15)';
                  borderColor = '#4ec9b0';
                  textColor = '#ffffff';
                }

                return (
                  <motion.button
                    key={opt.label}
                    type="button"
                    onClick={() => handleSelectCard(opt.label)}
                    disabled={isCorrect === true}
                    whileHover={
                      !isCorrect
                        ? {
                            scale: 1.008,
                            borderColor: '#007acc',
                            backgroundColor: isSelected ? 'rgba(0, 122, 204, 0.22)' : 'rgba(0, 122, 204, 0.08)',
                          }
                        : {}
                    }
                    whileTap={!isCorrect ? { scale: 0.995 } : {}}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      textAlign: 'left',
                      padding: question.type === 'true_false' ? '16px 20px' : '12px 18px',
                      backgroundColor: cardBg,
                      border: `1px solid ${borderColor}`,
                      borderRadius: '6px',
                      color: textColor,
                      cursor: isCorrect ? 'default' : 'pointer',
                      transition: 'background-color 0.15s ease, border-color 0.15s ease',
                      position: 'relative',
                      userSelect: 'none',
                    }}
                  >
                    {/* Option letter pill */}
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '4px',
                        backgroundColor: isSelected ? '#007acc' : '#2d2d2d',
                        color: isSelected ? '#ffffff' : '#9da3ae',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-code)',
                        fontSize: '13px',
                        fontWeight: 600,
                        marginRight: '14px',
                        flexShrink: 0,
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      {opt.label}
                    </div>

                    <span style={{ fontSize: '15px', fontWeight: 500, flex: 1 }}>{opt.text}</span>

                    {/* Check icon if correct */}
                    {isCardCorrect && (
                      <CheckCircle2 size={18} color="#4ec9b0" style={{ marginLeft: '10px' }} />
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* One-Word Text Input */}
          {question.type === 'one_word' && (
            <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
              <label
                htmlFor="one-word-answer"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#9da3ae',
                  marginBottom: '8px',
                  fontFamily: 'var(--font-code)',
                }}
              >
                Type your answer below (case-insensitive):
              </label>

              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  id="one-word-answer"
                  type="text"
                  value={textInput}
                  onChange={(e) => {
                    setTextInput(e.target.value);
                    if (submitted && !isCorrect) {
                      setSubmitted(false);
                      setIsCorrect(null);
                      setFeedbackMessage('');
                    }
                  }}
                  disabled={isCorrect === true}
                  placeholder="Enter exact answer..."
                  autoFocus
                  style={{
                    flex: 1,
                    backgroundColor: '#1e1e1e',
                    border: isCorrect
                      ? '1px solid #4ec9b0'
                      : submitted && !isCorrect
                      ? '1px solid #f14c4c'
                      : '1px solid #3e3e42',
                    borderRadius: '6px',
                    padding: '12px 16px',
                    color: '#d4d4d4',
                    fontSize: '15px',
                    fontFamily: 'var(--font-code)',
                  }}
                />

                {!isCorrect && (
                  <button
                    type="submit"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#007acc',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0 20px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    <Send size={15} />
                    <span>Submit</span>
                  </button>
                )}
              </div>
            </form>
          )}

          {/* Feedback Display */}
          <AnimatePresence mode="wait">
            {submitted && feedbackMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '6px',
                  backgroundColor: isCorrect ? 'rgba(78, 201, 176, 0.12)' : 'rgba(241, 76, 76, 0.12)',
                  border: `1px solid ${isCorrect ? 'rgba(78, 201, 176, 0.4)' : 'rgba(241, 76, 76, 0.4)'}`,
                  marginBottom: '20px',
                }}
              >
                {isCorrect ? (
                  <CheckCircle2 size={20} color="#4ec9b0" style={{ flexShrink: 0, marginTop: '2px' }} />
                ) : (
                  <XCircle size={20} color="#f14c4c" style={{ flexShrink: 0, marginTop: '2px' }} />
                )}

                <div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: isCorrect ? '#4ec9b0' : '#f14c4c',
                      marginBottom: isCorrect ? '4px' : '0',
                    }}
                  >
                    {feedbackMessage}
                  </div>

                  {isCorrect && question.explanation && (
                    <div
                      style={{
                        fontSize: '13px',
                        color: '#d4d4d4',
                        lineHeight: 1.4,
                      }}
                    >
                      {question.explanation}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom Action Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '12px',
              borderTop: '1px solid #333333',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#858585', fontSize: '12px' }}>
              <HelpCircle size={14} />
              <span>
                {isCorrect
                  ? 'Great job! Click Continue Video to resume playback.'
                  : 'Select an option and submit to advance.'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              {/* SUBMIT ANSWER button (for MCQ / T/F when not yet correct) */}
              {!isCorrect && (question.type === 'mcq' || question.type === 'true_false') && (
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  style={{
                    backgroundColor: selectedOption ? '#007acc' : '#2d2d2d',
                    color: selectedOption ? '#ffffff' : '#858585',
                    border: '1px solid #3e3e42',
                    borderRadius: '4px',
                    padding: '8px 20px',
                    fontSize: '13px',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    cursor: selectedOption ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s ease',
                  }}
                >
                  SUBMIT ANSWER
                </button>
              )}

              {/* CONTINUE VIDEO button (Shown ONLY after the correct answer) */}
              {isCorrect && (
                <motion.button
                  type="button"
                  onClick={onContinue}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  whileHover={{ scale: 1.03, backgroundColor: '#388a34' }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: '#2ea043',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '9px 24px',
                    fontSize: '13px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(46, 160, 67, 0.4)',
                  }}
                >
                  <Play size={15} fill="#ffffff" />
                  <span>CONTINUE VIDEO</span>
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
