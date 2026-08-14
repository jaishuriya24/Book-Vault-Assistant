import React from 'react';
import { useVoiceBookScanner } from '../../hooks/useVoiceBookScanner';
import { Mic, Camera, X } from 'lucide-react';

export default function VoiceBookScanner({ onSave, showTriggerButton = false }) {
  const { 
    startScan, 
    cancelScan, 
    onFileSelect, 
    status, 
    promptText, 
    fileInputRef 
  } = useVoiceBookScanner(onSave);

  return (
    <div className="voice-scanner-container">
      
      {/* Hidden Native Camera Input */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        onChange={onFileSelect}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {/* Screen Reader Announcements */}
      <div 
        aria-live="assertive" 
        className="sr-only" 
        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}
      >
        {promptText}
      </div>

      {/* Optional trigger button (if explicitly requested) */}
      {status === 'idle' && showTriggerButton && (
        <button 
          onClick={startScan}
          className="voice-scan-btn"
          aria-label="Start Voice Guided Book Scan"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            background: 'linear-gradient(135deg, #FF7900, #FF4500)',
            color: 'white',
            padding: '16px 24px',
            borderRadius: '16px',
            fontWeight: 'bold',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(255, 69, 0, 0.4)',
            fontSize: '18px'
          }}
        >
          <Camera size={24} />
          <span>Voice Scan</span>
        </button>
      )}

      {/* Active Modal Overlay when scanning */}
      {status !== 'idle' && (
        <div 
          className="voice-scan-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div 
            className="voice-scan-active-card"
            style={{
              background: '#1A1A1A',
              border: '1px solid #333',
              borderRadius: '24px',
              padding: '32px',
              maxWidth: '420px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
              textAlign: 'center',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div className="status-icon" style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'rgba(255, 121, 0, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FF7900'
            }}>
              {status === 'confirming' || status === 'askingTitle' ? (
                <Mic size={36} className="pulse-anim" />
              ) : (
                <Camera size={36} className={status === 'analyzing' ? 'pulse-anim' : ''} />
              )}
            </div>
            
            <div>
              <h3 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '22px', fontWeight: 'bold' }}>
                {status === 'confirming' ? 'Voice Command' : status === 'analyzing' ? 'Processing Image...' : 'Book Scanner'}
              </h3>
              <p style={{ margin: 0, color: '#ccc', fontSize: '16px', lineHeight: '1.5' }}>
                {promptText}
              </p>
            </div>

            <button 
              onClick={cancelScan}
              style={{
                background: 'transparent',
                color: '#ef4444',
                border: '1px solid #ef4444',
                padding: '12px 28px',
                borderRadius: '999px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                marginTop: '8px',
                transition: 'all 0.2s'
              }}
            >
              <X size={18} />
              Cancel Scan
            </button>
          </div>
        </div>
      )}

      <style>{`
        .pulse-anim {
          animation: pulse 1.5s infinite ease-in-out;
        }
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.7; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
