import React, { useState } from "react";
import notify from "../../../services/notificationService";
import mysqlService from "../../../services/mysqlService";

export default function StorageSyncSettingsTab({ settings, updateSetting, speakAnnouncement, activeUser }) {
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);

  const handleRunDiagnostics = async () => {
    setCheckingHealth(true);
    speakAnnouncement("Running system backend diagnostics check...", true);

    try {
      const isOnline = await mysqlService.healthCheck();
      const status = {
        backend: isOnline ? "Connected (MySQL REST API)" : "Offline (Local Storage Fallback)",
        speechSynth: "speechSynthesis" in window ? "Available" : "Not Supported",
        camera: navigator.mediaDevices ? "Available" : "No Camera Permission",
      };
      setHealthStatus(status);

      const speechMsg = `System Diagnostics Complete. Backend connection is ${
        isOnline ? "online and connected to MySQL" : "offline, using local storage fallback"
      }. Speech synthesis is ${status.speechSynth}. Camera sensor is ${status.camera}.`;

      notify.info("Diagnostics Complete");
      speakAnnouncement(speechMsg, true);
    } catch (e) {
      notify.error("Diagnostics check failed.");
      speakAnnouncement("Diagnostics check failed.", true);
    } finally {
      setCheckingHealth(false);
    }
  };

  const handleClearCache = () => {
    try {
      // Clear reading position keys for active user
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(`readingPos_${activeUser}`)) {
          localStorage.removeItem(key);
        }
      });
      notify.success("Saved reading positions cleared successfully.");
      speakAnnouncement("Saved reading positions cleared successfully.", true);
    } catch (e) {
      notify.error("Failed to clear cache.");
    }
  };

  const handleExportData = () => {
    try {
      const booksData = localStorage.getItem(`uploadedBooks_${activeUser}`) || "[]";
      const blob = new Blob([booksData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `book_vault_library_${activeUser}_backup.json`;
      a.click();
      URL.revokeObjectURL(url);

      notify.success("Library backup exported.");
      speakAnnouncement("Library backup downloaded as JSON file.", true);
    } catch (e) {
      notify.error("Export failed.");
    }
  };

  return (
    <div className="settings-tab-content slide-up">
      <div className="settings-tab-header">
        <h2>💾 Storage, MySQL Sync & Audio Diagnostics</h2>
        <p>Monitor MySQL database status, clear reading progress cache, and export library backups.</p>
      </div>

      <div className="settings-section">
        <h3 className="section-title">🩺 System & Backend Diagnostics</h3>

        <div style={{ marginBottom: 14 }}>
          <button
            className="btn-primary-accessible"
            onClick={handleRunDiagnostics}
            disabled={checkingHealth}
            aria-label="Run audio system health diagnostics check"
          >
            {checkingHealth ? "⏳ Checking System..." : "🔊 Run System Health Diagnostics"}
          </button>
        </div>

        {healthStatus && (
          <div className="diagnostic-results-card">
            <div className="diag-row">
              <strong>MySQL Backend:</strong>
              <span>{healthStatus.backend}</span>
            </div>
            <div className="diag-row">
              <strong>Speech Synthesis Engine:</strong>
              <span>{healthStatus.speechSynth}</span>
            </div>
            <div className="diag-row">
              <strong>Camera Sensor:</strong>
              <span>{healthStatus.camera}</span>
            </div>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3 className="section-title">🧹 Data & Storage Management</h3>

        <div className="setting-card">
          <div className="setting-info">
            <span className="setting-label">Clear Saved Reading Progress Cache</span>
            <span className="setting-desc">Resets saved page bookmark indices for all books in your library.</span>
          </div>
          <button className="btn-danger-accessible" onClick={handleClearCache} aria-label="Clear reading progress bookmark cache">
            🗑️ Clear Progress Cache
          </button>
        </div>

        <div className="setting-card">
          <div className="setting-info">
            <span className="setting-label">Export Book Library Backup</span>
            <span className="setting-desc">Download a JSON file copy of your collection and bookmarks.</span>
          </div>
          <button className="btn-secondary-accessible" onClick={handleExportData} aria-label="Export library backup as JSON file">
            📥 Export Backup JSON
          </button>
        </div>
      </div>
    </div>
  );
}
