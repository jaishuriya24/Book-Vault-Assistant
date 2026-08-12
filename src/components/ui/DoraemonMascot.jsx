import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function DoraemonMascot() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const [state, setState] = useState("sleeping"); // "sleeping", "idle", "typing", "joy"
  const [spriteIndex, setSpriteIndex] = useState(1);
  const [dialogText, setDialogText] = useState("");
  const [showBubble, setShowBubble] = useState(false);
  
  const bubbleTimeoutRef = useRef(null);
  const hasAnnouncedMount = useRef(false);
  const recognitionRef = useRef(null);
  const sleepModeRef = useRef(true);

  // Voice greeting messages
  const quotes = [
    "Need any secret gadgets from my 4D pocket for your reading today? 🐱💙",
    "Don't study too hard, Nobita! Take a quick Dorayaki break! 🥞",
    "I'm keeping watch over your Book Vault! All safe! 📖✨",
    "Sometimes, things don't work out no matter how hard you try. Take a breath and try again! 🌈",
    "Let's explore your library collections together!"
  ];

  const triggerBubble = () => {
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    setDialogText(randomQuote);
    setShowBubble(true);
    setState("joy");

    if (bubbleTimeoutRef.current) {
      clearTimeout(bubbleTimeoutRef.current);
    }
    bubbleTimeoutRef.current = setTimeout(() => {
      setShowBubble(false);
      if (sleepModeRef.current) {
        setState("sleeping");
      } else {
        setState("idle");
      }
    }, 5000);
  };

  const showSpeechBubble = (text, replyText) => {
    if (text) setDialogText(text);
    if (replyText) setDialogText(replyText);
    setShowBubble(true);

    if (bubbleTimeoutRef.current) {
      clearTimeout(bubbleTimeoutRef.current);
    }
    bubbleTimeoutRef.current = setTimeout(() => {
      setShowBubble(false);
    }, 6000);
  };

  // Speaks text using SpeechSynthesis with language support
  const speakText = (text, langCode = null) => {
    const activeLang = langCode || localStorage.getItem("assistant_lang") || "en-US";
    if (!("speechSynthesis" in window && window.speechSynthesis)) {
      setDialogText(text);
      setShowBubble(true);
      return;
    }

    // Cancel any active speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = activeLang;
    utterance.rate = 1.05;

    utterance.onstart = () => {
      setState("joy");
      showSpeechBubble("", text);
    };

    utterance.onend = () => {
      if (sleepModeRef.current) {
        setState("sleeping");
      } else {
        setState("idle");
      }
    };

    utterance.onerror = () => {
      if (sleepModeRef.current) {
        setState("sleeping");
      } else {
        setState("idle");
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // Initialize Speech Recognition
  const initSpeech = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition is not supported in this browser.");
      return;
    }
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = localStorage.getItem("assistant_lang") || "en-US";

    rec.onstart = () => {
      if (!sleepModeRef.current) {
        setState("idle");
      }
    };

    rec.onresult = (event) => {
      const lastResultIndex = event.resultIndex;
      const speechText = event.results[lastResultIndex][0].transcript.trim().toLowerCase();
      console.log("[DoraemonAssistant] Heard:", speechText);
      showSpeechBubble(`Heard: "${speechText}"`, "");

      handleCommand(speechText);
    };

    rec.onerror = (e) => {
      console.error("[DoraemonAssistant] Recognition error:", e);
    };

    rec.onend = () => {
      // Keep listening unless explicitly stopped
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // ignore
        }
      }
    };

    recognitionRef.current = rec;
  };

  // Process Voice Commands using Backend Gemini Intent Parser
  const handleCommand = async (command) => {
    // If sleeping, only wake word can wake it up
    if (sleepModeRef.current) {
      if (
        command.includes("wake up") || 
        command.includes("hi doraemon") || 
        command.includes("hello doraemon") ||
        command.includes("எழுந்திரு") ||
        command.includes("उठो")
      ) {
        wakeUp();
      }
      return;
    }

    // Voice language switching overrides
    if (command.includes("switch to tamil") || command.includes("தமிழ் மொழி") || command.includes("பேசு")) {
      localStorage.setItem("assistant_lang", "ta-IN");
      if (recognitionRef.current) recognitionRef.current.lang = "ta-IN";
      speakText("தமிழ் மொழிக்கு மாற்றப்பட்டது.", "ta-IN");
      return;
    }
    if (command.includes("switch to hindi") || command.includes("हिंदी भाषा") || command.includes("बोलो")) {
      localStorage.setItem("assistant_lang", "hi-IN");
      if (recognitionRef.current) recognitionRef.current.lang = "hi-IN";
      speakText("हिंदी भाषा में बदल दिया गया है।", "hi-IN");
      return;
    }
    if (command.includes("switch to english")) {
      localStorage.setItem("assistant_lang", "en-US");
      if (recognitionRef.current) recognitionRef.current.lang = "en-US";
      speakText("Switched to English.", "en-US");
      return;
    }

    setState("typing");
    setDialogText("...");
    setShowBubble(true);

    try {
      const response = await fetch("http://localhost:3001/api/parse-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInput: command })
      });
      const parsed = await response.json();
      console.log("[DoraemonAssistant] Parsed intent:", parsed);

      // Speak response in detected language
      speakText(parsed.response, parsed.language);

      // Handle actions
      const action = parsed.intent;
      const navTarget = parsed.navigate;

      if (action === "navigate" && navTarget) {
        if (navTarget === "library" || navTarget === "home") {
          navigate("/");
        } else if (navTarget === "scanner" || navTarget === "add-book") {
          navigate("/add-book");
        } else {
          navigate("/" + navTarget);
        }
      } else if (action === "open_camera") {
        window.dispatchEvent(new CustomEvent("book-vault:open-upload-modal", { detail: { method: "camera" } }));
      } else if (action === "capture_scan") {
        window.dispatchEvent(new CustomEvent("book-vault:open-upload-modal", { detail: { method: "camera" } }));
      } else if (action === "read_aloud" || action === "resume" || action === "read") {
        window.dispatchEvent(new CustomEvent("book-vault:tts-control", { detail: "play" }));
      } else if (action === "pause") {
        window.dispatchEvent(new CustomEvent("book-vault:tts-control", { detail: "pause" }));
      } else if (action === "stop_reading" || action === "stop") {
        window.dispatchEvent(new CustomEvent("book-vault:tts-control", { detail: "stop" }));
      } else if (command.includes("play my favorite song") || command.includes("favorite song")) {
        window.open("https://www.youtube.com/watch?v=x4rMUIXoyhE", "_blank");
      } else if (command.includes("stop listening") || command.includes("go to sleep")) {
        sleepAssistant();
      }
    } catch (err) {
      console.error("[DoraemonAssistant] Command error:", err);
      speakText("I am sorry, I encountered an error connecting to my database.", "en-US");
    }
  };

  const wakeUp = () => {
    sleepModeRef.current = false;
    setState("idle");
    const activeLang = localStorage.getItem("assistant_lang") || "en-US";
    const msg = activeLang === "ta-IN" ? "சொல்லுங்க பாஸ், நான் கேக்குறேன்." : 
                activeLang === "hi-IN" ? "जी हुजूर, मैं सुन रहा हूँ।" : 
                "Yes, boss? I am listening.";
    speakText(msg, activeLang);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {}
    }
  };

  const sleepAssistant = () => {
    const activeLang = localStorage.getItem("assistant_lang") || "en-US";
    const msg = activeLang === "ta-IN" ? "தேவைப்பட்டால் கூப்பிடுங்கள் பாஸ்." : 
                activeLang === "hi-IN" ? "ज़रूरत हो तो मुझे बुला लेना।" : 
                "Call me if you need me.";
    speakText(msg, activeLang);
    sleepModeRef.current = true;
    setState("sleeping");
  };

  const toggleAssistant = () => {
    if (sleepModeRef.current) {
      wakeUp();
    } else {
      sleepAssistant();
    }
  };

  // Mount/Initialization Lifecycle
  useEffect(() => {
    initSpeech();
    
    // Auto start in sleep mode, listening for wake word
    sleepModeRef.current = true;
    setState("sleeping");
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {}
    }

    // Initial greeting
    setTimeout(() => {
      const activeLang = localStorage.getItem("assistant_lang") || "en-US";
      const greeting = activeLang === "ta-IN" ? "வணக்கம்! நான் டோரேமான். ஆக்டிவேட் செய்ய, எழுந்திரு, என்று சொல்லுங்கள்!" :
                       activeLang === "hi-IN" ? "नमस्ते! मैं डोरेमोन हूँ। एक्टिवेट करने के लिए, उठो, कहें!" :
                       "Hello! I am Doraemon, your desktop companion. Say, Wake up, to activate voice controls!";
      speakText(greeting, activeLang);
    }, 1500);

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      window.speechSynthesis.cancel();
      if (bubbleTimeoutRef.current) {
        clearTimeout(bubbleTimeoutRef.current);
      }
    };
  }, []);

  // Monitor page transitions and speak them automatically in the user's preferred language
  useEffect(() => {
    if (hasAnnouncedMount.current) {
      let pageKey = "home screen";
      if (path === "/library") pageKey = "library";
      else if (path === "/settings") pageKey = "settings view";
      else if (path.startsWith("/reader/")) pageKey = "book reader";
      else if (path === "/continue-reading") pageKey = "reading progress view";

      const activeLang = localStorage.getItem("assistant_lang") || "en-US";
      const maps = {
        "ta-IN": {
          "home screen": "நீங்கள் முகப்புப் பக்கத்திற்கு வந்துவிட்டீர்கள்.",
          "library": "நீங்கள் நூலகப் பக்கத்திற்கு வந்துவிட்டீர்கள்.",
          "settings view": "நீங்கள் அமைப்புகள் பக்கத்திற்கு வந்துவிட்டீர்கள்.",
          "book reader": "நீங்கள் புத்தக வாசிப்பு பக்கத்திற்கு வந்துவிட்டீர்கள்.",
          "reading progress view": "நீங்கள் வாசிப்பு முன்னேற்றப் பக்கத்திற்கு வந்துவிட்டீர்கள்."
        },
        "hi-IN": {
          "home screen": "आप मुख्य स्क्रीन पर आ गए हैं।",
          "library": "आप पुस्तकालय पर आ गए हैं।",
          "settings view": "आप सेटिंग्स स्क्रीन पर आ गए हैं।",
          "book reader": "आप पुस्तक पाठक पर आ गए हैं।",
          "reading progress view": "आप पठन प्रगति स्क्रीन पर आ गए हैं।"
        },
        "en-US": {
          "home screen": "You have navigated to the home screen.",
          "library": "You have navigated to the library.",
          "settings view": "You have navigated to the settings view.",
          "book reader": "You have navigated to the book reader.",
          "reading progress view": "You have navigated to the reading progress view."
        }
      };

      const langMap = maps[activeLang] || maps["en-US"];
      const text = langMap[pageKey] || `You have navigated to the ${pageKey}`;
      speakText(text, activeLang);
    } else {
      hasAnnouncedMount.current = true;
    }
  }, [path]);

  // State loop: periodically change idle animations if active
  useEffect(() => {
    const stateInterval = setInterval(() => {
      if (showBubble || sleepModeRef.current) return;
      const states = ["idle", "idle", "typing"];
      const nextState = states[Math.floor(Math.random() * states.length)];
      setState(nextState);
    }, 12000);

    return () => clearInterval(stateInterval);
  }, [showBubble]);

  // Sprite frame animation speed loop
  useEffect(() => {
    const frameInterval = setInterval(() => {
      setSpriteIndex((prev) => (prev % 3) + 1);
    }, 450);

    return () => clearInterval(frameInterval);
  }, []);

  const getSpritePath = () => {
    switch (state) {
      case "typing":
        return `/dora-sprites/action-coding_typing-0${spriteIndex}.png`;
      case "sleeping":
        return `/dora-sprites/action-nap-0${spriteIndex}.png`;
      case "joy":
        return `/dora-sprites/emotion-joy-0${spriteIndex}.png`;
      case "idle":
      default:
        return `/dora-sprites/emotion-calm-0${spriteIndex}.png`;
    }
  };

  return (
    <div 
      className="dora-mascot-root"
      style={{
        position: "fixed",
        bottom: "16px",
        right: "16px",
        display: "flex",
        alignItems: "flex-end",
        gap: "12px",
        zIndex: 99999,
        pointerEvents: "none"
      }}
    >
      {/* Dialogue Speech Bubble */}
      {showBubble && (
        <div 
          className="dora-bubble"
          style={{
            background: "rgba(18, 18, 18, 0.88)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "18px 18px 2px 18px",
            padding: "12px 16px",
            maxWidth: "240px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
            color: "#fff",
            fontSize: "13px",
            lineHeight: "1.45",
            pointerEvents: "auto",
            animation: "doraSlide 0.25s ease-out forwards",
            transformOrigin: "bottom right",
            fontFamily: "'Inter', sans-serif"
          }}
        >
          {dialogText}
        </div>
      )}

      {/* Mascot sprite container */}
      <div 
        onClick={toggleAssistant}
        className={`dora-sprite-container ${state}`}
        style={{
          width: "76px",
          height: "76px",
          cursor: "pointer",
          pointerEvents: "auto",
          transition: "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          userSelect: "none"
        }}
      >
        <img 
          src={getSpritePath()} 
          alt="Doraemon Desktop Mascot"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            imageRendering: "pixelated"
          }}
        />
      </div>

      <style>{`
        @keyframes doraSlide {
          from { opacity: 0; transform: translateY(8px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .dora-sprite-container:hover {
          transform: translateY(-6px) scale(1.1);
        }
        .dora-sprite-container.sleeping {
          animation: sleepingFloat 2.5s infinite ease-in-out;
        }
        .dora-sprite-container.idle, .dora-sprite-container.typing {
          animation: gentleLevitate 3.5s infinite ease-in-out;
        }
        @keyframes gentleLevitate {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes sleepingFloat {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-2px) rotate(2deg); }
        }
      `}</style>
    </div>
  );
}
