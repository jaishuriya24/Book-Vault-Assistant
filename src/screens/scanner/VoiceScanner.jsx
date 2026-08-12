import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import Tesseract from 'tesseract.js';
import { useNavigate } from 'react-router-dom';

const CENTER_TOLERANCE = 0.2; // 20% from center
const MIN_WIDTH_RATIO = 0.4;  // Book should cover at least 40% of the screen width

function detectSkewAngle(ctx, w, h) {
  const sw = 300;
  const sh = 300;
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = sw;
  tempCanvas.height = sh;
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.drawImage(ctx.canvas, 0, 0, w, h, 0, 0, sw, sh);
  const imgData = tempCtx.getImageData(0, 0, sw, sh);
  const data = imgData.data;

  // Binarize
  const pixels = new Uint8Array(sw * sh);
  for (let i = 0; i < sw * sh; i++) {
    const idx = i * 4;
    const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    pixels[i] = gray < 128 ? 1 : 0;
  }

  // Helper to calculate variance for a given angle, sampling only the center 60% columns to avoid margins/illustrations
  const getVariance = (angle) => {
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const profile = new Float32Array(sh);
    const startX = Math.floor(sw * 0.2);
    const endX = Math.floor(sw * 0.8);

    for (let y = 0; y < sh; y++) {
      for (let x = startX; x < endX; x++) {
        const rx = Math.floor((x - sw / 2) * cos - (y - sh / 2) * sin + sw / 2);
        const ry = Math.floor((x - sw / 2) * sin + (y - sh / 2) * cos + sh / 2);

        if (rx >= 0 && rx < sw && ry >= 0 && ry < sh) {
          if (pixels[ry * sw + rx] === 1) {
            profile[y]++;
          }
        }
      }
    }

    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < sh; i++) {
      sum += profile[i];
      sumSq += profile[i] * profile[i];
    }
    const mean = sum / sh;
    return sumSq / sh - mean * mean;
  };

  // Coarse search: -30 to 30 degrees in 2-degree steps
  let bestAngle = 0;
  let maxVariance = -1;
  for (let angle = -30; angle <= 30; angle += 2) {
    const v = getVariance(angle);
    if (v > maxVariance) {
      maxVariance = v;
      bestAngle = angle;
    }
  }

  // Fine search: search around the best coarse angle in 0.5-degree steps
  let fineBestAngle = bestAngle;
  for (let angle = bestAngle - 1.5; angle <= bestAngle + 1.5; angle += 0.5) {
    const v = getVariance(angle);
    if (v > maxVariance) {
      maxVariance = v;
      fineBestAngle = angle;
    }
  }

  return fineBestAngle;
}

function rotateCanvas(srcCanvas, angleDegrees) {
  if (Math.abs(angleDegrees) < 0.5) return srcCanvas;

  const angleRad = (angleDegrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(angleRad));
  const sin = Math.abs(Math.sin(angleRad));

  const nw = Math.floor(srcCanvas.width * cos + srcCanvas.height * sin);
  const nh = Math.floor(srcCanvas.width * sin + srcCanvas.height * cos);

  const rotCanvas = document.createElement("canvas");
  rotCanvas.width = nw;
  rotCanvas.height = nh;
  const rotCtx = rotCanvas.getContext("2d");

  rotCtx.translate(nw / 2, nh / 2);
  rotCtx.rotate(angleRad);
  rotCtx.drawImage(srcCanvas, -srcCanvas.width / 2, -srcCanvas.height / 2);

  return rotCanvas;
}

