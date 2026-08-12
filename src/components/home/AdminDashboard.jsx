import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";

const AUTH_URL = import.meta.env.VITE_SPRING_BOOT_AUTH_URL || import.meta.env.VITE_SERVER_URL || "http://localhost:3001";
const BOOK_URL = import.meta.env.VITE_SPRING_BOOT_API_URL || import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

// ── Helpers ───────────────────────────────────────────────
function formatTime(raw) {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch { return String(raw); }
}

function Badge({ children, color = "#22c55e" }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 99,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
      background: color + "22", color, border: `1px solid ${color}55`,
      textTransform: "uppercase",
    }}>
      {children}
    </span>
  );
}

function MetricCard({ title, value, icon, gradient, color, subtext }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #111 0%, #1a1a1a 100%)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 18,
      padding: "20px 24px",
      boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: -20, right: -20, width: 80, height: 80,
        background: gradient, opacity: 0.15, borderRadius: "50%", filter: "blur(20px)",
      }} />
      <div>
        <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {title}
        </p>
        <h3 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
          {value}
        </h3>
        {subtext && (
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
            {subtext}
          </p>
        )}
      </div>
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: gradient,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 24, boxShadow: `0 8px 24px ${color}33`,
      }}>
        {icon}
      </div>
    </div>
  );
}

function TableCard({ title, icon, subtitle, count, search, onSearch, loading, error, children }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #0d0d0d 0%, #171717 100%)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 20, overflow: "hidden",
      boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
    }}>
      {/* Header */}
      <div style={{
        padding: "20px 28px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.02)",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 26 }}>{icon}</span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
                {title}
              </h2>
              {count !== undefined && (
                <span style={{
                  background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)",
                  borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: 700,
                }}>
                  {count}
                </span>
              )}
            </div>
            {subtitle && (
              <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {onSearch && (
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="Search records…"
              value={search}
              onChange={e => onSearch(e.target.value)}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                padding: "8px 14px 8px 32px",
                color: "#fff",
                fontSize: 13,
                outline: "none",
                width: 200,
              }}
            />
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, opacity: 0.5 }}>
              🔍
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "0 0 8px" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
            Loading MySQL Database records…
          </div>
        ) : error ? (
          <div style={{ padding: 36, textAlign: "center", color: "#ef4444", fontSize: 13 }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>⚠️</div>
            {error}
          </div>
        ) : children}
      </div>
    </div>
  );
}

