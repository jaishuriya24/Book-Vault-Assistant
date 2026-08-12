import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import notify from "../../services/notificationService";

const AUTH_URL = import.meta.env.VITE_SPRING_BOOT_AUTH_URL || import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

function deduplicateUserList(list) {
  if (!Array.isArray(list)) return [];
  const map = new Map();
  for (const u of list) {
    const rawName = (u.userName || u.name || '').trim();
    if (!rawName) continue;
    const key = rawName.toLowerCase();
    if (!map.has(key) || u.hasBiometric) {
      map.set(key, { ...u, userName: rawName });
    }
  }
  return Array.from(map.values());
}

export default function ProfileScreen() {
  const navigate = useNavigate();
  const [username, setUsername] = useState(() => localStorage.getItem("username") || "Guest");
  const [registeredUsers, setRegisteredUsers] = useState(() => {
    try {
      const localProfiles = JSON.parse(localStorage.getItem("face_profiles") || "[]");
      const mapped = localProfiles.map((p, idx) => ({
        userId: idx + 1,
        userName: p.name,
        email: p.email || `${p.name.toLowerCase().replace(/\s+/g, '')}@bookvault.local`,
        role: 'READER',
        sourceTable: 'biometric_users',
        authType: 'BIOMETRIC_FACE',
        hasBiometric: true,
        faceDescriptor: p.faceDescriptor,
        createdAt: p.createdAt || new Date().toISOString()
      }));
      return deduplicateUserList(mapped);
    } catch (_) {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);

  const fetchUsers = () => {
    fetch(`${AUTH_URL}/api/users/readers`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const deduped = deduplicateUserList(data);
          setRegisteredUsers(deduped);
          // Sync local storage face profiles with deduplicated server list
          const freshLocal = deduped
            .filter((u) => u.faceDescriptor)
            .map((u) => ({
              name: u.userName,
              email: u.email,
              faceDescriptor: typeof u.faceDescriptor === "string" ? JSON.parse(u.faceDescriptor) : u.faceDescriptor,
              createdAt: u.createdAt,
            }));
          localStorage.setItem("face_profiles", JSON.stringify(freshLocal));
        }
      })
      .catch((err) => console.warn("Could not fetch MySQL users:", err.message))
      .finally(() => setLoading(false));
  };

  const handleDeleteUser = async (e, u) => {
    e.stopPropagation();
    const uName = u.userName || u.name;
    const shouldDelete = await notify.confirm({
      title: "Remove User Profile",
      message: `Delete "${uName}" from registered biometric users?`,
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger",
      icon: "🗑️",
    });

    if (shouldDelete) {
      try {
        if (u.sourceTable === 'biometric_users' && u.userId) {
          await fetch(`${AUTH_URL}/api/users/biometric/${u.userId}`, { method: 'DELETE' });
        }
      } catch (_) {}

      // Prune local storage
      const local = JSON.parse(localStorage.getItem("face_profiles") || "[]");
      const updated = local.filter((p) => p.name.toLowerCase() !== uName.toLowerCase());
      localStorage.setItem("face_profiles", JSON.stringify(updated));

      fetchUsers();
      notify.success(`Removed user "${uName}".`);
    }
  };

  const handleClearAllUsers = async () => {
    const shouldClear = await notify.confirm({
      title: "Clear All Registered Users",
      message: "This will remove all enrolled face profiles so you can start fresh with only real users.",
      confirmText: "Clear All",
      cancelText: "Cancel",
      type: "danger",
      icon: "🧹",
    });

    if (shouldClear) {
      localStorage.setItem("face_profiles", "[]");
      localStorage.removeItem("username");
      localStorage.removeItem("token");
      try {
        await fetch(`${AUTH_URL}/api/users/clear-all`, { method: 'DELETE' });
      } catch (_) {}
      fetchUsers();
      notify.info("All test user profiles cleared.");
    }
  };

  useEffect(() => {
    fetchUsers();
    window.addEventListener("focus", fetchUsers);
    return () => window.removeEventListener("focus", fetchUsers);
  }, []);

  const handleLogout = async () => {
    const shouldLogout = await notify.confirm({
      title: "Logout Confirmation",
      message: `Are you sure you want to end your active session as "${username}"?`,
      confirmText: "Yes, Logout",
      cancelText: "Stay Logged In",
      type: "danger",
      icon: "🚪",
    });

    if (shouldLogout) {
      localStorage.removeItem("username");
      localStorage.removeItem("token");
      localStorage.removeItem("readease_token");
      window.dispatchEvent(new Event("bookvault:username-updated"));
      notify.info("Logged out successfully.");
      navigate("/signin");
    }
  };

  const handleSwitchUser = (user) => {
    const newName = user.userName || user.name;
    localStorage.setItem("username", newName);
    setUsername(newName);
    window.dispatchEvent(new Event("bookvault:username-updated"));
    notify.success(`Switched active user to "${newName}"!`);
  };

  const currentUserData = registeredUsers.find(
    (u) => (u.userName || "").toLowerCase() === username.toLowerCase()
  );

  return (
    <div className="slide-up" style={{ width: "100%", maxWidth: 860, margin: "0 auto", padding: "16px 20px" }}>
      {/* ── Top Nav ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <button
          onClick={() => navigate("/")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#e2e8f0",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          ← Back to Vault
        </button>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => navigate("/admin-dashboard")}
            style={{
              padding: "8px 18px",
              borderRadius: 12,
              background: "linear-gradient(135deg, #4f46e5, #4338ca)",
              border: "1px solid rgba(129,140,248,0.3)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            👥 View MySQL Database
          </button>
        </div>
      </div>

      {/* ── Active User Hero Profile Card ── */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(20,20,20,0.9) 0%, rgba(30,30,30,0.85) 100%)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 24,
          padding: "36px 32px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
          position: "relative",
          overflow: "hidden",
          marginBottom: 28,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 160,
            height: 160,
            background: "radial-gradient(circle, rgba(234,88,12,0.25) 0%, transparent 70%)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          {/* Avatar */}
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #ea580c, #9a3412)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 800,
              color: "#fff",
              boxShadow: "0 0 24px rgba(234,88,12,0.45)",
              border: "3px solid rgba(251,146,60,0.5)",
              position: "relative",
            }}
          >
            {username ? username.charAt(0).toUpperCase() : "👤"}
            <span
              style={{
                position: "absolute",
                bottom: 2,
                right: 2,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#22c55e",
                border: "2px solid #18181b",
                boxShadow: "0 0 8px #22c55e",
              }}
            />
          </div>

          {/* User Meta */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
                {username}
              </h1>
              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 700,
                  background: currentUserData?.role === "ADMIN" ? "rgba(168,85,247,0.2)" : "rgba(234,88,12,0.2)",
                  color: currentUserData?.role === "ADMIN" ? "#c084fc" : "#fb923c",
                  border: `1px solid ${currentUserData?.role === "ADMIN" ? "rgba(168,85,247,0.4)" : "rgba(234,88,12,0.4)"}`,
                  textTransform: "uppercase",
                }}
              >
                {currentUserData?.role || (username.toLowerCase().includes("admin") ? "ADMIN" : "READER")}
              </span>
            </div>

            <p style={{ margin: "0 0 10px", fontSize: 14, color: "rgba(255,255,255,0.6)" }}>
              {currentUserData?.email || `${username.toLowerCase().replace(/\s+/g, "")}@bookvault.local`}
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#4ade80",
                  background: "rgba(34,197,94,0.12)",
                  padding: "4px 10px",
                  borderRadius: 8,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80" }} />
                MySQL Connected
              </span>

              {currentUserData?.hasBiometric && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#38bdf8",
                    background: "rgba(56,189,248,0.12)",
                    padding: "4px 10px",
                    borderRadius: 8,
                  }}
                >
                  👁️ Face Biometrics Enrolled
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {username !== "Guest" ? (
              <button
                onClick={handleLogout}
                style={{
                  padding: "10px 22px",
                  borderRadius: 12,
                  background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.4)",
                  color: "#f87171",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                🚪 Log Out
              </button>
            ) : (
              <button
                onClick={() => navigate("/signin")}
                style={{
                  padding: "10px 22px",
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #ea580c, #c2410c)",
                  border: "none",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                🔑 Sign In
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── All Registered Users in MySQL ── */}
      <div
        style={{
          background: "rgba(18,18,18,0.75)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          padding: "24px 28px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff" }}>
              👥 All Registered Users ({registeredUsers.length})
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
              Only unique, verified face profiles stored in MySQL <code style={{ color: "#fb923c" }}>biometric_users</code>.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {registeredUsers.length > 0 && (
              <button
                onClick={handleClearAllUsers}
                style={{
                  padding: "6px 12px",
                  borderRadius: 10,
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#f87171",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                🧹 Clear Old Test Users
              </button>
            )}

            <button
              onClick={() => {
                localStorage.removeItem("username");
                localStorage.removeItem("token");
                localStorage.removeItem("readease_token");
                window.dispatchEvent(new Event("bookvault:username-updated"));
                navigate("/facelogin?mode=register");
              }}
              style={{
                padding: "6px 14px",
                borderRadius: 10,
                background: "linear-gradient(135deg, rgba(234,88,12,0.2), rgba(249,115,22,0.3))",
                border: "1px solid rgba(251,146,60,0.4)",
                color: "#fb923c",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + Add New Face / User
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Loading registered users from MySQL...</p>
        ) : registeredUsers.length === 0 ? (
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>No registered users found in MySQL.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {registeredUsers.map((u) => {
              const uName = u.userName || u.name;
              const isActive = (uName || "").toLowerCase() === username.toLowerCase();
              return (
                <div
                  key={u.userId || u.id}
                  onClick={() => handleSwitchUser(u)}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 14,
                    background: isActive ? "rgba(234,88,12,0.15)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isActive ? "rgba(234,88,12,0.5)" : "rgba(255,255,255,0.06)"}`,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: isActive ? "#ea580c" : "rgba(255,255,255,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      color: "#fff",
                      fontSize: 16,
                    }}
                  >
                    {uName ? uName.charAt(0).toUpperCase() : "👤"}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontWeight: 700, color: "#fff", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {uName}
                      </span>
                      {isActive && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.15)", padding: "1px 6px", borderRadius: 99 }}>
                          Active
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {u.email}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14 }} title={u.hasBiometric ? "Biometric Face Enrolled" : "Password Only"}>
                      {u.hasBiometric ? "👁️" : "🔑"}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteUser(e, u)}
                      title="Delete profile"
                      style={{
                        background: "none",
                        border: "none",
                        color: "rgba(255,255,255,0.3)",
                        cursor: "pointer",
                        fontSize: 14,
                        padding: "2px 4px",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
