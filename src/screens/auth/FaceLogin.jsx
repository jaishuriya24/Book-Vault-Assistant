import React, { useRef, useEffect, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { useNavigate, useSearchParams } from "react-router-dom";

import BrandMark from "../../components/ui/BrandMark";
import BackButton from "../../components/ui/BackButton";
import MorphText from "../../components/ui/MorphText";
import Ferrofluid from "../../components/ui/Ferrofluid";
import BorderGlow from "../../components/ui/BorderGlow";
import notify from "../../services/notificationService";
import {
  extractRobustFaceDescriptor,
  detectFacePresence,
  findBestFaceMatch,
  FACE_MATCH_THRESHOLD
} from "../../utils/faceBiometrics";

export default function FaceLogin() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";
  const [mode, setMode] = useState(initialMode); // "login" | "register"
  const [statusMessage, setStatusMessage] = useState(
    initialMode === "register" 
      ? "Enter your name below to enroll your new face." 
      : "Camera active. Looking for your face..."
  );
  const [isVerifying, setIsVerifying] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [regEmail, setRegEmail] = useState("");
  const [showRegisterInput, setShowRegisterInput] = useState(initialMode === "register");
  const [isAskingName, setIsAskingName] = useState(initialMode === "register");
  const [hasFaceInFrame, setHasFaceInFrame] = useState(false);
  
  const pendingDescriptorRef = useRef(null);
  const regEmailRef = useRef("");
  const isScanningRef = useRef(false);

  const authApiUrl = import.meta.env.VITE_SPRING_BOOT_AUTH_URL || import.meta.env.VITE_SERVER_URL || "http://localhost:8081";

  // Multi-backend resilient API caller
  const callAuthApi = useCallback(async (path, method = "GET", body = null) => {
    const urls = [
      authApiUrl,
      "http://localhost:8081",
    ].filter((v, i, a) => v && a.indexOf(v) === i);

    for (const base of urls) {
      try {
        const res = await fetch(`${base}${path}`, {
          method,
          headers: { "Content-Type": "application/json" },
          ...(body ? { body: JSON.stringify(body) } : {})
        });
        if (res.ok || res.status === 401 || res.status === 400) {
          return res;
        }
      } catch (_) {}
    }
    return null;
  }, [authApiUrl]);

  // Audio Earcon / Chime for blind users using Web Audio API
  const playTone = useCallback((freq = 520, duration = 0.15) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }, []);

  useEffect(() => {
    regEmailRef.current = regEmail;
  }, [regEmail]);

  // Sync registered face profiles from MySQL on mount
  useEffect(() => {
    callAuthApi("/api/users/readers")
      .then((res) => (res && res.ok ? res.json() : null))
      .then((users) => {
        if (Array.isArray(users) && users.length > 0) {
          const profiles = [];
          users.forEach((u) => {
            if (u.faceDescriptor) {
              try {
                profiles.push({
                  name: u.userName || u.name,
                  email: u.email,
                  faceDescriptor: typeof u.faceDescriptor === "string" ? JSON.parse(u.faceDescriptor) : u.faceDescriptor,
                  createdAt: u.createdAt,
                });
              } catch (_) {}
            }
          });
          if (profiles.length > 0) {
            localStorage.setItem("face_profiles", JSON.stringify(profiles));
          }
        }
      })
      .catch((err) => console.log("MySQL users sync note:", err.message));
  }, [callAuthApi]);

  // Saves registered face with name and logs in
  const handleRegisterWithName = async (nameToRegister) => {
    const finalName = (nameToRegister || regEmail || "").trim();
    if (!finalName) {
      notify.warning("Please enter your name to enroll your face.");
      return;
    }

    let descriptor = pendingDescriptorRef.current;
    if (!descriptor && webcamRef.current) {
      try {
        const screenshot = webcamRef.current.getScreenshot();
        if (screenshot) {
          descriptor = await extractRobustFaceDescriptor(screenshot, canvasRef.current);
        }
      } catch (e) {}
    }
    if (!descriptor) {
      notify.error("Could not capture facial frame. Please look directly at the camera.");
      return;
    }

    setIsVerifying(true);
    setStatusMessage(`Registering face for ${finalName}...`);
    playTone(650, 0.2);

    try {
      // 1. Save to MySQL backend
      try {
        await callAuthApi("/api/auth/face-register", "POST", {
          name: finalName,
          email: `${finalName.toLowerCase().replace(/\s+/g, '')}@readease.vault`,
          faceDescriptor: descriptor,
          role: "READER"
        });
      } catch (err) {
        console.warn("Backend MySQL offline, saved to local store:", err);
      }

      // 2. Save to local storage face profiles
      const existing = JSON.parse(localStorage.getItem("face_profiles") || "[]");
      const updated = existing.filter((p) => p.name.toLowerCase() !== finalName.toLowerCase());
      updated.push({
        name: finalName,
        email: `${finalName.toLowerCase().replace(/\s+/g, '')}@readease.vault`,
        faceDescriptor: descriptor,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem("face_profiles", JSON.stringify(updated));

      // 3. Set the username in user session and log in
      localStorage.setItem("username", finalName);
      localStorage.setItem("role", "READER");
      localStorage.setItem("token", "readease_face_token_" + Date.now());
      window.dispatchEvent(new Event("bookvault:username-updated"));

      setIsAskingName(false);
      setShowRegisterInput(false);
      setStatusMessage(`✅ Welcome to Book Vault, ${finalName}! Logged in successfully.`);
      playTone(880, 0.4);
      notify.success(`Face registered for ${finalName}!`);

      setTimeout(() => {
        navigate("/");
      }, 900);
    } catch (e) {
      console.error("Enrollment error:", e);
      setStatusMessage("Failed to register face. Please try again.");
      setIsVerifying(false);
    }
  };

  // Main biometric verification loop
  const handleFaceLogin = useCallback(async () => {
    if (isScanningRef.current || isAskingName || !webcamRef.current) return;
    const screenshot = webcamRef.current.getScreenshot();
    if (!screenshot) return;

    isScanningRef.current = true;

    try {
      const descriptor = await extractRobustFaceDescriptor(screenshot, canvasRef.current);
      if (!descriptor) {
        setHasFaceInFrame(false);
        setStatusMessage("Camera active. Looking for your face...");
        isScanningRef.current = false;
        return;
      }

      setHasFaceInFrame(true);
      pendingDescriptorRef.current = descriptor;

      // 1. Try MySQL backend
      let loginSuccess = false;
      let userName = "";
      let userRole = "READER";
      let token = "";

      try {
        const res = await callAuthApi("/api/auth/face-login", "POST", { faceDescriptor: descriptor });
        if (res && res.ok) {
          const data = await res.json();
          loginSuccess = true;
          userName = data.name || data.email || "Reader";
          userRole = data.role || (userName.toLowerCase().includes("admin") ? "ADMIN" : "READER");
          token = data.token || "";
        }
      } catch (err) {
        console.warn("Backend auth unavailable, checking local store:", err);
      }

      // 2. Fallback to local cache with calibrated threshold
      if (!loginSuccess) {
        const localProfiles = JSON.parse(localStorage.getItem("face_profiles") || "[]");
        const match = findBestFaceMatch(descriptor, localProfiles, FACE_MATCH_THRESHOLD);

        if (match.isMatch && match.bestMatch) {
          loginSuccess = true;
          userName = match.bestMatch.name || match.bestMatch.email || "Reader";
          userRole = match.bestMatch.role || (userName.toLowerCase().includes("admin") ? "ADMIN" : "READER");
          token = "local_token_" + Date.now();
        }
      }

      if (loginSuccess) {
        setShowRegisterInput(false);
        setIsAskingName(false);
        const targetGoal = userRole === "ADMIN" ? "/admin-dashboard" : "/";
        const roleGreeting = userRole === "ADMIN"
          ? `✅ Welcome Administrator ${userName}! Opening Admin Dashboard...`
          : `✅ Face Recognized: Welcome back, ${userName}! Opening your vault...`;

        setStatusMessage(roleGreeting);
        playTone(880, 0.4);
        notify.success(`Welcome back, ${userName}! (${userRole})`);

        localStorage.setItem("username", userName);
        localStorage.setItem("role", userRole);
        if (token) {
          localStorage.setItem("token", token);
          localStorage.setItem("readease_token", token);
        }
        window.dispatchEvent(new Event("bookvault:username-updated"));

        setTimeout(() => {
          navigate(targetGoal);
        }, 900);
      } else {
        loginSuccess = false;
        setIsVerifying(false);
        setIsAskingName(true);
        setShowRegisterInput(true);
        setStatusMessage("New face detected! Enter your name below to enroll & log in.");
        playTone(440, 0.2);
        isScanningRef.current = false;
      }
    } catch (err) {
      console.error("Face login error:", err);
      setStatusMessage("Camera active. Looking for your face...");
      isScanningRef.current = false;
    }
  }, [isAskingName, callAuthApi, navigate, playTone]);

  // Auto-scan timer: runs automatically every 1.2s when camera is ready
  useEffect(() => {
    if (!cameraReady || isAskingName || mode !== "login") return;
    const interval = setInterval(() => {
      if (!isScanningRef.current) {
        handleFaceLogin();
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [cameraReady, isAskingName, mode, handleFaceLogin]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === " " || e.key === "Enter") {
        if (mode === "login" && !showRegisterInput) handleFaceLogin();
      } else if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        if (!showRegisterInput) navigate("/signin");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, showRegisterInput, handleFaceLogin, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12" style={{ backgroundColor: 'var(--sidebar-bg)' }}>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div className="sr-only" aria-live="assertive" role="alert">
        {statusMessage}
      </div>

      <BorderGlow
        className="w-full max-w-5xl shadow-2xl backdrop-blur-sm"
        backgroundColor="rgba(0,0,0,0.8)"
        borderRadius={24}
        glowColor="255 100 80"
        colors={['#c084fc', '#f472b6', '#38bdf8']}
        edgeSensitivity={50}
        animated={true}
      >
        <div className="w-full flex rounded-3xl overflow-hidden bg-black/80">
          
          {/* Left Promo Container with Ferrofluid Art */}
          <div className="hidden md:flex md:w-1/2 items-end p-8 relative">
            <div className="absolute inset-0 rounded-l-3xl overflow-hidden bg-black">
              <Ferrofluid
                colors={["#ffffff", "#ffffff", "#ffffff"]}
                speed={0.5}
                scale={1}
                turbulence={1}
                fluidity={0.1}
                rimWidth={0.2}
                sharpness={3}
                shimmer={1}
                glow={2}
                flowDirection="down"
                opacity={1}
                mouseInteraction={true}
                mouseStrength={1}
                mouseRadius={0.3}
              />
            </div>
            <div className="absolute inset-0 rounded-l-3xl bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none" />
            <div className="relative z-10 flex flex-col justify-end text-white h-full pointer-events-none">
              <div className="p-6">
                <MorphText
                  words={["Book Vault", "Reading Reimagined", "Biometric Authentication"]}
                  interval={2600}
                  fontSize="clamp(1.8rem, 3.5vw, 2.4rem)"
                  className="text-left"
                />
                
                <p className="text-gray-300 mt-4 max-w-sm text-sm">
                  Discover, organize, and immerse yourself in books with high-precision face recognition and voice assistance.
                </p>
                
                <div className="mt-8 flex items-center gap-3 text-emerald-400 text-xs font-semibold">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  Biometric Facial Authentication Active
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Face Recognition Viewfinder */}
          <div className="w-full md:w-1/2 p-6 sm:p-8 bg-gradient-to-b from-neutral-900 to-black text-white flex flex-col justify-center min-h-[580px] relative transition-all">
            
            {/* Top Navigation */}
            <div className="flex items-center justify-between mb-4">
              <BackButton onClick={() => navigate("/signin")} />
              <BrandMark showVoice={false} />
            </div>

            {/* Camera Viewfinder */}
            <div className="flex flex-col items-center text-center animate-fade-in w-full">
              <div className="relative w-full h-[320px] sm:h-[350px] md:h-[370px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-neutral-950 mb-3 flex items-center justify-center">
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{
                    facingMode: "user",
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                  }}
                  className="w-full h-full object-cover transform -scale-x-100"
                  onUserMedia={() => {
                    setCameraReady(true);
                    setCameraError(false);
                    if (mode === "login") {
                      setStatusMessage("Camera active. Looking for your face...");
                    }
                    playTone(520, 0.1);
                  }}
                  onUserMediaError={(err) => {
                    console.error("Camera access error:", err);
                    setCameraError(true);
                    setCameraReady(false);
                    setStatusMessage("⚠️ Camera access denied! Check permissions.");
                  }}
                />

                {hasFaceInFrame && (
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-emerald-500/80 backdrop-blur-sm text-white text-[11px] font-bold flex items-center gap-1.5 shadow">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    Face Detected
                  </div>
                )}
              </div>

              {/* Status and Action Area */}
              <div className="w-full space-y-2.5">
                <div className="text-center text-xs text-neutral-300 font-medium">
                  {statusMessage}
                </div>

                {mode === "login" && !showRegisterInput && (
                  <div className="flex justify-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => handleFaceLogin()}
                      className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold text-xs rounded-xl shadow-lg cursor-pointer transition-all flex items-center gap-2 active:scale-95"
                    >
                      <span>📸</span>
                      <span>Scan & Verify Face</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("register");
                        setShowRegisterInput(true);
                        setIsAskingName(true);
                        setStatusMessage("Enter your name to enroll a new face profile.");
                      }}
                      className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white font-medium text-xs rounded-xl border border-neutral-700 cursor-pointer transition-all flex items-center gap-1.5"
                    >
                      <span>➕</span>
                      <span>Enroll New Face</span>
                    </button>
                  </div>
                )}

                {(showRegisterInput || mode === "register") && (
                  <div className="w-full flex flex-col gap-2 p-3.5 bg-neutral-900/95 border border-orange-500/40 rounded-2xl animate-fade-in text-left shadow-xl">
                    <div className="flex items-center justify-between text-[11px] text-orange-400 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <span className="animate-pulse">👤</span>
                        <span>Enter your name to enroll this face:</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMode("login");
                          setShowRegisterInput(false);
                          setIsAskingName(false);
                          setRegEmail("");
                          setStatusMessage("Camera active. Looking for your face...");
                        }}
                        className="text-neutral-400 hover:text-white text-[10px] underline cursor-pointer"
                      >
                        Rescan Face
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter your name (e.g. Alex, Jai)"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRegisterWithName(regEmail);
                        }}
                        className="flex-1 px-3 py-2 bg-black border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleRegisterWithName(regEmail)}
                        disabled={isVerifying}
                        className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-all whitespace-nowrap"
                      >
                        {isVerifying ? "Saving..." : "Enroll & Login"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Switch links */}
                <div className="w-full flex items-center justify-between text-xs text-neutral-400 pt-2 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => navigate("/signup")}
                    className="text-orange-400 hover:text-orange-300 font-semibold underline underline-offset-4 transition-colors cursor-pointer"
                  >
                    + Create Full Account
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/signin")}
                    className="text-neutral-400 hover:text-white underline underline-offset-4 transition-colors cursor-pointer"
                  >
                    Password Login (Press P)
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </BorderGlow>
    </div>
  );
}
