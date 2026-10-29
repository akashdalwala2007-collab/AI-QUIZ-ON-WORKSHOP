import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Key, Download, X, AlertCircle, CheckCircle, FileSpreadsheet } from 'lucide-react';
import { getLocalAttempts } from '../services/participant';

interface AdminExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminExportModal: React.FC<AdminExportModalProps> = ({ isOpen, onClose }) => {
  const [adminKey, setAdminKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRemoteExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminKey.trim()) {
      setError('Please enter your QUIZ_ADMIN_KEY passcode.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Call the protected Netlify function via POST with header authentication (never in URL params)
      const endpoint = '/.netlify/functions/export-csv';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey.trim(),
        },
        body: JSON.stringify({ adminKey: adminKey.trim() }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized: The admin passcode is incorrect.');
        } else if (response.status === 404) {
          throw new Error(
            'Netlify Function endpoint not reachable on this host. (If testing locally, run "netlify dev" or deploy to Netlify).'
          );
        } else {
          const json = await response.json().catch(() => ({}));
          throw new Error(json.error || `Server responded with HTTP ${response.status}`);
        }
      }

      // Download CSV blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `quiz_results_${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setSuccess('CSV successfully generated and downloaded!');
      setAdminKey('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleExportLocalFallback = () => {
    try {
      const attempts = getLocalAttempts();
      if (attempts.length === 0) {
        setError('No local attempt records found in this browser.');
        return;
      }

      const lines: string[] = [];
      lines.push('=== LOCAL BROWSER ATTEMPTS EXPORT ===');
      lines.push(
        '"Participant ID","Attempt #","Version","Status","Started","Completed","Score","Accuracy (%)","Correct Count","Retry Count","Duration (s)"'
      );

      for (const a of attempts) {
        lines.push(
          [
            `"${a.participantId}"`,
            a.attemptNumber,
            `"${a.quizVersion}"`,
            `"${a.status}"`,
            `"${a.startedAt}"`,
            `"${a.completedAt || 'Incomplete'}"`,
            a.score.toFixed(2),
            a.accuracy.toFixed(1),
            a.correctCount,
            a.incorrectCount,
            a.durationSeconds,
          ].join(',')
        );
      }

      const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `local_quiz_attempts_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setSuccess('Local browser attempts exported successfully.');
    } catch (err) {
      setError('Failed to export local data.');
    }
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
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: '#252526',
          border: '1px solid #3e3e42',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: '#1e1e1e',
            padding: '14px 18px',
            borderBottom: '1px solid #3e3e42',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff' }}>
            <Shield size={16} color="#007acc" />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Owner Assessment CSV Export</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#858585',
              cursor: 'pointer',
              padding: '2px',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleRemoteExport} style={{ padding: '20px' }}>
          <p style={{ fontSize: '12px', color: '#9da3ae', lineHeight: 1.5, marginBottom: '16px' }}>
            Download the complete PostgreSQL assessment database as an Excel-compatible CSV file.
            This endpoint is server-side protected by your <code>QUIZ_ADMIN_KEY</code>.
          </p>

          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 600,
                color: '#cccccc',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Admin Passcode (QUIZ_ADMIN_KEY)
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#1e1e1e',
                border: '1px solid #3e3e42',
                borderRadius: '4px',
                padding: '0 10px',
              }}
            >
              <Key size={14} color="#858585" style={{ marginRight: '8px' }} />
              <input
                type="password"
                placeholder="Enter admin passcode"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  padding: '9px 0',
                  fontSize: '13px',
                }}
              />
            </div>
          </div>

          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                backgroundColor: 'rgba(241, 76, 76, 0.15)',
                border: '1px solid rgba(241, 76, 76, 0.3)',
                borderRadius: '4px',
                padding: '10px',
                marginBottom: '16px',
                color: '#f87171',
                fontSize: '12px',
                lineHeight: 1.4,
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(46, 160, 67, 0.15)',
                border: '1px solid rgba(78, 201, 176, 0.3)',
                borderRadius: '4px',
                padding: '10px',
                marginBottom: '16px',
                color: '#4ec9b0',
                fontSize: '12px',
              }}
            >
              <CheckCircle size={15} />
              <span>{success}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: '#007acc',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                padding: '10px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              <Download size={14} />
              <span>{loading ? 'Downloading from Database...' : 'Download Database CSV'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportLocalFallback}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: 'transparent',
                color: '#858585',
                border: '1px solid #3e3e42',
                borderRadius: '4px',
                padding: '8px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              <FileSpreadsheet size={13} />
              <span>Export Local Browser Attempts (Offline Backup)</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
