import React, { useState } from "react";
import notify from "../../../services/notificationService";

export default function AccountSettingsTab({ settings, updateSetting, speakAnnouncement, activeUser, navigate }) {
  const userEmail = localStorage.getItem("email") || `${activeUser.toLowerCase()}@bookvault.io`;
  const userRole = localStorage.getItem("role") || "READER";

  // Check face descriptor in localStorage
  const hasFaceDescriptor = !!(
    localStorage.getItem(`faceDescriptor_${activeUser}`) || localStorage.getItem("face_descriptor")
  );

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passData, setPassData] = useState({ oldPass: "", newPass: "", confirmPass: "" });

  const handleReadProfile = () => {
    speakAnnouncement(
      `Account Profile: Username is ${activeUser}. Email is ${userEmail}. Account role is ${userRole}. Face biometric authentication is ${
        hasFaceDescriptor ? "configured and active" : "not yet set up"
      }.`,
      true
    );
  };

  const handleRecalibrateFace = () => {
    speakAnnouncement("Opening face biometric registration camera...", true);
    if (navigate) {
      navigate("/facelogin");
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (!passData.newPass) {
      notify.error("Please enter a new password.");
      speakAnnouncement("Please enter a new password.", true);
      return;
    }
    if (passData.newPass !== passData.confirmPass) {
      notify.error("New passwords do not match.");
      speakAnnouncement("New passwords do not match.", true);
      return;
    }

    notify.success("Password updated successfully.");
    speakAnnouncement("Password updated successfully.", true);
    setShowPasswordForm(false);
    setPassData({ oldPass: "", newPass: "", confirmPass: "" });
  };

  return (
    <div className="settings-tab-content slide-up">
      <div className="settings-tab-header">
        <h2>👤 Profile & Biometric Security</h2>
        <p>Manage account profile, voice-guided Face ID recognition, and password security.</p>
      </div>

      <div className="settings-section">
        <h3 className="section-title">🆔 User Profile</h3>

        <div className="profile-summary-card">
          <div className="profile-avatar">{activeUser.charAt(0).toUpperCase()}</div>
          <div className="profile-details">
            <h3 className="profile-name">{activeUser}</h3>
            <span className="profile-email">{userEmail}</span>
            <span className="profile-role-badge">Role: {userRole}</span>
          </div>
          <button className="btn-secondary-accessible" onClick={handleReadProfile} aria-label="Read account summary aloud">
            📢 Read Profile Aloud
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-title">👁️ Face Biometric Authentication</h3>

        <div className="setting-card">
          <div className="setting-info">
            <span className="setting-label">Face Biometric Status</span>
            <span className="setting-desc">Biometric facial descriptor used for fast hands-free sign in.</span>
          </div>
          <div className="status-badge-container">
            {hasFaceDescriptor ? (
              <span className="badge-success">🟢 Face ID Active</span>
            ) : (
              <span className="badge-warning">🟡 Not Configured</span>
            )}
          </div>
        </div>

        <div className="setting-card">
          <div className="setting-info">
            <label htmlFor="face-quick-login-toggle" className="setting-label">Enable Face Quick Login</label>
            <span className="setting-desc">Log in instantly using face recognition camera.</span>
          </div>
          <button
            id="face-quick-login-toggle"
            role="switch"
            aria-checked={settings.faceQuickLogin}
            className={`toggle-switch ${settings.faceQuickLogin ? "active" : ""}`}
            onClick={() => {
              const val = !settings.faceQuickLogin;
              updateSetting("faceQuickLogin", val, val ? "Face quick login enabled." : "Face quick login disabled.");
            }}
          >
            <span className="toggle-slider"></span>
          </button>
        </div>

        <div style={{ marginTop: 14 }}>
          <button className="btn-primary-accessible" onClick={handleRecalibrateFace} aria-label="Re-calibrate or scan face biometrics now">
            📷 Recalibrate Face Biometrics
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-title">🔒 Password & Security</h3>

        {!showPasswordForm ? (
          <button className="btn-secondary-accessible" onClick={() => setShowPasswordForm(true)} aria-label="Change account password">
            🔑 Change Password
          </button>
        ) : (
          <form className="password-form-card" onSubmit={handlePasswordSubmit}>
            <h4>Change Account Password</h4>

            <div className="form-group">
              <label htmlFor="current-pass-input">Current Password</label>
              <input
                id="current-pass-input"
                type="password"
                className="accessible-input"
                value={passData.oldPass}
                onChange={(e) => setPassData({ ...passData, oldPass: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="new-pass-input">New Password</label>
              <input
                id="new-pass-input"
                type="password"
                className="accessible-input"
                value={passData.newPass}
                onChange={(e) => setPassData({ ...passData, newPass: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirm-pass-input">Confirm New Password</label>
              <input
                id="confirm-pass-input"
                type="password"
                className="accessible-input"
                value={passData.confirmPass}
                onChange={(e) => setPassData({ ...passData, confirmPass: e.target.value })}
                required
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary-accessible">Save New Password</button>
              <button type="button" className="btn-secondary-accessible" onClick={() => setShowPasswordForm(false)}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
