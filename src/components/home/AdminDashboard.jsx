import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";

const AUTH_URL = import.meta.env.VITE_SPRING_BOOT_AUTH_URL || import.meta.env.VITE_SERVER_URL || "http://localhost:8081";
const BOOK_URL = import.meta.env.VITE_SPRING_BOOT_API_URL || import.meta.env.VITE_SERVER_URL || "http://localhost:8082";

// Liquid Caustics Water Texture matching the reference image provided by the user
const LIQUID_CAUSTIC_BG = "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1400&q=80";

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
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 14px", borderRadius: 99,
      fontSize: 11, fontWeight: 800, letterSpacing: "0.05em",
      background: color + "25", color: color === "#6b7280" ? "#9ca3af" : color,
      border: `1px solid ${color}66`,
      boxShadow: `0 0 16px ${color}25`,
      textTransform: "uppercase",
      backdropFilter: "blur(6px)"
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}` }} />
      {children}
    </span>
  );
}

function MetricCard({ title, value, icon, gradient, color, subtext }) {
  return (
    <div style={{
      background: `url('${LIQUID_CAUSTIC_BG}') center/cover no-repeat, radial-gradient(circle at 50% 30%, #15243b 0%, #0d1627 60%, #060a12 100%)`,
      backgroundBlendMode: "overlay",
      border: "1px solid rgba(255, 255, 255, 0.15)",
      borderRadius: 24,
      padding: "24px 26px",
      boxShadow: "0 16px 40px rgba(6, 10, 18, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      position: "relative",
      overflow: "hidden",
      transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
      cursor: "default"
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = "translateY(-4px)";
      e.currentTarget.style.borderColor = `${color}88`;
      e.currentTarget.style.boxShadow = `0 22px 50px rgba(6, 10, 18, 0.45), 0 0 25px ${color}30`;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
      e.currentTarget.style.boxShadow = "0 16px 40px rgba(6, 10, 18, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)";
    }}
    >
      <div style={{
        position: "absolute", top: -30, right: -30, width: 120, height: 120,
        background: gradient, opacity: 0.22, borderRadius: "50%", filter: "blur(30px)",
        pointerEvents: "none"
      }} />
      <div style={{ zIndex: 1 }}>
        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {title}
        </p>
        <h3 style={{ margin: 0, fontSize: 36, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.02em", fontFamily: "system-ui, -apple-system, sans-serif" }}>
          {value}
        </h3>
        {subtext && (
          <p style={{ margin: "6px 0 0", fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.55)" }}>
            {subtext}
          </p>
        )}
      </div>
      <div style={{
        width: 56, height: 56, borderRadius: 18,
        background: "rgba(255, 255, 255, 0.08)",
        border: "1px solid rgba(255, 255, 255, 0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 26, color: "#fff",
        boxShadow: `0 8px 24px ${color}40`,
        backdropFilter: "blur(8px)",
        zIndex: 1, flexShrink: 0
      }}>
        {icon}
      </div>
    </div>
  );
}

function TableCard({ title, icon, subtitle, count, search, onSearch, loading, error, children }) {
  return (
    <div style={{
      background: `url('${LIQUID_CAUSTIC_BG}') center/cover no-repeat, radial-gradient(circle at 50% 30%, #15243b 0%, #0d1627 60%, #060a12 100%)`,
      backgroundBlendMode: "overlay",
      border: "1px solid rgba(255, 255, 255, 0.15)",
      borderRadius: 30, overflow: "hidden",
      boxShadow: "0 22px 55px rgba(6, 10, 18, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
      transition: "border-color 0.2s"
    }}>
      {/* Header */}
      <div style={{
        padding: "24px 32px 20px",
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        background: "linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 100%)",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 16,
            background: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, boxShadow: "0 6px 18px rgba(0,0,0,0.3)"
          }}>
            {icon}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#ffffff", fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: "-0.01em" }}>
                {title}
              </h2>
              {count !== undefined && (
                <span style={{
                  background: "rgba(234, 88, 12, 0.25)", color: "#ffaa66",
                  border: "1px solid rgba(234, 88, 12, 0.5)",
                  borderRadius: 99, padding: "3px 12px", fontSize: 11, fontWeight: 800,
                  boxShadow: "0 0 14px rgba(234, 88, 12, 0.3)"
                }}>
                  {count} {count === 1 ? "record" : "records"}
                </span>
              )}
            </div>
            {subtitle && (
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {onSearch && (
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="Search records..."
              value={search}
              onChange={e => onSearch(e.target.value)}
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: 99,
                padding: "10px 20px 10px 42px",
                color: "#fff",
                fontSize: 13,
                outline: "none",
                width: 240,
                transition: "all 0.2s",
              }}
              onFocus={e => {
                e.target.style.background = "rgba(255, 255, 255, 0.15)";
                e.target.style.borderColor = "rgba(234, 88, 12, 0.6)";
                e.target.style.boxShadow = "0 0 20px rgba(234, 88, 12, 0.35)";
              }}
              onBlur={e => {
                e.target.style.background = "rgba(255, 255, 255, 0.08)";
                e.target.style.borderColor = "rgba(255, 255, 255, 0.2)";
                e.target.style.boxShadow = "none";
              }}
            />
            <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 15, opacity: 0.6 }}>
              🔍
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "0 0 8px" }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 14, fontWeight: 600 }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>🔄</div>
            Synchronizing MySQL Database records...
          </div>
        ) : error ? (
          <div style={{ padding: 44, textAlign: "center", color: "#f87171", fontSize: 14, fontWeight: 600 }}>
            <div style={{ fontSize: 34, marginBottom: 12 }}>⚠️</div>
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
      padding: "16px 26px", textAlign: "left",
      fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.55)",
      letterSpacing: "0.08em", textTransform: "uppercase",
      borderBottom: "1px solid rgba(255,255,255,0.1)",
      background: "rgba(255,255,255,0.03)"
    },
    td: {
      padding: "18px 26px", fontSize: 13, color: "rgba(255,255,255,0.9)",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      verticalAlign: "middle",
    },
  };

  const filtered = useMemo(() => {
    if (!search) return data;
    const s = search.toLowerCase();
    return data.filter(r =>
      String(r.userId || r.id).includes(s) ||
      (r.userName && r.userName.toLowerCase().includes(s)) ||
      (r.name && r.name.toLowerCase().includes(s)) ||
      (r.role && r.role.toLowerCase().includes(s))
    );
  }, [data, search]);

  return (
    <TableCard
      title="Registered Users (APP_USERS Table)"
      icon="👤"
      subtitle="Biometric face-enrolled book readers & system administrators"
      count={filtered.length}
      search={search}
      onSearch={onSearch}
      loading={loading}
      error={error}
    >
      {filtered.length === 0 ? (
        <div style={{ padding: 48, textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: 14 }}>
          No matching user records found.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={COL_STYLES.th}>#</th>
                <th style={COL_STYLES.th}>User ID</th>
                <th style={COL_STYLES.th}>User Name</th>
                <th style={COL_STYLES.th}>Email Address</th>
                <th style={COL_STYLES.th}>Role</th>
                <th style={COL_STYLES.th}>Face Biometric Login</th>
                <th style={COL_STYLES.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={row.userId || row.id || i} style={{ transition: "background 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ ...COL_STYLES.td, color: "rgba(255,255,255,0.35)", width: 40, fontWeight: 600 }}>{i + 1}</td>
                  <td style={COL_STYLES.td}>
                    <span style={{
                      display: "inline-block", padding: "4px 12px",
                      background: "rgba(99, 102, 241, 0.25)", color: "#a5b4fc",
                      border: "1px solid rgba(99, 102, 241, 0.5)",
                      borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: "monospace",
                    }}>
                      #{row.userId || row.id}
                    </span>
                  </td>
                  <td style={COL_STYLES.td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: "50%",
                        background: "linear-gradient(135deg, #f97316, #ea580c)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 15, fontWeight: 800, color: "#fff", flexShrink: 0,
                        boxShadow: "0 4px 14px rgba(249,115,22,0.4)"
                      }}>
                        {(row.userName || row.name || "?").charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>{row.userName || row.name || "—"}</span>
                    </div>
                  </td>
                  <td style={{ ...COL_STYLES.td, fontSize: 12, color: "rgba(255,255,255,0.65)", fontFamily: "monospace" }}>
                    {row.email || "—"}
                  </td>
                  <td style={COL_STYLES.td}>
                    <Badge color={row.role === "ADMIN" ? "#f59e0b" : row.role === "EMPLOYEE" ? "#38bdf8" : "#22c55e"}>
                      {row.role || "READER"}
                    </Badge>
                  </td>
                  <td style={COL_STYLES.td}>
                    {row.hasBiometric || row.biometric_saved ? (
                      <Badge color="#22c55e">✓ Enrolled</Badge>
                    ) : (
                      <Badge color="#6b7280">✗ Not Enrolled</Badge>
                    )}
                  </td>
                  <td style={COL_STYLES.td}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      fontSize: 12, fontWeight: 700, color: "#4ade80",
                      background: "rgba(34, 197, 94, 0.18)", padding: "4px 12px", borderRadius: 99,
                      border: "1px solid rgba(34, 197, 94, 0.45)"
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 10px #4ade80" }} />
                      Active
                    </span>
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
      padding: "16px 26px", textAlign: "left",
      fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.55)",
      letterSpacing: "0.08em", textTransform: "uppercase",
      borderBottom: "1px solid rgba(255,255,255,0.1)",
      background: "rgba(255,255,255,0.03)"
    },
    td: {
      padding: "18px 26px", fontSize: 13, color: "rgba(255,255,255,0.9)",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
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
      subtitle="Captured cover images and multi-page books stored in MySQL database"
      count={filtered.length}
      search={search}
      onSearch={onSearch}
      loading={loading}
      error={error}
    >
      {filtered.length === 0 ? (
        <div style={{ padding: 48, textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: 14 }}>
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
                <tr key={b.id || i} style={{ transition: "background 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ ...COL_STYLES.td, color: "rgba(255,255,255,0.35)", width: 40, fontWeight: 600 }}>{i + 1}</td>
                  <td style={COL_STYLES.td}>
                    <span style={{
                      display: "inline-block", padding: "4px 12px",
                      background: "rgba(234, 88, 12, 0.25)", color: "#ffaa66",
                      border: "1px solid rgba(234, 88, 12, 0.5)",
                      borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: "monospace",
                    }}>
                      #{b.id}
                    </span>
                  </td>
                  <td style={COL_STYLES.td}>
                    {b.coverImage || b.cover ? (
                      <div
                        onClick={() => onPreviewBook(b)}
                        style={{
                          width: 48, height: 64, borderRadius: 10, overflow: "hidden",
                          cursor: "pointer", border: "1px solid rgba(255,255,255,0.25)",
                          boxShadow: "0 8px 20px rgba(0,0,0,0.5)",
                          transition: "transform 0.2s, box-shadow 0.2s"
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = "scale(1.08)";
                          e.currentTarget.style.boxShadow = "0 10px 25px rgba(234,88,12,0.5)";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = "scale(1)";
                          e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.5)";
                        }}
                      >
                        <img
                          src={b.coverImage || b.cover}
                          alt={b.title}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </div>
                    ) : (
                      <div style={{
                        width: 48, height: 64, borderRadius: 10,
                        background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                      }}>
                        📖
                      </div>
                    )}
                  </td>
                  <td style={COL_STYLES.td}>
                    <div>
                      <span style={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>{b.title || "Untitled Book"}</span>
                      {b.fullText && (
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(255,255,255,0.55)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {b.fullText}
                        </p>
                      )}
                    </div>
                  </td>
                  <td style={COL_STYLES.td}>
                    <Badge color="#38bdf8">{b.language || "ENG"}</Badge>
                  </td>
                  <td style={{ ...COL_STYLES.td, fontSize: 12, color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
                    🕐 {formatTime(b.createdAt)}
                  </td>
                  <td style={COL_STYLES.td}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => onPreviewBook(b)}
                        style={{
                          background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)",
                          color: "#fff", borderRadius: 99, padding: "6px 14px", fontSize: 12,
                          cursor: "pointer", fontWeight: 700, transition: "all 0.2s"
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = "rgba(255,255,255,0.22)";
                          e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                          e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
                        }}
                      >
                        👁 View
                      </button>
                      {onDeleteBook && (
                        <button
                          onClick={() => onDeleteBook(b.id)}
                          style={{
                            background: "rgba(239, 68, 68, 0.22)", border: "1px solid rgba(239, 68, 68, 0.45)",
                            color: "#fca5a5", borderRadius: 99, padding: "6px 14px", fontSize: 12,
                            cursor: "pointer", fontWeight: 700, transition: "all 0.2s"
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = "rgba(239, 68, 68, 0.35)";
                            e.currentTarget.style.borderColor = "#f87171";
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = "rgba(239, 68, 68, 0.22)";
                            e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.45)";
                          }}
                        >
                          🗑 Delete
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
      padding: "16px 26px", textAlign: "left",
      fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.55)",
      letterSpacing: "0.08em", textTransform: "uppercase",
      borderBottom: "1px solid rgba(255,255,255,0.1)",
      background: "rgba(255,255,255,0.03)"
    },
    td: {
      padding: "18px 26px", fontSize: 13, color: "rgba(255,255,255,0.9)",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
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
        <div style={{ padding: 48, textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: 14 }}>
          No login audit records match your query.
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
                <tr key={row.logId || i} style={{ transition: "background 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ ...COL_STYLES.td, color: "rgba(255,255,255,0.35)", width: 40, fontWeight: 600 }}>{i + 1}</td>
                  <td style={COL_STYLES.td}>
                    <span style={{
                      display: "inline-block", padding: "4px 12px",
                      background: "rgba(99, 102, 241, 0.25)", color: "#a5b4fc",
                      border: "1px solid rgba(99, 102, 241, 0.5)",
                      borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: "monospace",
                    }}>
                      {row.userId != null ? `#${row.userId}` : "—"}
                    </span>
                  </td>
                  <td style={COL_STYLES.td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: "50%",
                        background: "linear-gradient(135deg, #f59e0b, #fbbf24)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 15, fontWeight: 800, color: "#fff", flexShrink: 0,
                        boxShadow: "0 4px 14px rgba(245,158,11,0.4)"
                      }}>
                        {(row.userName || "?").charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>{row.userName}</span>
                    </div>
                  </td>
                  <td style={{ ...COL_STYLES.td, color: "rgba(255,255,255,0.65)", fontFamily: "monospace", fontSize: 12 }}>
                    {row.email || "—"}
                  </td>
                  <td style={{ ...COL_STYLES.td, fontSize: 12, color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
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
      .then(r => {
        if (!r.ok) throw new Error("Auth service HTTP error");
        return r.json();
      })
      .then(data => {
        setUsers(Array.isArray(data) ? data : []);
        setUsersLoading(false);
      })
      .catch(() => {
        // Fallback to local Vite server API plugin (/api/users/readers)
        fetch("/api/users/readers")
          .then(r => r.json())
          .then(data => {
            setUsers(Array.isArray(data) ? data : []);
            setUsersError(null);
            setUsersLoading(false);
          })
          .catch(() => {
            setUsersError("Could not reach auth service (Port 8081). Ensure MySQL & Spring Boot are running.");
            setUsersLoading(false);
          });
      });

    // 2. Fetch Books from MySQL
    setBooksLoading(true);
    setBooksError(null);
    fetch(`${BOOK_URL}/api/books`)
      .then(r => {
        if (!r.ok) throw new Error("Book service HTTP error");
        return r.json();
      })
      .then(data => {
        setBooks(Array.isArray(data) ? data : []);
        setBooksLoading(false);
      })
      .catch(() => {
        // Fallback to local Vite server API plugin (/api/books)
        fetch("/api/books")
          .then(r => r.json())
          .then(data => {
            setBooks(Array.isArray(data) ? data : []);
            setBooksError(null);
            setBooksLoading(false);
          })
          .catch(() => {
            setBooksError("Could not reach book service (Port 8082). Ensure MySQL & Spring Boot are running.");
            setBooksLoading(false);
          });
      });

    // 3. Fetch Logins
    setLoginsLoading(true);
    setLoginsError(null);
    fetch(`${AUTH_URL}/api/users/admin-logins`)
      .then(r => {
        if (!r.ok) throw new Error("Auth service HTTP error");
        return r.json();
      })
      .then(data => {
        setLogins(Array.isArray(data) ? data : []);
        setLoginsLoading(false);
      })
      .catch(() => {
        // Fallback to local Vite server API plugin (/api/users/admin-logins)
        fetch("/api/users/admin-logins")
          .then(r => r.json())
          .then(data => {
            setLogins(Array.isArray(data) ? data : []);
            setLoginsError(null);
            setLoginsLoading(false);
          })
          .catch(() => {
            setLoginsError("Could not reach auth service (Port 8081). Ensure MySQL & Spring Boot are running.");
            setLoginsLoading(false);
          });
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

  const userRole = localStorage.getItem("role") || localStorage.getItem("user_role");
  const isAdmin = userRole === "ADMIN" || (username && username.toLowerCase().includes("admin"));

  const biometricCount = useMemo(() => users.filter(u => u.hasBiometric || u.biometric_saved).length, [users]);

  if (!isAdmin) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "var(--bg-base, #f3ede4)",
        padding: "60px 24px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div style={{
          maxWidth: 480,
          width: "100%",
          background: `url('${LIQUID_CAUSTIC_BG}') center/cover no-repeat, radial-gradient(circle at 50% 30%, #15243b 0%, #0d1627 60%, #060a12 100%)`,
          backgroundBlendMode: "overlay",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: 32,
          padding: "48px 38px",
          textAlign: "center",
          boxShadow: "0 25px 60px rgba(6, 10, 18, 0.3)"
        }}>
          <div style={{
            width: 76, height: 76, borderRadius: 26,
            background: "rgba(234, 88, 12, 0.25)", border: "1px solid rgba(234, 88, 12, 0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 38, margin: "0 auto 24px", boxShadow: "0 0 30px rgba(234, 88, 12, 0.35)"
          }}>
            🔒
          </div>
          <h2 style={{ margin: "0 0 14px", fontSize: 28, fontWeight: 900, color: "#fff", fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: "-0.02em" }}>
            Admin Access Restricted
          </h2>
          <p style={{ margin: "0 0 30px", fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
            The MySQL Database Monitor is restricted to administrators. You are signed in as <strong style={{ color: "#ffaa66" }}>{username}</strong>.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
            <button
              onClick={() => navigate("/")}
              style={{
                padding: "13px 24px",
                borderRadius: 99,
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.25)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                transition: "all 0.25s"
              }}
            >
              ← Back to App
            </button>
            <button
              onClick={() => navigate("/admin-login")}
              style={{
                padding: "13px 28px",
                borderRadius: 99,
                background: "linear-gradient(135deg, #ea580c, #c2410c)",
                border: "none",
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: "0 10px 30px rgba(234, 88, 12, 0.5)",
                transition: "all 0.25s"
              }}
            >
              🔑 Sign In as Admin
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      width: "100%",
      background: "var(--bg-base, #f3ede4)",
      padding: "32px 32px 100px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "#fff",
      boxSizing: "border-box"
    }}>

      {/* Hero Header Card Container with Liquid Caustics Background Texture from Reference Image */}
      <div style={{ maxWidth: 1280, margin: "0 auto 36px" }}>
        <div style={{
          background: `url('${LIQUID_CAUSTIC_BG}') center/cover no-repeat, radial-gradient(circle at 50% 30%, #172a46 0%, #0d182a 60%, #060a12 100%)`,
          backgroundBlendMode: "overlay",
          border: "1px solid rgba(255, 255, 255, 0.18)",
          borderRadius: 36,
          padding: "40px 44px",
          boxShadow: "0 28px 70px rgba(6, 10, 18, 0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
          position: "relative",
          overflow: "hidden"
        }}>
          {/* Top Pill Badges matching reference UI screenshot */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 24, position: "relative", zIndex: 1 }}>
            <button
              onClick={() => navigate("/")}
              style={{
                background: "rgba(255, 255, 255, 0.12)", border: "1px solid rgba(255, 255, 255, 0.25)",
                color: "#fff", borderRadius: 99, padding: "7px 18px",
                fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 700,
                display: "inline-flex", alignItems: "center", gap: 8,
                backdropFilter: "blur(8px)",
                transition: "all 0.2s"
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255, 255, 255, 0.22)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)"}
            >
              ← Back to App
            </button>

            {/* Glowing Orange User Badge */}
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 18px", borderRadius: 99, fontSize: 12, fontWeight: 800,
              background: "rgba(234, 88, 12, 0.25)", color: "#ffaa66",
              border: "1px solid rgba(234, 88, 12, 0.55)",
              boxShadow: "0 0 20px rgba(234, 88, 12, 0.35)", backdropFilter: "blur(8px)"
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ffaa66", boxShadow: "0 0 10px #ffaa66" }} />
              👤 Logged in as: {username}
            </span>

            {/* Glowing Indigo Service Badge */}
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 18px", borderRadius: 99, fontSize: 12, fontWeight: 800,
              background: "rgba(99, 102, 241, 0.25)", color: "#a5b4fc",
              border: "1px solid rgba(99, 102, 241, 0.55)",
              boxShadow: "0 0 20px rgba(99, 102, 241, 0.35)", backdropFilter: "blur(8px)"
            }}>
              👥 View MySQL Users & Audits
            </span>

            {/* Glowing Green Live Badge */}
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 18px", borderRadius: 99, fontSize: 12, fontWeight: 800,
              background: "rgba(34, 197, 94, 0.25)", color: "#4ade80",
              border: "1px solid rgba(34, 197, 94, 0.55)",
              boxShadow: "0 0 20px rgba(34, 197, 94, 0.35)", backdropFilter: "blur(8px)"
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 10px #4ade80" }} />
              ● MySQL Live
            </span>

            <div style={{ marginLeft: "auto" }}>
              <button
                onClick={fetchData}
                style={{
                  background: "linear-gradient(135deg, #ea580c, #c2410c)",
                  border: "1px solid rgba(255, 255, 255, 0.25)", color: "#fff",
                  borderRadius: 99, padding: "11px 24px",
                  fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 800,
                  display: "inline-flex", alignItems: "center", gap: 8,
                  boxShadow: "0 10px 28px rgba(234, 88, 12, 0.45)",
                  transition: "all 0.2s"
                }}
                onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"}
                onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
              >
                🔄 Refresh MySQL Data
              </button>
            </div>
          </div>

          {/* Large Serif Title matching reference screenshot */}
          <h1 style={{
            margin: 0, fontSize: 46, fontWeight: 900, color: "#fff",
            fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: "-0.02em",
            position: "relative", zIndex: 1
          }}>
            Admin Dashboard & Database Monitor
          </h1>
          <p style={{ margin: "12px 0 0", fontSize: 15, color: "rgba(255, 255, 255, 0.7)", fontWeight: 500, position: "relative", zIndex: 1 }}>
            Direct MySQL Synchronization for <span style={{ color: "#ffaa66", fontWeight: 800 }}>APP_USERS</span>, <span style={{ color: "#a5b4fc", fontWeight: 800 }}>BOOKS</span>, and <span style={{ color: "#4ade80", fontWeight: 800 }}>LOGIN_HISTORY</span> tables.
          </p>
        </div>
      </div>

      {/* ── KPI Metric Summary Grid with Liquid Caustics Backgrounds ── */}
      <div style={{
        maxWidth: 1280, margin: "0 auto 36px",
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20,
      }}>
        <MetricCard
          title="Total Users"
          value={usersLoading ? "..." : users.length}
          icon="👥"
          gradient="linear-gradient(135deg, #6366f1, #818cf8)"
          color="#6366f1"
          subtext="Registered in APP_USERS"
        />
        <MetricCard
          title="Face Enrolled"
          value={usersLoading ? "..." : biometricCount}
          icon="👁️"
          gradient="linear-gradient(135deg, #10b981, #34d399)"
          color="#10b981"
          subtext="Biometric face descriptors saved"
        />
        <MetricCard
          title="MySQL Books"
          value={booksLoading ? "..." : books.length}
          icon="📚"
          gradient="linear-gradient(135deg, #f97316, #fb923c)"
          color="#f97316"
          subtext="Books saved in BOOKS table"
        />
        <MetricCard
          title="Login Audits"
          value={loginsLoading ? "..." : logins.length}
          icon="🔐"
          gradient="linear-gradient(135deg, #f59e0b, #fbbf24)"
          color="#f59e0b"
          subtext="Records in LOGIN_HISTORY"
        />
      </div>

      {/* ── Tab Switcher Pill Bar ── */}
      <div style={{
        maxWidth: 1280, margin: "0 auto 32px",
        display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4
      }}>
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
              padding: "12px 26px", borderRadius: 99, fontSize: 13, fontWeight: 800,
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.25s",
              border: activeTab === tab.id ? "1px solid rgba(234, 88, 12, 0.6)" : "1px solid rgba(13, 21, 43, 0.2)",
              background: activeTab === tab.id ? "linear-gradient(135deg, #ea580c, #c2410c)" : "#0d1627",
              color: activeTab === tab.id ? "#fff" : "rgba(255, 255, 255, 0.75)",
              boxShadow: activeTab === tab.id ? "0 8px 24px rgba(234, 88, 12, 0.4)" : "0 4px 12px rgba(13, 21, 43, 0.08)"
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Table Content ── */}
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: 36 }}>
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
            background: "rgba(5, 10, 18, 0.82)", backdropFilter: "blur(12px)", zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: `url('${LIQUID_CAUSTIC_BG}') center/cover no-repeat, radial-gradient(circle at 50% 30%, #15243b 0%, #0d1627 60%, #060a12 100%)`,
              backgroundBlendMode: "overlay",
              borderRadius: 32,
              boxShadow: "0 30px 90px rgba(0,0,0,0.8), 0 0 50px rgba(234, 88, 12, 0.25)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              maxWidth: 600, width: "100%",
              overflow: "hidden", position: "relative",
            }}
          >
            <button
              onClick={() => setPreviewBook(null)}
              style={{
                position: "absolute", top: 18, right: 18, zIndex: 10,
                background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: "50%", width: 40, height: 40, cursor: "pointer", color: "#fff",
                fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s"
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.3)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}
            >
              ✕
            </button>

            {previewBook.coverImage || previewBook.cover ? (
              <img
                src={previewBook.coverImage || previewBook.cover}
                alt={previewBook.title}
                style={{ width: "100%", maxHeight: 440, objectFit: "contain", background: "#080c14", display: "block" }}
              />
            ) : (
              <div style={{
                width: "100%", height: 260, background: "rgba(234, 88, 12, 0.15)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72,
              }}>
                📖
              </div>
            )}

            <div style={{ padding: "26px 32px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <span style={{
                  padding: "4px 12px", background: "rgba(234,88,12,0.25)", color: "#ffaa66",
                  border: "1px solid rgba(234,88,12,0.5)",
                  borderRadius: 10, fontSize: 12, fontWeight: 800, fontFamily: "monospace",
                }}>
                  ID #{previewBook.id}
                </span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
                  Saved in MySQL on {formatTime(previewBook.createdAt)}
                </span>
              </div>
              <h2 style={{ margin: "0 0 14px", fontSize: 24, fontWeight: 900, color: "#fff", fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: "-0.01em" }}>
                {previewBook.title}
              </h2>
              {previewBook.fullText && (
                <div style={{
                  background: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 18,
                  fontSize: 13, color: "rgba(255,255,255,0.9)", maxHeight: 150, overflowY: "auto",
                  border: "1px solid rgba(255,255,255,0.15)", whiteSpace: "pre-wrap", lineHeight: 1.6
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
