import '../App.css'
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/* AUTH SCREENS */
import SignIn from "../screens/auth/SignIn";
import SignUp from "../screens/auth/SignUp";
import OTPVerify from "../screens/auth/OTPVerify";
import FaceLogin from "../screens/auth/FaceLogin";

/* HOME COMPONENTS */
import ContinueReading from "../components/home/ContinueReading";
import MyOwnBook from "../components/home/MyOwnBook";
import MyBookCollection from "../components/home/MyBookCollection";
import Sidebar from "../components/ui/Sidebar";
import ProfileScreen from "../components/home/ProfileScreen";
import AdminDashboard from "../components/home/AdminDashboard";
import BookScanner from "../screens/scanner/BookScanner";
import VoiceBookScanner from "../components/ui/VoiceBookScanner";
import InteractiveBook from "../components/ui/InteractiveBook";
import Ferrofluid from "../components/ui/Ferrofluid";
import Shuffle from "../components/ui/Shuffle";
import ToastNotification from "../components/ui/ToastNotification";
import ConfirmModal from "../components/ui/ConfirmModal";
import SettingsScreen from "../screens/settings/SettingsScreen";
import notify from "../services/notificationService";
import { extractText } from "../services/ocrService";
import mysqlService from "../services/mysqlService";
import MySQLDatabasePage from "../screens/database/MySQLDatabasePage";
import { parseVoiceCommand } from "../services/voiceCommandService";
import { startMoonshineListening, stopMoonshineListening } from "../services/moonshineVoiceService";
import { Sparkles, Trash2, RotateCcw, Plus, Layers, FileText, Image as ImageIcon, Volume2, CheckCircle2, AlertCircle, Loader2, Database, Mic, MicOff } from "lucide-react";
/* ── SVG Icon Components ── */
const IconBook = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);
const IconLibrary = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <line x1="8" y1="6" x2="16" y2="6" />
    <line x1="8" y1="10" x2="14" y2="10" />
  </svg>
);
const IconScan = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);
const IconPlus = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconCheck = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconArrowLeft = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCover, setUploadCover] = useState(null);
  const [uploadText, setUploadText] = useState(null);
  const [uploadMethod, setUploadMethod] = useState("file"); // "file" or "camera"
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [wizardStep, setWizardStep] = useState(1); // 1: method, 2: content, 3: review
  const [capturedPages, setCapturedPages] = useState([]);
  const [selectedPageIdx, setSelectedPageIdx] = useState(0);
  const [uploadSubTab, setUploadSubTab] = useState("images"); // "images" or "doc"
  const [autoSaveTimeLeft, setAutoSaveTimeLeft] = useState(25);
  const handleUploadSubmitRef = useRef(null);
  const lastPageCountRef = useRef(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [activeUser, setActiveUser] = useState(() => localStorage.getItem("username") || "Guest");
  const [availableAccounts, setAvailableAccounts] = useState(() => {
    try {
      const faceProfiles = JSON.parse(localStorage.getItem("face_profiles") || "[]");
      const names = faceProfiles.map(p => p.name).filter(Boolean);
      const cur = localStorage.getItem("username") || "Guest";
      return Array.from(new Set(["Guest", "Reader", "Admin", cur, ...names]));
    } catch (_) {
      return ["Guest", "Reader", "Admin"];
    }
  });
  const [uploadUser, setUploadUser] = useState(() => localStorage.getItem("username") || "Guest");
  const [customAccountName, setCustomAccountName] = useState("");
  const [showAddAccountInput, setShowAddAccountInput] = useState(false);

  const STORAGE_KEY = `uploadedBooks_${activeUser}`;

  useEffect(() => {
    const refresh = () => {
      const u = localStorage.getItem("username") || "Guest";
      setActiveUser(u);
      setUploadUser(u);
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("bookvault:username-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("bookvault:username-updated", refresh);
    };
  }, [location.pathname]);

  useEffect(() => {
    const authUrl = import.meta.env.VITE_SPRING_BOOT_AUTH_URL || "http://localhost:8081";
    fetch(`${authUrl}/api/users/readers`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const names = data.map((u) => u.userName || u.name).filter(Boolean);
          setAvailableAccounts((prev) => Array.from(new Set([...prev, ...names])));
        }
      })
      .catch(() => {});
  }, []);

  // Re-read books from MySQL & local storage when user or route changes
  const [books, setBooks] = useState([]);
  const [activeInteractiveBook, setActiveInteractiveBook] = useState(null);

  // TTS State
  const [ttsLang, setTtsLang] = useState("en-US");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [ttsIndex, setTtsIndex] = useState(0);
  const [ttsLength, setTtsLength] = useState(0);

  // Dropdown & Edit State
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [editingCoverId, setEditingCoverId] = useState(null);

  // ── Global Ollama Voice Assistant & Command Dispatcher ──
  const [isVoiceListening, setIsVoiceListening] = useState(true);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const globalRecRef = useRef(null);

  const [doraFrame, setDoraFrame] = useState(1);
  useEffect(() => {
    const interval = setInterval(() => {
      setDoraFrame((prev) => (prev % 3) + 1);
    }, 450);
    return () => clearInterval(interval);
  }, []);

  const [pendingField, setPendingField] = useState("");
  const [aiResponseText, setAiResponseText] = useState("");
  const [isSpeakingTts, setIsSpeakingTts] = useState(false);

  // Developer AI Log Console State & Drag Position
  const [showDevConsole, setShowDevConsole] = useState(true);
  const [devConsolePos, setDevConsolePos] = useState({ x: 20, y: Math.max(80, window.innerHeight - 340) });
  const [devInputText, setDevInputText] = useState("");
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const [chatHistory, setChatHistory] = useState([
    { sender: "system", text: "🤖 Doraemon AI Assistant Active (Ollama qwen3.5:0.8b)", time: new Date().toLocaleTimeString() }
  ]);

  const handleStartDrag = (e) => {
    isDraggingRef.current = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragOffsetRef.current = {
      x: clientX - devConsolePos.x,
      y: clientY - devConsolePos.y
    };

    const handleMove = (moveEvt) => {
      if (!isDraggingRef.current) return;
      const curX = moveEvt.touches ? moveEvt.touches[0].clientX : moveEvt.clientX;
      const curY = moveEvt.touches ? moveEvt.touches[0].clientY : moveEvt.clientY;
      const newX = Math.max(10, Math.min(window.innerWidth - 360, curX - dragOffsetRef.current.x));
      const newY = Math.max(10, Math.min(window.innerHeight - 50, curY - dragOffsetRef.current.y));
      setDevConsolePos({ x: newX, y: newY });
    };

    const handleEnd = () => {
      isDraggingRef.current = false;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("touchend", handleEnd);
  };

  const speakWithEchoGuard = useCallback((text, speed = 1.0) => {
    if (!text || !('speechSynthesis' in window && window.speechSynthesis)) return;
    try {
      window.speechSynthesis.cancel();
      setIsSpeakingTts(true);
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      utter.rate = speed || 1.0;
      utter.onend = () => {
        setTimeout(() => setIsSpeakingTts(false), 350);
      };
      utter.onerror = () => {
        setIsSpeakingTts(false);
      };
      window.speechSynthesis.speak(utter);
    } catch (e) {
      setIsSpeakingTts(false);
    }
  }, []);

  const handleDispatchCommand = useCallback(async (transcript) => {
    if (!transcript || !transcript.trim()) return;

    // Do not run global AI conversation or toast notifications on auth pages
    const isAuthRoute = path === "/signin" || path === "/facelogin" || path === "/signup" || path === "/otp";
    if (isAuthRoute) {
      return;
    }

    setVoiceTranscript(transcript);
    notify.info(`Listening: "${transcript}"`);

    const isAuth = activeUser && activeUser !== "Guest" && path !== "/signin" && path !== "/facelogin" && path !== "/signup" && path !== "/otp";

    // Modal Context Voice Controls when Add Book modal is visible
    if (showUploadModal) {
      const lower = transcript.toLowerCase().trim();
      if (lower.includes("continue") || lower.includes("next") || lower.includes("proceed")) {
        setWizardStep(prev => Math.min(3, prev + 1));
        speakWithEchoGuard("Proceeding to next step.");
        setChatHistory(prev => [
          ...prev,
          { sender: "user", text: transcript, time: new Date().toLocaleTimeString() },
          { sender: "ai", text: "Proceeding to next step.", action: "WIZARD_NEXT", source: "Modal Voice", time: new Date().toLocaleTimeString() }
        ]);
        return;
      }
      if (lower.includes("live capture") || lower.includes("camera")) {
        setUploadMethod("camera");
        speakWithEchoGuard("Selected live capture mode.");
        setChatHistory(prev => [
          ...prev,
          { sender: "user", text: transcript, time: new Date().toLocaleTimeString() },
          { sender: "ai", text: "Selected live capture mode.", action: "SELECT_CAMERA", source: "Modal Voice", time: new Date().toLocaleTimeString() }
        ]);
        return;
      }
      if (lower.includes("upload file") || lower.includes("upload") || lower.includes("file")) {
        setUploadMethod("file");
        speakWithEchoGuard("Selected file upload mode.");
        setChatHistory(prev => [
          ...prev,
          { sender: "user", text: transcript, time: new Date().toLocaleTimeString() },
          { sender: "ai", text: "Selected file upload mode.", action: "SELECT_FILE", source: "Modal Voice", time: new Date().toLocaleTimeString() }
        ]);
        return;
      }
      if (lower.includes("close") || lower.includes("cancel") || lower.includes("exit")) {
        setShowUploadModal(false);
        speakWithEchoGuard("Closing modal.");
        setChatHistory(prev => [
          ...prev,
          { sender: "user", text: transcript, time: new Date().toLocaleTimeString() },
          { sender: "ai", text: "Closing modal.", action: "CLOSE_MODAL", source: "Modal Voice", time: new Date().toLocaleTimeString() }
        ]);
        return;
      }
    }

    const appContext = {
      authenticated: isAuth,
      activeUser: activeUser || "Guest",
      currentRoute: path || "/",
      activeBookTitle: activeInteractiveBook ? activeInteractiveBook.title : "",
      activePageNumber: 1,
      bookCount: books ? books.length : 0,
      userBookTitles: books ? books.map(b => b.title).filter(Boolean) : [],
      pendingField: pendingField
    };

    // Call Spring Boot backend (Ollama qwen3.5:0.8b parser with context)
    const cmd = await parseVoiceCommand(transcript, appContext);

    const logSource = cmd._source || (cmd.valid ? "Ollama LLM (qwen3.5:0.8b)" : "Fallback Rule");

    setChatHistory(prev => [
      ...prev,
      { sender: "user", text: transcript, time: new Date().toLocaleTimeString() },
      {
        sender: "ai",
        text: (cmd && cmd.feedbackTts) ? cmd.feedbackTts : "Command parsed.",
        action: cmd ? cmd.action : "UNKNOWN",
        source: logSource,
        time: new Date().toLocaleTimeString()
      }
    ]);

    if (!cmd || !cmd.feedbackTts) {
      const fallbackMsg = "I didn't quite catch that. How can I help you?";
      setAiResponseText(fallbackMsg);
      notify.warn(fallbackMsg);
      speakWithEchoGuard(fallbackMsg);
      return;
    }

    if (!cmd.feedbackTts.trim()) {
      return; // Quiet response for ignored self-echoes
    }

    setAiResponseText(cmd.feedbackTts);
    console.log("🎮 [App Dispatcher] Executing validated AI Command:", cmd);
    notify.success(`AI Action: ${(cmd.action || 'CONVERSATION').replace('_', ' ')}`);

    // Spoken feedback with self-echo guard
    speakWithEchoGuard(cmd.feedbackTts, cmd.speakingSpeed);

    // Command Dispatcher Execution across whole application
    switch (cmd.action) {
      case 'OPEN_FACELOGIN':
        navigate('/facelogin');
        setPendingField('');
        break;

      case 'OPEN_SIGNUP':
        navigate('/signup');
        setPendingField('name');
        break;

      case 'OPEN_SIGNIN':
        navigate('/signin');
        setPendingField('email');
        break;

      case 'TYPE_TEXT':
      case 'SET_FORM_FIELD':
        const textToType = cmd.query || cmd.value || '';
        console.log("[VOICE][ACTION][TYPE_TEXT]", JSON.stringify(textToType));
        console.log("[VOICE][TYPE_TEXT][ACTIVE_ELEMENT]", document.activeElement);

        let activeEl = null;
        if (document.activeElement && (
          document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA' ||
          document.activeElement.isContentEditable
        )) {
          activeEl = document.activeElement;
        }

        if (activeEl) {
          if (activeEl.tagName === 'INPUT') {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            setter?.call(activeEl, textToType);
          } else if (activeEl.tagName === 'TEXTAREA') {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
            setter?.call(activeEl, textToType);
          } else if (activeEl.isContentEditable) {
            activeEl.innerText = textToType;
          }
          activeEl.dispatchEvent(new Event('input', { bubbles: true }));
          activeEl.dispatchEvent(new Event('change', { bubbles: true }));
          console.log("[VOICE][TYPE_TEXT][VALUE_AFTER]", activeEl.value || activeEl.innerText);
        } else {
          console.log("[VOICE][TYPE_TEXT] No editable element focused");
        }

        const fieldName = cmd.field || pendingField || 'name';
        window.dispatchEvent(new CustomEvent('bookvault:voice-fill-field', {
          detail: { field: fieldName, value: textToType }
        }));
        if (fieldName === 'name') setPendingField('email');
        else if (fieldName === 'email') setPendingField('password');
        else setPendingField('');
        break;

      case 'SUBMIT_SIGNUP':
        window.dispatchEvent(new CustomEvent('bookvault:voice-submit-signup'));
        setPendingField('');
        break;

      case 'SUBMIT_LOGIN':
        window.dispatchEvent(new CustomEvent('bookvault:voice-submit-login'));
        setPendingField('');
        break;

      case 'SET_VOICE_SPEED':
        if (cmd.speakingSpeed && 'speechSynthesis' in window) {
          notify.info(`Speaking speed set to ${cmd.speakingSpeed}x`);
        }
        break;

      case 'LIST_BOOKS':
      case 'OPEN_LIBRARY':
        navigate('/library');
        setPendingField('');
        break;

      case 'OPEN_LATEST_BOOK':
      case 'CONTINUE_READING':
        setPendingField('');
        if (books && books.length > 0) {
          setActiveInteractiveBook(books[0]);
        } else {
          notify.info("No books in your vault yet. Scan or upload a book to get started!");
        }
        break;

      case 'NEXT_PAGE':
      case 'PREVIOUS_PAGE':
      case 'READ_PAGE':
      case 'PAUSE_READING':
      case 'BOOKMARK_PAGE':
        window.dispatchEvent(new CustomEvent('bookvault:reader-command', { detail: cmd }));
        break;

      case 'SCAN_PAGE':
        setShowUploadModal(true);
        setUploadMethod('camera');
        setWizardStep(1);
        break;

      case 'CLOSE_MODAL':
      case 'CANCEL':
      case 'STOP':
        setShowUploadModal(false);
        if ('speechSynthesis' in window && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        break;

      case 'SEARCH_BOOK':
        navigate('/search');
        break;

      case 'OPEN_BOOK':
        if (books && books.length > 0) {
          let matched = books[0];
          if (cmd.query) {
            const found = books.find(b => b.title && b.title.toLowerCase().includes(cmd.query.toLowerCase()));
            if (found) matched = found;
          }
          setActiveInteractiveBook(matched);
        } else {
          notify.info("No books in collection to open.");
        }
        break;

      case 'OPEN_SETTINGS':
        navigate('/settings');
        break;

      case 'OPEN_PROFILE':
        navigate('/profile');
        break;

      case 'NAVIGATE':
        if (cmd.target === 'home' || cmd.target === 'root') {
          navigate('/');
        } else if (cmd.target) {
          navigate('/' + cmd.target.replace('/', ''));
        }
        break;

      default:
        // Conversational response spoken via TTS
        break;
    }
  }, [activeUser, path, activeInteractiveBook, books, navigate, pendingField]);

  const [isSpeechPausedByScanner, setIsSpeechPausedByScanner] = useState(false);

  useEffect(() => {
    const handlePause = () => setIsSpeechPausedByScanner(true);
    const handleResume = () => setIsSpeechPausedByScanner(false);

    window.addEventListener("bookvault:pause-global-voice", handlePause);
    window.addEventListener("bookvault:resume-global-voice", handleResume);
    return () => {
      window.removeEventListener("bookvault:pause-global-voice", handlePause);
      window.removeEventListener("bookvault:resume-global-voice", handleResume);
    };
  }, []);

  // Global Speech Recognition with Moonshine WASM Engine + Web Speech Fallback
  useEffect(() => {
    if (!isVoiceListening || isSpeakingTts || isSpeechPausedByScanner) {
      stopMoonshineListening();
      if (globalRecRef.current) {
        try { globalRecRef.current.abort(); } catch (e) {}
        globalRecRef.current = null;
      }
      return;
    }

    let isComponentMounted = true;

    // 1. Try Moonshine Voice WASM Engine first
    startMoonshineListening(
      (finalLine) => {
        if (isComponentMounted && finalLine) {
          console.log("🎙️ [Moonshine WASM] Heard Final:", finalLine);
          handleDispatchCommand(finalLine);
        }
      },
      (interimText) => {
        if (isComponentMounted && interimText) {
          setVoiceTranscript(interimText);
        }
      }
    ).then((transcriber) => {
      // 2. Fallback to Web Speech API if WASM engine not active in browser environment
      if (!transcriber && isComponentMounted) {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) return;

        try {
          const recInstance = new SpeechRec();
          recInstance.continuous = true;
          recInstance.interimResults = false;
          recInstance.lang = 'en-US';

          recInstance.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
              if (event.results[i].isFinal) {
                const transcript = event.results[i][0].transcript.trim();
                if (transcript) {
                  console.log("🎙️ [Web Speech Fallback] Heard:", transcript);
                  handleDispatchCommand(transcript);
                }
              }
            }
          };

          recInstance.onend = () => {
            if (isComponentMounted && isVoiceListening && !isSpeakingTts && !isSpeechPausedByScanner && !(showUploadModal && uploadMethod === 'camera')) {
              setTimeout(() => {
                if (isComponentMounted) {
                  try { recInstance.start(); } catch (e) {}
                }
              }, 600);
            }
          };

          recInstance.start();
          globalRecRef.current = recInstance;
        } catch (e) {}
      }
    });

    return () => {
      isComponentMounted = false;
      stopMoonshineListening();
      if (globalRecRef.current) {
        try { globalRecRef.current.abort(); } catch (e) {}
        globalRecRef.current = null;
      }
    };
  }, [isVoiceListening, isSpeakingTts, isSpeechPausedByScanner, showUploadModal, uploadMethod, handleDispatchCommand]);

  useEffect(() => {
    // Load books directly from MySQL for the active logged-in user only
    mysqlService.getAllBooks(activeUser).then((userBooks) => {
      setBooks(userBooks || []);
    });
  }, [activeUser, path]);


  useEffect(() => {
    if (path.startsWith("/reader/")) {
      const id = path.split("/")[2];
      const savedPos = localStorage.getItem(`readingPos_${activeUser}_${id}`);
      if (savedPos) {
        setTtsIndex(Number(savedPos));
        const book = books.find(b => b.id === id);
        const fullText = book ? book.content : (id === "1" ? localStorage.getItem("uploadedDocument") : "");
        if (fullText) {
          const textAfter = fullText.substring(Number(savedPos));
          const match = textAfter.match(/\s/);
          setTtsLength(match ? match.index : textAfter.length);
        }
        setTimeout(() => {
          document.getElementById("tts-highlight")?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      } else {
        setTtsIndex(0);
        setTtsLength(0);
      }
    } else {
      if ('speechSynthesis' in window && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
      setIsPaused(false);
    }
  }, [path, activeUser, books]);

  const capturedPagesRef = useRef(capturedPages);
  capturedPagesRef.current = capturedPages;

  const handleTextFileChange = (file) => {
    if (!file) return;
    setUploadText(file);

    if (file.type && file.type.startsWith("image/")) {
      handleMultiImageUpload([file]);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target.result || "";
        setExtractedText(content);
        if (!uploadTitle) {
          const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
          setUploadTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
        }
        notify.success(`Loaded text content from ${file.name}`);
      };
      reader.readAsText(file);
    }
  };

  const handleMultiImageUpload = async (files) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);

    notify.info(`Adding ${fileArray.length} ${fileArray.length === 1 ? 'page image' : 'page images'} & extracting text via OCR...`);

    const newPageItems = [];
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });

      const pageNum = capturedPages.length + newPageItems.length + 1;
      newPageItems.push({
        id: Date.now() + Math.random() + i,
        pageNumber: pageNum,
        pageTitle: `Page ${pageNum}`,
        fileName: file.name,
        dataUrl,
        image: dataUrl,
        extractedText: "",
        isExtracting: true,
        status: "extracting"
      });
    }

    setCapturedPages((prev) => {
      const updated = [...prev, ...newPageItems];
      if (!uploadCover && updated.length > 0) {
        setUploadCover(updated[0].dataUrl);
      }
      return updated;
    });

    if (!uploadTitle && fileArray[0]) {
      const cleanName = fileArray[0].name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      setUploadTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }

    // Run OCR asynchronously on each newly added page
    for (const page of newPageItems) {
      try {
        const text = await extractText(page.dataUrl);
        const finalText = (text && text.trim().length > 0) ? text.trim() : "";
        setCapturedPages((prev) => {
          const updated = prev.map((p) =>
            p.id === page.id
              ? { ...p, extractedText: finalText, isExtracting: false, status: "done" }
              : p
          );
          // Sync full book combined text to extractedText state
          const combined = updated.map((p, idx) => `[Page ${idx + 1}]\n${p.extractedText || ""}`).join("\n\n");
          setExtractedText(combined);
          return updated;
        });
      } catch (err) {
        console.warn("OCR error for page:", err);
        setCapturedPages((prev) =>
          prev.map((p) =>
            p.id === page.id
              ? { ...p, extractedText: "", isExtracting: false, status: "error" }
              : p
          )
        );
      }
    }
    notify.success("OCR text extraction completed for uploaded images!");
  };

  const handleReExtractPage = async (pageId) => {
    const page = capturedPages.find((p) => p.id === pageId);
    if (!page) return;
    setCapturedPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, isExtracting: true, status: "extracting" } : p))
    );
    try {
      notify.info(`Re-extracting text for Page ${page.pageNumber}...`);
      const text = await extractText(page.dataUrl || page.image);
      setCapturedPages((prev) =>
        prev.map((p) =>
          p.id === pageId
            ? { ...p, extractedText: text || "", isExtracting: false, status: "done" }
            : p
        )
      );
      notify.success(`Page ${page.pageNumber} text updated!`);
    } catch (err) {
      notify.error("OCR re-extraction failed: " + err.message);
      setCapturedPages((prev) =>
        prev.map((p) =>
          p.id === pageId ? { ...p, isExtracting: false, status: "error" } : p
        )
      );
    }
  };

  const handleDeleteUploadedPage = (pageId) => {
    setCapturedPages((prev) => {
      const filtered = prev.filter((p) => p.id !== pageId);
      const renumbered = filtered.map((p, idx) => ({
        ...p,
        pageNumber: idx + 1,
        pageTitle: `Page ${idx + 1}`
      }));
      if (renumbered.length > 0 && (!uploadCover || !renumbered.some(p => p.dataUrl === uploadCover))) {
        setUploadCover(renumbered[0].dataUrl);
      }
      return renumbered;
    });
    if (selectedPageIdx >= capturedPages.length - 1) {
      setSelectedPageIdx(Math.max(0, capturedPages.length - 2));
    }
  };

  const handleUpdatePageText = (pageId, newText) => {
    setCapturedPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, extractedText: newText } : p))
    );
  };

  const uploadCoverRef = useRef(uploadCover);
  uploadCoverRef.current = uploadCover;
  const uploadTitleRef = useRef(uploadTitle);
  uploadTitleRef.current = uploadTitle;
  const booksRef = useRef(books);
  booksRef.current = books;
  const uploadMethodRef = useRef(uploadMethod);
  uploadMethodRef.current = uploadMethod;

  const handleUploadSubmit = (opts = {}) => {
    console.log("handleUploadSubmit executing with opts:", opts);

    const effectiveMethod = uploadMethodRef.current || uploadMethod;
    const rawTitle = uploadTitleRef.current || uploadTitle || "";
    const defaultTitle = `Book ${(booksRef.current?.length || books.length) + 1}`;
    const finalTitle = rawTitle.trim() ? rawTitle.trim() : defaultTitle;

    const effectivePages = (capturedPages && capturedPages.length > 0)
      ? capturedPages
      : (capturedPagesRef.current && capturedPagesRef.current.length > 0)
        ? capturedPagesRef.current
        : JSON.parse(localStorage.getItem("scanned_book_pages") || "[]");

    const effectiveCover = uploadCover
      || uploadCoverRef.current
      || (effectivePages[0]?.dataUrl || effectivePages[0]?.image || "");

    if (effectiveMethod === "file" && !uploadText && (!effectivePages || effectivePages.length === 0)) {
      if (!opts.isAutoSave) alert("Please provide at least one book image or a text file.");
      return;
    }
    if ((effectiveMethod === "camera" || effectivePages.length > 0) && !effectiveCover && effectivePages.length === 0) {
      if (!opts.isAutoSave) alert("Please capture or upload a book page first.");
      return;
    }

    let combinedContent = "";
    let pagesList = [];

    if (effectivePages.length > 0) {
      combinedContent = effectivePages
        .map((p, idx) => `[Page ${idx + 1}]\n${typeof p === 'string' ? p : (p.extractedText || p.text || "")}`)
        .join("\n\n");

      pagesList = effectivePages.map((p, idx) => ({
        pageNumber: idx + 1,
        pageTitle: p.pageTitle || `Page ${idx + 1}`,
        image: p.dataUrl || p.image || effectiveCover,
        dataUrl: p.dataUrl || p.image || effectiveCover,
        extractedText: typeof p === 'string' ? p : (p.extractedText || p.text || ""),
      }));
    } else {
      combinedContent = extractedText || "No text content provided.";
      pagesList = [{
        pageNumber: 1,
        pageTitle: "Page 1",
        image: effectiveCover,
        dataUrl: effectiveCover,
        extractedText: combinedContent
      }];
    }

    const effectiveUser = uploadUser || activeUser || "Guest";
    const newBook = {
      id: Date.now().toString(),
      title: finalTitle,
      cover: effectiveCover,
      content: combinedContent,
      pages: pagesList,
      pageCount: pagesList.length || 1,
      userId: effectiveUser,
      userName: effectiveUser,
    };

    const finalizeUpload = () => {
      console.log("finalizeUpload saving book:", newBook.title, "for user:", effectiveUser);
      const currentList = booksRef.current || books || [];
      const updated = [...currentList, newBook];
      
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        if (effectiveUser !== activeUser) {
          const targetKey = `uploadedBooks_${effectiveUser}`;
          const targetBooks = JSON.parse(localStorage.getItem(targetKey) || "[]");
          localStorage.setItem(targetKey, JSON.stringify([...targetBooks, newBook]));
        }
      } catch (e) {
        console.warn("LocalStorage full, saved to memory & MySQL:", e);
      }
      
      setBooks(updated);

      // Save directly to MySQL Database (localhost:3306)
      mysqlService.saveBook(newBook)
        .then((res) => {
          if (res.success) {
            notify.success(`"${newBook.title}" (${newBook.pageCount} ${newBook.pageCount === 1 ? 'page' : 'pages'}) saved directly to MySQL Database!`);
          }
        })
        .catch((err) => {
          console.warn("MySQL save error:", err);
          notify.info(`"${newBook.title}" saved for ${effectiveUser}.`);
        });

      setShowUploadModal(false);
      setUploadTitle("");
      setUploadCover(null);
      setUploadText(null);
      setExtractedText("");
      setCapturedPages([]);
      setSelectedPageIdx(0);
      setUploadMethod("file");
      setWizardStep(1);
      setAutoSaveTimeLeft(25);
      localStorage.removeItem("scanned_book_pages");

      if ('speechSynthesis' in window && window.speechSynthesis) {
        const msg = opts.isAutoSave
          ? `25 seconds of inactivity reached. ${finalTitle} automatically saved to MySQL vault.`
          : `${finalTitle} saved to MySQL vault.`;
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(msg));
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2200);
    };

    if (effectiveCover && typeof effectiveCover !== 'string' && effectiveCover instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => {
        newBook.cover = e.target.result;
        finalizeUpload();
      };
      reader.readAsDataURL(effectiveCover);
    } else {
      finalizeUpload();
    }
  };

  handleUploadSubmitRef.current = handleUploadSubmit;

  // 25-second auto-save inactivity countdown timer
  useEffect(() => {
    if (!showUploadModal) {
      setAutoSaveTimeLeft(25);
      lastPageCountRef.current = 0;
      return;
    }

    const currentPages = capturedPages.length > 0 ? capturedPages : (capturedPagesRef.current || []);
    const hasCapturedPages = currentPages.length > 0 || !!uploadCover || !!uploadCoverRef.current;

    if (!hasCapturedPages) {
      setAutoSaveTimeLeft(25);
      lastPageCountRef.current = 0;
      return;
    }

    // Reset countdown to 25s whenever a new page is captured
    if (currentPages.length > lastPageCountRef.current) {
      setAutoSaveTimeLeft(25);
      lastPageCountRef.current = currentPages.length;
    }

    const interval = setInterval(() => {
      setAutoSaveTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimeout(() => {
            if (handleUploadSubmitRef.current) {
              handleUploadSubmitRef.current({ isAutoSave: true });
            }
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const resetInactivity = () => {
      setAutoSaveTimeLeft(25);
    };

    window.addEventListener("keydown", resetInactivity);
    window.addEventListener("click", resetInactivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener("keydown", resetInactivity);
      window.removeEventListener("click", resetInactivity);
    };
  }, [showUploadModal, capturedPages.length, !!uploadCover]);

  const handleRenameBook = async (id, currentTitle, e) => {
    e.stopPropagation();
    setActiveDropdown(null);
    const newTitle = window.prompt("Enter new book title:", currentTitle);
    if (newTitle && newTitle.trim()) {
      const updated = books.map(b => b.id === id ? { ...b, title: newTitle.trim() } : b);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch (_) {}
      setBooks(updated);

      // Sync Rename to MySQL Database
      await mysqlService.updateBook(id, { title: newTitle.trim() });
      notify.success("Book title updated in MySQL Database.");
    }
  };

  const handleUpdateCover = (e) => {
    const file = e.target.files?.[0];
    if (file && editingCoverId) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const coverData = ev.target.result;
        const updated = books.map(b => b.id === editingCoverId ? { ...b, cover: coverData } : b);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch (_) {}
        setBooks(updated);

        // Sync Cover to MySQL Database
        await mysqlService.updateBook(editingCoverId, { coverImage: coverData, cover: coverData });
        notify.success("Book cover updated in MySQL Database.");

        setEditingCoverId(null);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = null; // reset
  };

  const handleDeleteBook = async (id, e) => {
    e.stopPropagation();
    setActiveDropdown(null);
    const shouldDelete = await notify.confirm({
      title: "Delete Book",
      message: "Are you sure you want to permanently remove this book and its pages from the MySQL database and vault?",
      confirmText: "Delete Book",
      cancelText: "Keep Book",
      type: "danger",
      icon: "🗑️",
    });

    if (shouldDelete) {
      await mysqlService.deleteBook(id, activeUser);
      setBooks(prev => prev.filter(b => String(b.id) !== String(id)));
      notify.success("Book deleted from MySQL database.");
    }
  };

  const getSentenceBounds = (text, index) => {
    if (!text || index < 0 || index >= text.length) return { start: 0, end: 0 };
    let start = index;
    while (start > 0 && !['.', '?', '!', '\n'].includes(text[start - 1])) {
      start--;
    }
    while (start < text.length && text[start] === ' ') start++;

    let end = index;
    while (end < text.length && !['.', '?', '!', '\n'].includes(text[end])) {
      end++;
    }
    if (end < text.length && ['.', '?', '!'].includes(text[end])) end++;

    return { start, end };
  };

  const handleSpeak = (fullText, bookId) => {
    if (!('speechSynthesis' in window && window.speechSynthesis)) {
      console.warn("Text-to-speech is not supported on this device.");
      return;
    }
    if (isPlaying) {
      if (isPaused) {
        window.speechSynthesis.resume();
        setIsPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsPaused(true);
        localStorage.setItem(`readingPos_${activeUser}_${bookId}`, ttsIndex.toString());
      }
      return;
    }

    let startIndex = ttsIndex;
    if (startIndex === 0) {
      startIndex = Number(localStorage.getItem(`readingPos_${activeUser}_${bookId}`) || 0);
      setTtsIndex(startIndex);
    }

    const textToSpeak = fullText.substring(startIndex);
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = ttsLang;

    utterance.onboundary = (e) => {
      if (e.name === 'word') {
        const absoluteIndex = startIndex + e.charIndex;
        setTtsIndex(absoluteIndex);
        localStorage.setItem(`readingPos_${activeUser}_${bookId}`, absoluteIndex.toString());
      }
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);

      if (ttsIndex >= fullText.length - 50) {
        setTtsIndex(0);
        localStorage.removeItem(`readingPos_${activeUser}_${bookId}`);
      }
    };

    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setIsPaused(false);
  };

  // Handle custom events from Voice Assistant (PetAssistant.jsx)
  useEffect(() => {
    const handleOpenUploadModal = (e) => {
      const method = e.detail?.method || "file";
      setUploadMethod(method);
      setShowUploadModal(true);
      if (method === "camera") {
        setWizardStep(2);
      }
    };

    const handleTtsControl = (e) => {
      const action = e.detail;
      if (action === "play" || action === "resume") {
        if (path.startsWith("/reader/")) {
          const id = path.split("/")[2];
          const book = books.find(b => b.id === id);
          const docText = book ? book.content : (id === "1" ? localStorage.getItem("uploadedDocument") : null);
          if (docText) {
            handleSpeak(docText, id);
          }
        }
      } else if (action === "pause") {
        if (isPlaying && !isPaused) {
          if ('speechSynthesis' in window && window.speechSynthesis) {
            window.speechSynthesis.pause();
          }
          setIsPaused(true);
          const id = path.split("/")[2];
          localStorage.setItem(`readingPos_${activeUser}_${id}`, ttsIndex.toString());
        }
      } else if (action === "stop") {
        if ('speechSynthesis' in window && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        setIsPlaying(false);
        setIsPaused(false);
      }
    };

    const handleCloseUploadModal = () => {
      setShowUploadModal(false);
    };

    window.addEventListener("book-vault:open-upload-modal", handleOpenUploadModal);
    window.addEventListener("book-vault:close-upload-modal", handleCloseUploadModal);
    window.addEventListener("book-vault:tts-control", handleTtsControl);

    return () => {
      window.removeEventListener("book-vault:open-upload-modal", handleOpenUploadModal);
      window.removeEventListener("book-vault:close-upload-modal", handleCloseUploadModal);
      window.removeEventListener("book-vault:tts-control", handleTtsControl);
    };
  }, [path, books, isPlaying, isPaused, ttsIndex, activeUser, handleSpeak]);

  const renderScreen = () => {
    if (path === "/signin") return <SignIn />;
    if (path === "/facelogin" || path === "/face-login") return <FaceLogin />;
    if (path === "/signup") return <SignUp />;
    if (path === "/otp") return <OTPVerify />;
    if (path === "/profile") return <ProfileScreen />;
    if (path === "/admin" || path === "/admin-dashboard" || path === "/users") {
      const userRole = localStorage.getItem("role");
      if (userRole !== "ADMIN") {
        return <SignIn />;
      }
      return <AdminDashboard />;
    }
    if (path === "/search") return <div className="p-10">🔍 Search Screen</div>;
    if (path === "/settings") return <SettingsScreen activeUser={activeUser} navigate={navigate} />;

    if (path === "/library") {
      return (
        <div className="slide-up" style={{ maxWidth: 960, width: "100%", margin: "0 auto", textAlign: 'left', position: 'relative' }}>
          <button onClick={() => navigate("/")} className="btn-back" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(243,237,228,0.6)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 14, padding: '8px 16px', borderRadius: 10, marginBottom: 20 }}>
            <IconArrowLeft /> Back
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>My Library Collection</h2>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{books.length} book{books.length !== 1 ? 's' : ''} in MySQL</span>
          </div>

          {books.length === 0 ? (
            <div className="card" style={{ padding: '48px 36px', textAlign: 'center' }}>
              <div className="empty-state">
                <div className="empty-state-icon">📚</div>
                <div className="empty-state-title">Your Collection is Empty</div>
                <div className="empty-state-subtitle">You haven't added any books to your vault yet.<br />Start by scanning or uploading a book!</div>
              </div>
            </div>
          ) : (
            <div className="book-grid">
              {books.map((b, i) => (
                <div
                  key={b.id}
                  onClick={() => { setActiveInteractiveBook(b); }}
                  className={`card card-interactive slide-up stagger-${Math.min(i + 1, 4)}`}
                  style={{ padding: 12, position: "relative" }}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === b.id ? null : b.id); }}
                    className="book-menu-btn"
                    title="Options"
                    style={{ position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.92)", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--text-secondary)", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", zIndex: 10 }}
                  >⋮</button>

                  {activeDropdown === b.id && (
                    <div style={{ position: "absolute", top: 42, right: 8, width: 156, background: "#fff", borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,0.14)", border: "1px solid var(--border)", overflow: "hidden", zIndex: 20, fontSize: 13 }}>
                      <button onClick={(e) => handleRenameBook(b.id, b.title, e)} style={{ display: "block", width: "100%", padding: "11px 16px", textAlign: "left", border: "none", background: "none", cursor: "pointer", color: "var(--text-primary)", fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>✏️ Rename</button>
                      <button onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setEditingCoverId(b.id); document.getElementById("cover-update-input").click(); }} style={{ display: "block", width: "100%", padding: "11px 16px", textAlign: "left", border: "none", background: "none", cursor: "pointer", color: "var(--text-primary)", fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>🖼️ Update Cover</button>
                      <button onClick={(e) => handleDeleteBook(b.id, e)} style={{ display: "block", width: "100%", padding: "11px 16px", textAlign: "left", border: "none", background: "none", cursor: "pointer", color: "#c0392b", fontWeight: 500, borderTop: "1px solid var(--border)", fontFamily: 'Inter, sans-serif' }}>🗑️ Remove</button>
                    </div>
                  )}

                  {b.cover ? (
                    <img
                      src={b.cover}
                      alt={b.title}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                      }}
                      style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 14, marginBottom: 10, display: "block", boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                    />
                  ) : null}
                  <div
                    className="book-cover-placeholder"
                    style={{
                      display: b.cover ? 'none' : 'flex',
                      marginBottom: 10,
                      aspectRatio: '3/4',
                      width: '100%',
                      borderRadius: 14,
                      background: 'linear-gradient(135deg, #f0e9df, #e8ddd0)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 36
                    }}
                  >
                    📖
                  </div>
                  <h3 style={{ margin: 0, fontSize: 13, fontFamily: "Playfair Display, serif", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{b.title}</h3>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (path === "/continue-reading") {
      const pausedBooks = books.filter(b => localStorage.getItem(`readingPos_${activeUser}_${b.id}`));

      return (
        <div className="card slide-up" style={{ padding: '48px 36px', maxWidth: 640, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <button onClick={() => navigate("/")} style={{ position: 'absolute', top: 24, left: 24, display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 500, fontSize: 14 }}>
            <IconArrowLeft /> Back
          </button>

          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 24, marginTop: 16 }}>Continue Reading</h2>
          {(() => {
            const pausedBooks = books.filter(b => 
              localStorage.getItem(`readingPos_${activeUser}_${b.id}`) || 
              localStorage.getItem(`readingPos_${activeUser}_${b.title}`)
            );

            return pausedBooks.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
                {pausedBooks.map(b => (
                  <div
                    key={b.id}
                    onClick={() => {
                      const pages = b.pages && b.pages.length > 0 ? b.pages : [{ pageNumber: 1, pageTitle: 'Page 1', image: b.cover || b.cover_image, extractedText: b.content || b.full_text || '' }];
                      setActiveInteractiveBook({
                        ...b,
                        bookId: b.id,
                        cover: b.cover || b.cover_image,
                        pages
                      });
                    }}
                    className="card card-interactive"
                    style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}
                  >
                    {b.cover || b.cover_image ? (
                      <img src={b.cover || b.cover_image} alt="cover" style={{ width: 56, height: 72, objectFit: 'cover', borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    ) : (
                      <div style={{ width: 56, height: 72, background: 'linear-gradient(135deg, #d8cdb8, #c2b5a0)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#9a8a78' }}>
                        📖
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>{b.title}</h3>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent-orange)', fontSize: 13, fontWeight: 600, marginTop: 6 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--accent-orange)" stroke="none">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        Resume Reading
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📖</div>
                <div className="empty-state-title">No Books in Progress</div>
                <div className="empty-state-subtitle">Start reading a book to see it here!</div>
              </div>
            );
          })()}
        </div>
      );
    }

    if (path === "/database" || path === "/mysql") {
      const userRole = localStorage.getItem("role");
      if (userRole !== "ADMIN") {
        return <SignIn />;
      }
      return (
        <MySQLDatabasePage
          onOpenBook={(b) => {
            const pages = b.pages || [{ pageNumber: 1, pageTitle: 'Page 1', image: b.cover || b.cover_image, extractedText: b.content || b.full_text || '' }];
            setActiveInteractiveBook({
              ...b,
              cover: b.cover || b.cover_image,
              pages
            });
          }}
          onNavigateHome={() => navigate("/")}
        />
      );
    }

    if (path === "/add-book") {
      return (
        <div className="card slide-up" style={{ padding: '48px 36px', maxWidth: 640, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <button onClick={() => navigate("/")} style={{ position: 'absolute', top: 24, left: 24, display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 500, fontSize: 14 }}>
            <IconArrowLeft /> Back
          </button>
          <div className="empty-state">
            <div className="empty-state-icon">✍️</div>
            <div className="empty-state-title">No Drafts Found</div>
            <div className="empty-state-subtitle">You haven't started writing your own book yet.</div>
          </div>
        </div>
      );
    }

    if (path.startsWith("/reader/")) {
      const id = path.split("/")[2];
      const book = books.find(b => b.id === id);

      let docText = book ? book.content : (id === "1" ? localStorage.getItem("uploadedDocument") : null);
      let docTitle = book ? book.title : (id === "1" ? localStorage.getItem("uploadedTitle") || "Untitled Document" : "Not Found");

      if (docText) {
        const bounds = getSentenceBounds(docText, ttsIndex);
        const before = docText.substring(0, bounds.start);
        const highlighted = docText.substring(bounds.start, bounds.end);
        const after = docText.substring(bounds.end);

        const hasSavedPos = localStorage.getItem(`readingPos_${activeUser}_${id}`);
        const showHighlight = isPlaying || isPaused || hasSavedPos;

        return (
          <div className="card slide-up" style={{ padding: '32px 28px', maxWidth: 800, margin: '0 auto', textAlign: 'left', position: 'relative', overflowY: 'auto', height: '100%' }}>
            <button onClick={() => navigate("/")} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(243,237,228,0.6)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 14, padding: '8px 16px', borderRadius: 10 }}>
              <IconArrowLeft /> Back
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, marginBottom: 8, justifyContent: 'flex-end' }}>
              <select
                value={ttsLang}
                onChange={e => setTtsLang(e.target.value)}
                className="field-input"
                style={{ width: 'auto', padding: '8px 12px', fontSize: 13 }}
              >
                <option value="en-US">🇺🇸 English</option>
                <option value="ta-IN">🇮🇳 Tamil</option>
                <option value="en-IN">🗣️ Tanglish</option>
              </select>
              <button
                onClick={() => handleSpeak(docText, id)}
                className={isPlaying && !isPaused ? 'btn-orange' : 'btn-primary'}
                style={{ padding: '8px 18px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {isPlaying ? (isPaused ? (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" stroke="none"><polygon points="5 3 19 12 5 21 5 3" /></svg> Resume</>
                ) : (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><line x1="6" y1="4" x2="6" y2="20" /><line x1="18" y1="4" x2="18" y2="20" /></svg> Pause</>
                )) : (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M19.07 4.93a10 10 0 010 14.14" /><path d="M15.54 8.46a5 5 0 010 7.07" /></svg> Listen</>
                )}
              </button>
            </div>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 24, marginTop: 20, textAlign: 'center' }}>{docTitle}</h2>
            <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', lineHeight: 1.85, fontFamily: 'Georgia, serif', fontSize: 17 }}>
              {before}
              {showHighlight && highlighted ? <span id="tts-highlight">{highlighted}</span> : highlighted}
              {after}
            </div>
          </div>
        );
      }

      return (
        <div className="card slide-up" style={{ padding: '48px 36px', maxWidth: 640, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <button onClick={() => navigate("/")} style={{ position: 'absolute', top: 24, left: 24, display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 500, fontSize: 14 }}>
            <IconArrowLeft /> Back
          </button>
          <div className="empty-state">
            <div className="empty-state-icon">🔖</div>
            <div className="empty-state-title">Nothing in Progress</div>
            <div className="empty-state-subtitle">You are not currently reading any books.</div>
          </div>
        </div>
      );
    }

    // ═══════════════════════════════════════
    // DEFAULT HOME ("/")
    // ═══════════════════════════════════════
    const greeting = () => {
      const h = new Date().getHours();
      if (h < 12) return "Good morning";
      if (h < 17) return "Good afternoon";
      return "Good evening";
    };

    const totalPages = books.reduce((acc, b) => acc + (b.content ? Math.ceil(b.content.length / 900) : 0), 0);
    const booksInProgress = books.filter(b => localStorage.getItem(`readingPos_${activeUser}_${b.id}`)).length;

    return (
      <div className="slide-up" style={{ maxWidth: 960, width: "100%", margin: "0 auto", position: 'relative', zIndex: 1 }}>
        {/* ── Hero Section ── */}
        <div className="hero-card" style={{ marginBottom: 28, position: 'relative', overflow: 'hidden', backgroundColor: '#000' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, opacity: 1 }}>
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
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: 'none', background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent, rgba(0,0,0,0.4))' }}></div>
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <button
                onClick={() => navigate(activeUser !== "Guest" ? "/profile" : "/signin")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "5px 14px",
                  borderRadius: 99,
                  fontSize: 12,
                  fontWeight: 700,
                  background: activeUser !== "Guest" ? "rgba(234,88,12,0.3)" : "rgba(255,255,255,0.1)",
                  color: activeUser !== "Guest" ? "#fb923c" : "#fff",
                  border: activeUser !== "Guest" ? "1px solid rgba(234,88,12,0.5)" : "1px solid rgba(255,255,255,0.2)",
                  cursor: "pointer",
                  letterSpacing: "0.03em",
                  boxShadow: activeUser !== "Guest" ? "0 0 12px rgba(234,88,12,0.3)" : "none"
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: activeUser !== "Guest" ? "#22c55e" : "#eab308", boxShadow: activeUser !== "Guest" ? "0 0 8px #22c55e" : "none" }} />
                {activeUser !== "Guest" ? `👤 Logged in as: ${activeUser}` : "👤 Guest (Click to Sign In)"}
              </button>

              <button
                onClick={() => navigate("/admin-dashboard")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 12px",
                  borderRadius: 99,
                  fontSize: 12,
                  fontWeight: 700,
                  background: "rgba(79,70,229,0.25)",
                  color: "#a5b4fc",
                  border: "1px solid rgba(129,140,248,0.4)",
                  cursor: "pointer",
                  letterSpacing: "0.03em"
                }}
              >
                👥 View MySQL Users & Audits
              </button>

              <span style={{ padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px #4ade80" }} />
                MySQL Live
              </span>
            </div>
            <Shuffle
              text="Book Vault"
              tag="h1"
              shuffleDirection="right"
              duration={0.35}
              animationMode="evenodd"
              shuffleTimes={1}
              ease="power3.out"
              stagger={0.03}
              threshold={0.1}
              triggerOnce={true}
              triggerOnHover={true}
              respectReducedMotion={true}
              style={{ fontFamily: "Playfair Display, serif", fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 700, margin: "0 0 6px", color: "#fff", letterSpacing: "-0.01em", textTransform: 'none' }}
            />
            <p style={{ margin: 0, opacity: 0.55, fontSize: 14, color: "#e0dbd4", maxWidth: 320 }}>Your personal reading companion — scan, read, and listen to your books</p>

            {/* Stats */}
            <div className="hero-stats">
              <div className="hero-stat">
                <div className="hero-stat-icon" style={{ background: 'rgba(224,122,58,0.2)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f5a66b" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                </div>
                <div>
                  <div className="hero-stat-value">{books.length}</div>
                  <div className="hero-stat-label">Books</div>
                </div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-icon" style={{ background: 'rgba(59,130,246,0.2)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                </div>
                <div>
                  <div className="hero-stat-value">{totalPages}</div>
                  <div className="hero-stat-label">Pages</div>
                </div>
              </div>
              {booksInProgress > 0 && (
                <div className="hero-stat">
                  <div className="hero-stat-icon" style={{ background: 'rgba(16,185,129,0.2)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                  </div>
                  <div>
                    <div className="hero-stat-value">{booksInProgress}</div>
                    <div className="hero-stat-label">In Progress</div>
                  </div>
                </div>
              )}
            </div>

            {!localStorage.getItem("username") && (
              <button
                onClick={() => navigate("/signin")}
                className="btn-orange"
                style={{ marginTop: 22, fontSize: 14, padding: "11px 24px" }}
              >
                Login to Sync →
              </button>
            )}
          </div>
        </div>

        {/* ── Quick Actions ── */}
        <div className="quick-action-grid">
          <div
            className="quick-action-card"
            onClick={() => navigate("/continue-reading")}
          >
            <div className="quick-action-icon" style={{ background: "linear-gradient(135deg, #fef3e8, #fde9d3)" }}>
              <IconBook />
            </div>
            <div>
              <div className="quick-action-title">Continue Reading</div>
              <div className="quick-action-subtitle">Pick up where you left off</div>
            </div>
          </div>

          <div
            className="quick-action-card"
            onClick={() => navigate("/library")}
          >
            <div className="quick-action-icon" style={{ background: "linear-gradient(135deg, #eef4f8, #dbeafe)" }}>
              <IconLibrary />
            </div>
            <div>
              <div className="quick-action-title">My Library</div>
              <div className="quick-action-subtitle">Browse your collection</div>
            </div>
          </div>

          <div
            className="quick-action-card"
            onClick={() => { setUploadMethod("camera"); setWizardStep(2); setShowUploadModal(true); }}
          >
            <div className="quick-action-icon" style={{ background: "linear-gradient(135deg, #f8f2ec, #f0e6d8)" }}>
              <IconScan />
            </div>
            <div>
              <div className="quick-action-title">Scan a Book</div>
              <div className="quick-action-subtitle">Voice-guided smart capture</div>
            </div>
          </div>

          {localStorage.getItem("role") === "ADMIN" && (
            <div
              className="quick-action-card"
              onClick={() => navigate("/database")}
            >
              <div className="quick-action-icon" style={{ background: "linear-gradient(135deg, #e0f2fe, #bae6fd)" }}>
                <Database size={22} color="#0284c7" />
              </div>
              <div>
                <div className="quick-action-title">MySQL Database</div>
                <div className="quick-action-subtitle">Live records & tables (Port 3306)</div>
              </div>
            </div>
          )}
        </div>

        {/* ── Uploaded Books Section ── */}
        <div>
          <h2 className="section-header">
            <div className="section-header-icon" style={{ background: 'linear-gradient(135deg, rgba(224,122,58,0.1), rgba(224,122,58,0.03))' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
            </div>
            My Uploaded Books
          </h2>

          {books.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">📭</div>
                <div className="empty-state-title">No books yet</div>
                <div className="empty-state-subtitle">Tap the + button or Scan a Book to get started</div>
              </div>
            </div>
          ) : (
            <div className="book-grid">
              {books.map((b, i) => (
                <div
                  key={b.id}
                  onClick={() => { setActiveInteractiveBook(b); }}
                  className={`card card-interactive slide-up stagger-${Math.min(i + 1, 4)}`}
                  style={{ padding: 12, position: "relative" }}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === b.id ? null : b.id); }}
                    className="book-menu-btn"
                    title="Options"
                    style={{ position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.92)", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--text-secondary)", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", opacity: 0, transition: "opacity 0.15s", zIndex: 10 }}
                  >⋮</button>

                  {activeDropdown === b.id && (
                    <div style={{ position: "absolute", top: 42, right: 8, width: 156, background: "#fff", borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,0.14)", border: "1px solid var(--border)", overflow: "hidden", zIndex: 20, fontSize: 13 }}>
                      <button onClick={(e) => handleRenameBook(b.id, b.title, e)} style={{ display: "block", width: "100%", padding: "11px 16px", textAlign: "left", border: "none", background: "none", cursor: "pointer", color: "var(--text-primary)", fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>✏️ Rename</button>
                      <button onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setEditingCoverId(b.id); document.getElementById("cover-update-input").click(); }} style={{ display: "block", width: "100%", padding: "11px 16px", textAlign: "left", border: "none", background: "none", cursor: "pointer", color: "var(--text-primary)", fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>🖼️ Update Cover</button>
                      <button onClick={(e) => handleDeleteBook(b.id, e)} style={{ display: "block", width: "100%", padding: "11px 16px", textAlign: "left", border: "none", background: "none", cursor: "pointer", color: "#c0392b", fontWeight: 500, borderTop: "1px solid var(--border)", fontFamily: 'Inter, sans-serif' }}>🗑️ Remove</button>
                    </div>
                  )}

                  {b.cover ? (
                    <img
                      src={b.cover}
                      alt={b.title}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                      }}
                      style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 14, marginBottom: 10, display: "block", boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                    />
                  ) : null}
                  <div
                    className="book-cover-placeholder"
                    style={{
                      display: b.cover ? 'none' : 'flex',
                      marginBottom: 10,
                      aspectRatio: '3/4',
                      width: '100%',
                      borderRadius: 14,
                      background: 'linear-gradient(135deg, #f0e9df, #e8ddd0)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 36
                    }}
                  >
                    📖
                  </div>
                  <h3 style={{ margin: 0, fontSize: 13, fontFamily: "Playfair Display, serif", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{b.title}</h3>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Interactive Book Reader Popup */}
        {activeInteractiveBook && (
          <InteractiveBook
            coverImage={activeInteractiveBook.cover}
            bookTitle={activeInteractiveBook.title}
            bookAuthor={activeInteractiveBook.author || "Uploaded Book"}
            pages={
              (activeInteractiveBook.pages && activeInteractiveBook.pages.length > 0)
                ? activeInteractiveBook.pages.map(p => typeof p === 'string' ? p : (p.extractedText || p.text || activeInteractiveBook.content || ""))
                : [activeInteractiveBook.content || "No text extracted."]
            }
            onClose={() => setActiveInteractiveBook(null)}
            onOpenReader={() => {
              const bookId = activeInteractiveBook.id;
              setActiveInteractiveBook(null);
              navigate(`/reader/${bookId}`);
            }}
          />
        )}

        {/* Hover hack for book menu buttons */}
        <style>{`.card:hover .book-menu-btn { opacity: 1; }`}</style>
      </div>
    );
  };

  const isAuthScreen = ["/signin", "/facelogin", "/face-login", "/signup", "/otp"].includes(path);

  return (
    <div className={`app-shell ${isAuthScreen ? "is-auth-screen" : ""}`}>
      {!isAuthScreen && <Sidebar />}
      <main className={`page-content ${isAuthScreen ? "auth-page-content" : ""}`}>
        {renderScreen()}
      </main>

      {/* ── Floating Action Button (Only on home / library pages, hidden on Face Detection & Auth) ── */}
      {!isAuthScreen && (
        <button
          onClick={() => setShowUploadModal(true)}
          title="Add a Book"
          aria-label="Add a Book"
          className="fab"
        >
          <IconPlus />
        </button>
      )}

      {/* ═══════════════════════════════════════
          UPLOAD MODAL (Step-by-Step Wizard)
         ═══════════════════════════════════════ */}
      {showUploadModal && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setShowUploadModal(false)}
        >
          <div className={`modal-box ${uploadMethod === "camera" && wizardStep === 2 ? "is-camera-mode" : ""}`} style={{ maxWidth: (uploadMethod === "camera" && wizardStep === 2) ? 820 : 520, width: "100%" }}>
            {/* Header */}
            <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-orange)" }}>New Entry</p>
                <h2 style={{ margin: 0, fontFamily: "Playfair Display, serif", fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>Add a Book</h2>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={() => setShowUploadModal(false)}
                  style={{ background: "rgba(221,214,200,0.3)", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", flexShrink: 0, transition: 'all 0.15s' }}
                >✕</button>
              </div>
            </div>

            {/* Wizard Steps Indicator */}
            <div className="wizard-steps">
              <div className={`wizard-step ${wizardStep === 1 ? 'active' : wizardStep > 1 ? 'completed' : ''}`}>
                <div className="wizard-step-number">{wizardStep > 1 ? '✓' : '1'}</div>
                <span className="wizard-step-label">Method</span>
              </div>
              <div className={`wizard-step-connector ${wizardStep > 1 ? 'completed' : ''}`} />
              <div className={`wizard-step ${wizardStep === 2 ? 'active' : wizardStep > 2 ? 'completed' : ''}`}>
                <div className="wizard-step-number">{wizardStep > 2 ? '✓' : '2'}</div>
                <span className="wizard-step-label">Content</span>
              </div>
              <div className={`wizard-step-connector ${wizardStep > 2 ? 'completed' : ''}`} />
              <div className={`wizard-step ${wizardStep === 3 ? 'active' : ''}`}>
                <div className="wizard-step-number">3</div>
                <span className="wizard-step-label">Review</span>
              </div>
            </div>

            {/* Divider */}
            <div className="modal-divider" style={{ height: 1, background: "var(--border)", margin: "0 0 20px" }} />

            {/* ── Step 1: Choose Method ── */}
            {wizardStep === 1 && (
              <div className="fade-in">
                <div className="method-picker" style={{ marginBottom: 20 }}>
                  <button
                    onClick={() => setUploadMethod("file")}
                    className={`method-card ${uploadMethod === "file" ? "selected" : ""}`}
                  >
                    <div className="method-card-icon">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={uploadMethod === "file" ? "var(--accent-orange)" : "var(--text-secondary)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    </div>
                    <div className="method-card-title">Upload File</div>
                    <div className="method-card-subtitle">TXT, MD or cover image</div>
                  </button>
                  <button
                    onClick={() => setUploadMethod("camera")}
                    className={`method-card ${uploadMethod === "camera" ? "selected" : ""}`}
                  >
                    <div className="method-card-icon">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={uploadMethod === "camera" ? "var(--accent-orange)" : "var(--text-secondary)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                    </div>
                    <div className="method-card-title">Live Capture</div>
                    <div className="method-card-subtitle">Voice-guided book scan</div>
                  </button>
                </div>
                <button
                  onClick={() => setWizardStep(2)}
                  className="btn-primary"
                  style={{ width: '100%', padding: '14px', fontSize: 15, borderRadius: 14 }}
                >
                  Continue →
                </button>
              </div>
            )}

            {/* ── Step 2: Content ── */}
            {wizardStep === 2 && (
              <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Title field */}
                <div className="book-title-field">
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>Book Title</label>
                  <input
                    className="field-input"
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Enter a book or document title…"
                  />
                </div>

                {uploadMethod === "file" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* Sub-tabs: Multi-Page Images vs Document File */}
                    <div style={{ display: "flex", gap: 8, background: "rgba(0,0,0,0.04)", padding: 4, borderRadius: 10 }}>
                      <button
                        type="button"
                        onClick={() => setUploadSubTab("images")}
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "none",
                          background: uploadSubTab === "images" ? "#fff" : "transparent",
                          boxShadow: uploadSubTab === "images" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                          fontWeight: 700,
                          fontSize: 13,
                          color: uploadSubTab === "images" ? "var(--accent-orange)" : "var(--text-secondary)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6
                        }}
                      >
                        <ImageIcon size={15} />
                        Book Images / Pages ({capturedPages.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setUploadSubTab("doc")}
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "none",
                          background: uploadSubTab === "doc" ? "#fff" : "transparent",
                          boxShadow: uploadSubTab === "doc" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                          fontWeight: 700,
                          fontSize: 13,
                          color: uploadSubTab === "doc" ? "var(--accent-orange)" : "var(--text-secondary)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6
                        }}
                      >
                        <FileText size={15} />
                        Text / Markdown File
                      </button>
                    </div>

                    {uploadSubTab === "images" ? (
                      <div>
                        {/* Multi-Image Upload dropzone */}
                        <label
                          htmlFor="multi-page-file-input"
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "2px dashed #e2d9cd",
                            borderRadius: 14,
                            padding: "20px 16px",
                            background: "#fbf9f6",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            textAlign: "center",
                            gap: 8
                          }}
                        >
                          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,121,0,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#FF7900" }}>
                            <Plus size={22} />
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                              {capturedPages.length === 0 ? "Select Book Images (Single or Multiple)" : "+ Add More Book Page Images"}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                              Upload 1 or more images — OCR extracts text automatically for each page
                            </div>
                          </div>
                          <input
                            id="multi-page-file-input"
                            type="file"
                            multiple
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={(e) => handleMultiImageUpload(e.target.files)}
                          />
                        </label>

                        {/* Gallery Strip of Uploaded Pages */}
                        {capturedPages.length > 0 && (
                          <div style={{ marginTop: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
                                Uploaded Pages ({capturedPages.length})
                              </span>
                              <span style={{ fontSize: 11, color: "var(--accent-orange)", fontWeight: 600 }}>
                                Click page to view & edit text
                              </span>
                            </div>

                            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
                              {capturedPages.map((page, idx) => {
                                const isSelected = selectedPageIdx === idx;
                                return (
                                  <div
                                    key={page.id || idx}
                                    onClick={() => setSelectedPageIdx(idx)}
                                    style={{
                                      width: 84,
                                      flexShrink: 0,
                                      cursor: "pointer",
                                      border: isSelected ? "2px solid #FF7900" : "1px solid var(--border)",
                                      borderRadius: 10,
                                      padding: 4,
                                      background: isSelected ? "rgba(255,121,0,0.06)" : "#fff",
                                      transition: "all 0.15s",
                                      boxShadow: isSelected ? "0 4px 12px rgba(255,121,0,0.18)" : "none",
                                      position: "relative"
                                    }}
                                  >
                                    <div style={{ width: "100%", height: 74, borderRadius: 6, overflow: "hidden", background: "#f0e9df" }}>
                                      <img src={page.dataUrl || page.image} alt={`Page ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, fontSize: 10, fontWeight: 700, color: "var(--text-primary)" }}>
                                      <span>P.{idx + 1}</span>
                                      {page.isExtracting ? (
                                        <Loader2 size={11} className="animate-spin" color="#FF7900" />
                                      ) : (page.extractedText && page.extractedText.trim().length > 0) ? (
                                        <CheckCircle2 size={12} color="#22c55e" />
                                      ) : (
                                        <AlertCircle size={12} color="#f59e0b" />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Active Page Inspector */}
                            {capturedPages[selectedPageIdx] && (
                              <div style={{ marginTop: 12, background: "#fdfbf7", border: "1px solid #e9e5df", borderRadius: 12, padding: 14 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                                      Page {selectedPageIdx + 1} of {capturedPages.length}
                                    </span>
                                    {uploadCover === (capturedPages[selectedPageIdx].dataUrl || capturedPages[selectedPageIdx].image) ? (
                                      <span style={{ background: "rgba(255,121,0,0.12)", color: "#FF7900", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>
                                        ⭐ Cover
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setUploadCover(capturedPages[selectedPageIdx].dataUrl || capturedPages[selectedPageIdx].image)}
                                        style={{ border: "none", background: "none", color: "#6b7280", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
                                      >
                                        Set as Cover
                                      </button>
                                    )}
                                  </div>

                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button
                                      type="button"
                                      onClick={() => handleReExtractPage(capturedPages[selectedPageIdx].id)}
                                      disabled={capturedPages[selectedPageIdx].isExtracting}
                                      style={{ display: "flex", alignItems: "center", gap: 4, background: "#fff", border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                                      title="Re-run OCR for this page"
                                    >
                                      <RotateCcw size={12} />
                                      Re-run OCR
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteUploadedPage(capturedPages[selectedPageIdx].id)}
                                      style={{ display: "flex", alignItems: "center", gap: 4, background: "#fee2e2", border: "none", color: "#b91c1c", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                                      title="Delete this page"
                                    >
                                      <Trash2 size={12} />
                                      Delete
                                    </button>
                                  </div>
                                </div>

                                <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                                  Extracted Text for Page {selectedPageIdx + 1} (Editable)
                                </label>
                                <textarea
                                  className="field-input"
                                  rows={4}
                                  value={capturedPages[selectedPageIdx].extractedText || ""}
                                  onChange={(e) => handleUpdatePageText(capturedPages[selectedPageIdx].id, e.target.value)}
                                  placeholder={capturedPages[selectedPageIdx].isExtracting ? "Extracting text via OCR..." : "No text detected yet. You can type or edit text here..."}
                                  style={{ resize: "vertical", fontSize: 13, lineHeight: 1.6 }}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Document / Plain Text file input */
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>Text Content File (.txt, .md, .json)</label>
                        <div className="file-input-wrap">
                          <div className={`file-input-display ${uploadText ? 'has-file' : ''}`}>
                            <FileText size={16} />
                            {uploadText ? uploadText.name : 'Choose a .txt, .md, or .json file...'}
                          </div>
                          <input type="file" accept=".txt,.md,.json" onChange={(e) => handleTextFileChange(e.target.files?.[0])} />
                        </div>
                        {extractedText && (
                          <div style={{ marginTop: 12 }}>
                            <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                              Document Text Preview (Editable)
                            </label>
                            <textarea
                              className="field-input"
                              rows={4}
                              value={extractedText}
                              onChange={(e) => setExtractedText(e.target.value)}
                              style={{ resize: "vertical", fontSize: 13 }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <BookScanner
                      bookTitle={uploadTitle}
                      autoSaveTimeLeft={autoSaveTimeLeft}
                      onPageCaptured={(pageItem) => {
                        setUploadCover(pageItem.dataUrl);
                        setCapturedPages((prev) => [...prev, pageItem]);
                        setAutoSaveTimeLeft(25); // Reset auto-save timer to 25s upon capture
                      }}
                      onCompleteScan={(pagesList) => {
                        setCapturedPages(pagesList);
                        if (pagesList.length > 0) {
                          setUploadCover(pagesList[0].dataUrl);
                        }
                        if ('speechSynthesis' in window && window.speechSynthesis) {
                          const countStr = `${pagesList.length} ${pagesList.length === 1 ? 'page' : 'pages'}`;
                          const utterance = new SpeechSynthesisUtterance(`${countStr} captured. Moving to review screen.`);
                          window.speechSynthesis.speak(utterance);
                        }
                        setWizardStep(3);
                      }}
                      onCancel={() => setWizardStep(1)}
                    />
                    {extractedText && (
                      <div style={{ marginTop: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>Extracted Text (editable)</label>
                        <textarea
                          className="field-input"
                          rows={4}
                          value={extractedText}
                          onChange={(e) => setExtractedText(e.target.value)}
                          style={{ resize: "vertical" }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {uploadMethod === "file" && (
                  <div className="wizard-nav-buttons" style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <button
                      onClick={() => setWizardStep(1)}
                      className="btn-primary"
                      style={{ flex: 1, padding: '14px', fontSize: 14, borderRadius: 14, background: 'rgba(221,214,200,0.3)', color: 'var(--text-secondary)' }}
                    >
                      ← Back
                    </button>
                    <button
                      onClick={() => {
                        if (!uploadTitle) { notify.warning("Please provide a title for the book."); return; }
                        if (uploadSubTab === "images" && capturedPages.length === 0) {
                          notify.warning("Please select at least one page image.");
                          return;
                        }
                        if (uploadSubTab === "doc" && !uploadText && !extractedText) {
                          notify.warning("Please select a text file.");
                          return;
                        }
                        setWizardStep(3);
                      }}
                      className="btn-primary"
                      style={{ flex: 2, padding: '14px', fontSize: 15, borderRadius: 14 }}
                    >
                      Review →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 3: Review & Save ── */}
            {wizardStep === 3 && (
              <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {uploadCover ? (
                      <div style={{ width: 56, height: 72, borderRadius: 10, overflow: 'hidden', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        {typeof uploadCover === 'string' ? (
                          <img src={uploadCover} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #d8cdb8, #c2b5a0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🖼️</div>
                        )}
                      </div>
                    ) : (
                      <div style={{ width: 56, height: 72, borderRadius: 10, background: 'linear-gradient(135deg, #d8cdb8, #c2b5a0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>📖</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{uploadTitle || "Untitled Book"}</h3>
                        <span style={{ background: '#ecfdf5', color: '#059669', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 8, border: '1px solid #a7f3d0' }}>
                          MySQL Connected
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <span style={{ background: '#f1f5f9', color: '#334155', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6 }}>
                          👤 Account: <strong>{uploadUser || activeUser || "Guest"}</strong>
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          📖 {capturedPages.length > 0 ? `${capturedPages.length} ${capturedPages.length === 1 ? 'Page' : 'Pages'}` : '1 Document'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Text preview & audio play button */}
                <div style={{ padding: 14, background: 'rgba(243,237,228,0.5)', borderRadius: 12, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                      Extracted Text Content
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const textToPlay = (capturedPages.length > 0 && capturedPages[selectedPageIdx]?.extractedText)
                          ? capturedPages[selectedPageIdx].extractedText
                          : (extractedText || uploadTitle);
                        if ('speechSynthesis' in window && window.speechSynthesis) {
                          window.speechSynthesis.cancel();
                          const utter = new SpeechSynthesisUtterance(textToPlay);
                          utter.lang = 'en-US';
                          utter.rate = 1.0;
                          window.speechSynthesis.speak(utter);
                        }
                      }}
                      style={{
                        background: '#eff6ff',
                        color: '#2563eb',
                        border: '1px solid #bfdbfe',
                        borderRadius: 8,
                        padding: '4px 10px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5
                      }}
                    >
                      🔊 Listen (Play Audio)
                    </button>
                  </div>

                  {capturedPages.length > 1 && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', paddingBottom: 4 }}>
                      {capturedPages.map((p, idx) => (
                        <button
                          key={p.id || idx}
                          type="button"
                          onClick={() => setSelectedPageIdx(idx)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: 'none',
                            background: selectedPageIdx === idx ? '#FF7900' : '#fff',
                            color: selectedPageIdx === idx ? '#fff' : '#4b5563',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Page {idx + 1}
                        </button>
                      ))}
                    </div>
                  )}

                  <div style={{ maxHeight: 140, overflowY: 'auto' }}>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap' }}>
                      {capturedPages.length > 0
                        ? (capturedPages[selectedPageIdx]?.extractedText || `[Page ${selectedPageIdx + 1}] Image captured and text ready.`)
                        : (extractedText || 'Page text extracted and ready to save to database.')}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button
                    onClick={() => setWizardStep(2)}
                    className="btn-primary"
                    style={{ flex: 1, padding: '14px', fontSize: 14, borderRadius: 14, background: 'rgba(221,214,200,0.3)', color: 'var(--text-secondary)' }}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleUploadSubmit}
                    className="btn-orange"
                    style={{ flex: 2, padding: '15px', fontSize: 15, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Save to MySQL Vault
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Success Animation ── */}
      {showSuccess && (
        <div className="success-overlay" onClick={() => setShowSuccess(false)}>
          <div className="success-card">
            <div className="success-checkmark">
              <IconCheck />
            </div>
            <div className="success-title">Book Added!</div>
            <div className="success-subtitle">Your book has been saved to the vault</div>
          </div>
        </div>
      )}

      {/* ── Active Book Reader Modal Overlay ── */}
      {activeInteractiveBook && (
        <InteractiveBook
          bookId={activeInteractiveBook.id || activeInteractiveBook.bookId}
          bookTitle={activeInteractiveBook.title}
          bookAuthor={activeInteractiveBook.author}
          coverImage={activeInteractiveBook.cover || activeInteractiveBook.coverImage || activeInteractiveBook.cover_image}
          pages={activeInteractiveBook.pages || []}
          activeUser={activeUser}
          onClose={() => setActiveInteractiveBook(null)}
        />
      )}

      {/* ── Doraemon AI Voice Assistant & Dev Console (Hidden on Auth Pages) ── */}
      {!(path === "/signin" || path === "/facelogin" || path === "/signup" || path === "/otp") && (
        <>
          <div
            style={{
              position: "fixed",
              bottom: "20px",
              right: "20px",
              zIndex: 99999,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "8px",
              pointerEvents: "none"
            }}
          >
            {/* Doraemon AI Response & Speech Bubble */}
            {(aiResponseText || voiceTranscript) && isVoiceListening && (
              <div
                style={{
                  background: "rgba(0, 0, 0, 0.9)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(34, 197, 94, 0.4)",
                  borderRadius: "16px 16px 4px 16px",
                  padding: "10px 14px",
                  maxWidth: "270px",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
                  color: "#ffffff",
                  fontSize: "12px",
                  lineHeight: "1.45",
                  pointerEvents: "auto",
                  fontFamily: "'Inter', sans-serif"
                }}
              >
                <div style={{ fontSize: "10px", color: "#4ade80", marginBottom: "3px", fontWeight: "700" }}>
                  🐱 Doraemon AI
                </div>
                <div>{aiResponseText || "Listening..."}</div>
                {voiceTranscript && (
                  <div style={{ fontSize: "10px", color: "rgba(255, 255, 255, 0.6)", marginTop: "4px", fontStyle: "italic", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "4px" }}>
                    Heard: "{voiceTranscript}"
                  </div>
                )}
              </div>
            )}

            {/* Clean Doraemon PNG Sprite Mascot Only */}
            <div
              onClick={() => {
                const nextState = !isVoiceListening;
                setIsVoiceListening(nextState);
                if (nextState) {
                  notify.success("Doraemon AI Assistant Active!");
                  if ('speechSynthesis' in window && window.speechSynthesis) {
                    window.speechSynthesis.cancel();
                    window.speechSynthesis.speak(new SpeechSynthesisUtterance("Doraemon active."));
                  }
                } else {
                  notify.info("Doraemon Sleeping.");
                }
              }}
              style={{
                width: "90px",
                height: "90px",
                cursor: "pointer",
                pointerEvents: "auto",
                transition: "transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                filter: isVoiceListening
                  ? "drop-shadow(0 0 12px rgba(74, 222, 128, 0.8))"
                  : "drop-shadow(0 4px 8px rgba(0, 0, 0, 0.5)) opacity(0.7)",
                userSelect: "none"
              }}
              title={isVoiceListening ? "Click to Pause Doraemon" : "Click to Wake Doraemon"}
            >
              <img
                src={isVoiceListening ? `/dora-sprites/emotion-calm-0${doraFrame}.png` : `/dora-sprites/action-nap-0${doraFrame}.png`}
                alt="Doraemon AI Mascot"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  imageRendering: "pixelated"
                }}
              />
            </div>
          </div>

          {/* Movable Developer AI Voice Debug Console UI Panel */}
          <div
            style={{
              position: "fixed",
              left: `${devConsolePos.x}px`,
              top: `${devConsolePos.y}px`,
              zIndex: 99999,
              fontFamily: "'Courier New', monospace",
              pointerEvents: "auto",
              touchAction: "none"
            }}
          >
            <div
              onMouseDown={handleStartDrag}
              onTouchStart={handleStartDrag}
              style={{
                background: "rgba(15, 23, 42, 0.95)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                borderRadius: showDevConsole ? "12px 12px 0 0" : "12px",
                padding: "8px 14px",
                color: "#38bdf8",
                fontSize: "11px",
                fontWeight: "bold",
                cursor: "grab",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.5)",
                userSelect: "none"
              }}
              title="Drag header to move developer console anywhere on screen"
            >
              <span style={{ cursor: "grab", opacity: 0.7 }}>⋮⋮</span>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#34d399", display: "inline-block" }} />
              <span>🛠️ Developer AI Logs ({chatHistory.length})</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDevConsole(!showDevConsole);
                }}
                style={{
                  marginLeft: "auto",
                  background: "none",
                  border: "none",
                  color: "#38bdf8",
                  cursor: "pointer",
                  fontSize: "10px",
                  fontWeight: "bold"
                }}
              >
                {showDevConsole ? "▼ Hide" : "▲ Show"}
              </button>
            </div>

            {showDevConsole && (
              <div
                style={{
                  width: "350px",
                  height: "240px",
                  background: "rgba(10, 15, 26, 0.96)",
                  backdropFilter: "blur(16px)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  borderTop: "none",
                  borderRadius: "0 0 12px 12px",
                  padding: "10px",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: "0 12px 36px rgba(0, 0, 0, 0.6)",
                  fontSize: "11px"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "6px", marginBottom: "8px" }}>
                  <span style={{ color: "#4ade80", fontSize: "10px", fontWeight: "bold" }}>
                    ● Engine: Ollama LLM (qwen3.5:0.8b)
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setChatHistory([]); }}
                    style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "10px", textDecoration: "underline" }}
                  >
                    Clear
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", paddingRight: "4px" }}>
                  {chatHistory.length === 0 ? (
                    <div style={{ color: "#64748b", fontStyle: "italic", textAlign: "center", padding: "10px" }}>
                      No voice logs yet. Speak to test Ollama AI.
                    </div>
                  ) : (
                    chatHistory.map((item, idx) => (
                      <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        {item.sender === "user" ? (
                          <div style={{ alignSelf: "flex-start", background: "rgba(59, 130, 246, 0.2)", borderLeft: "3px solid #3b82f6", padding: "5px 8px", borderRadius: "4px", maxWidth: "92%" }}>
                            <span style={{ color: "#60a5fa", fontWeight: "bold" }}>🎤 You: </span>
                            <span style={{ color: "#f8fafc" }}>"{item.text}"</span>
                            <span style={{ fontSize: "9px", color: "#64748b", marginLeft: "6px" }}>{item.time}</span>
                          </div>
                        ) : item.sender === "ai" ? (
                          <div style={{ alignSelf: "flex-end", background: "rgba(34, 197, 94, 0.15)", borderRight: "3px solid #22c55e", padding: "5px 8px", borderRadius: "4px", maxWidth: "92%", textAlign: "right" }}>
                            <div style={{ color: "#4ade80", fontWeight: "bold", fontSize: "10px" }}>
                              🤖 AI [{item.action}] <span style={{ fontSize: "8px", opacity: 0.8 }}>({item.source})</span>
                            </div>
                            <div style={{ color: "#f1f5f9", marginTop: "2px" }}>"{item.text}"</div>
                            <div style={{ fontSize: "8px", color: "#94a3b8", marginTop: "2px" }}>{item.time}</div>
                          </div>
                        ) : (
                          <div style={{ fontSize: "10px", color: "#38bdf8", fontStyle: "italic", textAlign: "center", padding: "2px" }}>
                            {item.text}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (devInputText && devInputText.trim()) {
                      handleDispatchCommand(devInputText.trim());
                      setDevInputText("");
                    }
                  }}
                  style={{ display: "flex", gap: "6px", marginTop: "8px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "6px" }}
                >
                  <input
                    type="text"
                    value={devInputText}
                    onChange={(e) => setDevInputText(e.target.value)}
                    placeholder='Test voice command (e.g. "type Alex")'
                    style={{ flex: 1, background: "rgba(15, 23, 42, 0.9)", border: "1px solid rgba(56, 189, 248, 0.4)", borderRadius: "4px", color: "#fff", padding: "4px 8px", fontSize: "10px" }}
                  />
                  <button
                    type="submit"
                    style={{ background: "#0284c7", color: "#fff", border: "none", borderRadius: "4px", padding: "4px 8px", fontSize: "10px", fontWeight: "bold", cursor: "pointer" }}
                  >
                    Send
                  </button>
                </form>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Global Professional Notifications & Modals ── */}
      <ToastNotification />
      <ConfirmModal />

      {/* Hidden cover update input */}
      <input type="file" id="cover-update-input" className="hidden" accept="image/*" onChange={handleUpdateCover} />
      <VoiceBookScanner onSave={(scannedBook) => {
        setBooks(prev => {
          const newBooks = [...prev, { ...scannedBook, date: new Date().toISOString() }];
          localStorage.setItem("bookVault_library", JSON.stringify(newBooks));
          notify.success(`"${scannedBook.title || 'Book'}" saved to your vault!`);
          return newBooks;
        });
      }} />
    </div>
  );
}