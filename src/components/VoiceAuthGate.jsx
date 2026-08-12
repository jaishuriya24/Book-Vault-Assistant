import { useVoiceAuthFlow, AUTH_STATE } from "../voice/useVoiceAuthFlow";

const authApiUrl = import.meta.env.VITE_SPRING_BOOT_AUTH_URL || import.meta.env.VITE_SERVER_URL || "http://localhost:8081";

async function loginApi(email, password) {
  try {
    const res = await fetch(`${authApiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return { ok: false, error: "invalid credentials" };
    const data = await res.json();
    if (data.token) localStorage.setItem("readease_token", data.token);
    return { ok: true };
  } catch {
    return { ok: false, error: "network error" };
  }
}

async function registerApi(email, password, name) {
  try {
    const res = await fetch(`${authApiUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || email.split("@")[0], email, password }),
    });
    if (!res.ok) return { ok: false, error: "could not register" };
    return { ok: true };
  } catch {
    return { ok: false, error: "network error" };
  }
}

export default function VoiceAuthGate({ langKey = "en", onAuthenticated }) {
  const { state, mode, username, errorMsg, restart } = useVoiceAuthFlow({
    onLogin: loginApi,
    onRegister: registerApi,
    langKey,
  });

  if (state === AUTH_STATE.SUCCESS) {
    onAuthenticated?.();
  }

  return (
    <div className="voice-auth-gate" aria-live="polite" style={{
      padding: "24px",
      borderRadius: "16px",
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
      marginTop: "16px",
      fontFamily: "Inter, sans-serif"
    }}>
      <p className="sr-only">
        Voice login active. Kutty is guiding you — no typing needed.
      </p>
      <div className="voice-auth-status" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <p style={{ margin: 0, fontSize: "15px" }}>Status: <span style={{ fontWeight: 700, color: "var(--accent-orange, #ff7900)" }}>{state}</span></p>
        {mode && <p style={{ margin: 0, fontSize: "14px" }}>Mode: <strong>{mode}</strong></p>}
        {username && <p style={{ margin: 0, fontSize: "14px" }}>Username heard: <strong style={{ color: "#38bdf8" }}>{username}</strong></p>}
        {errorMsg && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
            <p role="alert" style={{ color: "#ef4444", margin: 0, fontSize: "14px" }}>Error: {errorMsg}</p>
            <button 
              onClick={restart}
              style={{
                alignSelf: "flex-start",
                padding: "8px 16px",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid #ef4444",
                color: "#ef4444",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "13px"
              }}
            >
              Try again (or say "Hey Kutty, retry")
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