// ── Table 1: Registered Users & Readers (APP_USERS) ────────
function ReaderUsersTable({ data, loading, error, search, onSearch }) {
  const COL_STYLES = {
    th: {
      padding: "12px 20px", textAlign: "left",
      fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)",
      letterSpacing: "0.08em", textTransform: "uppercase",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    },
    td: {
      padding: "14px 20px", fontSize: 13, color: "rgba(255,255,255,0.85)",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
      verticalAlign: "middle",
    },
  };

  const filtered = useMemo(() => {
    if (!search) return data;
    const s = search.toLowerCase();
    return data.filter(r =>
      String(r.userId).includes(s) ||
      (r.userName && r.userName.toLowerCase().includes(s)) ||
      (r.role && r.role.toLowerCase().includes(s))
    );
  }, [data, search]);

  return (
    <TableCard
      title="Registered Users (APP_USERS Table)"
      icon="👤"
      subtitle="Biometric face-enrolled book readers & system users"
      count={filtered.length}
      search={search}
      onSearch={onSearch}
      loading={loading}
      error={error}
    >
      {filtered.length === 0 ? (
        <div style={{ padding: 36, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
          No user records match your query.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={COL_STYLES.th}>#</th>
                <th style={COL_STYLES.th}>User ID</th>
                <th style={COL_STYLES.th}>User Name</th>
                <th style={COL_STYLES.th}>Role</th>
                <th style={COL_STYLES.th}>Face Biometric Login</th>
                <th style={COL_STYLES.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={row.userId || i} style={{ transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ ...COL_STYLES.td, color: "rgba(255,255,255,0.25)", width: 40 }}>{i + 1}</td>
                  <td style={COL_STYLES.td}>
                    <span style={{
                      display: "inline-block", padding: "2px 8px",
                      background: "rgba(99,102,241,0.15)", color: "#818cf8",
                      borderRadius: 6, fontSize: 12, fontWeight: 600, fontFamily: "monospace",
                    }}>
                      #{row.userId}
                    </span>
                  </td>
                  <td style={COL_STYLES.td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: "linear-gradient(135deg, #f97316, #fb923c)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0,
                      }}>
                        {(row.userName || "?").charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600 }}>{row.userName || "—"}</span>
                    </div>
                  </td>
                  <td style={COL_STYLES.td}>
                    <Badge color={row.role === "ADMIN" ? "#f59e0b" : row.role === "EMPLOYEE" ? "#38bdf8" : "#22c55e"}>
                      {row.role || "USER"}
                    </Badge>
                  </td>
                  <td style={COL_STYLES.td}>
                    {row.hasBiometric ? (
                      <Badge color="#22c55e">✓ Enrolled</Badge>
                    ) : (
                      <Badge color="#6b7280">✗ Not Enrolled</Badge>
                    )}
                  </td>
                  <td style={COL_STYLES.td}>
                    <span style={{ fontSize: 12, color: "#22c55e" }}>● Active</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TableCard>
  );
}

// ── Table 2: MySQL Uploaded Books (BOOKS Table) ────────────
function BooksTable({ data, loading, error, search, onSearch, onPreviewBook, onDeleteBook }) {
  const COL_STYLES = {
    th: {
      padding: "12px 20px", textAlign: "left",
      fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)",
      letterSpacing: "0.08em", textTransform: "uppercase",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    },
    td: {
      padding: "14px 20px", fontSize: 13, color: "rgba(255,255,255,0.85)",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
      verticalAlign: "middle",
    },
  };

  const filtered = useMemo(() => {
    if (!search) return data;
    const s = search.toLowerCase();
    return data.filter(b =>
      String(b.id).includes(s) ||
      (b.title && b.title.toLowerCase().includes(s)) ||
      (b.language && b.language.toLowerCase().includes(s))
    );
  }, [data, search]);

  return (
    <TableCard
      title="Uploaded Books (BOOKS Table)"
      icon="📚"
      subtitle="Captured cover images and books stored in MySQL database"
      count={filtered.length}
      search={search}
      onSearch={onSearch}
      loading={loading}
      error={error}
    >
      {filtered.length === 0 ? (
        <div style={{ padding: 36, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
          No book records found in MySQL database.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={COL_STYLES.th}>#</th>
                <th style={COL_STYLES.th}>Book ID</th>
                <th style={COL_STYLES.th}>Cover Image</th>
                <th style={COL_STYLES.th}>Book Title</th>
                <th style={COL_STYLES.th}>Language</th>
                <th style={COL_STYLES.th}>Saved In MySQL</th>
                <th style={COL_STYLES.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b, i) => (
                <tr key={b.id || i} style={{ transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ ...COL_STYLES.td, color: "rgba(255,255,255,0.25)", width: 40 }}>{i + 1}</td>
                  <td style={COL_STYLES.td}>
                    <span style={{
                      display: "inline-block", padding: "2px 8px",
                      background: "rgba(234,88,12,0.15)", color: "#fb923c",
                      borderRadius: 6, fontSize: 12, fontWeight: 600, fontFamily: "monospace",
                    }}>
                      #{b.id}
                    </span>
                  </td>
                  <td style={COL_STYLES.td}>
                    {b.coverImage ? (
                      <div
                        onClick={() => onPreviewBook(b)}
                        style={{
                          width: 44, height: 56, borderRadius: 6, overflow: "hidden",
                          cursor: "pointer", border: "1px solid rgba(255,255,255,0.2)",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                        }}
                      >
                        <img
                          src={b.coverImage}
                          alt={b.title}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </div>
                    ) : (
                      <div style={{
                        width: 44, height: 56, borderRadius: 6,
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                      }}>
                        📖
                      </div>
                    )}
                  </td>
                  <td style={COL_STYLES.td}>
                    <div>
                      <span style={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>{b.title || "Untitled Book"}</span>
                      {b.fullText && (
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.35)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {b.fullText}
                        </p>
                      )}
                    </div>
                  </td>
                  <td style={COL_STYLES.td}>
                    <Badge color="#38bdf8">{b.language || "ENG"}</Badge>
                  </td>
                  <td style={{ ...COL_STYLES.td, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                    🕐 {formatTime(b.createdAt)}
                  </td>
                  <td style={COL_STYLES.td}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => onPreviewBook(b)}
                        style={{
                          background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                          color: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 11,
                          cursor: "pointer", fontWeight: 600,
                        }}
                      >
                        👁 View
                      </button>
                      {onDeleteBook && (
                        <button
                          onClick={() => onDeleteBook(b.id)}
                          style={{
                            background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
                            color: "#ef4444", borderRadius: 8, padding: "5px 10px", fontSize: 11,
                            cursor: "pointer", fontWeight: 600,
                          }}
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TableCard>
  );
}

// ── Table 3: Admin & User Login History (LOGIN_HISTORY) ─────
function AdminLoginTable({ data, loading, error, search, onSearch }) {
  const COL_STYLES = {
    th: {
      padding: "12px 20px", textAlign: "left",
      fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)",
      letterSpacing: "0.08em", textTransform: "uppercase",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    },
    td: {
      padding: "14px 20px", fontSize: 13, color: "rgba(255,255,255,0.85)",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
      verticalAlign: "middle",
    },
  };

  const filtered = useMemo(() => {
    if (!search) return data;
    const s = search.toLowerCase();
    return data.filter(l =>
      String(l.logId).includes(s) ||
      (l.userName && l.userName.toLowerCase().includes(s)) ||
      (l.email && l.email.toLowerCase().includes(s)) ||
      (l.authMethod && l.authMethod.toLowerCase().includes(s))
    );
  }, [data, search]);

  return (
    <TableCard
      title="Login History Audit (LOGIN_HISTORY Table)"
      icon="🔐"
      subtitle="Security audit trail — User Name · Email · User ID · Login Time · Biometric Face Match"
      count={filtered.length}
      search={search}
      onSearch={onSearch}
      loading={loading}
      error={error}
    >
      {filtered.length === 0 ? (
        <div style={{ padding: 36, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
          No login records match your query.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={COL_STYLES.th}>#</th>
                <th style={COL_STYLES.th}>User ID</th>
                <th style={COL_STYLES.th}>User Name</th>
                <th style={COL_STYLES.th}>Email ID</th>
                <th style={COL_STYLES.th}>Login Time</th>
                <th style={COL_STYLES.th}>Method</th>
                <th style={COL_STYLES.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={row.logId || i} style={{ transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ ...COL_STYLES.td, color: "rgba(255,255,255,0.25)", width: 40 }}>{i + 1}</td>
                  <td style={COL_STYLES.td}>
                    <span style={{
                      display: "inline-block", padding: "2px 8px",
                      background: "rgba(99,102,241,0.15)", color: "#818cf8",
                      borderRadius: 6, fontSize: 12, fontWeight: 600, fontFamily: "monospace",
                    }}>
                      {row.userId != null ? `#${row.userId}` : "—"}
                    </span>
                  </td>
                  <td style={COL_STYLES.td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: "linear-gradient(135deg, #f59e0b, #fbbf24)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0,
                      }}>
                        {(row.userName || "?").charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600 }}>{row.userName}</span>
                    </div>
                  </td>
                  <td style={{ ...COL_STYLES.td, color: "rgba(255,255,255,0.5)", fontFamily: "monospace", fontSize: 12 }}>
                    {row.email || "—"}
                  </td>
                  <td style={{ ...COL_STYLES.td, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                    🕐 {formatTime(row.loginTime)}
                  </td>
                  <td style={COL_STYLES.td}>
                    <Badge color={row.authMethod === "FACE_RECOGNITION" ? "#818cf8" : "#38bdf8"}>
                      {row.authMethod === "FACE_RECOGNITION" ? "👁 Face" : row.authMethod === "PASSWORD" ? "🔑 Password" : row.authMethod || "—"}
                    </Badge>
                  </td>
                  <td style={COL_STYLES.td}>
                    <Badge color={row.status === "SUCCESS" ? "#22c55e" : "#ef4444"}>
                      {row.status === "SUCCESS" ? "✓ Success" : "✗ Failed"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TableCard>
  );
}

// ── Main Dashboard Page ───────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const username = localStorage.getItem("username") || "Admin";

  // State
  const [activeTab, setActiveTab] = useState("all"); // "all", "users", "books", "logins"
  const [userSearch, setUserSearch] = useState("");
  const [bookSearch, setBookSearch] = useState("");
  const [loginSearch, setLoginSearch] = useState("");

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState(null);

  const [books, setBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [booksError, setBooksError] = useState(null);

  const [logins, setLogins] = useState([]);
  const [loginsLoading, setLoginsLoading] = useState(true);
  const [loginsError, setLoginsError] = useState(null);

  const [previewBook, setPreviewBook] = useState(null);

  const fetchData = useCallback(() => {
    // 1. Fetch Users
    setUsersLoading(true);
    setUsersError(null);
    fetch(`${AUTH_URL}/api/users/readers`)
      .then(r => r.json())
      .then(data => {
        setUsers(Array.isArray(data) ? data : []);
        setUsersLoading(false);
      })
      .catch(err => {
        console.error("Users fetch error:", err);
        setUsersError("Could not reach auth service (Port 8081). Ensure MySQL & Spring Boot are running.");
        setUsersLoading(false);
      });

    // 2. Fetch Books from MySQL
    setBooksLoading(true);
    setBooksError(null);
    fetch(`${BOOK_URL}/api/books`)
      .then(r => r.json())
      .then(data => {
        setBooks(Array.isArray(data) ? data : []);
        setBooksLoading(false);
      })
      .catch(err => {
        console.error("Books fetch error:", err);
        setBooksError("Could not reach book service (Port 8082). Ensure MySQL & Spring Boot are running.");
        setBooksLoading(false);
      });

    // 3. Fetch Logins
    setLoginsLoading(true);
    setLoginsError(null);
    fetch(`${AUTH_URL}/api/users/admin-logins`)
      .then(r => r.json())
      .then(data => {
        setLogins(Array.isArray(data) ? data : []);
        setLoginsLoading(false);
      })
      .catch(err => {
        console.error("Logins fetch error:", err);
        setLoginsError("Could not reach auth service (Port 8081). Ensure MySQL & Spring Boot are running.");
        setLoginsLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteBook = (id) => {
    if (!window.confirm("Are you sure you want to delete this book from MySQL database?")) return;
    fetch(`${BOOK_URL}/api/books/${id}`, { method: "DELETE" })
      .then(() => {
        setBooks(prev => prev.filter(b => b.id !== id));
      })
      .catch(err => alert("Failed to delete book: " + err.message));
  };

  const biometricCount = useMemo(() => users.filter(u => u.hasBiometric).length, [users]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080808",
      padding: "32px 24px 80px",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      color: "#fff",
    }}>
      {/* Page Header */}
      <div style={{ maxWidth: 1200, margin: "0 auto 32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <button
                onClick={() => navigate("/")}
                style={{
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.8)", borderRadius: 10, padding: "6px 14px",
                  fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                ← Back to App
              </button>
              <span style={{
                padding: "3px 12px", borderRadius: 99, fontSize: 11, fontWeight: 800,
                background: "rgba(245,158,11,0.15)", color: "#f59e0b",
                border: "1px solid rgba(245,158,11,0.3)", textTransform: "uppercase", letterSpacing: "0.06em",
              }}>
                MySQL Admin Control Center
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
              📊 Admin Dashboard & Database Monitor
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "rgba(255,255,255,0.4)" }}>
              Direct MySQL Synchronization for <span style={{ color: "#f59e0b", fontWeight: 700 }}>APP_USERS</span>, <span style={{ color: "#fb923c", fontWeight: 700 }}>BOOKS</span>, and <span style={{ color: "#818cf8", fontWeight: 700 }}>LOGIN_HISTORY</span> tables.
            </p>
          </div>

          {/* Live refresh button */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={fetchData}
              style={{
                background: "linear-gradient(135deg, #f97316, #ea580c)",
                border: "none", color: "#fff",
                borderRadius: 12, padding: "10px 20px",
                fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 700,
                display: "flex", alignItems: "center", gap: 8,
                boxShadow: "0 6px 20px rgba(234,88,12,0.35)",
              }}
            >
              🔄 Refresh MySQL Data
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Metric Summary Grid ── */}
      <div style={{
        maxWidth: 1200, margin: "0 auto 32px",
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18,
      }}>
        <MetricCard
          title="Total Users"
          value={usersLoading ? "…" : users.length}
          icon="👥"
          gradient="linear-gradient(135deg, #6366f1, #818cf8)"
          color="#6366f1"
          subtext="Registered in APP_USERS"
        />
        <MetricCard
          title="Face Enrolled"
          value={usersLoading ? "…" : biometricCount}
          icon="👁️"
          gradient="linear-gradient(135deg, #22c55e, #4ade80)"
          color="#22c55e"
          subtext="Biometric face descriptors saved"
        />
        <MetricCard
          title="MySQL Books"
          value={booksLoading ? "…" : books.length}
          icon="📚"
          gradient="linear-gradient(135deg, #f97316, #fb923c)"
          color="#f97316"
          subtext="Books saved in BOOKS table"
        />
        <MetricCard
          title="Login Audits"
          value={loginsLoading ? "…" : logins.length}
          icon="🔐"
          gradient="linear-gradient(135deg, #f59e0b, #fbbf24)"
          color="#f59e0b"
          subtext="Records in LOGIN_HISTORY"
        />
      </div>

      {/* ── Tab Switcher ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto 24px", display: "flex", gap: 10, overflowX: "auto" }}>
        {[
          { id: "all", label: "All Tables" },
          { id: "users", label: `👤 Registered Users (${users.length})` },
          { id: "books", label: `📚 MySQL Books (${books.length})` },
          { id: "logins", label: `🔐 Login Audits (${logins.length})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "9px 18px", borderRadius: 12, fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
              border: activeTab === tab.id ? "1px solid rgba(245,158,11,0.5)" : "1px solid rgba(255,255,255,0.08)",
              background: activeTab === tab.id ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.03)",
              color: activeTab === tab.id ? "#f59e0b" : "rgba(255,255,255,0.6)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Table Content ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32 }}>
        {(activeTab === "all" || activeTab === "users") && (
          <ReaderUsersTable
            data={users}
            loading={usersLoading}
            error={usersError}
            search={userSearch}
            onSearch={setUserSearch}
          />
        )}

        {(activeTab === "all" || activeTab === "books") && (
          <BooksTable
            data={books}
            loading={booksLoading}
            error={booksError}
            search={bookSearch}
            onSearch={setBookSearch}
            onPreviewBook={setPreviewBook}
            onDeleteBook={handleDeleteBook}
          />
        )}

        {(activeTab === "all" || activeTab === "logins") && (
          <AdminLoginTable
            data={logins}
            loading={loginsLoading}
            error={loginsError}
            search={loginSearch}
            onSearch={setLoginSearch}
          />
        )}
      </div>

      {/* ── Book Preview Modal ── */}
      {previewBook && (
        <div
          onClick={() => setPreviewBook(null)}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.85)", zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#161616", borderRadius: 20,
              boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
              border: "1px solid rgba(255,255,255,0.1)",
              maxWidth: 540, width: "100%",
              overflow: "hidden", position: "relative",
            }}
          >
            <button
              onClick={() => setPreviewBook(null)}
              style={{
                position: "absolute", top: 14, right: 14, zIndex: 10,
                background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%",
                width: 36, height: 36, cursor: "pointer", color: "#fff",
                fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              ✕
            </button>

            {previewBook.coverImage ? (
              <img
                src={previewBook.coverImage}
                alt={previewBook.title}
                style={{ width: "100%", maxHeight: 420, objectFit: "contain", background: "#0a0a0a", display: "block" }}
              />
            ) : (
              <div style={{
                width: "100%", height: 260, background: "rgba(255,255,255,0.03)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64,
              }}>
                📖
              </div>
            )}

            <div style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{
                  padding: "2px 8px", background: "rgba(234,88,12,0.2)", color: "#fb923c",
                  borderRadius: 6, fontSize: 12, fontWeight: 700, fontFamily: "monospace",
                }}>
                  ID #{previewBook.id}
                </span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                  Saved in MySQL on {formatTime(previewBook.createdAt)}
                </span>
              </div>
              <h2 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 700, color: "#fff" }}>
                {previewBook.title}
              </h2>
              {previewBook.fullText && (
                <div style={{
                  background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 12,
                  fontSize: 13, color: "rgba(255,255,255,0.7)", maxHeight: 120, overflowY: "auto",
                  border: "1px solid rgba(255,255,255,0.06)", whiteSpace: "pre-wrap",
                }}>
                  {previewBook.fullText}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
