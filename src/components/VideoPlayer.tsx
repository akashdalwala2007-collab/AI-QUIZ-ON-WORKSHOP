import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Lock,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Question } from '../types';
import { VOICEOVER_CONFIG, VoiceoverConfig } from '../config/quizConfig';

interface VideoPlayerProps {
  videoSrc: string;
  questions: Question[];
  answeredQuestionIds: number[];
  activeQuestion: Question | null;
  onTriggerQuestion: (question: Question) => void;
  onVideoEnded: () => void;
  seekTargetTime: number | null;
  onSeekCompleted: () => void;
  autoPlay?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoSrc,
  questions,
  answeredQuestionIds,
  activeQuestion,
  onTriggerQuestion,
  onVideoEnded,
  seekTargetTime,
  onSeekCompleted,
  autoPlay = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentSegmentIdRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(854.6);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lockWarning, setLockWarning] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);

  // Helper: map a video timestamp to its corresponding voiceover segment
  const getSegmentForTime = (time: number): VoiceoverConfig | null => {
    for (const segment of VOICEOVER_CONFIG) {
      if (time >= segment.startTime && time < segment.endTime) {
        return segment;
      }
    }
    return null;
  };

  // Immediate voiceover stop & cleanup (ABSOLUTE RULE: No voiceover during MCQs)
  const stopVoiceover = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch (e) {
        // Ignored
      }
    }
    currentSegmentIdRef.current = null;
  }, []);

  // Synchronize and play the voiceover corresponding to a video timestamp
  const playVoiceoverForTime = useCallback(
    (time: number) => {
      // ABSOLUTE RULE: Never play voiceovers during an active MCQ checkpoint
      if (activeQuestion) {
        stopVoiceover();
        return;
      }

      const audio = audioRef.current;
      if (!audio) return;

      const segment = getSegmentForTime(time);
      if (!segment) {
        // Beyond all 10 checkpoints (> 800s)
        audio.pause();
        currentSegmentIdRef.current = null;
        return;
      }

      const offset = Math.max(0, time - segment.startTime);

      // Check if we need to load a new audio track
      const isSameSegment =
        currentSegmentIdRef.current === segment.id &&
        audio.getAttribute('data-segment-id') === String(segment.id);

      if (!isSameSegment) {
        currentSegmentIdRef.current = segment.id;
        audio.setAttribute('data-segment-id', String(segment.id));
        audio.src = segment.file;
        audio.playbackRate = playbackRate;
        audio.volume = isMuted ? 0 : volume;
        audio.muted = isMuted;

        const onReadyToPlay = () => {
          audio.removeEventListener('loadedmetadata', onReadyToPlay);
          audio.removeEventListener('canplay', onReadyToPlay);
          if (activeQuestion || !videoRef.current || videoRef.current.paused) {
            audio.pause();
            return;
          }
          try {
            audio.currentTime = offset;
          } catch (e) {
            // Ignored
          }
          audio.playbackRate = playbackRate;
          audio.volume = isMuted ? 0 : volume;
          audio.muted = isMuted;
          audio.play().catch((err) => {
            console.warn(`Voiceover playback prevented for ${segment.file}:`, err);
          });
        };

        if (audio.readyState >= 1) {
          onReadyToPlay();
        } else {
          audio.addEventListener('loadedmetadata', onReadyToPlay, { once: true });
        }
        audio.load();
      } else {
        // Already loaded this segment: re-align offset if drifted
        if (Math.abs(audio.currentTime - offset) > 0.6) {
          try {
            audio.currentTime = offset;
          } catch (e) {
            // Ignored
          }
        }
        if (audio.paused && videoRef.current && !videoRef.current.paused) {
          audio.playbackRate = playbackRate;
          audio.volume = isMuted ? 0 : volume;
          audio.muted = isMuted;
          audio.play().catch((err) => {
            console.warn(`Voiceover resume error for ${segment.file}:`, err);
          });
        }
      }
    },
    [activeQuestion, isMuted, volume, playbackRate, stopVoiceover]
  );

  // Auto-play trigger when requested (e.g. following intro completion)
  useEffect(() => {
    if (autoPlay && videoRef.current && !activeQuestion) {
      if (videoRef.current.currentTime === 0 || !videoRef.current.currentTime) {
        videoRef.current.currentTime = 0;
      }
      videoRef.current.muted = true;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .then(() => {
            setIsPlaying(true);
            playVoiceoverForTime(0);
          })
          .catch((err) => {
            console.warn('Main video auto-start blocked by browser policy:', err);
            setIsPlaying(false);
          });
      }
    }
  }, [autoPlay, activeQuestion]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lockWarning, setLockWarning] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  }, [autoPlay, activeQuestion, playVoiceoverForTime]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // Calculate the maximum time allowed to seek based on the first unanswered question
  const nextUnansweredQuestion = questions.find((q) => !answeredQuestionIds.includes(q.id));
  const maxAllowedTime = nextUnansweredQuestion ? nextUnansweredQuestion.timestamp : duration;

  // External seek target (e.g. from review or restart)
  useEffect(() => {
    if (seekTargetTime !== null && videoRef.current) {
      const clamped = Math.min(seekTargetTime, maxAllowedTime);
      videoRef.current.currentTime = clamped;
      setCurrentTime(clamped);
      onSeekCompleted();
      if (isPlaying && !activeQuestion) {
        playVoiceoverForTime(clamped);
      } else {
        stopVoiceover();
      }
    }
  }, [seekTargetTime, maxAllowedTime, onSeekCompleted]);
  }, [seekTargetTime, maxAllowedTime, onSeekCompleted, isPlaying, activeQuestion, playVoiceoverForTime, stopVoiceover]);

  // Handle Play/Pause
  const togglePlay = useCallback(() => {
    if (activeQuestion) return; // Do not allow playing while quiz is open
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      videoRef.current.muted = true;
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .then(() => {
          setIsPlaying(true);
          playVoiceoverForTime(videoRef.current?.currentTime || 0);
        })
        .catch((err) => {
          console.warn('Playback error:', err);
        });
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [activeQuestion]);
  }, [activeQuestion, playVoiceoverForTime]);

  // Track previous active question to automatically resume video when question is dismissed
  const prevActiveQuestion = useRef<Question | null>(null);
  useEffect(() => {
    if (activeQuestion && videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
      setIsPlaying(false);
    if (activeQuestion) {
      // ABSOLUTE RULE: Whenever an MCQ appears, immediately stop the currently playing voiceover.
      stopVoiceover();
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    } else if (prevActiveQuestion.current && !activeQuestion && videoRef.current) {
      // User just answered correctly and clicked CONTINUE VIDEO!
      // Nudge slightly past the checkpoint timestamp so float precision doesn't re-trigger it
      const nextTime = Math.max(videoRef.current.currentTime, prevActiveQuestion.current.timestamp + 0.15);
      videoRef.current.currentTime = nextTime;
      setCurrentTime(nextTime);
      videoRef.current.muted = true;

      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .then(() => {
          setIsPlaying(true);
          playVoiceoverForTime(nextTime);
        })
        .catch((err) => {
          console.warn('Auto-resume playback error:', err);
        });
    }
    prevActiveQuestion.current = activeQuestion;
  }, [activeQuestion]);
  }, [activeQuestion, playVoiceoverForTime, stopVoiceover]);

  // Time update monitoring & Checkpoint trigger logic
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    setCurrentTime(current);

    // If quiz is currently open, ensure video remains paused
    // If quiz is currently open, ensure video and voiceover remain paused and silent
    if (activeQuestion) {
      stopVoiceover();
      if (!videoRef.current.paused) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
      return;
    }

    // Check if any unanswered question has been reached
    for (const q of questions) {
      if (!answeredQuestionIds.includes(q.id)) {
        // Trigger if current time is within or past the timestamp (with 0.5s margin)
        if (current >= q.timestamp) {
          videoRef.current.pause();
          videoRef.current.currentTime = q.timestamp;
          setCurrentTime(q.timestamp);
          setIsPlaying(false);
          // ABSOLUTE RULE: Immediately stop voiceover at checkpoint
          stopVoiceover();
          onTriggerQuestion(q);
          break;
          return;
        }
      }
    }

    // Continuous segment synchronization while video is actively playing
    if (!videoRef.current.paused) {
      const segment = getSegmentForTime(current);
      if (segment) {
        if (currentSegmentIdRef.current !== segment.id) {
          playVoiceoverForTime(current);
        } else if (audioRef.current && !audioRef.current.paused) {
          const expectedAudioTime = current - segment.startTime;
          if (Math.abs(audioRef.current.currentTime - expectedAudioTime) > 0.8) {
            try {
              audioRef.current.currentTime = expectedAudioTime;
            } catch (e) {
              // Ignored
            }
          }
        }
      } else if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    }
  };

  // Safe seek handler with anti-skip verification
  const handleSeek = (newTime: number) => {
    if (!videoRef.current) return;

    if (newTime > maxAllowedTime + 0.2) {
      // User is attempting to skip past an unanswered question!
      setLockWarning(
        `🔒 Checkpoint locked! You must complete Question ${nextUnansweredQuestion?.id} (${formatTime(
          nextUnansweredQuestion?.timestamp || 0
        )}) before advancing.`
      );
      setTimeout(() => setLockWarning(null), 3500);

      // Seek to the exact checkpoint timestamp and trigger it
      videoRef.current.currentTime = maxAllowedTime;
      setCurrentTime(maxAllowedTime);
      if (nextUnansweredQuestion) {
        videoRef.current.pause();
        setIsPlaying(false);
        stopVoiceover();
        onTriggerQuestion(nextUnansweredQuestion);
      }
      return;
    }

    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);

    if (isPlaying && !activeQuestion) {
      playVoiceoverForTime(newTime);
    } else {
      // Sync audio position while paused without playing
      const segment = getSegmentForTime(newTime);
      if (segment && audioRef.current) {
        const offset = Math.max(0, newTime - segment.startTime);
        if (audioRef.current.getAttribute('data-segment-id') !== String(segment.id)) {
          audioRef.current.setAttribute('data-segment-id', String(segment.id));
          audioRef.current.src = segment.file;
        }
        try {
          audioRef.current.currentTime = offset;
        } catch (e) {
          // Ignored
        }
        audioRef.current.pause();
      } else if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = percentage * duration;
    handleSeek(targetTime);
  };

  const handleProgressBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    setHoverPosition(clickX);
    setHoverTime(percentage * duration);
  };

  const handleProgressBarMouseLeave = () => {
    setHoverTime(null);
  };

  // Volume & Speed controls
  // Volume & Speed controls - Controls the active voiceover audio while main video stays muted
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    const shouldMute = val === 0;
    setIsMuted(shouldMute);
    if (audioRef.current) {
      audioRef.current.volume = val;
      audioRef.current.muted = shouldMute;
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    if (audioRef.current) {
      audioRef.current.muted = nextMuted;
      audioRef.current.volume = nextMuted ? 0 : volume;
    }
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.warn(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.warn(err));
      setIsFullscreen(false);
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in a text field
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleSeek(Math.max(0, currentTime - 5));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleSeek(currentTime + 5);
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, maxAllowedTime, togglePlay]);

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#000000',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Video Element */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000000',
        }}
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={videoSrc}
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={() => {
            if (videoRef.current) {
              videoRef.current.muted = true;
              setDuration(videoRef.current.duration || 854.6);
            }
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onPlay={() => {
            setIsPlaying(true);
            if (!activeQuestion) {
              playVoiceoverForTime(videoRef.current?.currentTime || 0);
            }
          }}
          onPause={() => {
            setIsPlaying(false);
            if (audioRef.current) {
              audioRef.current.pause();
            }
          }}
          onTimeUpdate={handleTimeUpdate}
          onEnded={onVideoEnded}
          onEnded={() => {
            stopVoiceover();
            onVideoEnded();
          }}
          onError={() => {
            setVideoError(
              'Unable to load the video stream. Please ensure the MP4 file is available at the specified source.'
            );
          }}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            filter: activeQuestion ? 'brightness(0.65) blur(1px)' : 'none',
            transition: 'filter 0.3s ease',
            cursor: activeQuestion ? 'default' : 'pointer',
          }}
        />

        {/* Voiceover Audio Element - Replaces main video audio with voiceover tracks */}
        <audio
          ref={audioRef}
          preload="auto"
          playsInline
          style={{ display: 'none' }}
          onError={(e) => {
            console.warn('Voiceover audio error (non-fatal):', e);
          }}
        />

        {/* Big play button overlay when paused and no quiz active */}
        {!isPlaying && !activeQuestion && !videoError && (
          <div
            style={{
              position: 'absolute',
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 122, 204, 0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              pointerEvents: 'none',
            }}
          >
            <Play size={32} fill="#ffffff" color="#ffffff" style={{ marginLeft: '4px' }} />
          </div>
        )}

        {/* Video Loading Error Overlay */}
        {videoError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: '#1e1e1e',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              color: '#d4d4d4',
              textAlign: 'center',
            }}
          >
            <AlertCircle size={48} color="#f14c4c" style={{ marginBottom: '16px' }} />
            <h3 style={{ fontSize: '18px', color: '#ffffff', marginBottom: '8px' }}>
              Video Source Notification
            </h3>
            <p style={{ maxWidth: '480px', color: '#9da3ae', fontSize: '14px', marginBottom: '20px' }}>
              {videoError}
            </p>
            <button
              onClick={() => {
                setVideoError(null);
                if (videoRef.current) {
                  videoRef.current.load();
                }
              }}
              style={{
                backgroundColor: '#007acc',
                border: 'none',
                color: '#ffffff',
                padding: '8px 20px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Retry Video Loading
            </button>
          </div>
        )}
      </div>

      {/* Lock Warning Toast */}
      {lockWarning && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1e1e1e',
            color: '#f14c4c',
            border: '1px solid rgba(241, 76, 76, 0.4)',
            padding: '10px 18px',
            borderRadius: '6px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 60,
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          <Lock size={16} />
          <span>{lockWarning}</span>
        </div>
      )}

      {/* Custom Video Controls Bar */}
      <div
        style={{
          width: '100%',
          backgroundColor: '#1e1e1e',
          borderTop: '1px solid #3e3e42',
          padding: '10px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 30,
          userSelect: 'none',
        }}
      >
        {/* Timeline Progress Bar with Quiz Markers */}
        <div
          onClick={handleProgressBarClick}
          onMouseMove={handleProgressBarMouseMove}
          onMouseLeave={handleProgressBarMouseLeave}
          style={{
            position: 'relative',
            width: '100%',
            height: '18px',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          {/* Track background */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '6px',
              backgroundColor: '#333333',
              borderRadius: '3px',
              overflow: 'visible',
            }}
          >
            {/* Max seekable unlocked boundary */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${Math.min(100, (maxAllowedTime / duration) * 100)}%`,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '3px',
              }}
            />

            {/* Played progress bar */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${Math.min(100, (currentTime / duration) * 100)}%`,
                backgroundColor: '#007acc',
                borderRadius: '3px',
              }}
            />

            {/* Scrubber head */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: `${Math.min(100, (currentTime / duration) * 100)}%`,
                transform: 'translate(-50%, -50%)',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                boxShadow: '0 0 6px rgba(0, 0, 0, 0.8)',
              }}
            />

            {/* Quiz Checkpoint Markers on the Timeline */}
            {questions.map((q, idx) => {
              const markerPercent = (q.timestamp / duration) * 100;
              const isAnswered = answeredQuestionIds.includes(q.id);
              const isCurrent = activeQuestion?.id === q.id;

              return (
                <div
                  key={q.id}
                  title={`Question ${idx + 1}: ${q.question} (${formatTime(q.timestamp)})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSeek(q.timestamp);
                  }}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: `${markerPercent}%`,
                    transform: 'translate(-50%, -50%)',
                    width: isCurrent ? '16px' : '12px',
                    height: isCurrent ? '16px' : '12px',
                    borderRadius: '50%',
                    backgroundColor: isAnswered ? '#4ec9b0' : isCurrent ? '#007acc' : '#858585',
                    border: '2px solid #1e1e1e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 2,
                    boxShadow: isCurrent ? '0 0 8px #007acc' : 'none',
                  }}
                  className={isCurrent ? 'pulse-marker' : ''}
                >
                  {isAnswered ? (
                    <Check size={8} color="#1e1e1e" strokeWidth={3} />
                  ) : (
                    <div
                      style={{
                        width: '4px',
                        height: '4px',
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                      }}
                    />
                  )}
                </div>
              );
            })}

            {/* Hover preview tooltip */}
            {hoverTime !== null && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '16px',
                  left: `${hoverPosition}px`,
                  transform: 'translateX(-50%)',
                  backgroundColor: '#252526',
                  color: '#d4d4d4',
                  border: '1px solid #3e3e42',
                  padding: '3px 8px',
                  borderRadius: '3px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-code)',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 10px rgba(0, 0, 0, 0.5)',
                }}
              >
                {formatTime(hoverTime)}
              </div>
            )}
          </div>
        </div>

        {/* Lower Controls Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13px',
          }}
        >
          {/* Left Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={togglePlay}
              disabled={activeQuestion !== null}
              style={{
                background: 'none',
                border: 'none',
                color: activeQuestion ? '#555555' : '#d4d4d4',
                cursor: activeQuestion ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>

            <button
              onClick={() => handleSeek(Math.max(0, currentTime - 10))}
              title="Rewind 10s"
              style={{
                background: 'none',
                border: 'none',
                color: '#9da3ae',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                fontSize: '11px',
              }}
            >
              <RotateCcw size={16} />
              <span>10s</span>
            </button>

            {/* Time readout */}
            <div
              style={{
                fontFamily: 'var(--font-code)',
                fontSize: '12px',
                color: '#cccccc',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span style={{ color: '#007acc', fontWeight: 600 }}>{formatTime(currentTime)}</span>
              <span style={{ color: '#6e7681' }}>/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            {/* Speed Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {[1, 1.25, 1.5].map((rate) => (
                <button
                  key={rate}
                  onClick={() => handleSpeedChange(rate)}
                  style={{
                    backgroundColor: playbackRate === rate ? '#007acc' : 'transparent',
                    color: playbackRate === rate ? '#ffffff' : '#9da3ae',
                    border: '1px solid #3e3e42',
                    borderRadius: '3px',
                    padding: '2px 6px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-code)',
                    cursor: 'pointer',
                  }}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Volume Control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={toggleMute}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9da3ae',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                style={{
                  width: '65px',
                  accentColor: '#007acc',
                  cursor: 'pointer',
                  height: '4px',
                }}
              />
            </div>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              style={{
                background: 'none',
                border: 'none',
                color: '#9da3ae',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
