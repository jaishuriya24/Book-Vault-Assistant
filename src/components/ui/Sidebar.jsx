import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import BorderGlow from "./BorderGlow";
import GooeyNav from "./GooeyNav";
import { LogOut, Users, User, ShieldCheck } from "lucide-react";
import Silk from "./Silk";
import notify from "../../services/notificationService";

const NAV_ITEMS = [
  { icon: "⊞", label: "Home", path: "/" },
  { icon: "📚", label: "Library", path: "/library" },
  { icon: "🔖", label: "Reading", path: "/continue-reading" },
  { icon: "👥", label: "MySQL Users", path: "/admin-dashboard" },
  { icon: "⚙️", label: "Settings", path: "/settings" },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState(() => localStorage.getItem("username"));

  // Refresh username whenever route changes OR localStorage is updated by another tab/component
  useEffect(() => {
    const refresh = () => setUsername(localStorage.getItem("username"));
    refresh(); // always re-read on pathname change
    window.addEventListener("storage", refresh);
    // Custom event dispatched after login to notify same-tab listeners
    window.addEventListener("bookvault:username-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("bookvault:username-updated", refresh);
    };
  }, [location.pathname]);

  const handleProfileClick = () => {
    navigate(username ? "/profile" : "/signin");
  };

  const handleLogout = async () => {
    const shouldLogout = await notify.confirm({
      title: "Logout Confirmation",
      message: `Are you sure you want to log out of "${username || 'Book Vault'}"?`,
      confirmText: "Yes, Logout",
      cancelText: "Stay Logged In",
      type: "danger",
      icon: "🚪",
    });

    if (shouldLogout) {
      localStorage.removeItem("username");
      localStorage.removeItem("token");
      localStorage.removeItem("readease_token");
      setUsername(null);
      window.dispatchEvent(new Event("bookvault:username-updated"));
      notify.info("You have logged out successfully.");
      navigate("/signin");
    }
  };

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <BorderGlow
        className="sidebar-container"
        edgeSensitivity={40}
        glowColor="20 90 60"
        backgroundColor="#000"
        borderRadius={22}
        glowRadius={40}
        glowIntensity={1.2}
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.8, pointerEvents: 'none' }}>
          <Silk speed={2} scale={1.2} color="#1b0800" noiseIntensity={0.5} />
        </div>
        <div className="sidebar-inner" style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
          
          {/* Active User Avatar & Tooltip */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 4 }}>
            <button
              onClick={handleProfileClick}
              title={username ? `Logged in as: ${username}` : "Click to Sign In"}
              className="sidebar-avatar"
              style={{
                position: 'relative',
                background: username ? 'linear-gradient(135deg, #ea580c, #c2410c)' : 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontWeight: 700,
                border: username ? '2px solid rgba(251,146,60,0.6)' : '1px solid rgba(255,255,255,0.2)',
                boxShadow: username ? '0 0 16px rgba(234,88,12,0.4)' : 'none',
                cursor: 'pointer'
              }}
            >
              {username ? username.charAt(0).toUpperCase() : "👤"}
              {username && (
                <span style={{
                  position: 'absolute',
                  bottom: -1,
                  right: -1,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: '#22c55e',
                  border: '2px solid #000',
                  boxShadow: '0 0 6px #22c55e'
                }} />
              )}
            </button>
            
            {/* User name display label under avatar */}
            <span 
              onClick={handleProfileClick}
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: username ? '#fb923c' : 'rgba(255,255,255,0.5)',
                maxWidth: 68,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textAlign: 'center',
                cursor: 'pointer',
                letterSpacing: '0.02em',
                marginTop: 2
              }}
            >
              {username || "Sign In"}
            </span>
          </div>

          {/* Nav items */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, marginTop: 18, width: "100%" }}>
            <GooeyNav 
              items={NAV_ITEMS}
              activeIndex={Math.max(0, NAV_ITEMS.findIndex(item => item.path === location.pathname))}
              onChange={(idx) => navigate(NAV_ITEMS[idx].path)}
            />
          </div>

          {/* User Profile / Admin Quick Link & Logout */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%', marginBottom: 8 }}>
            {username ? (
              <button
                onClick={handleLogout}
                className="sidebar-nav-btn"
                title={`Logout from ${username}`}
                style={{ color: "#ef4444", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}
              >
                <LogOut size={18} />
              </button>
            ) : (
              <button
                onClick={() => navigate("/signin")}
                className="sidebar-nav-btn"
                title="Sign In with Face or Password"
                style={{ color: "#38bdf8", background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.25)" }}
              >
                <User size={18} />
              </button>
            )}
          </div>

        </div>
      </BorderGlow>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="bottom-nav">
        <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flex: 1, justifyContent: 'space-around', alignItems: 'center' }}>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`mobile-nav-btn ${location.pathname === item.path ? 'active' : ''}`}
              >
                <span className="mobile-nav-icon">{item.icon}</span>
                <span className="mobile-nav-label">{item.label}</span>
              </button>
            ))}
            <button
              onClick={handleProfileClick}
              className={`mobile-nav-btn ${location.pathname === "/profile" ? 'active' : ''}`}
            >
              <span className="mobile-nav-icon">{username ? "👤" : "🔑"}</span>
              <span className="mobile-nav-label">{username || "Login"}</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
