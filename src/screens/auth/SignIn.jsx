import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Webcam from "react-webcam";

import BrandMark from "../../components/ui/BrandMark";
import BackButton from "../../components/ui/BackButton";
import Field from "../../components/ui/Field";
import PrimaryButton from "../../components/ui/PrimaryButton";
import Divider from "../../components/ui/Divider";
import MorphText from "../../components/ui/MorphText";
import Ferrofluid from "../../components/ui/Ferrofluid";
import BorderGlow from "../../components/ui/BorderGlow";
import notify from "../../services/notificationService";

import { classifyIntent } from "../../services/nlpService";

import {
  extractRobustFaceDescriptor,
  detectFacePresence,
  findBestFaceMatch,
  loadFaceApiModels,
  purgeLegacyFaceProfiles,
  verifyLivenessAndExtractMultiDescriptors,
  FACE_MATCH_THRESHOLD
} from "../../utils/faceBiometrics";

export default function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isListening, setIsListening] = useState(false);

  // Face Recognition states and refs
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);

  const [isFaceLoginMode, setIsFaceLoginMode] = useState(true);
  const [statusMessage, setStatusMessage] = useState("Looking for your face in frame...");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [hasFaceInFrame, setHasFaceInFrame] = useState(false);

  const authApiUrl = import.meta.env.VITE_SPRING_BOOT_AUTH_URL || import.meta.env.VITE_SERVER_URL || "http://localhost:8081";

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
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }, []);

  // Text-To-Speech announcement
  const speak = useCallback((text, onEndCallback) => {
    if ("speechSynthesis" in window && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.95;
      if (onEndCallback) {
        utterance.onend = () => onEndCallback();
        utterance.onerror = () => onEndCallback();
      }
      window.speechSynthesis.speak(utterance);
    } else if (onEndCallback) {
      onEndCallback();
    }
  }, []);

  // Crisp Audio BEEP sound signal indicating voice recording start
  const playBeepSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {}
  }, []);

  // Preload face-api 68 landmark neural models & purge legacy vectors
  useEffect(() => {
    loadFaceApiModels();
    purgeLegacyFaceProfiles();
  }, []);

  // Initial camera permission check
  useEffect(() => {
    if (isFaceLoginMode) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
          .then((stream) => {
            stream.getTracks().forEach(track => track.stop());
          })
          .catch((err) => {
            console.warn("Camera permission prompt error:", err);
          });
      }
    }
  }, [isFaceLoginMode]);

  const [showRegisterInput, setShowRegisterInput] = useState(false);
  const [enrollName, setEnrollName] = useState("");
  const [isListeningName, setIsListeningName] = useState(false);
  const pendingDescriptorRef = useRef(null);
  const isScanningRef = useRef(false);
  const enrollNameRef = useRef("");
  const enrollInputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    enrollNameRef.current = enrollName;
  }, [enrollName]);

  // Dedicated speech listener for name input with auto-focus & voice readout
  const startListeningForName = useCallback(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setStatusMessage("🎙️ Speech recognition not supported in browser. Please type your name.");
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
      }

      const recognition = new SpeechRec();
      recognitionRef.current = recognition;
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsListeningName(true);
      setStatusMessage("🎙️ Listening... Please say your name now!");

      recognition.onresult = (event) => {
        setIsListeningName(false);
        const rawTranscript = event.results[0][0].transcript.trim();
        if (rawTranscript) {
          const cleanName = rawTranscript.replace(/^(my name is|name is|i am|it's|it is|this is|called)\s+/i, '').trim();
          const finalName = cleanName || rawTranscript;
          
          setEnrollName(finalName);
          
          setTimeout(() => {
            if (enrollInputRef.current) {
              enrollInputRef.current.focus();
              enrollInputRef.current.select();
            }
          }, 100);

          setStatusMessage(`🎙️ Heard name: "${finalName}". Click Enroll & Login or press Enter.`);
          speak(`Your name is ${finalName}. Click enroll to complete.`);
        }
      };

      recognition.onerror = (e) => {
        console.warn("SignIn name speech error:", e.error);
        setIsListeningName(false);
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          setStatusMessage("🎙️ Could not hear clearly. Click mic or type your name.");
        }
      };

      recognition.onend = () => {
        setIsListeningName(false);
      };

      recognition.start();
    } catch (err) {
      console.warn("Error starting speech recognition:", err);
      setIsListeningName(false);
    }
  }, [speak]);

  // Sync registered readers list metadata on mount if needed
  useEffect(() => {
    fetch(`${authApiUrl}/api/users/readers`)
      .then((res) => (res.ok ? res.json() : null))
      .catch((err) => console.log("MySQL readers query note:", err.message));
  }, [authApiUrl]);

  // ── STEP 2: Quick Face Enrollment (Save & Login) ───────────────────
  const handleRegisterWithName = useCallback(async (nameToRegister) => {
    const finalName = (nameToRegister || enrollName || "").trim();
    if (!finalName) {
      notify.warning("Please enter your name to enroll your face.");
      speak("Please enter your name to register.");
      return;
    }

    // Capture multi-sample descriptor array via liveness challenge
    let descriptorSamples = [];
    if (webcamRef.current && webcamRef.current.video) {
      setStatusMessage("👁️ Verifying live presence... Please blink or turn your head slightly.");
      const livenessResult = await verifyLivenessAndExtractMultiDescriptors(
        webcamRef.current.video,
        { maxDurationMs: 6000 },
        (msg) => setStatusMessage(msg)
      );
      if (livenessResult.isLive && livenessResult.multiDescriptors) {
        descriptorSamples = livenessResult.multiDescriptors;
      }
    }

    if (descriptorSamples.length === 0 && pendingDescriptorRef.current) {
      descriptorSamples = [pendingDescriptorRef.current];
    }

    const finalDescriptorPayload = descriptorSamples;

    if (!finalDescriptorPayload) {
      notify.error("Could not capture facial frame. Please look directly at the camera.");
      return;
    }

    setStatusMessage(`Enrolling multi-sample biometric face for "${finalName}"...`);
    playTone(650, 0.2);

    try {
      // 1. Save to MySQL database
      try {
        await fetch(`${authApiUrl}/api/auth/face-register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: finalName,
            email: `${finalName.toLowerCase().replace(/\s+/g, "")}@readease.vault`,
            role: "READER",
            faceDescriptor: finalDescriptorPayload,
          }),
        });
      } catch (err) {
        console.warn("Backend face-register note:", err.message);
      }

      // 2. Save to local profiles cache
      const profiles = JSON.parse(localStorage.getItem("face_profiles") || "[]");
      const updated = profiles.filter((p) => p.name.toLowerCase() !== finalName.toLowerCase());
      updated.push({
        name: finalName,
        email: `${finalName.toLowerCase().replace(/\s+/g, "")}@readease.vault`,
        faceDescriptor: finalDescriptorPayload,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem("face_profiles", JSON.stringify(updated));

      // 3. Set logged-in session
      localStorage.setItem("username", finalName);
      localStorage.setItem("role", "READER");
      localStorage.setItem("token", `readease_face_${Date.now()}`);
      window.dispatchEvent(new Event("bookvault:username-updated"));

      setShowRegisterInput(false);
      setEnrollName("");
      setStatusMessage(`✅ Face enrolled successfully for ${finalName}!`);
      playTone(880, 0.4);
      notify.success(`Face enrolled! Welcome to Book Vault, ${finalName}.`);
      speak(`Welcome, ${finalName}. Your face has been enrolled.`);

      setTimeout(() => navigate("/"), 900);
    } catch (e) {
      console.error("Face enrollment error:", e);
      notify.error("Could not complete enrollment.");
      setStatusMessage("Enrollment error. Please try again.");
    }
  }, [enrollName, authApiUrl, navigate, playTone, speak]);

  // ── STEP 1: Biometric Face Login Scan Loop ──────────────────────────
  const handleFaceLogin = useCallback(async () => {
    if (isScanningRef.current || showRegisterInput || !webcamRef.current) return;
    const screenshot = webcamRef.current.getScreenshot();
    if (!screenshot) return;

    isScanningRef.current = true;

    try {
      const descriptor = await extractRobustFaceDescriptor(screenshot, canvasRef.current);
      if (!descriptor) {
        setHasFaceInFrame(false);
        setStatusMessage("Looking for your face in frame...");
        isScanningRef.current = false;
        return;
      }

      setHasFaceInFrame(true);
      pendingDescriptorRef.current = descriptor;

      // Step A: Check MySQL backend
      let loginSuccess = false;
      let userName = "";
      let userRole = "READER";
      let token = "";

      try {
        const res = await fetch(`${authApiUrl}/api/auth/face-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ faceDescriptor: descriptor }),
        });
        if (res.ok) {
          const data = await res.json();
          loginSuccess = true;
          userName = data.name || data.email || "Reader";
          userRole = "READER";
          token = data.token || "";
        }
      } catch (_) {}

      // Step B: Check local cache with calibrated threshold
      if (!loginSuccess) {
        const profiles = JSON.parse(localStorage.getItem("face_profiles") || "[]");
        const match = findBestFaceMatch(descriptor, profiles, FACE_MATCH_THRESHOLD);

        if (match.isMatch && match.bestMatch) {
          loginSuccess = true;
          userName = match.bestMatch.name || match.bestMatch.email || "Reader";
          userRole = "READER";
          token = "local_" + Date.now();
        }
      }

      if (loginSuccess) {
        // ✅ Recognized face match -> navigate to reader vault
        setShowRegisterInput(false);
        const roleGreeting = `✅ Welcome back, ${userName}! Opening your vault...`;

        setStatusMessage(roleGreeting);
        playTone(880, 0.4);
        notify.success(`Welcome back, ${userName}!`);
        speak(`Login successful. Welcome back, ${userName}.`);

        localStorage.setItem("username", userName);
        localStorage.setItem("role", "READER");
        if (token) {
          localStorage.setItem("token", token);
          localStorage.setItem("readease_token", token);
        }
        window.dispatchEvent(new Event("bookvault:username-updated"));
        setTimeout(() => navigate("/"), 900);
      } else {
        // ❓ New or Unrecognized face -> Voice Guided Hands-Free Enrollment
        setShowRegisterInput(true);
        setStatusMessage("👤 Face detected! Focusing input & instructing voice...");

        // 1. Focus input box immediately
        setTimeout(() => {
          if (enrollInputRef.current) {
            enrollInputRef.current.focus();
          }
        }, 100);

        // 2. Instruct user to speak after beep -> Play Beep -> Listen -> Read back
        speak("New face detected! What is your name? Please say your name after the beep.", () => {
          playBeepSound();
          setStatusMessage("🔊 BEEP! 🎙️ Listening... Say your name now!");
          setTimeout(() => {
            startListeningForName();
          }, 250);
        });

        isScanningRef.current = false;
      }
    } catch (err) {
      console.error("Face scan error:", err);
      setStatusMessage("Camera active. Looking for your face...");
      isScanningRef.current = false;
    }
  }, [showRegisterInput, authApiUrl, navigate, playBeepSound, speak, startListeningForName]);

  // Auto-focus input box when enrollment opens
  useEffect(() => {
    if (showRegisterInput) {
      setTimeout(() => {
        if (enrollInputRef.current) {
          enrollInputRef.current.focus();
        }
      }, 150);
    }
  }, [showRegisterInput]);

  // Auto-scan every 1.2s when camera is ready and not asking for name
  useEffect(() => {
    if (!isFaceLoginMode || !cameraReady || showRegisterInput) return;
    const interval = setInterval(() => {
      if (!isScanningRef.current) handleFaceLogin();
    }, 1200);
    return () => clearInterval(interval);
  }, [isFaceLoginMode, cameraReady, showRegisterInput, handleFaceLogin]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === " " || e.key === "Enter") {
        if (isFaceLoginMode && !showRegisterInput) handleFaceLogin();
      } else if (e.key === "p" || e.key === "P") {
        if (!showRegisterInput) setIsFaceLoginMode(false);
      } else if (e.key === "f" || e.key === "F") {
        setIsFaceLoginMode(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFaceLoginMode, showRegisterInput, handleFaceLogin]);

  // Voice fill & submit listener
  useEffect(() => {
    const handleVoiceFill = (e) => {
      const { field, value } = e.detail;
      if (field === "name" || field === "fullName" || field === "enrollName" || field === "username") {
        setEnrollName(value);
        setShowRegisterInput(true);
      } else if (field === "email") {
        setEmail(value);
      } else if (field === "password") {
        setPassword(value);
      }
    };
    const handleVoiceSubmit = () => {
      if (showRegisterInput) {
        handleRegisterWithName(enrollName);
      } else {
        handlePasswordLogin();
      }
    };
    window.addEventListener("book-vault:voice-fill-field", handleVoiceFill);
    window.addEventListener("book-vault:voice-submit-login", handleVoiceSubmit);
    return () => {
      window.removeEventListener("book-vault:voice-fill-field", handleVoiceFill);
      window.removeEventListener("book-vault:voice-submit-login", handleVoiceSubmit);
    };
  }, [showRegisterInput, enrollName, handleRegisterWithName]);

  // Standard Reader & Admin Password Login
  const handlePasswordLogin = async () => {
    if (!email || !password) {
      notify.warning("Please enter both email/username and password.");
      return;
    }

    const isAdminCredentials = email.trim() === "admin123" || email.trim() === "admin" || email.trim() === "admin@bookvault.io";

    // 1. If admin credentials entered on password sign-in
    if (isAdminCredentials) {
      try {
        const res = await fetch(`${authApiUrl}/api/auth/admin/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usernameOrEmail: email.trim(), password }),
        });

        const data = await res.json();
        if (res.ok && data.role === "ADMIN") {
          const adminUser = data.name || data.username || "System Administrator";
          localStorage.setItem("username", adminUser);
          localStorage.setItem("role", "ADMIN");
          if (data.token) {
            localStorage.setItem("token", data.token);
            localStorage.setItem("readease_token", data.token);
          }
          window.dispatchEvent(new Event("bookvault:username-updated"));
          playTone(880, 0.4);
          notify.success(`Administrator access granted! Welcome, ${adminUser}.`);
          speak(`Administrator login successful. Welcome, ${adminUser}.`);
          navigate("/admin-dashboard");
          return;
        }
      } catch (err) {
        console.warn("Admin backend auth attempt error:", err);
      }

      // Offline fallback for default admin account
      if (password === "admin123" || password === "AdminVault@2026") {
        localStorage.setItem("username", "System Administrator");
        localStorage.setItem("role", "ADMIN");
        localStorage.setItem("token", "admin_offline_token");
        window.dispatchEvent(new Event("bookvault:username-updated"));
        playTone(880, 0.4);
        notify.success("Administrator access granted (Offline Mode).");
        speak("Administrator login successful. Opening dashboard.");
        navigate("/admin-dashboard");
        return;
      }
    }

    // 2. Standard Reader authentication
    try {
      const res = await fetch(`${authApiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok && (data.success || data.token || data.role)) {
        const loggedUser = data.name || data.username || email.split("@")[0];
        localStorage.setItem("username", loggedUser);
        localStorage.setItem("role", "READER");
        if (data.token) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("readease_token", data.token);
        }
        window.dispatchEvent(new Event("bookvault:username-updated"));
        playTone(880, 0.4);
        notify.success(`Access granted! Welcome, ${loggedUser}.`);
        speak(`Login successful. Welcome, ${loggedUser}.`);
        navigate("/");
        return;
      } else {
        notify.error(typeof data === "string" ? data : data.message || "Invalid credentials.");
        return;
      }
    } catch (e) {
      console.error("MySQL Login Error:", e);
      // Reader offline fallback login
      const loggedUser = email.split("@")[0] || "Reader";
      localStorage.setItem("username", loggedUser);
      localStorage.setItem("role", "READER");
      localStorage.setItem("token", "reader_offline_token");
      window.dispatchEvent(new Event("bookvault:username-updated"));
      notify.success(`Signed in locally as ${loggedUser}.`);
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12" style={{ backgroundColor: 'var(--sidebar-bg)' }}>
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
          
          {/* Left image / promo */}
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
                  words={["Book Vault", "Reading Reimagined", "Biometric Access"]}
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
                  Biometric Face Engine Active
                </div>
              </div>
            </div>
          </div>

          {/* Right: Face Recognition View or Password Login */}
          <div className={`w-full md:w-1/2 ${isFaceLoginMode ? 'p-6 sm:p-8' : 'p-10'} bg-gradient-to-b from-neutral-900 to-black text-white flex flex-col justify-center min-h-[580px] relative transition-all`}>
            <canvas ref={canvasRef} style={{ display: "none" }} />
            <div className="sr-only" aria-live="assertive" role="alert">
              {statusMessage}
            </div>

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <BackButton onClick={() => navigate(-1)} />
              <BrandMark showVoice={false} />
            </div>

            {isFaceLoginMode ? (
              /* ── USER BIOMETRIC LOGIN ── */
              <div className="flex flex-col items-center text-center animate-fade-in w-full">
                
                {/* Camera Viewfinder */}
                <div className="relative w-full h-[320px] sm:h-[350px] md:h-[370px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-neutral-950 mb-3 flex items-center justify-center">
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{
                      facingMode: "user",
                      width: 1280,
                      height: 720,
                    }}
                    className="w-full h-full object-cover transform -scale-x-100"
                    onUserMedia={() => {
                      setCameraReady(true);
                      setCameraError(false);
                      setStatusMessage("Camera active. Looking for reader's face...");
                      playTone(520, 0.1);
                    }}
                    onUserMediaError={(err) => {
                      console.error("Camera access error:", err);
                      setCameraError(true);
                      setCameraReady(false);
                      setStatusMessage("⚠️ Camera access denied! Check permissions.");
                    }}
                  />

                  {/* Face indicator badge */}
                  {hasFaceInFrame && (
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-emerald-500/80 backdrop-blur-sm text-white text-[11px] font-bold flex items-center gap-1.5 shadow">
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      Face Detected
                    </div>
                  )}
                </div>

                {/* Status & Quick Enrollment Box */}
                <div className="w-full space-y-2.5">
                  <div className="text-center text-xs text-neutral-300 font-medium">
                    {statusMessage}
                  </div>

                  {showRegisterInput && (
                    <div className="w-full flex flex-col gap-2 p-3.5 bg-neutral-900/95 border border-orange-500/40 rounded-2xl animate-fade-in text-left shadow-xl">
                      <div className="flex items-center justify-between text-[11px] text-orange-400 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span className="animate-pulse">{isListeningName ? "🎙️" : "👤"}</span>
                          <span>{isListeningName ? "Listening for your name..." : "New face detected! Enter your name to enroll:"}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowRegisterInput(false);
                            setEnrollName("");
                            if (recognitionRef.current) {
                              try { recognitionRef.current.stop(); } catch (_) {}
                            }
                            setStatusMessage("Camera active. Looking for your face...");
                          }}
                          className="text-neutral-400 hover:text-white text-[10px] underline cursor-pointer"
                        >
                          Rescan Face
                        </button>
                      </div>
                      <div className="flex gap-2 items-center">
                        <div className="relative flex-1">
                          <input
                            ref={enrollInputRef}
                            type="text"
                            placeholder="Enter your name (e.g. Alex, Jai)"
                            value={enrollName}
                            onChange={(e) => setEnrollName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRegisterWithName(enrollName);
                            }}
                            className="w-full px-3 py-2 pr-9 bg-black border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={startListeningForName}
                            title="Click to speak your name"
                            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-all ${
                              isListeningName 
                                ? "text-red-400 animate-bounce scale-110" 
                                : "text-neutral-400 hover:text-orange-400"
                            }`}
                          >
                            {isListeningName ? "🎙️" : "🎤"}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={startListeningForName}
                          className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                            isListeningName 
                              ? "bg-red-500/20 border-red-500 text-red-400 animate-pulse border-red-500/50" 
                              : "bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white"
                          }`}
                        >
                          <span>{isListeningName ? "🔴 Listening..." : "🎤 Speak"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRegisterWithName(enrollName)}
                          className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-all whitespace-nowrap active:scale-95"
                        >
                          Enroll & Login
                        </button>
                      </div>
                    </div>
                  )}

                  {!showRegisterInput && (
                    <div className="flex justify-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => handleFaceLogin()}
                        className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold text-xs rounded-xl shadow cursor-pointer transition-all flex items-center gap-1.5 active:scale-95"
                      >
                        <span>📸</span>
                        <span>Scan Face Now</span>
                      </button>
                    </div>
                  )}

                  <div className="w-full flex items-center justify-between text-xs text-neutral-400 pt-2 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => navigate("/signup")}
                      className="text-orange-400 hover:text-orange-300 font-semibold underline underline-offset-4 transition-colors cursor-pointer"
                    >
                      + Create New Account
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setIsFaceLoginMode(false)}
                      className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-4 transition-colors cursor-pointer"
                    >
                      Password Sign In (Press P)
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ── PASSWORD LOGIN ── */
              <div className="animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-widest">
                    🔑 Password Sign In
                  </span>
                </div>
                <h1 className="text-2xl font-bold mb-1 text-white">Sign In</h1>
                <p className="text-xs text-neutral-400 mb-5">
                  Enter your username / email and password to access Book Vault
                </p>

                <div className="space-y-3.5">
                  <Field
                    label="Email or Username"
                    type="text"
                    placeholder="Enter email or username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Field
                    label="Password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between mt-3 mb-4">
                  <button
                    type="button"
                    onClick={() => navigate("/signup")}
                    className="text-xs text-orange-400 hover:underline cursor-pointer"
                  >
                    Need an account? Sign Up
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFaceLoginMode(true)}
                    className="text-xs text-emerald-400 hover:underline cursor-pointer"
                  >
                    Use Face Recognition
                  </button>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={handlePasswordLogin}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm rounded-xl shadow-lg hover:shadow-indigo-500/25 transition-all cursor-pointer"
                  >
                    Sign In →
                  </button>
                </div>

                <div className="mt-4 text-center text-xs text-neutral-400">
                  Prefer hands-free login?{" "}
                  <button
                    type="button"
                    onClick={() => setIsFaceLoginMode(true)}
                    className="font-semibold text-orange-400 hover:underline cursor-pointer"
                  >
                    Switch to Biometric Face Login (Press F)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </BorderGlow>
    </div>
  );
}