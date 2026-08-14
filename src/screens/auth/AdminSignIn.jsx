import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BrandMark from "../../components/ui/BrandMark";
import Field from "../../components/ui/Field";
import BorderGlow from "../../components/ui/BorderGlow";
import notify from "../../services/notificationService";

export default function AdminSignIn() {
  const navigate = useNavigate();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const authApiUrl = import.meta.env.VITE_SPRING_BOOT_AUTH_URL || import.meta.env.VITE_SERVER_URL || "http://localhost:8081";

  const handleAdminLogin = async (e) => {
    e?.preventDefault();
    if (!usernameOrEmail || !password) {
      notify.warning("Please enter your admin credentials.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${authApiUrl}/api/auth/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernameOrEmail, password }),
      });

      const data = await res.json();
      if (res.ok && data.role === "ADMIN") {
        localStorage.setItem("username", data.name || data.username || usernameOrEmail);
        localStorage.setItem("role", "ADMIN");
        if (data.token) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("readease_token", data.token);
        }
        window.dispatchEvent(new Event("bookvault:username-updated"));
        notify.success(`Administrator access granted. Welcome, ${data.name || data.username || "Admin"}!`);
        navigate("/admin-dashboard");
      } else {
        notify.error(typeof data === "string" ? data : data.message || "Invalid administrator credentials.");
      }
    } catch (e) {
      console.error("Admin Auth Error:", e);
      // Fallback check for local default admin if backend offline
      if ((usernameOrEmail === "admin123" || usernameOrEmail === "admin" || usernameOrEmail === "admin@bookvault.io") && (password === "admin123" || password === "AdminVault@2026")) {
        localStorage.setItem("username", "System Administrator");
        localStorage.setItem("role", "ADMIN");
        localStorage.setItem("token", "admin_offline_token");
        window.dispatchEvent(new Event("bookvault:username-updated"));
        notify.success("Administrator access granted (Offline Mode).");
        navigate("/admin-dashboard");
      } else {
        notify.error("Could not connect to authentication server.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-neutral-950 text-white">
      <BorderGlow
        className="w-full max-w-md shadow-2xl backdrop-blur-sm"
        backgroundColor="rgba(10, 10, 10, 0.9)"
        borderRadius={24}
        glowColor="168 85 247"
        colors={['#a855f7', '#ec4899', '#3b82f6']}
        edgeSensitivity={50}
        animated={true}
      >
        <div className="p-8 sm:p-10 flex flex-col items-center text-center">
          <BrandMark showVoice={false} />
          
          <div className="mt-4 mb-2 px-3 py-1 rounded-full text-[11px] font-bold tracking-widest uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            Administrator Portal
          </div>

          <h1 className="text-2xl font-extrabold text-white mt-1">Control Center Sign In</h1>
          <p className="text-xs text-neutral-400 mt-1 mb-6">
            Authorized administrative access only
          </p>

          <form onSubmit={handleAdminLogin} className="w-full space-y-4 text-left">
            <Field
              label="Admin Username or Email"
              type="text"
              placeholder="e.g. admin123"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              autoFocus
            />

            <Field
              label="Password"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? "Authenticating..." : "Sign In to Admin Dashboard →"}
              </button>
            </div>
          </form>

          <div className="mt-6 p-3 rounded-xl bg-purple-950/40 border border-purple-800/30 text-left w-full text-[11px] text-purple-300">
            <span className="font-semibold text-purple-200 block mb-1">🔐 Default Credentials:</span>
            <div>Username: <code className="bg-black/50 px-1 py-0.5 rounded text-white">admin123</code></div>
            <div>Password: <code className="bg-black/50 px-1 py-0.5 rounded text-white">admin123</code></div>
          </div>
        </div>
      </BorderGlow>
    </div>
  );
}
