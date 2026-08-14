import React from "react";

export default function GeneralSettingsTab({ settings, updateSetting, resetSettings, speakAnnouncement }) {
  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all settings to factory defaults?")) {
      resetSettings();
    }
  };

  return (
    <div className="settings-tab-content slide-up">
      <div className="settings-tab-header">
        <h2>⚙️ General App Preferences</h2>
        <p>Set default startup screens, interface language, and reset settings.</p>
      </div>

      <div className="settings-section">
        <h3 className="section-title">🚀 Startup & App Preferences</h3>

        <div className="setting-card col">
          <label htmlFor="default-screen-select" className="setting-label">Default App Screen on Launch</label>
          <select
            id="default-screen-select"
            className="accessible-select"
            value={settings.defaultScreen}
            aria-label="Default app screen on startup"
            onChange={(e) => {
              const val = e.target.value;
              updateSetting("defaultScreen", val, `Default startup screen set to ${val.replace("/", "")}`);
            }}
          >
            <option value="/library">📚 My Library Collection</option>
            <option value="/scanner">📷 Book Scanner</option>
            <option value="/profile">👤 User Profile</option>
          </select>
        </div>

        <div className="setting-card col">
          <label htmlFor="app-lang-select" className="setting-label">App System Language</label>
          <select
            id="app-lang-select"
            className="accessible-select"
            value={settings.appLanguage}
            aria-label="App system language selection"
            onChange={(e) => {
              const val = e.target.value;
              const names = { en: "English", ta: "Tamil", hi: "Hindi" };
              updateSetting("appLanguage", val, `App language changed to ${names[val] || val}`);
            }}
          >
            <option value="en">🇬🇧 English</option>
            <option value="ta">🇮🇳 Tamil (தமிழ்)</option>
            <option value="hi">🇮🇳 Hindi (हिंदी)</option>
          </select>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-title">ℹ️ System Information</h3>

        <div className="info-box-card">
          <div className="info-row">
            <strong>Application Name:</strong>
            <span>Book Vault (Voice & Biometrics Edition)</span>
          </div>
          <div className="info-row">
            <strong>Version:</strong>
            <span>v2.5.0 (2026 Build)</span>
          </div>
          <div className="info-row">
            <strong>Accessibility Engine:</strong>
            <span>TTS Neural Speech + Web Speech API</span>
          </div>
          <div className="info-row">
            <strong>Biometric Engine:</strong>
            <span>TensorFlow face-api.js WebGL</span>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-title">🔄 Reset Settings</h3>

        <div className="setting-card">
          <div className="setting-info">
            <span className="setting-label">Restore Factory Defaults</span>
            <span className="setting-desc">Resets all voice, audio, reading, scanner, and app settings to defaults.</span>
          </div>
          <button className="btn-danger-accessible" onClick={handleReset} aria-label="Reset all settings to factory default values">
            🔄 Reset All Settings
          </button>
        </div>
      </div>
    </div>
  );
}
