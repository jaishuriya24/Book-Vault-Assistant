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
import VoiceBookScanner from "../components/BookScanner";
import InteractiveBook from "../components/ui/InteractiveBook";
import Ferrofluid from "../components/ui/Ferrofluid";
import Shuffle from "../components/ui/Shuffle";
import ToastNotification from "../components/ui/ToastNotification";
import ConfirmModal from "../components/ui/ConfirmModal";
import notify from "../services/notificationService";
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
  const [autoSaveTimeLeft, setAutoSaveTimeLeft] = useState(25);
  const handleUploadSubmitRef = useRef(null);
  const lastPageCountRef = useRef(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [activeUser, setActiveUser] = useState(() => localStorage.getItem("username") || "Guest");
  const STORAGE_KEY = `uploadedBooks_${activeUser}`;

  useEffect(() => {
    const refresh = () => setActiveUser(localStorage.getItem("username") || "Guest");
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("bookvault:username-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("bookvault:username-updated", refresh);
    };
  }, [location.pathname]);

  // Re-read books when route changes to keep it fresh
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

  useEffect(() => {
    try {
      const cleanCoverUrl = (img) => (img && typeof img === 'string' && !img.startsWith('http://') && !img.startsWith('https://')) ? img : '';

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      const cleanedStored = stored.map((b) => ({ ...b, cover: cleanCoverUrl(b.cover) }));
      setBooks(cleanedStored);

      // Connect React to Java Spring Boot & MySQL Database API
      const springApiUrl = import.meta.env.VITE_SPRING_BOOT_API_URL || import.meta.env.VITE_SERVER_URL || "http://localhost:8082";
      fetch(`${springApiUrl}/api/books`)
        .then((res) => res.json())
        .then((data) => {
          const list = Array.isArray(data) ? data : (data && data.books) || [];
          if (list && list.length > 0) {
            const apiBooks = list.map((b) => ({
              id: String(b.id || b._id || b.timestamp || Date.now()),
              title: b.title || "Scanned Book",
              author: b.author || "Unknown",
              cover: cleanCoverUrl(b.coverImage || b.cover || b.image_base64 || ""),
              content: b.content || b.extracted_text || b.text || b.fullText || "No text extracted",
              pages: [],
              pageCount: b.pageCount || b.page_count || 1,
            }));
            setBooks(apiBooks);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(apiBooks));
            } catch (_) {}
          }
        })
        .catch((err) => console.log("Backend DB offline or starting...", err));
    } catch (e) {
      setBooks([]);
    }
  }, [path, STORAGE_KEY]);


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
      if (!opts.isAutoSave) alert("Please provide a text file or cover image.");
      return;
    }
    if ((effectiveMethod === "camera" || effectivePages.length > 0) && !effectiveCover && effectivePages.length === 0) {
      if (!opts.isAutoSave) alert("Please capture a book page first.");
      return;
    }

    let combinedContent = "";
    if (effectivePages.length > 0) {
      combinedContent = effectivePages
        .map((p, idx) => `[Page ${idx + 1}]\n${p.extractedText || ""}`)
        .join("\n\n");
    } else {
      combinedContent = extractedText || "Scanned Book Page Image";
    }

    const newBook = {
      id: Date.now().toString(),
      title: finalTitle,
      cover: effectiveCover,
      content: combinedContent,
      pages: effectivePages,
      pageCount: effectivePages.length || 1,
    };

    const finalizeUpload = () => {
      console.log("finalizeUpload saving book:", newBook.title);
      const currentList = booksRef.current || books || [];
      const updated = [...currentList, newBook];
      
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn("LocalStorage full, saved to memory & MySQL:", e);
      }
      
      setBooks(updated);

      // Save to Java Spring Boot Database (MySQL)
      const springApiUrl = import.meta.env.VITE_SPRING_BOOT_API_URL || import.meta.env.VITE_SERVER_URL || "http://localhost:8082";
      console.log("POSTing to Spring Boot MySQL backend:", `${springApiUrl}/api/books`);
      fetch(`${springApiUrl}/api/books`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newBook.title,
          coverImage: typeof newBook.cover === "string" ? newBook.cover : "",
          content: newBook.content || "",
        }),
      })
        .then((res) => console.log("MySQL book save response status:", res.status))
        .catch((err) => console.error("MySQL book save error:", err));

      setShowUploadModal(false);
      setUploadTitle("");
      setUploadCover(null);
      setUploadText(null);
      setExtractedText("");
      setCapturedPages([]);
      setUploadMethod("file");
      setWizardStep(1);
      setAutoSaveTimeLeft(25);
      localStorage.removeItem("scanned_book_pages");

      if ('speechSynthesis' in window && window.speechSynthesis) {
        const msg = opts.isAutoSave
          ? `25 seconds of inactivity reached. ${finalTitle} automatically saved to vault.`
          : `${finalTitle} saved to vault.`;
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

  const handleRenameBook = (id, currentTitle, e) => {
    e.stopPropagation();
    setActiveDropdown(null);
    const newTitle = window.prompt("Enter new book title:", currentTitle);
    if (newTitle && newTitle.trim()) {
      const updated = books.map(b => b.id === id ? { ...b, title: newTitle.trim() } : b);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch (_) {}
      setBooks(updated);

      // Sync Rename to MySQL Database
      const springApiUrl = import.meta.env.VITE_SPRING_BOOT_API_URL || import.meta.env.VITE_SERVER_URL || "http://localhost:8082";
      fetch(`${springApiUrl}/api/books/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      }).catch(err => console.error("MySQL rename sync error:", err));
    }
  };

  const handleUpdateCover = (e) => {
    const file = e.target.files?.[0];
    if (file && editingCoverId) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const coverData = ev.target.result;
        const updated = books.map(b => b.id === editingCoverId ? { ...b, cover: coverData } : b);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch (_) {}
        setBooks(updated);

        // Sync Cover to MySQL Database
        const springApiUrl = import.meta.env.VITE_SPRING_BOOT_API_URL || import.meta.env.VITE_SERVER_URL || "http://localhost:8082";
        fetch(`${springApiUrl}/api/books/${editingCoverId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coverImage: coverData }),
        }).catch(err => console.error("MySQL cover sync error:", err));

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
      message: "Are you sure you want to remove this book from your vault? This cannot be undone.",
      confirmText: "Delete Book",
      cancelText: "Keep Book",
      type: "danger",
      icon: "🗑️",
    });

    if (shouldDelete) {
      const updated = books.filter(b => b.id !== id);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch (_) {}
      setBooks(updated);

      // Sync Delete to MySQL Database
      const springApiUrl = import.meta.env.VITE_SPRING_BOOT_API_URL || import.meta.env.VITE_SERVER_URL || "http://localhost:8082";
      fetch(`${springApiUrl}/api/books/${id}`, {
        method: "DELETE",
      }).catch(err => console.error("MySQL delete sync error:", err));

      notify.success("Book removed from vault.");
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
    if (path === "/admin" || path === "/admin-dashboard" || path === "/users") return <AdminDashboard />;
    if (path === "/search") return <div className="p-10">🔍 Search Screen</div>;
    if (path === "/settings") return <div className="p-10">⚙️ Settings Screen</div>;

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

          {pausedBooks.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
              {pausedBooks.map(b => (
                <div
                  key={b.id}
                  onClick={() => navigate(`/reader/${b.id}`)}
                  className="card card-interactive"
                  style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}
                >
                  {b.cover ? (
                    <img src={b.cover} alt="cover" style={{ width: 56, height: 72, objectFit: 'cover', borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
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
          )}
        </div>
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

        {/* Book image popup modal */}
        {activeInteractiveBook && (
          <div
            onClick={() => setActiveInteractiveBook(null)}
            style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0,0,0,0.75)", zIndex: 9999,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#fff", borderRadius: 18,
                boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
                maxWidth: 520, width: "100%",
                overflow: "hidden", position: "relative",
              }}
            >
              {/* Close button */}
              <button
                onClick={() => setActiveInteractiveBook(null)}
                style={{
                  position: "absolute", top: 12, right: 12, zIndex: 10,
                  background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%",
                  width: 36, height: 36, cursor: "pointer", color: "#fff",
                  fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >✕</button>

              {/* Book image */}
              {activeInteractiveBook.cover ? (
                <img
                  src={activeInteractiveBook.cover}
                  alt={activeInteractiveBook.title}
                  style={{ width: "100%", display: "block", maxHeight: 480, objectFit: "contain", background: "#f8f8f8" }}
                />
              ) : (
                <div style={{
                  width: "100%", height: 320, background: "linear-gradient(135deg,#f0e9df,#e8ddd0)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64,
                }}>📖</div>
              )}

              {/* Title */}
              <div style={{ padding: "16px 20px" }}>
                <h2 style={{
                  margin: 0, fontFamily: "Playfair Display, serif",
                  fontSize: 20, fontWeight: 700, color: "#1e293b",
                }}>
                  {activeInteractiveBook.title}
                </h2>
                {activeInteractiveBook.pageCount > 0 && (
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>
                    {activeInteractiveBook.pageCount} page{activeInteractiveBook.pageCount !== 1 ? "s" : ""} scanned
                  </p>
                )}
              </div>
            </div>
          </div>
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
                    placeholder="Enter a title…"
                  />
                </div>

                {uploadMethod === "file" ? (
                  <>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>Cover Image <span style={{ fontWeight: 400, textTransform: "none", opacity: 0.7 }}>(optional)</span></label>
                      <div className="file-input-wrap">
                        <div className={`file-input-display ${uploadCover ? 'has-file' : ''}`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                          {uploadCover ? uploadCover.name || 'Image selected' : 'Choose an image...'}
                        </div>
                        <input type="file" accept="image/*" onChange={(e) => setUploadCover(e.target.files?.[0] || null)} />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>Text Content File</label>
                      <div className="file-input-wrap">
                        <div className={`file-input-display ${uploadText ? 'has-file' : ''}`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                          {uploadText ? uploadText.name : 'Choose a .txt, .md, or .json file...'}
                        </div>
                        <input type="file" accept=".txt,.md,.json" onChange={(e) => setUploadText(e.target.files?.[0] || null)} />
                      </div>
                    </div>
                  </>
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
                        if (!uploadText) { notify.warning("Please select or drop a text file."); return; }
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
                    <div>
                      <h3 style={{ margin: 0, fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{uploadTitle}</h3>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                        {uploadMethod === "file" ? (
                          <>📁 File upload · {uploadText?.name || 'text file'}</>
                        ) : (
                          <>📸 Camera scan · Book page captured</>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Text preview only for file upload method */}
                {uploadMethod === "file" && (extractedText || uploadText) && (
                  <div style={{ padding: 14, background: 'rgba(243,237,228,0.5)', borderRadius: 10, border: '1px solid var(--border)', maxHeight: 120, overflowY: 'auto' }}>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: 'Georgia, serif' }}>
                      {extractedText ? extractedText.substring(0, 300) + (extractedText.length > 300 ? '...' : '') : 'File content will be loaded on save'}
                    </p>
                  </div>
                )}

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
                    Save to Vault
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