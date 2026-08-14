import React, { useState, useEffect } from "react";

export default function VoiceAudioSettingsTab({ settings, updateSetting, speakAnnouncement }) {
  const [voices, setVoices] = useState([]);

  useEffect(() => {
    const loadVoices = () => {
      if ("speechSynthesis" in window) {
        const vList = window.speechSynthesis.getVoices();
        setVoices(vList);
      }
    };
    loadVoices();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const handleTestAudio = () => {
    speakAnnouncement(
      "Welcome to Book Vault. Voice audio is working perfectly! All screens and actions are announced clearly for screen readers and blind users.",
      true
    );
  };

  return (
    <div className="settings-tab-content slide-up">
      <div className="settings-tab-header">
        <h2>🔊 Voice & Audio Settings</h2>
        <p>Customize speech synthesis rate, voice pitch, Doraemon mascot language, and audio feedback.</p>
      </div>

      <div className="settings-section">
        <h3 className="section-title">🗣️ Text-to-Speech Engine</h3>

        <div className="setting-card">
          <div className="setting-info">
            <label htmlFor="voice-announcements-toggle" className="setting-label">Voice Announcements for Blind Users</label>
            <span className="setting-desc">Announce all setting changes, screen transitions, and button clicks automatically.</span>
          </div>
          <button
            id="voice-announcements-toggle"
            role="switch"
            aria-checked={settings.voiceAnnouncements}
            className={`toggle-switch ${settings.voiceAnnouncements ? "active" : ""}`}
            onClick={() => {
              const val = !settings.voiceAnnouncements;
              updateSetting("voiceAnnouncements", val, val ? "Voice announcements enabled." : "Voice announcements disabled.");
            }}
          >
            <span className="toggle-slider"></span>
          </button>
        </div>

        <div className="setting-card col">
          <div className="setting-info flex-between">
            <label htmlFor="speech-rate-slider" className="setting-label">Speech Rate (Speed)</label>
            <span className="setting-value-badge">{settings.speechRate}x</span>
          </div>
          <input
            id="speech-rate-slider"
            type="range"
            min="0.5"
            max="3.0"
            step="0.1"
            value={settings.speechRate}
            aria-label={`Speech rate ${settings.speechRate} speed`}
            className="accessible-slider"
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              updateSetting("speechRate", val, `Speech rate set to ${val} speed.`);
            }}
          />
          <div className="slider-ticks">
            <span>Slow (0.5x)</span>
            <span>Normal (1.0x)</span>
            <span>Fast (2.0x)</span>
            <span>Ultra (3.0x)</span>
          </div>
        </div>

        <div className="setting-card col">
          <div className="setting-info flex-between">
            <label htmlFor="speech-pitch-slider" className="setting-label">Speech Pitch</label>
            <span className="setting-value-badge">{settings.speechPitch}</span>
          </div>
          <input
            id="speech-pitch-slider"
            type="range"
            min="0.5"
            max="1.5"
            step="0.1"
            value={settings.speechPitch}
            aria-label={`Speech pitch ${settings.speechPitch}`}
            className="accessible-slider"
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              updateSetting("speechPitch", val, `Speech pitch set to ${val}.`);
            }}
          />
        </div>

        <div className="setting-card col">
          <label htmlFor="voice-select-dropdown" className="setting-label">Active Speech Voice</label>
          <span className="setting-desc" style={{ marginBottom: 10 }}>Select installed voice profile for TTS reading.</span>
          <select
            id="voice-select-dropdown"
            className="accessible-select"
            value={settings.selectedVoice}
            aria-label="Select speech voice"
            onChange={(e) => {
              const val = e.target.value;
              updateSetting("selectedVoice", val, `Selected voice set to ${val || "default system voice"}`);
            }}
          >
            <option value="">Default System Voice</option>
            {voices.map((v, i) => (
              <option key={i} value={v.name}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 16 }}>
          <button className="btn-primary-accessible" onClick={handleTestAudio} aria-label="Test voice speech audio now">
            📢 Test Voice Audio Output
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-title">🐱 Doraemon Voice Mascot & Audio Cues</h3>

        <div className="setting-card">
          <div className="setting-info">
            <label htmlFor="mascot-toggle" className="setting-label">Enable Doraemon Voice Mascot</label>
            <span className="setting-desc">Spoken guidance mascot at bottom corner of screen.</span>
          </div>
          <button
            id="mascot-toggle"
            role="switch"
            aria-checked={settings.mascotEnabled}
            className={`toggle-switch ${settings.mascotEnabled ? "active" : ""}`}
            onClick={() => {
              const val = !settings.mascotEnabled;
              updateSetting("mascotEnabled", val, val ? "Doraemon mascot enabled." : "Doraemon mascot disabled.");
            }}
          >
            <span className="toggle-slider"></span>
          </button>
        </div>

        <div className="setting-card col">
          <label htmlFor="mascot-lang-select" className="setting-label">Mascot Voice Language</label>
          <select
            id="mascot-lang-select"
            className="accessible-select"
            value={settings.mascotLanguage}
            aria-label="Mascot language selection"
            onChange={(e) => {
              const val = e.target.value;
              const names = { eng: "English", tam: "Tamil", hin: "Hindi" };
              updateSetting("mascotLanguage", val, `Mascot language changed to ${names[val] || val}`);
            }}
          >
            <option value="eng">🇬🇧 English (Default)</option>
            <option value="tam">🇮🇳 Tamil (தமிழ்)</option>
            <option value="hin">🇮🇳 Hindi (हिंदी)</option>
          </select>
        </div>

        <div className="setting-card">
          <div className="setting-info">
            <label htmlFor="audio-beeps-toggle" className="setting-label">Audio Earcon Chimes & Beeps</label>
            <span className="setting-desc">Play distinct sound effects when pressing buttons or toggling controls.</span>
          </div>
          <button
            id="audio-beeps-toggle"
            role="switch"
            aria-checked={settings.audioBeeps}
            className={`toggle-switch ${settings.audioBeeps ? "active" : ""}`}
            onClick={() => {
              const val = !settings.audioBeeps;
              updateSetting("audioBeeps", val, val ? "Audio chimes enabled." : "Audio chimes disabled.");
            }}
          >
            <span className="toggle-slider"></span>
          </button>
        </div>
      </div>
    </div>
  );
}
