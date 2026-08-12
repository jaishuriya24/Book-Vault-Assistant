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

import {
  extractRobustFaceDescriptor,
  detectFacePresence
} from "../../utils/faceBiometrics";

export default function SignUp() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  
  // Biometric Camera state
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [cameraStatus, setCameraStatus] = useState("Camera active. Looking for your face...");
  const [isRegistering, setIsRegistering] = useState(false);

  const authApiUrl = import.meta.env.VITE_SPRING_BOOT_AUTH_URL || import.meta.env.VITE_SERVER_URL || "http://localhost:8081";

  // Audio Earcon / Chime for blind users
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

  // Voice fill listener
  useEffect(() => {
    const handleVoiceFill = (e) => {
      const { field, value } = e.detail;
      if (field === "name") {
        setName(value);
        setUsername(value.toLowerCase().replace(/\s+/g, ""));
      } else if (field === "email") {
        setEmail(value);
      } else if (field === "password") {
        setPassword(value);
      }
    };
    window.addEventListener("book-vault:voice-fill-field", handleVoiceFill);
    return () => {
      window.removeEventListener("book-vault:voice-fill-field", handleVoiceFill);
    };
  }, []);

  // Blind accessibility announcement on mount
  useEffect(() => {
    if ('speechSynthesis' in window && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const msg = new SpeechSynthesisUtterance("You are on the registration page. Face biometric camera is active. Enter your name, email, and password to create your vault account.");
      msg.rate = 0.95;
      window.speechSynthesis.speak(msg);
    }
    return () => {
      if ('speechSynthesis' in window && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Face presence polling on camera preview
  useEffect(() => {
    if (!isCameraActive || !cameraReady) return;
    const interval = setInterval(async () => {
      if (webcamRef.current) {
        const screenshot = webcamRef.current.getScreenshot();
        if (screenshot) {
          const presence = await detectFacePresence(webcamRef.current.video, canvasRef.current);
          if (presence && presence.hasFace) {
            setFaceDetected(true);
            setCameraStatus("✅ Face detected! Ready to enroll.");
          } else {
            setFaceDetected(false);
            setCameraStatus("Looking for your face in frame...");
          }
        }
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [isCameraActive, cameraReady]);

  const handleRegister = async () => {
    const finalName = name.trim();
    const finalEmail = email.trim();
    const finalUsername = (username || finalName.toLowerCase().replace(/\s+/g, "")).trim();
    const finalPassword = password.trim();

    if (!finalName) {
      notify.warning("Please enter your name.");
      return;
    }
    if (!finalEmail) {
      notify.warning("Please enter your email address.");
      return;
    }
    if (!finalPassword) {
      notify.warning("Please choose a password.");
      return;
    }

    setIsRegistering(true);
    playTone(650, 0.2);

    let descriptor = null;
    if (isCameraActive && webcamRef.current) {
      try {
        const screenshot = webcamRef.current.getScreenshot();
        if (screenshot) {
          descriptor = await extractRobustFaceDescriptor(screenshot, canvasRef.current);
        }
      } catch (err) {
        console.warn("Face capture note:", err);
      }
    }

    const payload = {
      name: finalName,
      email: finalEmail,
      username: finalUsername,
      password: finalPassword,
      role: "READER",
      faceDescriptor: descriptor,
    };

    try {
      const res = await fetch(`${authApiUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const registeredName = data.name || finalName;
        localStorage.setItem("username", registeredName);
        localStorage.setItem("role", data.role || "READER");
        if (data.token) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("readease_token", data.token);
        }

        // Also save to local face_profiles cache if biometric descriptor was captured
        if (descriptor) {
          const profiles = JSON.parse(localStorage.getItem("face_profiles") || "[]");
          const updated = profiles.filter((p) => p.name.toLowerCase() !== registeredName.toLowerCase());
          updated.push({
            name: registeredName,
            email: finalEmail,
            faceDescriptor: descriptor,
            createdAt: new Date().toISOString(),
          });
          localStorage.setItem("face_profiles", JSON.stringify(updated));
        }

        window.dispatchEvent(new Event("bookvault:username-updated"));
        playTone(880, 0.4);
        notify.success(`Account created successfully for ${registeredName}!`);

        if ('speechSynthesis' in window && window.speechSynthesis) {
          const welcomeMsg = new SpeechSynthesisUtterance(`Welcome to Book Vault, ${registeredName}. Your account has been registered.`);
          window.speechSynthesis.speak(welcomeMsg);
        }

        navigate("/");
        return;
      } else {
        notify.error(data.error || data.message || "Registration failed.");
        setIsRegistering(false);
        return;
      }
    } catch (e) {
      console.warn("Backend offline, saving to local store fallback:", e);

      // Local fallback
      const users = JSON.parse(localStorage.getItem("users") || "[]");
      if (users.find((u) => u.email === finalEmail)) {
        notify.error("User already exists! Please login.");
        setIsRegistering(false);
        return;
      }

      users.push({ email: finalEmail, password: finalPassword, name: finalName, username: finalUsername });
      localStorage.setItem("users", JSON.stringify(users));

      if (descriptor) {
        const profiles = JSON.parse(localStorage.getItem("face_profiles") || "[]");
        profiles.push({
          name: finalName,
          email: finalEmail,
          faceDescriptor: descriptor,
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem("face_profiles", JSON.stringify(profiles));
      }

      localStorage.setItem("username", finalName);
      localStorage.setItem("role", "READER");
      localStorage.setItem("token", `local_token_${Date.now()}`);
      window.dispatchEvent(new Event("bookvault:username-updated"));
      
      playTone(880, 0.4);
      notify.success(`Account created successfully for ${finalName}!`);
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10" style={{ backgroundColor: 'var(--sidebar-bg)' }}>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <BorderGlow
        className="w-full max-w-5xl shadow-2xl backdrop-blur-sm"
        backgroundColor="rgba(0,0,0,0.8)"
        borderRadius={24}
        glowColor="255 100 80"
        colors={['#c084fc', '#f472b6', '#38bdf8']}
        edgeSensitivity={50}
        animated={true}
      >
        <div className="w-full flex flex-col md:flex-row rounded-3xl overflow-hidden bg-black/80">
          
          {/* Left promo / art */}
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
            <div className="absolute inset-0 rounded-l-3xl bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />
            <div className="relative z-10 flex flex-col justify-end text-white h-full pointer-events-none">
              <div className="p-6">
                <MorphText
                  words={["Create Account", "Biometric Vault", "Start Reading"]}
                  interval={2600}
                  fontSize="clamp(1.8rem, 3.5vw, 2.4rem)"
                  className="text-left"
                />
                <p className="text-gray-300 mt-4 max-w-sm text-sm">
                  Join Book Vault. Scan physical books, extract text with voice AI, and enjoy seamless face biometric login.
                </p>
                <div className="mt-6 flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  Instant Biometric & MySQL Synchronization
                </div>
              </div>
            </div>
          </div>

          {/* Right: Registration Form with Camera preview */}
          <div className="w-full md:w-1/2 p-6 sm:p-8 bg-gradient-to-b from-neutral-900 to-black text-white flex flex-col justify-center">
            <div className="flex items-center justify-between mb-4">
              <BackButton onClick={() => navigate("/signin")} />
              <BrandMark showVoice={false} />
            </div>

            <h1 className="text-2xl font-bold mb-1">Create Account</h1>
            <p className="text-xs text-neutral-400 mb-4">
              Fill in your details and enroll your face for instant login
            </p>

            {/* Optional Live Camera Frame for Face Enrollment */}
            <div className="mb-4 p-3 bg-neutral-950 border border-neutral-800 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                  <span>📸</span>
                  <span>Face Biometrics (Optional)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsCameraActive(!isCameraActive)}
                  className="text-[11px] text-orange-400 hover:text-orange-300 underline cursor-pointer"
                >
                  {isCameraActive ? "Disable Camera" : "Enable Camera"}
                </button>
              </div>

              {isCameraActive && (
                <div>
                  <div className="relative w-full h-36 rounded-xl overflow-hidden border border-white/10 bg-black flex items-center justify-center mb-2">
                    <Webcam
                      ref={webcamRef}
                      audio={false}
                      screenshotFormat="image/jpeg"
                      videoConstraints={{ facingMode: "user", width: 640, height: 480 }}
                      className="w-full h-full object-cover transform -scale-x-100"
                      onUserMedia={() => setCameraReady(true)}
                      onUserMediaError={() => {
                        setCameraReady(false);
                        setIsCameraActive(false);
                      }}
                    />
                    {faceDetected && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-emerald-500/80 text-white text-[10px] font-bold">
                        ✓ Face In Frame
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400 text-center">
                    {cameraStatus}
                  </p>
                </div>
              )}
            </div>

            {/* Form Fields */}
            <div className="space-y-3">
              <Field
                label="Full Name"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!username) setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""));
                }}
              />
              <Field
                label="Email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Field
                label="Username"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <Field
                label="Password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="mt-5">
              <PrimaryButton onClick={handleRegister}>
                {isRegistering ? "Creating Account..." : "Create Account & Enroll"}
              </PrimaryButton>
            </div>

            <div className="my-3 flex items-center">
              <Divider label="OR" />
            </div>

            <div className="text-center text-xs text-neutral-400">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => navigate("/signin")}
                className="font-semibold text-orange-400 hover:underline cursor-pointer"
              >
                Sign in with Face / Password
              </button>
            </div>
          </div>
        </div>
      </BorderGlow>
    </div>
  );
}