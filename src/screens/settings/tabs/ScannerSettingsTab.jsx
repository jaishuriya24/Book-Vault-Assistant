import React from "react";

export default function ScannerSettingsTab({ settings, updateSetting, speakAnnouncement }) {
  return (
    <div className="settings-tab-content slide-up">
      <div className="settings-tab-header">
        <h2>📷 Voice-Guided Scanner & Camera</h2>
        <p>Configure document camera framing assist, auto-capture hold delays, and haptic vibrations for blind users.</p>
      </div>

      <div className="settings-section">
        <h3 className="section-title">🔊 Blind Framing Assistance</h3>

        <div className="setting-card">
          <div className="setting-info">
            <label htmlFor="spoken-framing-toggle" className="setting-label">Spoken Voice Framing Guidance</label>
            <span className="setting-desc">Speaks live camera alignment tips (e.g. "Move camera higher", "Hold steady").</span>
          </div>
          <button
            id="spoken-framing-toggle"
            role="switch"
            aria-checked={settings.spokenFramingAssist}
            className={`toggle-switch ${settings.spokenFramingAssist ? "active" : ""}`}
            onClick={() => {
              const val = !settings.spokenFramingAssist;
              updateSetting("spokenFramingAssist", val, val ? "Spoken camera framing assist enabled." : "Framing assist disabled.");
            }}
          >
            <span className="toggle-slider"></span>
          </button>
        </div>

        <div className="setting-card">
          <div className="setting-info">
            <label htmlFor="haptic-feedback-toggle" className="setting-label">Haptic Tactile Vibration Alerts</label>
            <span className="setting-desc">Vibrates touch device when book page text is correctly aligned in view.</span>
          </div>
          <button
            id="haptic-feedback-toggle"
            role="switch"
            aria-checked={settings.hapticFeedback}
            className={`toggle-switch ${settings.hapticFeedback ? "active" : ""}`}
            onClick={() => {
              const val = !settings.hapticFeedback;
              updateSetting("hapticFeedback", val, val ? "Haptic vibration feedback enabled." : "Haptic feedback disabled.");
            }}
          >
            <span className="toggle-slider"></span>
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-title">📸 Auto-Capture & Camera Hardware</h3>

        <div className="setting-card">
          <div className="setting-info">
            <label htmlFor="auto-capture-toggle" className="setting-label">Automatic Text Capture</label>
            <span className="setting-desc">Automatically trigger shutter when book text is steady without clicking shutter button.</span>
          </div>
          <button
            id="auto-capture-toggle"
            role="switch"
            aria-checked={settings.autoCapture}
            className={`toggle-switch ${settings.autoCapture ? "active" : ""}`}
            onClick={() => {
              const val = !settings.autoCapture;
              updateSetting("autoCapture", val, val ? "Auto capture enabled." : "Auto capture disabled.");
            }}
          >
            <span className="toggle-slider"></span>
          </button>
        </div>

        <div className="setting-card col">
          <div className="setting-info flex-between">
            <label htmlFor="capture-delay-slider" className="setting-label">Auto-Capture Hold Delay</label>
            <span className="setting-value-badge">{settings.autoCaptureDelay}s</span>
          </div>
          <input
            id="capture-delay-slider"
            type="range"
            min="1.0"
            max="4.0"
            step="0.5"
            value={settings.autoCaptureDelay}
            aria-label={`Auto capture delay ${settings.autoCaptureDelay} seconds`}
            className="accessible-slider"
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              updateSetting("autoCaptureDelay", val, `Auto capture delay set to ${val} seconds.`);
            }}
          />
        </div>

        <div className="setting-card col">
          <label htmlFor="camera-device-select" className="setting-label">Default Camera Sensor</label>
          <select
            id="camera-device-select"
            className="accessible-select"
            value={settings.defaultCameraDevice}
            aria-label="Default camera sensor selection"
            onChange={(e) => {
              const val = e.target.value;
              updateSetting("defaultCameraDevice", val, `Default camera set to ${val === "user" ? "front camera" : "back camera"}`);
            }}
          >
            <option value="user">Selfie / Front Camera</option>
            <option value="environment">Rear / Back Camera (Recommended for Scanning)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
