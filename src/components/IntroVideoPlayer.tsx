import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  FastForward,
  Sparkles,
  AlertCircle,
  Film,
} from 'lucide-react';

interface IntroVideoPlayerProps {
  introSrc: string;
  onComplete: () => void;
}

export const IntroVideoPlayer: React.FC<IntroVideoPlayerProps> = ({
  introSrc,
  onComplete,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [autoplayFailed, setAutoplayFailed] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState<boolean>(true);
  const controlsTimeoutRef = useRef<number | null>(null);

  // Attempt muted autoplay on mount for browser compatibility
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    setIsMuted(true);

    const startPlay = async () => {
      try {
        await video.play();
        setIsPlaying(true);
        setAutoplayFailed(false);
      } catch (err) {
        console.warn('Intro video autoplay prevented by browser policy:', err);
        setIsPlaying(false);
        setAutoplayFailed(true);
      }
    };

    startPlay();
  }, []);

  // Format mm:ss
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Play / Pause toggle
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setAutoplayFailed(false);
        })
        .catch((err) => {
          console.warn('Playback error:', err);
          setAutoplayFailed(true);
        });
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  // Handle manual start (unmuting if user initiated)
  const handleManualStart = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!videoRef.current) return;

    // Direct user click allows sound playback
    videoRef.current.muted = false;
    setIsMuted(false);

    videoRef.current
      .play()
      .then(() => {
        setIsPlaying(true);
        setAutoplayFailed(false);
      })
      .catch((err) => {
        console.warn('Manual play error:', err);
      });
  };

  // Unmute button action
  const handleUnmute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = false;
    setIsMuted(false);
  };

  // Mute / Unmute toggle
  const toggleMute = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!videoRef.current) return;
    const next = !isMuted;
    videoRef.current.muted = next;
    setIsMuted(next);
  };

  // Volume slider
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  // Progress Bar seek
  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!videoRef.current || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const target = percentage * duration;
    videoRef.current.currentTime = target;
    setCurrentTime(target);
  };

  // Fullscreen toggle
  const toggleFullscreen = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.warn(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.warn(err));
      setIsFullscreen(false);
    }
  };

  // Auto-hide controls during playback on idle
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
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
  }, [togglePlay]);

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#0a0a0c',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* VS Code Inspired Top Breadcrumb / Title Bar */}
      <header
        style={{
          height: '42px',
          backgroundColor: '#252526',
          borderBottom: '1px solid #3e3e42',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#1e1e1e',
              padding: '4px 10px',
              borderRadius: '4px',
              border: '1px solid #3c3c3c',
            }}
          >
            <Film size={14} color="#007acc" />
            <span
              style={{
                fontFamily: 'var(--font-code)',
                fontSize: '12px',
                color: '#9cdcfe',
                fontWeight: 500,
              }}
            >
              intro_briefing.mp4
            </span>
          </div>

          <span
            style={{
              fontSize: '12px',
              color: '#9da3ae',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Sparkles size={13} color="#ffd166" />
            <span>Course Introduction & Overview</span>
          </span>
        </div>

        {/* Top Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isMuted && isPlaying && (
            <button
              onClick={handleUnmute}
              style={{
                backgroundColor: 'rgba(255, 209, 102, 0.15)',
                border: '1px solid rgba(255, 209, 102, 0.5)',
                color: '#ffd166',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
              }}
              title="Click to enable audio"
            >
              <VolumeX size={13} />
              <span>Unmute Audio</span>
            </button>
          )}

          <button
            onClick={onComplete}
            style={{
              backgroundColor: '#007acc',
              border: 'none',
              color: '#ffffff',
              padding: '5px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(0, 122, 204, 0.35)',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1c97ea';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#007acc';
            }}
            title="Skip directly to the interactive lesson"
          >
            <span>Skip to Lesson</span>
            <FastForward size={14} />
          </button>
        </div>
      </header>

      {/* Video Viewport Area */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000000',
          cursor: isPlaying ? 'default' : 'pointer',
        }}
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={introSrc}
          autoPlay
          muted
          playsInline
          preload="auto"
          onPlay={() => {
            setIsPlaying(true);
            setAutoplayFailed(false);
          }}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={() => {
            if (videoRef.current) {
              setCurrentTime(videoRef.current.currentTime);
            }
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration || 0);
            }
          }}
          onEnded={onComplete}
          onError={() => {
            setVideoError(
              'Unable to load the introductory clip. You can skip ahead directly to the lesson.'
            );
          }}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            outline: 'none',
          }}
        />

        {/* Autoplay Fallback / Paused Center Play Button */}
        {(!isPlaying || autoplayFailed) && !videoError && (
          <div
            onClick={handleManualStart}
            style={{
              position: 'absolute',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
              cursor: 'pointer',
              zIndex: 30,
              padding: '20px',
              borderRadius: '12px',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div
              style={{
                width: '74px',
                height: '74px',
                borderRadius: '50%',
                backgroundColor: '#007acc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 28px rgba(0, 122, 204, 0.7)',
                transition: 'transform 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <Play size={36} fill="#ffffff" color="#ffffff" style={{ marginLeft: '4px' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: 600,
                  letterSpacing: '0.3px',
                }}
              >
                {autoplayFailed ? 'Click to Start Introduction' : 'Play Introduction'}
              </div>
              <div style={{ color: '#9da3ae', fontSize: '12px', marginTop: '4px' }}>
                {autoplayFailed
                  ? 'Browser required user interaction to start video'
                  : 'Click anywhere to play with sound'}
              </div>
            </div>
          </div>
        )}

        {/* Floating Unmute Hint Pill */}
        {isPlaying && isMuted && (
          <div
            onClick={handleUnmute}
            style={{
              position: 'absolute',
              bottom: '70px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(37, 37, 38, 0.92)',
              border: '1px solid #007acc',
              padding: '8px 18px',
              borderRadius: '20px',
              color: '#d4d4d4',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
              zIndex: 25,
              animation: 'pulseGlow 2.5s infinite',
            }}
          >
            <VolumeX size={15} color="#ffd166" />
            <span>Playing muted for browser compatibility — </span>
            <span style={{ color: '#007acc', fontWeight: 600 }}>Click to unmute</span>
          </div>
        )}

        {/* Error Notification */}
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
              zIndex: 35,
            }}
          >
            <AlertCircle size={44} color="#f14c4c" style={{ marginBottom: '14px' }} />
            <h3 style={{ fontSize: '17px', color: '#ffffff', marginBottom: '8px' }}>
              Intro Video Notice
            </h3>
            <p style={{ maxWidth: '480px', fontSize: '13px', color: '#9da3ae', marginBottom: '20px' }}>
              {videoError}
            </p>
            <button
              onClick={onComplete}
              style={{
                backgroundColor: '#007acc',
                color: '#ffffff',
                border: 'none',
                padding: '8px 20px',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Continue to Lesson Video
            </button>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <footer
        style={{
          backgroundColor: '#252526',
          borderTop: '1px solid #3e3e42',
          padding: '8px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          zIndex: 40,
          opacity: showControls || !isPlaying ? 1 : 0,
          transition: 'opacity 0.25s ease',
        }}
      >
        {/* Progress Bar */}
        <div
          onClick={handleProgressBarClick}
          style={{
            position: 'relative',
            width: '100%',
            height: '6px',
            backgroundColor: '#3c3c3c',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: `${progressPercentage}%`,
              height: '100%',
              backgroundColor: '#007acc',
              borderRadius: '3px',
              position: 'relative',
              transition: 'width 0.1s linear',
            }}
          >
            <div
              style={{
                position: 'absolute',
                right: '-4px',
                top: '-3px',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                boxShadow: '0 0 4px rgba(0,0,0,0.5)',
              }}
            />
          </div>
        </div>

        {/* Control Buttons & Indicators */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '2px',
          }}
        >
          {/* Left Controls: Play, Restart, Volume, Timestamp */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={togglePlay}
              style={{
                background: 'none',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
              }}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = 0;
                  videoRef.current.play().catch((err) => console.warn(err));
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#9da3ae',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
              }}
              title="Restart Intro"
            >
              <RotateCcw size={15} />
            </button>

            {/* Volume / Mute */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={toggleMute}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isMuted ? '#ffd166' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px',
                }}
                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
              >
                {isMuted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
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

            <div
              style={{
                fontFamily: 'var(--font-code)',
                fontSize: '12px',
                color: '#9da3ae',
                marginLeft: '4px',
              }}
            >
              <span style={{ color: '#d4d4d4' }}>{formatTime(currentTime)}</span>
              <span> / </span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls: Skip button & Fullscreen */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={onComplete}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid #3e3e42',
                color: '#d4d4d4',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = '#d4d4d4';
              }}
            >
              <span>Skip Intro</span>
              <FastForward size={12} />
            </button>

            <button
              onClick={toggleFullscreen}
              style={{
                background: 'none',
                border: 'none',
                color: '#9da3ae',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
              }}
              title="Fullscreen (F)"
            >
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

