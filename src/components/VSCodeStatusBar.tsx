import React from 'react';
import { GitBranch, RefreshCw, AlertCircle, Check, Bell, Lock, User, Shield } from 'lucide-react';

interface VSCodeStatusBarProps {
  completedCount: number;
  totalQuestions: number;
  currentTimeFormatted: string;
  durationFormatted: string;
  isLocked: boolean;
  participantLabel?: string;
  onOpenAdminExport?: () => void;
}

export const VSCodeStatusBar: React.FC<VSCodeStatusBarProps> = ({
  completedCount,
  totalQuestions,
  currentTimeFormatted,
  durationFormatted,
  isLocked,
  participantLabel,
  onOpenAdminExport,
}) => {
  return (
    <footer
      style={{
        backgroundColor: '#007acc',
        color: '#ffffff',
        height: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 10px',
        fontSize: '11px',
        fontFamily: 'var(--font-sans)',
        userSelect: 'none',
        zIndex: 50,
      }}
    >
      {/* Left side info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <GitBranch size={13} />
          <span>main*</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <RefreshCw size={11} />
        </div>

        {/* Anonymous Participant Badge */}
        {participantLabel && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              padding: '1px 7px',
              borderRadius: '2px',
            }}
          >
            <User size={11} color="#89d185" />
            <span style={{ fontWeight: 600 }}>{participantLabel}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <AlertCircle size={12} />
            <span>0</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <span style={{ fontSize: '10px' }}>⚠️</span>
            <span>0</span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: 'rgba(0,0,0,0.2)',
            padding: '1px 8px',
            borderRadius: '2px',
          }}
        >
          {completedCount === totalQuestions ? (
            <Check size={12} color="#89d185" />
          ) : isLocked ? (
            <Lock size={12} color="#ffd166" />
          ) : (
            <Check size={12} />
          )}
          <span>
            Quiz Checkpoints: {completedCount} / {totalQuestions}
          </span>
        </div>

        <div style={{ opacity: 0.85 }}>
          <span>Video: {currentTimeFormatted} / {durationFormatted}</span>
        </div>
      </div>

      {/* Right side info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Owner CSV Export Action Button */}
        {onOpenAdminExport && (
          <div
            onClick={onOpenAdminExport}
            title="Export Assessment CSV (Owner Key Required)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              backgroundColor: 'rgba(0,0,0,0.25)',
              padding: '1px 8px',
              borderRadius: '2px',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.25)';
            }}
          >
            <Shield size={11} color="#ffd166" />
            <span>Owner Export</span>
          </div>
        )}

        <span>Ln 14, Col 2</span>
        <span>Spaces: 2</span>
        <span>UTF-8</span>
        <span>TypeScript React</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <Check size={12} />
          <span>Prettier</span>
        </div>
        <Bell size={12} style={{ cursor: 'pointer' }} />
      </div>
    </footer>
  );
};
