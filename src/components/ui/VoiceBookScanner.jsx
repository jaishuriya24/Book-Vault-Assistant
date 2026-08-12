import React from 'react';
import { useVoiceBookScanner } from '../../hooks/useVoiceBookScanner';
import { Mic, Camera, X } from 'lucide-react';

export default function VoiceBookScanner({ onSave }) {
  const { 
    startScan, 
    cancelScan, 
    onFileSelect, 
    status, 
    promptText, 
    fileInputRef 
  } = useVoiceBookScanner(onSave);

  return (
    <div className="voice-scanner-container" style={{ position: 'relative' }}>
      
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

      {/* UI for Sighted / Low Vision users to trigger or cancel */}
      {status === 'idle' ? (
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
            width: '100%',
            fontSize: '18px'
          }}
        >
          <Camera size={24} />
          <span>Voice Scan</span>
        </button>
      ) : (
        <div 
          className="voice-scan-active-card"
          style={{
            background: '#1A1A1A',
            border: '1px solid #333',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            textAlign: 'center'
          }}
        >
          <div className="status-icon" style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(255, 121, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FF7900'
          }}>
            {status === 'confirming' || status === 'askingTitle' ? (
              <Mic size={32} className="pulse-anim" />
            ) : (
              <Camera size={32} className={status === 'analyzing' ? 'pulse-anim' : ''} />
            )}
          </div>
          
          <div>
            <h3 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '20px' }}>Scanning...</h3>
            <p style={{ margin: 0, color: '#aaa', fontSize: '16px' }} aria-hidden="true">
              {promptText}
            </p>
          </div>

          <button 
            onClick={cancelScan}
            style={{
              background: 'transparent',
              color: '#ef4444',
              border: '1px solid #ef4444',
              padding: '12px 24px',
              borderRadius: '999px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              marginTop: '8px'
            }}
          >
            <X size={18} />
            Cancel
          </button>
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
