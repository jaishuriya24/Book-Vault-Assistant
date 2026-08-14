import React from "react";

export default function ReadingSettingsTab({ settings, updateSetting, speakAnnouncement }) {
  const themePresets = [
    { id: "dark", name: "🌙 Dark Charcoal", bg: "#1e1e2e", color: "#f3ede4" },
    { id: "yellow-black", name: "🟡 Yellow on Black (Low Vision)", bg: "#000000", color: "#ffea00", border: "#ffea00" },
    { id: "oled", name: "🖤 Pure OLED Black", bg: "#000000", color: "#ffffff" },
    { id: "sepia", name: "📜 Cozy Sepia", bg: "#f4ecd8", color: "#433422" },
    { id: "cream", name: "🍦 Warm Cream", bg: "#fbf0d9", color: "#2d2821" },
    { id: "white", name: "☀️ Crisp White", bg: "#ffffff", color: "#111111" },
  ];

  return (
    <div className="settings-tab-content slide-up">
      <div className="settings-tab-header">
        <h2>📖 Reading & Low-Vision Contrast</h2>
        <p>Adjust visual reading themes, high-contrast colors, font scaling, and dyslexic text options.</p>
      </div>

      <div className="settings-section">
        <h3 className="section-title">🎨 High Contrast & Theme Presets</h3>

        <div className="theme-grid">
          {themePresets.map((t) => (
            <button
              key={t.id}
              className={`theme-card-option ${settings.colorTheme === t.id ? "selected" : ""}`}
              style={{ background: t.bg, color: t.color, borderColor: t.border || "transparent" }}
              aria-label={`Select ${t.name} reading theme`}
              onClick={() => {
                updateSetting("colorTheme", t.id, `Selected ${t.name} theme.`);
              }}
            >
              <div className="theme-name">{t.name}</div>
              <div className="theme-sample-text">Aa 123</div>
            </button>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-title">🔤 Typography & Text Scaling</h3>

        <div className="setting-card col">
          <div className="setting-info flex-between">
            <label htmlFor="font-size-slider" className="setting-label">Text Font Size</label>
            <span className="setting-value-badge">{settings.fontSize}px</span>
          </div>
          <input
            id="font-size-slider"
            type="range"
            min="14"
            max="36"
            step="2"
            value={settings.fontSize}
            aria-label={`Text font size ${settings.fontSize} pixels`}
            className="accessible-slider"
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              updateSetting("fontSize", val, `Font size set to ${val} pixels.`);
            }}
          />
          <div className="slider-ticks">
            <span>Standard (16px)</span>
            <span>Large (22px)</span>
            <span>Extra Large (28px)</span>
            <span>Max (36px)</span>
          </div>
        </div>

        <div className="setting-card">
          <div className="setting-info">
            <label htmlFor="dyslexic-font-toggle" className="setting-label">Dyslexic-Friendly Font Spacing</label>
            <span className="setting-desc">Increases letter spacing and line height for improved readability.</span>
          </div>
          <button
            id="dyslexic-font-toggle"
            role="switch"
            aria-checked={settings.dyslexicFont}
            className={`toggle-switch ${settings.dyslexicFont ? "active" : ""}`}
            onClick={() => {
              const val = !settings.dyslexicFont;
              updateSetting("dyslexicFont", val, val ? "Dyslexic font spacing enabled." : "Dyslexic font spacing disabled.");
            }}
          >
            <span className="toggle-slider"></span>
          </button>
        </div>

        <div className="setting-card">
          <div className="setting-info">
            <label htmlFor="tts-highlight-toggle" className="setting-label">Real-Time Spoken Word Highlighting</label>
            <span className="setting-desc">Visually highlight each word as the text-to-speech engine reads aloud.</span>
          </div>
          <button
            id="tts-highlight-toggle"
            role="switch"
            aria-checked={settings.ttsHighlight}
            className={`toggle-switch ${settings.ttsHighlight ? "active" : ""}`}
            onClick={() => {
              const val = !settings.ttsHighlight;
              updateSetting("ttsHighlight", val, val ? "Spoken word highlighting enabled." : "Word highlighting disabled.");
            }}
          >
            <span className="toggle-slider"></span>
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-title">✨ Live Reading Preview</h3>
        <p className="setting-desc">This is how your books will render in the reader screen:</p>

        {(() => {
          const selectedObj = themePresets.find((tp) => tp.id === settings.colorTheme) || themePresets[0];
          return (
            <div
              className="live-reading-preview-card"
              style={{
                backgroundColor: selectedObj.bg,
                color: selectedObj.color,
                fontSize: `${settings.fontSize}px`,
                letterSpacing: settings.dyslexicFont ? "1.5px" : "normal",
                lineHeight: settings.dyslexicFont ? "2.0" : "1.6",
                border: selectedObj.border ? `2px solid ${selectedObj.border}` : "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <p>
                "Welcome to <span style={{ textDecoration: "underline", fontWeight: "bold" }}>Book Vault</span>. Voice-guided reading and accessibility empower every reader to explore literature effortlessly."
              </p>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