function enhanceImage(ctx, w, h) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  const S = Math.max(16, Math.floor(w / 12));
  const s2 = Math.floor(S / 2);
  const T = 0.12;

  const integral = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      sum += gray[idx];
      if (y === 0) {
        integral[idx] = sum;
      } else {
        integral[idx] = integral[(y - 1) * w + x] + sum;
      }
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;

      const x1 = Math.max(0, x - s2);
      const x2 = Math.min(w - 1, x + s2);
      const y1 = Math.max(0, y - s2);
      const y2 = Math.min(h - 1, y + s2);

      const count = (x2 - x1 + 1) * (y2 - y1 + 1);

      let sum = integral[y2 * w + x2];
      if (x1 > 0) sum -= integral[y2 * w + (x1 - 1)];
      if (y1 > 0) sum -= integral[(y1 - 1) * w + x2];
      if (x1 > 0 && y1 > 0) sum += integral[(y1 - 1) * w + (x1 - 1)];

      const avg = sum / count;
      const val = gray[idx] < avg * (1.0 - T) ? 0 : 255;

      const dataIdx = idx * 4;
      data[dataIdx] = val;
      data[dataIdx + 1] = val;
      data[dataIdx + 2] = val;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

async function cleanOcrText(rawText, lang = "eng") {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  const model = import.meta.env.VITE_OPENROUTER_MODEL || "google/gemini-flash-1.5";
  if (!apiKey) {
    console.warn("OpenRouter API key missing, skipping Gemini text cleanup.");
    return rawText;
  }

  try {
    const systemPrompt = `You are a text cleanup assistant for an accessibility book scanner. 
Analyze the raw OCR text and reconstruct the clean book page text.
1. Remove any junk characters, random symbols, and layout noise caused by page borders, drawings, illustrations, or camera artifacts.
2. Fix spelling errors, broken words, hyphenations, spacing, and casing.
3. Preserve the original paragraph layout and line breaks of the actual text content.
4. Return ONLY the cleaned, readable book text. Do NOT add any notes, intros, summaries, explanations, or conversational filler.
If the text is completely unreadable gibberish, return an empty string or a very short string so the app knows to retake.
Output must be in the same language as the input (primarily ${lang}).`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: rawText },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) throw new Error("Gemini cleanup request failed");
    const data = await response.json();
    const cleaned = data.choices?.[0]?.message?.content?.trim();
    return cleaned || rawText;
  } catch (err) {
    console.error("Gemini text cleanup failed:", err);
    return rawText;
  }
}

