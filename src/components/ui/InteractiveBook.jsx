import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, RefreshCcw, Languages } from 'lucide-react';
import notify from '../../services/notificationService';

const speak = (text, { lang = "en-US" } = {}) => {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.onend = resolve;
    utter.onerror = resolve;
    window.speechSynthesis.speak(utter);
  });
};

const getPageText = (pageItem) => {
  if (!pageItem) return "";
  if (typeof pageItem === 'string') return pageItem;
  return pageItem.extractedText || pageItem.text || pageItem.content || "";
};

export default function InteractiveBook({ coverImage, bookTitle = 'Book Title', bookAuthor = 'Author', pages = [], onClose, onOpenReader }) {
  const [isOpen, setIsOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(-1);
  const [viewMode, setViewMode] = useState("original"); // "original" | "translated" | "summary" | "explanation"

  const [translatedText, setTranslatedText] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const [summaryText, setSummaryText] = useState(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const [explanationText, setExplanationText] = useState(null);
  const [isExplaining, setIsExplaining] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const utteranceRef = useRef(null);

  useEffect(() => {
    setIsOpen(true);
    setCurrentPage(-1);
    setTranslatedText(null);
    setSummaryText(null);
    setExplanationText(null);
    setViewMode("original");
    stopReading();
  }, [coverImage]);

  useEffect(() => {
    setTranslatedText(null);
    setSummaryText(null);
    setExplanationText(null);
    setViewMode("original");
    stopReading();
  }, [currentPage]);

  // Clean up speech synthesis on component unmount
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const open = () => setIsOpen(true);
  
  const close = () => {
    stopReading();
    setIsOpen(false);
    if (onClose) onClose();
  };

  const next = () => setCurrentPage((p) => Math.min(p + 1, pages.length - 1));
  const prev = () => setCurrentPage((p) => Math.max(p - 1, -1));
  const restart = () => setCurrentPage(-1);

  // --- TTS Controls ---
  const startReading = () => {
    if (!("speechSynthesis" in window)) return;
    
    let textToRead = getPageText(pages[currentPage]);
    if (viewMode === "translated" && translatedText) textToRead = translatedText;
    if (viewMode === "summary" && summaryText) textToRead = summaryText;
    if (viewMode === "explanation" && explanationText) textToRead = explanationText;

    if (!textToRead) return;

    window.speechSynthesis.cancel();
    
    const utter = new SpeechSynthesisUtterance(textToRead);
    if (viewMode === "translated" && textToRead.match(/[\u0B80-\u0BFF]/)) {
      utter.lang = "ta-IN";
    } else {
      utter.lang = "en-US";
    }
    
    utter.rate = playbackSpeed;
    
    utter.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };
    utter.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utteranceRef.current = utter;
    setIsPlaying(true);
    setIsPaused(false);
    window.speechSynthesis.speak(utter);
  };

  const pauseReading = () => {
    if (!("speechSynthesis" in window)) return;
    if (isPlaying && !isPaused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const resumeReading = () => {
    if (!("speechSynthesis" in window)) return;
    if (isPlaying && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else if (!isPlaying) {
      startReading();
    }
  };

  const stopReading = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  };

  const changeSpeed = (speed) => {
    setPlaybackSpeed(speed);
    if (isPlaying && !isPaused) {
      setTimeout(() => startReading(), 100);
    }
  };

  // --- AI Operations ---
  const translatePage = async () => {
    if (currentPage === -1 || !pages[currentPage]) return;
    if (translatedText) {
      setViewMode("translated");
      return;
    }
    setIsTranslating(true);
    setViewMode("translated");
    
    const textToTranslate = getPageText(pages[currentPage]);
    const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    const model = import.meta.env.VITE_OPENROUTER_MODEL || "google/gemini-flash-1.5";

    if (!apiKey) {
      notify.warning("OpenRouter API key is missing. Cannot translate.");
      setIsTranslating(false);
      setViewMode("original");
      return;
    }

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { 
              role: "system", 
              content: "You are a professional translator for Book Vault. Translate the user's text into Tamil if it is in English, or English if it is in Tamil. Preserve the original formatting and line breaks. Return ONLY the translated text, with no extra conversational filler or markdown notes." 
            },
            { role: "user", content: textToTranslate }
          ],
          temperature: 0.3
        })
      });

      if (!response.ok) throw new Error("Translation request failed");
      const data = await response.json();
      const result = data.choices?.[0]?.message?.content?.trim() || "Translation failed.";
      setTranslatedText(result);
      notify.success("Page translated successfully!");
    } catch (error) {
      console.error(error);
      notify.error("Translation error: " + error.message);
      setViewMode("original");
    } finally {
      setIsTranslating(false);
    }
  };

  const summarizePage = async () => {
    if (currentPage === -1 || !pages[currentPage]) return;
    if (summaryText) {
      setViewMode("summary");
      return;
    }
    setIsSummarizing(true);
    setViewMode("summary");

    const textToSummarize = getPageText(pages[currentPage]);
    const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    const model = import.meta.env.VITE_OPENROUTER_MODEL || "google/gemini-flash-1.5";

    if (!apiKey) {
      notify.warning("OpenRouter API key is missing.");
      setIsSummarizing(false);
      setViewMode("original");
      return;
    }

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { 
              role: "system", 
              content: "You are a reading assistant for Book Vault. Summarize the user's book page in 3 clear, easy-to-understand bullet points. Keep it brief. Do not write conversational filler or markdown notes." 
            },
            { role: "user", content: textToSummarize }
          ],
          temperature: 0.3
        })
      });

      if (!response.ok) throw new Error("Summarization request failed");
      const data = await response.json();
      const result = data.choices?.[0]?.message?.content?.trim() || "Summarization failed.";
      setSummaryText(result);
      notify.success("Page summarized!");
    } catch (error) {
      console.error(error);
      notify.error("Summarization error: " + error.message);
      setViewMode("original");
    } finally {
      setIsSummarizing(false);
    }
  };

  const explainPage = async () => {
    if (currentPage === -1 || !pages[currentPage]) return;
    if (explanationText) {
      setViewMode("explanation");
      return;
    }
    setIsExplaining(true);
    setViewMode("explanation");

    const textToExplain = getPageText(pages[currentPage]);
    const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    const model = import.meta.env.VITE_OPENROUTER_MODEL || "google/gemini-flash-1.5";

    if (!apiKey) {
      notify.warning("OpenRouter API key is missing.");
      setIsExplaining(false);
      setViewMode("original");
      return;
    }

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { 
              role: "system", 
              content: "You are a reading assistant for Book Vault. Explain the main concepts, difficult terms, or context of the user's book page in a simple, friendly paragraph. Keep it concise. Do not write conversational filler or markdown notes." 
            },
            { role: "user", content: textToExplain }
          ],
          temperature: 0.3
        })
      });

      if (!response.ok) throw new Error("Explanation request failed");
      const data = await response.json();
      const result = data.choices?.[0]?.message?.content?.trim() || "Explanation failed.";
      setExplanationText(result);
      notify.success("Explanation generated!");
    } catch (error) {
      console.error(error);
      notify.error("Explanation error: " + error.message);
      setViewMode("original");
    } finally {
      setIsExplaining(false);
    }
  };

  return (
    <div className="interactive-book-modal" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={close} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />

      <div style={{ width: 720, maxWidth: '95%', perspective: 1200 }}>
        <div style={{ position: 'relative' }}>
          <button onClick={close} style={{ position: 'absolute', right: -12, top: -12, zIndex: 30, borderRadius: '50%', width: 36, height: 36, border: 'none', background: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.12)', cursor: 'pointer' }} aria-label="Close">
            <X size={18} />
          </button>

          <div style={{ width: '100%', height: 480, position: 'relative', transformStyle: 'preserve-3d' }}>
            {/* Cover */}
            <div
              onClick={() => { if (currentPage === -1) setCurrentPage(0); }}
              style={{
                position: 'absolute', inset: 0, transformStyle: 'preserve-3d',
                transition: 'transform 0.9s ease',
                transform: isOpen ? `translateZ(0px) rotateY(${currentPage >= 0 ? -180 : -10}deg)` : 'none',
                cursor: 'pointer'
              }}
            >
              <div style={{ position: 'absolute', inset: 0, borderRadius: 14, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.35)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundImage: `url(${coverImage})` }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.6), rgba(0,0,0,0.1))' }} />
            </div>

            {/* Pages stack (show current page front) */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ width: '76%', height: '86%', background: '#fdfbf7', borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,0.12)', border: '1px solid #e9e5df', overflow: 'hidden', pointerEvents: 'auto' }}>
                <div style={{ padding: 28, height: '100%', overflow: 'hidden' }}>
                  {currentPage === -1 ? (
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#8a7a68', fontFamily: 'Playfair Display, serif', fontSize: 28 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 22, marginBottom: 8, fontWeight: '600' }}>{bookTitle}</div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>{bookAuthor}</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: '#3b3b3b', fontFamily: 'Georgia, serif', display: 'flex', flexDirection: 'column', height: '100%' }}>
                      {/* Tabs */}
                      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #e9e5df', paddingBottom: 8, marginBottom: 12, overflowX: 'auto' }}>
                        <button
                          onClick={() => setViewMode("original")}
                          style={{
                            padding: '4px 10px',
                            fontSize: 12,
                            borderRadius: 6,
                            border: 'none',
                            background: viewMode === "original" ? '#FF7900' : 'transparent',
                            color: viewMode === "original" ? '#fff' : '#6b7280',
                            cursor: 'pointer',
                            fontWeight: '600',
                            transition: 'all 0.2s'
                          }}
                        >
                          Original
                        </button>
                        <button
                          onClick={translatePage}
                          style={{
                            padding: '4px 10px',
                            fontSize: 12,
                            borderRadius: 6,
                            border: 'none',
                            background: viewMode === "translated" ? '#FF7900' : 'transparent',
                            color: viewMode === "translated" ? '#fff' : '#6b7280',
                            cursor: 'pointer',
                            fontWeight: '600',
                            transition: 'all 0.2s'
                          }}
                        >
                          Translation
                        </button>
                        <button
                          onClick={summarizePage}
                          style={{
                            padding: '4px 10px',
                            fontSize: 12,
                            borderRadius: 6,
                            border: 'none',
                            background: viewMode === "summary" ? '#FF7900' : 'transparent',
                            color: viewMode === "summary" ? '#fff' : '#6b7280',
                            cursor: 'pointer',
                            fontWeight: '600',
                            transition: 'all 0.2s'
                          }}
                        >
                          Summary
                        </button>
                        <button
                          onClick={explainPage}
                          style={{
                            padding: '4px 10px',
                            fontSize: 12,
                            borderRadius: 6,
                            border: 'none',
                            background: viewMode === "explanation" ? '#FF7900' : 'transparent',
                            color: viewMode === "explanation" ? '#fff' : '#6b7280',
                            cursor: 'pointer',
                            fontWeight: '600',
                            transition: 'all 0.2s'
                          }}
                        >
                          Explanation
                        </button>
                      </div>

                      {/* Display Text Content */}
                      <div style={{ flex: 1, overflowY: 'auto', lineHeight: 1.7, fontSize: '15px', whiteSpace: 'pre-wrap', color: '#2c2c2c', paddingRight: 4 }}>
                        {viewMode === "original" && (getPageText(pages[currentPage]) || "No text on this page.")}
                        {viewMode === "translated" && (isTranslating ? "Translating... please wait..." : (translatedText || "No translation loaded yet."))}
                        {viewMode === "summary" && (isSummarizing ? "Generating summary... please wait..." : (summaryText || "No summary generated yet."))}
                        {viewMode === "explanation" && (isExplaining ? "Analyzing context... please wait..." : (explanationText || "No explanation generated yet."))}
                      </div>

                      {/* Page footer */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9c9081', fontSize: '11px', marginTop: 12, borderTop: '1px solid #e9e5df', paddingTop: 6 }}>
                        <span>Book Reader</span>
                        <span>Page {currentPage * 2 + 1}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18, alignItems: 'center' }}>
            {/* Audio Reading Panel */}
            {currentPage !== -1 && (
              <div style={{ display: 'flex', gap: 8, background: '#fff', padding: '6px 12px', borderRadius: 12, boxShadow: '0 4px 14px rgba(0,0,0,0.06)', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#8a7a68', fontWeight: '600', marginRight: 4 }}>Voice Assistant:</span>
                
                {isPlaying && !isPaused ? (
                  <button 
                    onClick={pauseReading}
                    style={{ background: 'rgba(255,121,0,0.1)', color: '#FF7900', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: '600', cursor: 'pointer' }}
                  >
                    ⏸️ Pause
                  </button>
                ) : (
                  <button 
                    onClick={resumeReading}
                    style={{ background: '#FF7900', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: '600', cursor: 'pointer' }}
                  >
                    ▶️ Read Aloud
                  </button>
                )}

                {isPlaying && (
                  <button 
                    onClick={stopReading}
                    style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: '600', cursor: 'pointer' }}
                  >
                    ⏹️ Stop
                  </button>
                )}

                {/* Speed drop-down */}
                <select
                  value={playbackSpeed}
                  onChange={(e) => changeSpeed(parseFloat(e.target.value))}
                  style={{ border: '1px solid #e9e5df', borderRadius: 6, padding: '3px 6px', fontSize: 11, color: '#4b5563', background: '#fff', outline: 'none' }}
                >
                  <option value="0.8">0.8x Speed</option>
                  <option value="1">1.0x Speed</option>
                  <option value="1.25">1.25x Speed</option>
                  <option value="1.5">1.5x Speed</option>
                </select>
              </div>
            )}

            {/* Page navigation */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button onClick={prev} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} aria-label="Previous Page">
                <ChevronLeft size={16} />
              </button>
              <button onClick={restart} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} aria-label="Restart Book">
                <RefreshCcw size={14} />
              </button>
              <button onClick={next} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} aria-label="Next Page">
                <ChevronRight size={16} />
              </button>
            </div>

            {onOpenReader && (
              <button
                onClick={() => { close(); onOpenReader(); }}
                style={{
                  marginTop: 6,
                  padding: '6px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,121,0,0.3)',
                  background: 'rgba(255,121,0,0.08)',
                  color: '#FF7900',
                  fontSize: 12,
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                📖 Open Full Reader & Highlights
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
