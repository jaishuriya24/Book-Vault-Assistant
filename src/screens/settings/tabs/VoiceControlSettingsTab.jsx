import React from "react";

export default function VoiceControlSettingsTab({ settings, updateSetting, speakAnnouncement }) {
  const handleTestCommands = () => {
    speakAnnouncement(
      "Available voice commands in Book Vault: Say 'Open Library', 'Scan Book', 'Read Aloud', 'Stop TTS', 'Go to Settings', or 'Help Doraemon'.",
      true
    );
  };

  return (
    <div className="settings-tab-content slide-up">
      <div className="settings-tab-header">
        <h2>🎙️ Voice Commands & Hands-Free Control</h2>
        <p>Control Book Vault completely hands-free using natural voice input commands.</p>
      </div>

      <div className="settings-section">
        <h3 className="section-title">🎤 Speech Recognition Input</h3>

        <div className="setting-card">
          <div className="setting-info">
            <label htmlFor="voice-control-toggle" className="setting-label">Enable Voice Command Input</label>
            <span className="setting-desc">Listen for spoken shortcuts like "Open Library" or "Scan Page".</span>
          </div>
          <button
            id="voice-control-toggle"
            role="switch"
            aria-checked={settings.voiceControlEnabled}
            className={`toggle-switch ${settings.voiceControlEnabled ? "active" : ""}`}
            onClick={() => {
              const val = !settings.voiceControlEnabled;
              updateSetting("voiceControlEnabled", val, val ? "Voice control listening enabled." : "Voice control disabled.");
            }}
          >
            <span className="toggle-slider"></span>
          </button>
        </div>

        <div className="setting-card col">
          <label htmlFor="mic-sensitivity-select" className="setting-label">Microphone Sensitivity</label>
          <select
            id="mic-sensitivity-select"
            className="accessible-select"
            value={settings.microphoneSensitivity}
            aria-label="Microphone sensitivity"
            onChange={(e) => {
              const val = e.target.value;
              updateSetting("microphoneSensitivity", val, `Microphone sensitivity set to ${val}.`);
            }}
          >
            <option value="low">Quiet Environment (Low)</option>
            <option value="normal">Standard Room (Normal)</option>
            <option value="high">Noisy Environment (High)</option>
          </select>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-title">🗣️ Spoken Command Shortcuts Reference</h3>
        <p className="setting-desc" style={{ marginBottom: 14 }}>
          You can speak any of the following commands at any time in Book Vault:
        </p>

        <div className="shortcut-grid">
          <div className="shortcut-card">
            <strong>"Open Library"</strong>
            <span>Navigates to your saved books.</span>
          </div>
          <div className="shortcut-card">
            <strong>"Scan Book"</strong>
            <span>Launches voice-guided camera scanner.</span>
          </div>
          <div className="shortcut-card">
            <strong>"Read Aloud"</strong>
            <span>Starts reading active page text.</span>
          </div>
          <div className="shortcut-card">
            <strong>"Stop Speech"</strong>
            <span>Pauses or cancels text-to-speech.</span>
          </div>
          <div className="shortcut-card">
            <strong>"Go to Settings"</strong>
            <span>Opens this settings screen.</span>
          </div>
          <div className="shortcut-card">
            <strong>"Help Doraemon"</strong>
            <span>Asks Doraemon mascot for screen guide.</span>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <button className="btn-primary-accessible" onClick={handleTestCommands} aria-label="Listen to voice command shortcuts list">
            📢 Read Commands Aloud
          </button>
        </div>
      </div>
    </div>
  );
}
