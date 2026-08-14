import React, { useState, useEffect, useMemo } from "react";
import useSettings from "../../hooks/useSettings";

import VoiceAudioSettingsTab from "./tabs/VoiceAudioSettingsTab";
import VoiceControlSettingsTab from "./tabs/VoiceControlSettingsTab";
import AccountSettingsTab from "./tabs/AccountSettingsTab";
import ScannerSettingsTab from "./tabs/ScannerSettingsTab";
import ReadingSettingsTab from "./tabs/ReadingSettingsTab";
import StorageSyncSettingsTab from "./tabs/StorageSyncSettingsTab";
import GeneralSettingsTab from "./tabs/GeneralSettingsTab";

const ALL_TABS = [
  { id: "voice", label: "Voice & Audio", icon: "🔊", desc: "Text-to-speech engine & speed" },
  { id: "voice-commands", label: "Voice Commands", icon: "🎙️", desc: "Voice recognition controls" },
  { id: "account", label: "Profile & Biometrics", icon: "👤", desc: "Face ID registration & user profile" },
  { id: "scanner", label: "Scanner & Camera", icon: "📷", desc: "Auto page capture & camera beep" },
  { id: "reading", label: "Reading & Contrast", icon: "📖", desc: "High contrast themes & font scaling" },
  { id: "storage", label: "Storage & Diagnostics", icon: "💾", desc: "Database stats & cache diagnostics", adminOnly: true },
  { id: "general", label: "General & System", icon: "⚙️", desc: "System reset & defaults", adminOnly: true },
];

export default function SettingsScreen({ activeUser = "Guest", navigate }) {
  const [activeTab, setActiveTab] = useState("voice");
  const { settings, updateSetting, resetSettings, speakAnnouncement } = useSettings(activeUser);

  const userRole = localStorage.getItem("role") || localStorage.getItem("user_role") || "READER";
  const isAdmin = userRole === "ADMIN" || (activeUser && activeUser.toLowerCase().includes("admin"));

  // Filter out unnecessary technical/developer tabs for regular reader roles (blind users)
  const visibleTabs = useMemo(() => {
    if (isAdmin) return ALL_TABS;
    return ALL_TABS.filter(t => !t.adminOnly);
  }, [isAdmin]);

  // Announce page title upon loading
  useEffect(() => {
    speakAnnouncement("Settings Dashboard opened. Press Tab or use navigation keys to browse setting categories.", false);
  }, [speakAnnouncement]);

  const handleTabChange = (tabId, tabLabel) => {
    setActiveTab(tabId);
    speakAnnouncement(`Switched to ${tabLabel} settings tab.`, false);
  };

  return (
    <div className="settings-screen-container slide-up" role="region" aria-label="Book Vault User Settings Dashboard">
      {/* Accessible Header */}
      <div className="settings-header-bar">
        <button
          className="btn-back-accessible"
          onClick={() => navigate ? navigate("/") : window.history.back()}
          aria-label="Back to main screen"
        >
          <span>← Back to App</span>
        </button>

        <div className="settings-title-area">
          <h1 className="settings-main-title">⚙️ Settings Dashboard</h1>
          <div className="settings-subtitle-badge">
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 14px", borderRadius: 99, fontSize: 12, fontWeight: 800,
              background: "rgba(234, 88, 12, 0.25)", color: "#ffaa66",
              border: "1px solid rgba(234, 88, 12, 0.5)"
            }}>
              👤 User: <strong>{activeUser}</strong> ({userRole})
            </span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 14px", borderRadius: 99, fontSize: 12, fontWeight: 800,
              background: settings.voiceAnnouncements ? "rgba(34, 197, 94, 0.25)" : "rgba(107, 114, 128, 0.25)",
              color: settings.voiceAnnouncements ? "#4ade80" : "#9ca3af",
              border: settings.voiceAnnouncements ? "1px solid rgba(34, 197, 94, 0.5)" : "1px solid rgba(107, 114, 128, 0.5)"
            }}>
              📢 Voice Accessibility: <strong>{settings.voiceAnnouncements ? "ENABLED" : "DISABLED"}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Main Settings Layout: Sidebar Tabs + Active Content */}
      <div className="settings-body-grid">
        {/* Category Navigation Bar */}
        <nav className="settings-sidebar-nav" role="tablist" aria-label="Settings Categories">
          {visibleTabs.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isSelected}
                aria-controls={`panel-${tab.id}`}
                tabIndex={isSelected ? 0 : -1}
                className={`settings-nav-tab ${isSelected ? "active" : ""}`}
                onClick={() => handleTabChange(tab.id, tab.label)}
              >
                <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Tab Content Panel with ARIA Live Region */}
        <main
          className="settings-content-viewport"
          id={`panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          aria-live="polite"
        >
          {activeTab === "voice" && (
            <VoiceAudioSettingsTab
              settings={settings}
              updateSetting={updateSetting}
              speakAnnouncement={speakAnnouncement}
            />
          )}

          {activeTab === "voice-commands" && (
            <VoiceControlSettingsTab
              settings={settings}
              updateSetting={updateSetting}
              speakAnnouncement={speakAnnouncement}
            />
          )}

          {activeTab === "account" && (
            <AccountSettingsTab
              settings={settings}
              updateSetting={updateSetting}
              speakAnnouncement={speakAnnouncement}
              activeUser={activeUser}
              navigate={navigate}
            />
          )}

          {activeTab === "scanner" && (
            <ScannerSettingsTab
              settings={settings}
              updateSetting={updateSetting}
              speakAnnouncement={speakAnnouncement}
            />
          )}

          {activeTab === "reading" && (
            <ReadingSettingsTab
              settings={settings}
              updateSetting={updateSetting}
              speakAnnouncement={speakAnnouncement}
            />
          )}

          {activeTab === "storage" && (
            <StorageSyncSettingsTab
              settings={settings}
              updateSetting={updateSetting}
              speakAnnouncement={speakAnnouncement}
              activeUser={activeUser}
            />
          )}

          {activeTab === "general" && (
            <GeneralSettingsTab
              settings={settings}
              updateSetting={updateSetting}
              resetSettings={resetSettings}
              speakAnnouncement={speakAnnouncement}
            />
          )}
        </main>
      </div>
    </div>
  );
}
