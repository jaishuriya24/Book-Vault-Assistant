import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, User, Shield, CheckCircle2, Layers, BookMarked, ArrowLeft, LogOut, Plus, RefreshCw, Key } from "lucide-react";
import mysqlService from "../../services/mysqlService";
import notify from "../../services/notificationService";

export default function ProfileScreen() {
  const navigate = useNavigate();
  const [username, setUsername] = useState(() => localStorage.getItem("username") || "Guest");
  const [userBooks, setUserBooks] = useState([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  const loadUserData = async () => {
    setIsLoadingBooks(true);
    const active = localStorage.getItem("username") || "Guest";
    setUsername(active);

    // 1. Fetch only books uploaded by this user from MySQL
    try {
      const books = await mysqlService.getAllBooks(active);
      setUserBooks(books || []);
    } catch (err) {
      console.warn("Could not fetch user books from MySQL:", err.message);
    } finally {
      setIsLoadingBooks(false);
    }

    // 2. Fetch biometric / profile info for this user only
    try {
      const localProfiles = JSON.parse(localStorage.getItem("face_profiles") || "[]");
      const matched = localProfiles.find(p => (p.name || "").toLowerCase() === active.toLowerCase());
      if (matched) {
        setUserProfile({
          name: matched.name,
          email: matched.email || `${matched.name.toLowerCase().replace(/\s+/g, '')}@bookvault.local`,
          hasBiometric: true,
          createdAt: matched.createdAt
        });
      } else {
        setUserProfile({
          name: active,
          email: `${active.toLowerCase().replace(/\s+/g, '')}@bookvault.local`,
          hasBiometric: false
        });
      }
    } catch (_) {}
  };

  useEffect(() => {
    loadUserData();
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

  const totalPages = userBooks.reduce((acc, b) => acc + (b.pageCount || (b.pages ? b.pages.length : 1)), 0);
  const inProgressCount = userBooks.filter(b => localStorage.getItem(`readingPos_${username}_${b.id}`)).length;

  return (
    <div className="slide-up" style={{ width: "100%", maxWidth: 880, margin: "0 auto", padding: "20px 20px 60px", fontFamily: "'Inter', sans-serif" }}>
      {/* ── Top Navigation ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => navigate("/")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 18px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.85)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
          }}
        >
          <ArrowLeft size={16} /> Back to Vault
        </button>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={loadUserData}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 14px",
              borderRadius: 12,
              background: "#fff",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.04)"
            }}
          >
            <RefreshCw size={14} className={isLoadingBooks ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Active User Profile Hero Card ── */}
      <div
        style={{
          background: "linear-gradient(135deg, #18181b 0%, #27272a 100%)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 24,
          padding: "36px 32px",
          boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
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
            width: 180,
            height: 180,
            background: "radial-gradient(circle, rgba(234,88,12,0.3) 0%, transparent 70%)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          {/* User Avatar */}
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #ea580c, #c2410c)",
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

          {/* User Details */}
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
                  background: "rgba(234,88,12,0.25)",
                  color: "#fb923c",
                  border: "1px solid rgba(234,88,12,0.4)",
                  textTransform: "uppercase",
                }}
              >
                Reader Profile
              </span>
            </div>

            <p style={{ margin: "0 0 12px", fontSize: 14, color: "rgba(255,255,255,0.65)" }}>
              {userProfile?.email || `${username.toLowerCase().replace(/\s+/g, "")}@bookvault.local`}
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#4ade80",
                  background: "rgba(34,197,94,0.15)",
                  padding: "4px 10px",
                  borderRadius: 8,
                }}
              >
                <CheckCircle2 size={13} /> MySQL Connected (Port 3306)
              </span>

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  fontWeight: 600,
                  color: userProfile?.hasBiometric ? "#38bdf8" : "#94a3b8",
                  background: userProfile?.hasBiometric ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.08)",
                  padding: "4px 10px",
                  borderRadius: 8,
                }}
              >
                {userProfile?.hasBiometric ? "👁️ Face Biometrics Enrolled" : "🔑 Password Account"}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {username !== "Guest" ? (
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  padding: "10px 22px",
                  borderRadius: 12,
                  background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.4)",
                  color: "#f87171",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <LogOut size={16} /> Log Out
              </button>
            ) : (
              <button
                type="button"
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

      {/* ── User Reading Statistics Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 28 }}>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 16, padding: 20, boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>My Uploaded Books</span>
            <BookOpen size={18} color="#FF7900" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#FF7900" }}>
            {userBooks.length}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            Books saved in your MySQL vault
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 16, padding: 20, boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Total Pages Extracted</span>
            <Layers size={18} color="#0284c7" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#0284c7" }}>
            {totalPages}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            Pages scanned & OCR converted
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 16, padding: 20, boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>In Progress</span>
            <BookMarked size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#10b981" }}>
            {inProgressCount}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            Books with saved reading bookmarks
          </div>
        </div>
      </div>

      {/* ── My Uploaded Books Shelf (Only User Uploaded Books) ── */}
      <div style={{ background: "#fff", borderRadius: 20, border: "1px solid var(--border)", padding: "24px 28px", boxShadow: "0 6px 24px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
              📚 My Uploaded Books ({userBooks.length})
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              Books stored in MySQL database specifically under account <strong>{username}</strong>.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/")}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #FF7900, #ea580c)",
              border: "none",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <Plus size={15} /> Add / Scan New Book
          </button>
        </div>

        {isLoadingBooks ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
            Loading your uploaded books from MySQL...
          </div>
        ) : userBooks.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", background: "#f8fafc", borderRadius: 14, border: "1px dashed #cbd5e1" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📖</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#334155" }}>No uploaded books yet</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4, marginBottom: 16 }}>
              You haven't uploaded or scanned any books under account <strong>{username}</strong> yet.
            </div>
            <button
              type="button"
              onClick={() => navigate("/")}
              style={{
                padding: "8px 18px",
                borderRadius: 10,
                background: "#FF7900",
                color: "#fff",
                border: "none",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Scan or Upload a Book
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
            {userBooks.map((b) => (
              <div
                key={b.id}
                onClick={() => navigate(`/reader/${b.id}`)}
                className="card card-interactive"
                style={{
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid var(--border)",
                  background: "#fafafa",
                  cursor: "pointer",
                  transition: "transform 0.15s, box-shadow 0.15s"
                }}
              >
                {b.cover || b.coverImage ? (
                  <img
                    src={b.cover || b.coverImage}
                    alt={b.title}
                    style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 10, marginBottom: 8 }}
                  />
                ) : (
                  <div style={{ width: "100%", aspectRatio: "3/4", background: "linear-gradient(135deg, #f0e9df, #e8ddd0)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 8 }}>
                    📖
                  </div>
                )}
                <h3 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {b.title}
                </h3>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "var(--text-muted)" }}>
                  <span>{b.pageCount || (b.pages ? b.pages.length : 1)} {b.pageCount === 1 ? 'Page' : 'Pages'}</span>
                  <span style={{ color: "#FF7900", fontWeight: 700 }}>Read →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
