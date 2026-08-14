import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, RefreshCcw, Sparkles, Volume2, Eye, FileText, Loader2 } from 'lucide-react';
import notify from '../../services/notificationService';
import { extractText } from '../../services/ocrService';
import mysqlService from '../../services/mysqlService';

const getPageText = (pageItem) => {
  if (!pageItem) return "";
  if (typeof pageItem === 'string') return pageItem;
  return pageItem.extractedText || pageItem.text || pageItem.content || "";
};

const getPageImage = (pageItem, defaultCover) => {
  if (!pageItem) return defaultCover || "";
  if (typeof pageItem === 'object') {
    return pageItem.image || pageItem.dataUrl || defaultCover || "";
  }
  return defaultCover || "";
};

export default function InteractiveBook({ coverImage, bookTitle = 'Book Title', bookAuthor = 'Author', pages = [], onClose, onOpenReader, bookId, activeUser = 'Guest' }) {
  const [isOpen, setIsOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(-1);
  const [viewMode, setViewMode] = useState("original"); // "original" | "translated" | "summary" | "explanation" | "scan"
  const [localPages, setLocalPages] = useState(pages);
  const [highlightRange, setHighlightRange] = useState({ start: 0, end: 0 });

  const [translatedText, setTranslatedText] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const [summaryText, setSummaryText] = useState(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const [explanationText, setExplanationText] = useState(null);
  const [isExplaining, setIsExplaining] = useState(false);

  const [isExtractingOcr, setIsExtractingOcr] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const utteranceRef = useRef(null);

  useEffect(() => {
    setLocalPages(pages);
  }, [pages]);

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

  const effectivePageList = localPages && localPages.length > 0 ? localPages : (coverImage ? [{ image: coverImage, extractedText: "" }] : []);
  const maxPages = effectivePageList.length;

  const saveReadingProgress = (pageIdx, charIdx) => {
    const effectiveId = bookId || bookTitle;
    const key = `readingPos_${activeUser || 'Guest'}_${effectiveId}`;
    const data = {
      page: pageIdx,
      charIndex: charIdx,
      title: bookTitle,
      timestamp: Date.now()
    };
    try {
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem(`readingPos_${activeUser || 'Guest'}_${effectiveId}_raw`, String(charIdx));
    } catch (e) {}

    if (bookId && mysqlService) {
      try {
        if (typeof mysqlService.updatePosition === 'function') {
          mysqlService.updatePosition(bookId, { last_position_char: charIdx, page_number: pageIdx + 1 }).catch(() => {});
        } else if (typeof mysqlService.updateBook === 'function') {
          mysqlService.updateBook(bookId, { last_position_char: charIdx, page_number: pageIdx + 1 }).catch(() => {});
        }
      } catch (e) {}
    }
  };

  // Restore saved reading position on mount / load
  useEffect(() => {
    const effectiveId = bookId || bookTitle;
    const key = `readingPos_${activeUser || 'Guest'}_${effectiveId}`;
    const savedPos = localStorage.getItem(key);
    if (savedPos) {
      try {
        const parsed = JSON.parse(savedPos);
        if (parsed.page !== undefined && parsed.page >= 0 && parsed.page < maxPages) {
          setCurrentPage(parsed.page);
          if (parsed.charIndex !== undefined) {
            setHighlightRange({ start: parsed.charIndex, end: parsed.charIndex + 25 });
          }
        }
      } catch (e) {}
    }
  }, [bookId, bookTitle, activeUser, maxPages]);

  // Listen for AI voice commands dispatched from global controller
  useEffect(() => {
    const handleReaderCommand = (e) => {
      const { action } = e.detail || {};
      if (!action) return;

      if (action === 'NEXT_PAGE') {
        next();
      } else if (action === 'PREVIOUS_PAGE') {
        prev();
      } else if (action === 'READ_PAGE') {
        if (isPaused) {
          resumeReading();
        } else {
          startReading();
        }
      } else if (action === 'PAUSE_READING') {
        pauseReading();
        stopReading();
      } else if (action === 'BOOKMARK_PAGE') {
        saveReadingProgress(currentPage, highlightRange.start);
        notify.success('Page bookmarked via voice!');
      }
    };

    window.addEventListener('bookvault:reader-command', handleReaderCommand);
    return () => window.removeEventListener('bookvault:reader-command', handleReaderCommand);
  }, [currentPage, isPlaying, isPaused, highlightRange, maxPages]);

  const close = () => {
    if (isPlaying || isPaused || highlightRange.start > 0) {
      saveReadingProgress(currentPage, highlightRange.start);
      notify.success("Reading position saved!");
    }
    stopReading();
    setIsOpen(false);
    if (onClose) onClose();
  };

  const next = () => {
    stopReading();
    setHighlightRange({ start: 0, end: 0 });
    setCurrentPage((p) => Math.min(p + 1, maxPages - 1));
  };
  const prev = () => {
    stopReading();
    setHighlightRange({ start: 0, end: 0 });
    setCurrentPage((p) => Math.max(p - 1, -1));
  };
  const restart = () => {
    stopReading();
    setHighlightRange({ start: 0, end: 0 });
    setCurrentPage(-1);
  };

  // --- TTS Controls ---
  const startReading = () => {
    if (!("speechSynthesis" in window)) return;
    
    let fullText = getPageText(effectivePageList[currentPage]);
    if (viewMode === "translated" && translatedText) fullText = translatedText;
    if (viewMode === "summary" && summaryText) fullText = summaryText;
    if (viewMode === "explanation" && explanationText) fullText = explanationText;

    if (!fullText || fullText.trim().length === 0) {
      notify.info("No text to read on this page.");
      return;
    }

    const startOffset = Math.max(0, highlightRange.start || 0);
    // Slice text from the saved offset if resuming from middle of page
    let textToRead = (startOffset > 0 && startOffset < fullText.length)
      ? fullText.substring(startOffset)
      : fullText;

    window.speechSynthesis.cancel();
    
    const utter = new SpeechSynthesisUtterance(textToRead);
    if (viewMode === "translated" && textToRead.match(/[\u0B80-\u0BFF]/)) {
      utter.lang = "ta-IN";
    } else {
      utter.lang = "en-US";
    }
    
    utter.rate = playbackSpeed;

    utter.onboundary = (event) => {
      if (event.charIndex !== undefined) {
        const relativeIdx = event.charIndex;
        const absoluteIdx = (startOffset > 0 && startOffset < fullText.length ? startOffset : 0) + relativeIdx;
        const charLen = event.charLength || 10;
        setHighlightRange({ start: absoluteIdx, end: absoluteIdx + charLen });
        saveReadingProgress(currentPage, absoluteIdx);
        setTimeout(() => {
          const el = document.getElementById("active-reading-line");
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
      }
    };
    
    utter.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setHighlightRange({ start: 0, end: 0 });
      saveReadingProgress(currentPage, fullText.length);
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
      saveReadingProgress(currentPage, highlightRange.start);
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
    if (isPlaying || isPaused) {
      saveReadingProgress(currentPage, highlightRange.start);
    }
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

  const renderHighlightedText = (text) => {
    if (!text) return "";
    const start = Math.max(0, highlightRange.start || 0);
    const end = Math.min(text.length, Math.max(start + 1, highlightRange.end || (start + 12)));

    if (!isPlaying && !isPaused && (start === 0 && end === 0)) {
      return text;
    }

    const before = text.substring(0, start);
    const highlighted = text.substring(start, end);
    const after = text.substring(end);

    return (
      <span>
        {before}
        <mark
          id="active-reading-line"
          style={{
            background: '#FF7900',
            color: '#ffffff',
            padding: '1px 5px',
            borderRadius: '4px',
            fontWeight: '600',
            boxShadow: '0 2px 6px rgba(255, 121, 0, 0.35)',
            display: 'inline'
          }}
        >
          {highlighted}
        </mark>
        {after}
      </span>
    );
  };

  // --- On-Demand OCR for this Page ---
  const handleExtractOcrNow = async () => {
    if (currentPage === -1 || !effectivePageList[currentPage]) return;
    const pageObj = effectivePageList[currentPage];
    const imageToScan = getPageImage(pageObj, coverImage);

    if (!imageToScan) {
      notify.warning("No image found for this page to extract text.");
      return;
    }

    setIsExtractingOcr(true);
    notify.info("Extracting text via OCR...");

    try {
      const text = await extractText(imageToScan);
      if (text && text.trim().length > 0) {
        const updated = [...effectivePageList];
        if (typeof updated[currentPage] === 'object') {
          updated[currentPage] = { ...updated[currentPage], extractedText: text };
        } else {
          updated[currentPage] = { image: imageToScan, extractedText: text };
        }
        setLocalPages(updated);
        notify.success("Text extracted successfully!");
      } else {
        notify.warning("Could not detect any clear text in this image.");
      }
    } catch (err) {
      console.error("Reader OCR error:", err);
      notify.error("OCR extraction failed: " + err.message);
    } finally {
      setIsExtractingOcr(false);
    }
  };

  // --- AI Operations ---
  const translatePage = async () => {
    if (currentPage === -1 || !effectivePageList[currentPage]) return;
    if (translatedText) {
      setViewMode("translated");
      return;
    }
    const textToTranslate = getPageText(effectivePageList[currentPage]);
    if (!textToTranslate) {
      notify.warning("No text on this page to translate.");
      return;
    }

    setIsTranslating(true);
    setViewMode("translated");
    
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
    if (currentPage === -1 || !effectivePageList[currentPage]) return;
    if (summaryText) {
      setViewMode("summary");
      return;
    }
    const textToSummarize = getPageText(effectivePageList[currentPage]);
    if (!textToSummarize) {
      notify.warning("No text on this page to summarize.");
      return;
    }

    setIsSummarizing(true);
    setViewMode("summary");

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
    if (currentPage === -1 || !effectivePageList[currentPage]) return;
    if (explanationText) {
      setViewMode("explanation");
      return;
    }
    const textToExplain = getPageText(effectivePageList[currentPage]);
    if (!textToExplain) {
      notify.warning("No text on this page to explain.");
      return;
    }

    setIsExplaining(true);
    setViewMode("explanation");

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

  // Auto-extract text on demand if page has an image but empty text
  useEffect(() => {
    if (currentPage >= 0 && effectivePageList[currentPage]) {
      const pageObj = effectivePageList[currentPage];
      const pageText = getPageText(pageObj);
      const pageImg = getPageImage(pageObj, coverImage);

      if ((!pageText || pageText.trim().length === 0) && pageImg && !isExtractingOcr) {
        setIsExtractingOcr(true);
        extractText(pageImg)
          .then((text) => {
            if (text && text.trim().length > 0) {
              setLocalPages((prev) => {
                const list = prev && prev.length > 0 ? [...prev] : [{ image: pageImg, extractedText: "" }];
                const updated = [...list];
                if (typeof updated[currentPage] === 'object') {
                  updated[currentPage] = { ...updated[currentPage], extractedText: text.trim() };
                } else {
                  updated[currentPage] = { image: pageImg, extractedText: text.trim() };
                }
                return updated;
              });
            }
          })
          .catch((err) => console.warn("InteractiveBook auto-OCR error:", err))
          .finally(() => setIsExtractingOcr(false));
      }
    }
  }, [currentPage, coverImage]);

  const activePageItem = currentPage >= 0 ? effectivePageList[currentPage] : null;
  const activePageText = activePageItem ? getPageText(activePageItem) : "";
  const activePageImage = activePageItem ? getPageImage(activePageItem, coverImage) : coverImage;

  return (
    <div className="interactive-book-modal" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={close} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }} />

      <div style={{ width: 780, maxWidth: '95%', perspective: 1200 }}>
        <div style={{ position: 'relative' }}>
          <button onClick={close} style={{ position: 'absolute', right: -12, top: -12, zIndex: 40, borderRadius: '50%', width: 38, height: 38, border: 'none', background: '#fff', boxShadow: '0 6px 20px rgba(0,0,0,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }} aria-label="Close">
            <X size={18} />
          </button>

          <div style={{ width: '100%', height: 520, position: 'relative' }}>
            {/* Cover (Only visible when book is closed currentPage === -1) */}
            <div
              onClick={() => { if (currentPage === -1) setCurrentPage(0); }}
              style={{
                position: 'absolute',
                inset: 0,
                transition: 'opacity 0.4s ease, transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: currentPage >= 0 ? 'scale(0.96) translateY(-10px)' : 'none',
                opacity: currentPage >= 0 ? 0 : 1,
                pointerEvents: currentPage >= 0 ? 'none' : 'auto',
                visibility: currentPage >= 0 ? 'hidden' : 'visible',
                zIndex: currentPage >= 0 ? 0 : 20,
                cursor: 'pointer',
              }}
            >
              <div style={{ position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.45)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundImage: coverImage ? `url(${coverImage})` : 'linear-gradient(135deg, #2b2b2b, #111111)' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.2) 60%, rgba(0,0,0,0.7) 100%)', borderRadius: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 32 }}>
                <div style={{ color: '#ff9436', fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Book Vault Edition</div>
                <div>
                  <h1 style={{ color: '#fff', fontFamily: 'Playfair Display, serif', fontSize: 'clamp(24px, 4vw, 36px)', margin: '0 0 8px', fontWeight: 700, textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>{bookTitle}</h1>
                  <p style={{ color: '#e2d9cd', margin: 0, fontSize: 14, opacity: 0.9 }}>{bookAuthor}</p>
                </div>
                <div style={{ color: '#ff9436', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  📖 Click cover to open book ({maxPages} {maxPages === 1 ? 'Page' : 'Pages'}) →
                </div>
              </div>
            </div>

            {/* Pages Stack / Reading Area */}
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: currentPage >= 0 ? 1 : 0,
              pointerEvents: currentPage >= 0 ? 'auto' : 'none',
              transition: 'opacity 0.3s ease',
              zIndex: currentPage >= 0 ? 10 : 0
            }}>
              <div style={{ width: '100%', height: '100%', background: '#ffffff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', height: '100%', boxSizing: 'border-box' }}>
                  {currentPage === -1 ? null : (
                    <div style={{ color: '#1e293b', fontFamily: 'Georgia, serif', display: 'flex', flexDirection: 'column', height: '100%' }}>
                      {/* Tabs */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 10, marginBottom: 12 }}>
                        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
                          <button
                            onClick={() => setViewMode("original")}
                            style={{
                              padding: '6px 14px',
                              fontSize: 12,
                              borderRadius: 8,
                              border: 'none',
                              background: viewMode === "original" ? '#FF7900' : '#f1f5f9',
                              color: viewMode === "original" ? '#fff' : '#475569',
                              cursor: 'pointer',
                              fontWeight: '700',
                              transition: 'all 0.15s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5
                            }}
                          >
                            <FileText size={13} />
                            Extracted Text
                          </button>
                          {activePageImage && (
                            <button
                              onClick={() => setViewMode("scan")}
                              style={{
                                padding: '6px 14px',
                                fontSize: 12,
                                borderRadius: 8,
                                border: 'none',
                                background: viewMode === "scan" ? '#FF7900' : '#f1f5f9',
                                color: viewMode === "scan" ? '#fff' : '#475569',
                                cursor: 'pointer',
                                fontWeight: '700',
                                transition: 'all 0.15s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5
                              }}
                            >
                              <Eye size={13} />
                              Scan Image
                            </button>
                          )}
                          <button
                            onClick={translatePage}
                            style={{
                              padding: '5px 12px',
                              fontSize: 12,
                              borderRadius: 6,
                              border: 'none',
                              background: viewMode === "translated" ? '#FF7900' : '#f3ede4',
                              color: viewMode === "translated" ? '#fff' : '#4b5563',
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
                              padding: '5px 12px',
                              fontSize: 12,
                              borderRadius: 6,
                              border: 'none',
                              background: viewMode === "summary" ? '#FF7900' : '#f3ede4',
                              color: viewMode === "summary" ? '#fff' : '#4b5563',
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
                              padding: '5px 12px',
                              fontSize: 12,
                              borderRadius: 6,
                              border: 'none',
                              background: viewMode === "explanation" ? '#FF7900' : '#f3ede4',
                              color: viewMode === "explanation" ? '#fff' : '#4b5563',
                              cursor: 'pointer',
                              fontWeight: '600',
                              transition: 'all 0.2s'
                            }}
                          >
                            Explanation
                          </button>
                        </div>

                        {/* Page counter indicator */}
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#8a7a68', background: '#f5efe6', padding: '3px 8px', borderRadius: 6 }}>
                          {currentPage + 1} / {maxPages}
                        </span>
                      </div>

                      {/* Display Content */}
                      <div style={{ flex: 1, overflowY: 'auto', lineHeight: 1.75, fontSize: '15px', whiteSpace: 'pre-wrap', color: '#2c2c2c', paddingRight: 6 }}>
                        {viewMode === "scan" && activePageImage ? (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img src={activePageImage} alt={`Page ${currentPage + 1}`} style={{ maxWidth: '100%', maxHeight: '310px', objectFit: 'contain', borderRadius: 8, boxShadow: '0 4px 14px rgba(0,0,0,0.1)' }} />
                          </div>
                        ) : viewMode === "original" ? (
                          activePageText && activePageText.trim().length > 0 ? (
                            renderHighlightedText(activePageText)
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', gap: 12, padding: 20 }}>
                              <div style={{ fontSize: 32 }}>📄</div>
                              <div style={{ fontSize: 15, fontWeight: 600, color: '#4b5563' }}>No text extracted for this page yet</div>
                              <p style={{ fontSize: 12, color: '#8a7a68', margin: 0, maxWidth: 300 }}>
                                If this page has an uploaded photo or scan, click below to extract the text right now.
                              </p>
                              {activePageImage && (
                                <button
                                  onClick={handleExtractOcrNow}
                                  disabled={isExtractingOcr}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '8px 16px',
                                    borderRadius: 10,
                                    border: 'none',
                                    background: '#FF7900',
                                    color: '#fff',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: isExtractingOcr ? 'wait' : 'pointer',
                                    boxShadow: '0 4px 12px rgba(255,121,0,0.25)'
                                  }}
                                >
                                  {isExtractingOcr ? (
                                    <>
                                      <Loader2 size={14} className="animate-spin" />
                                      Extracting Text...
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles size={14} />
                                      Extract Text with AI/OCR
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          )
                        ) : viewMode === "translated" ? (
                          isTranslating ? "Translating... please wait..." : (translatedText || "No translation loaded yet.")
                        ) : viewMode === "summary" ? (
                          isSummarizing ? "Generating summary... please wait..." : (summaryText || "No summary generated yet.")
                        ) : (
                          isExplaining ? "Analyzing context... please wait..." : (explanationText || "No explanation generated yet.")
                        )}
                      </div>

                      {/* Page footer */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9c9081', fontSize: '11px', marginTop: 10, borderTop: '1px solid #e9e5df', paddingTop: 6 }}>
                        <span>Book Reader • {bookTitle}</span>
                        <span>Page {currentPage + 1} of {maxPages}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16, alignItems: 'center' }}>
            {/* Audio Reading Panel */}
            {currentPage !== -1 && (
              <div style={{ display: 'flex', gap: 8, background: '#fff', padding: '6px 14px', borderRadius: 12, boxShadow: '0 4px 14px rgba(0,0,0,0.08)', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#8a7a68', fontWeight: '700', marginRight: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Volume2 size={13} color="#FF7900" />
                  Voice Assistant:
                </span>
                
                {isPlaying && !isPaused ? (
                  <button 
                    onClick={pauseReading}
                    style={{ background: 'rgba(255,121,0,0.12)', color: '#FF7900', border: '1px solid rgba(255,121,0,0.3)', padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: '700', cursor: 'pointer' }}
                  >
                    ⏸️ Pause
                  </button>
                ) : (
                  <button 
                    onClick={resumeReading}
                    style={{ background: '#FF7900', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: '700', cursor: 'pointer', boxShadow: '0 2px 8px rgba(255,121,0,0.25)' }}
                  >
                    ▶️ Read Aloud
                  </button>
                )}

                {isPlaying && (
                  <button 
                    onClick={stopReading}
                    style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: '700', cursor: 'pointer' }}
                  >
                    ⏹️ Stop
                  </button>
                )}

                {/* Speed drop-down */}
                <select
                  value={playbackSpeed}
                  onChange={(e) => changeSpeed(parseFloat(e.target.value))}
                  style={{ border: '1px solid #e9e5df', borderRadius: 8, padding: '4px 8px', fontSize: 11, color: '#4b5563', background: '#fff', outline: 'none' }}
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
              <button onClick={prev} disabled={currentPage <= -1} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.08)', cursor: currentPage <= -1 ? 'default' : 'pointer', opacity: currentPage <= -1 ? 0.4 : 1, display: 'flex', alignItems: 'center' }} aria-label="Previous Page">
                <ChevronLeft size={16} />
              </button>
              <button onClick={restart} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} aria-label="Restart Book">
                <RefreshCcw size={14} />
              </button>
              <button onClick={next} disabled={currentPage >= maxPages - 1} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.08)', cursor: currentPage >= maxPages - 1 ? 'default' : 'pointer', opacity: currentPage >= maxPages - 1 ? 0.4 : 1, display: 'flex', alignItems: 'center' }} aria-label="Next Page">
                <ChevronRight size={16} />
              </button>
            </div>

            {onOpenReader && (
              <button
                onClick={() => { close(); onOpenReader(); }}
                style={{
                  marginTop: 4,
                  padding: '7px 16px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,121,0,0.3)',
                  background: 'rgba(255,121,0,0.08)',
                  color: '#FF7900',
                  fontSize: 12,
                  fontWeight: '700',
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