export default function VoiceScanner() {
  const webcamRef = useRef(null);
  const navigate = useNavigate();
  const [model, setModel] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [feedback, setFeedback] = useState("Loading AI models. Please wait...");
  const [isMirrored, setIsMirrored] = useState(false);
  
  // Audio guidance tracking
  const lastSpeakTime = useRef(0);
  const holdStillStartTime = useRef(null);
  const lastBookBboxRef = useRef(null);

  // 1. Initialize Text-to-Speech
  const speak = useCallback((text) => {
    if (!('speechSynthesis' in window && window.speechSynthesis)) {
      setFeedback(text);
      return;
    }
    const now = Date.now();
    // Throttle speech so it doesn't overlap constantly
    if (now - lastSpeakTime.current < 2000) return;
    
    window.speechSynthesis.cancel(); // Stop current speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
    lastSpeakTime.current = now;
    setFeedback(text);
  }, []);

  // 2. Load the Object Detection Model
  useEffect(() => {
    const loadModel = async () => {
      try {
        const cocoSsdGlobal = window.cocoSsd;
        if (!cocoSsdGlobal) {
          throw new Error("COCO-SSD library not loaded from CDN.");
        }
        const loadedModel = await cocoSsdGlobal.load();
        setModel(loadedModel);
        speak("Model loaded. Please point your camera at a book.");
        setIsScanning(true);
      } catch (err) {
        console.error("Failed to load model:", err);
        setFeedback("Failed to load AI model.");
      }
    };
    loadModel();
    
    return () => {
      if ('speechSynthesis' in window && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [speak]);

  // 3. Process Video Frames
  const detectBook = useCallback(async () => {
    if (!model || !isScanning || isProcessingOCR) return;
    if (webcamRef.current && webcamRef.current.video.readyState === 4) {
      const video = webcamRef.current.video;
      
      const predictions = await model.detect(video);
      
      // Look for a book, paper, notebook, or binder object
      const BOOK_CLASSES = ["book", "paper", "notebook", "binder", "magazine", "card"];
      const book = predictions.find(p => BOOK_CLASSES.includes(p.class.toLowerCase()) && p.score >= 0.30);

      if (!book) {
        speak("I am sorry, no book is detected yet. Please point your phone camera at a book.");
        holdStillStartTime.current = null;
        lastBookBboxRef.current = null;
      } else {
        // We found a book! Analyze its position.
        const [x, y, width, height] = book.bbox;
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        lastBookBboxRef.current = { x, y, width, height, videoWidth, videoHeight };

        // Calculate center of the book relative to the video frame
        const bookCenterX = x + width / 2;
        const bookCenterY = y + height / 2;
        
        const frameCenterX = videoWidth / 2;
        const frameCenterY = videoHeight / 2;

        // Define target zones
        const minX = frameCenterX - (videoWidth * CENTER_TOLERANCE);
        const maxX = frameCenterX + (videoWidth * CENTER_TOLERANCE);
        const minY = frameCenterY - (videoHeight * CENTER_TOLERANCE);
        const maxY = frameCenterY + (videoHeight * CENTER_TOLERANCE);

        let command = "";

        if (bookCenterX < minX) command = "Move camera left.";
        else if (bookCenterX > maxX) command = "Move camera right.";
        else if (bookCenterY < minY) command = "Move camera up.";
        else if (bookCenterY > maxY) command = "Move camera down.";
        else if (width / videoWidth < MIN_WIDTH_RATIO) command = "Move closer.";
        else {
          command = "Perfect. Hold still.";
          
          if (!holdStillStartTime.current) {
            holdStillStartTime.current = Date.now();
          } else if (Date.now() - holdStillStartTime.current > 2500) {
            // Held still for 2.5 seconds! Take the picture.
            setIsScanning(false);
            captureAndRead(video);
            return;
          }
        }

        if (command !== "Perfect. Hold still.") {
          holdStillStartTime.current = null;
        }

        speak(command);
      }
    }
    
    // Loop
    if (isScanning && !isProcessingOCR) {
      requestAnimationFrame(detectBook);
    }
  }, [model, isScanning, isProcessingOCR, speak, isMirrored]);

  // Start the loop once scanning is active
  useEffect(() => {
    if (isScanning && model) {
      const timeoutId = setTimeout(() => detectBook(), 1000); // give video time to render
      return () => clearTimeout(timeoutId);
    }
  }, [isScanning, model, detectBook]);

  // 4. Capture & OCR
  const captureAndRead = async (video) => {
    speak("Capturing image. Please wait while I read the text.");
    setIsProcessingOCR(true);

    const canvas = document.createElement("canvas");
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

    let finalCanvas = canvas;
    let finalW = videoWidth;
    let finalH = videoHeight;

    const bbox = lastBookBboxRef.current;
    if (bbox) {
      const pad = 0.03;
      const cropX = Math.max(0, bbox.x - bbox.videoWidth * pad);
      const cropY = Math.max(0, bbox.y - bbox.videoHeight * pad);
      const cropW = Math.min(bbox.videoWidth - cropX, bbox.width + bbox.videoWidth * pad * 2);
      const cropH = Math.min(bbox.videoHeight - cropY, bbox.height + bbox.videoHeight * pad * 2);

      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      const cropCtx = cropCanvas.getContext("2d");
      cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      // Perspective correction (Deskew)
      const skewAngle = detectSkewAngle(cropCtx, cropW, cropH);
      if (Math.abs(skewAngle) >= 1 && Math.abs(skewAngle) <= 10) {
        finalCanvas = rotateCanvas(cropCanvas, -skewAngle);
      } else {
        finalCanvas = cropCanvas;
      }
      finalW = finalCanvas.width;
      finalH = finalCanvas.height;
    } else {
      const cropX = videoWidth * 0.125;
      const cropY = videoHeight * 0.25;
      const cropW = videoWidth * 0.75;
      const cropH = videoHeight * 0.50;

      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      const cropCtx = cropCanvas.getContext("2d");
      cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      
      finalCanvas = cropCanvas;
      finalW = cropW;
      finalH = cropH;
    }

    const finalCtx = finalCanvas.getContext("2d");
    // Image enhancement (Bradley-Roth Adaptive Thresholding)
    // enhanceImage(finalCtx, finalW, finalH);

    const processedImageUrl = finalCanvas.toDataURL("image/png");
    
    try {
      const result = await Tesseract.recognize(processedImageUrl, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        }
      });

      const rawText = result.data.text.trim();
      setFeedback("Polishing text with Gemini...");
      const extractedText = await cleanOcrText(rawText, "eng");
      
      if (!extractedText || extractedText.length < 10) {
        speak("The text was blurry or could not be read. Let's try again, please hold steady.");
        setIsProcessingOCR(false);
        setIsScanning(true);
        return;
      }

      speak("Scanning complete. Opening your book now.");
      
      // Save book
      const activeUser = localStorage.getItem("username") || "Guest";
      const STORAGE_KEY = `uploadedBooks_${activeUser}`;
      const books = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      
      const newBook = {
        id: Date.now().toString(),
        title: `Scanned Page ${new Date().toLocaleTimeString()}`,
        cover: imageSrc,
        content: extractedText
      };
      
      books.push(newBook);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
      localStorage.setItem(`continueReading_${activeUser}`, newBook.id);
      
      // Navigate to reader
      navigate(`/reader/${newBook.id}`);
      
    } catch (err) {
      console.error(err);
      speak("I am sorry, book detection text extraction is not working properly. Let's try again.");
      setIsProcessingOCR(false);
      setIsScanning(true);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-900 w-full relative overflow-hidden">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-8 flex justify-between items-center z-10 bg-gradient-to-b from-black/70 to-transparent">
        <button 
          onClick={() => navigate("/")} 
          className="text-white hover:text-orange-400 transition-colors font-medium text-lg px-4 py-2 bg-black/30 rounded-xl"
        >
          ← Cancel Scan
        </button>
        <div className="text-white font-serif text-xl">Voice Scanner</div>
        <div className="w-32" aria-hidden="true" />
      </div>

      {/* Camera Feed */}
      <Webcam
        ref={webcamRef}
        audio={false}
        screenshotFormat="image/jpeg"
        videoConstraints={{ facingMode: "environment" }}
        mirrored={false}
        style={{ transform: "scaleX(-1)" }}
        className={`w-full h-full object-cover absolute inset-0 ${isProcessingOCR ? 'opacity-30 blur-sm' : 'opacity-100'}`}
      />

      {/* Guidelines Overlay */}
      {!isProcessingOCR && (
        <div className="absolute inset-0 border-[10px] border-orange-500/30 pointer-events-none rounded-3xl m-8">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-4 border-white/50 w-3/4 h-1/2 rounded-2xl flex items-center justify-center">
            <span className="text-white/50 font-bold text-2xl tracking-widest">+</span>
          </div>
        </div>
      )}

      {/* Feedback Overlay */}
      <div className="absolute bottom-16 left-8 right-8 z-10 text-center">
        {isProcessingOCR ? (
          <div className="bg-stone-800/90 p-8 rounded-3xl border border-stone-700 shadow-2xl inline-block max-w-md w-full">
            <h2 className="text-3xl text-white font-serif mb-4">Reading Text...</h2>
            <div className="w-full bg-stone-700 rounded-full h-3 mb-2">
              <div className="bg-orange-500 h-3 rounded-full transition-all duration-300" style={{ width: `${ocrProgress}%` }}></div>
            </div>
            <p className="text-stone-400 font-medium">{ocrProgress}% Complete</p>
          </div>
        ) : (
          <div className="bg-black/60 px-8 py-4 rounded-full text-white text-2xl font-medium inline-block shadow-lg border border-white/10 backdrop-blur-md">
            {feedback}
          </div>
        )}
      </div>
    </div>
  );
}
