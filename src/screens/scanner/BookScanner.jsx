import React, { useRef, useState, useEffect, useCallback } from "react";
import { loadModel, detectObjects } from "../../utils/objectDetector";
import {
  isOpenCvReady,
  detectBookQuadrilateral,
  warpBookPage,
  enhanceWarpedPage
} from "../../utils/opencvHelper";
import { computeDHash, isDuplicateHash } from "../../utils/duplicateDetector";
import { checkFrameQuality } from "../../utils/qualityChecker";
import { detectPageContour } from "../../utils/pageDetectorJS";

const speakTts = (text, { lang = "en-US" } = {}) => {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window && window.speechSynthesis)) {
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

const LANG_OPTIONS = [
  { code: "eng", label: "English", flag: "🇺🇸" },
  { code: "tam", label: "Tamil", flag: "🇮🇳" },
  { code: "tang", label: "Tanglish", flag: "🗣️" },
];

const ALIGN_TOLERANCE = {
  centerOffset: 0.08,
  minFill: 0.55,
  maxFill: 0.92,
};

const STABLE_MS_REQUIRED = 1200;
const MIN_CLARITY_SCORE = 1200;
const MIN_LAPLACIAN_SCORE = 60;
const CLARITY_FRAMES_REQUIRED = 4;
const CLARITY_HISTORY_SIZE = 6;

// Friendly user messages — no technical jargon
const FRIENDLY_MESSAGES = {
  eng: {
    blurry: [
      "📸 The image is a bit blurry — try holding your phone steady",
      "🤚 Hold still for a moment — I need a clearer picture",
      "📷 Almost there! Keep the camera steady and don't move",
    ],
    tooFar: "📏 You're a bit far — move the camera closer to the book",
    tooClose: "📏 A bit too close — step back just a little",
    moveRight: "👉 Shift the camera slightly to the right",
    moveLeft: "👈 Shift the camera slightly to the left",
    moveDown: "👇 Tilt the camera down a bit",
    moveUp: "👆 Tilt the camera up a bit",
    rotate: "🔄 Rotate camera slightly to align with the page",
    holdSteady: "✨ Perfect! Hold still — capturing...",
    lookingForBook: "📖 Point your camera at a book page",
    modelLoading: "🔄 Getting the scanner ready...",
    bookFound: "✅ Book detected! Hold steady while I scan it",
    notABook: (label) =>
      `🤔 I see a ${label} — please point at a book page instead`,
    captured: "🎉 Got it! Extracting text now...",
    noText:
      "😕 Couldn't find any text on this page. Try a page with more text, or improve the lighting.",
    textFound: "📝 Text extracted successfully!",
    cameraError:
      "📵 Couldn't access your camera. Please check your browser permissions.",
    ocrFailed:
      "I am sorry, book detection text extraction is not working properly. Let's try again!",
    notSharpEnough:
      "🔍 The image wasn't quite sharp enough — let's try again with steadier hands!",
    seeObjects: (list) => `I see ${list}.`,
  },
  tang: {
    blurry: [
      "📸 Padam konjam mangala irukku — phone-a nillaiya pidi",
      "🤚 Konjam nillaiya iru — thelivana padam thevai",
      "📷 Kittathatta mudinjithu! Camera-va asaikkama pidi",
    ],
    tooFar: "📏 Konjam thoorama irukka — camera-va book kitta kondu po",
    tooClose: "📏 Romba kitta irukka — konjam pinnaadi po",
    moveRight: "👉 Camera-va konjam valathu pakkam nagarthu",
    moveLeft: "👈 Camera-va konjam idathu pakkam nagarthu",
    moveDown: "👇 Camera-va konjam keela erakku",
    moveUp: "👆 Camera-va konjam mela thukku",
    rotate: "🔄 Align panna camera-va konjam thiruppu",
    holdSteady: "✨ Super! Asaikkama pidi — photo edukkuren...",
    lookingForBook: "📖 Camera-va oru book page mela kaatu",
    modelLoading: "🔄 Scanner ready aaguthu...",
    bookFound: "✅ Book theriyuthu! Scan pandra vara asaikkama pidi",
    notABook: (label) =>
      `🤔 Ithu ${label} mathiri theriyuthu — please book page mela kaatu`,
    captured: "🎉 Super! Ezhutha edukkuren...",
    noText:
      "😕 Intha page la ezhuthu edhuvum illai. Velichatha athigappaduthi marubadiyum try pannu.",
    textFound: "📝 Ezhutha correct-a eduthachu!",
    cameraError: "📵 Camera-va access panna mudiyala. Permissions check pannu.",
    ocrFailed: "I am sorry, book detection text extraction is not working properly. Marubadiyum try pannuvom!",
    notSharpEnough: "🔍 Padam theliva illai — asaikkama marubadiyum try pannu!",
    seeObjects: (list) => `Enaku ${list} theriyuthu.`,
  },
  tam: {
    blurry: [
      "📸படம் சற்று மங்கலாக உள்ளது — உங்கள் போனை நிலையாக வைத்திருக்கவும்",
      "🤚 ஒரு கணம் நிலையாக இருங்கள் — எனக்கு தெளிவான படம் தேவை",
      "📷 வந்துவிட்டது! கேமராவை நிலையாக வைத்து அசையாமல் இருங்கள்",
    ],
    tooFar:
      "📏 நீங்கள் சற்று தொலைவில் உள்ளீர்கள் — கேமராவை புத்தகத்திற்கு அருகில் கொண்டு செல்லவும்",
    tooClose: "📏 சற்று நெருக்கமாக — சிறிது பின்வாங்கவும்",
    moveRight: "👉 கேமராவை சற்று வலதுபுறம் நகர்த்தவும்",
    moveLeft: "👈 கேமராவை சற்று இடதுபுறம் நகர்த்தவும்",
    moveDown: "👇 கேமராவை சற்று கீழே சாய்க்கவும்",
    moveUp: "👆 கேமராவை சற்று மேலே சாய்க்கவும்",
    rotate: "🔄 பக்கத்துடன் சீரமைக்க கேமராவை சற்று சுழற்றவும்",
    holdSteady: "✨ சரியானது! நிலையாக இருங்கள் — படம் எடுக்கப்படுகிறது...",
    lookingForBook: "📖 உங்கள் கேமராவை ஒரு புத்தகப் பக்கத்தில் திருப்பவும்",
    modelLoading: "🔄 ஸ்கேனர் தயாராகிறது...",
    bookFound:
      "✅ புத்தகம் கண்டறியப்பட்டது! நான் அதை ஸ்கேன் செய்யும் போது நிலையாக இருக்கவும்",
    notABook: (label) =>
      `🤔 நான் ஒரு ${label} ஐப் பார்க்கிறேன் — தயவுசெய்து ஒரு புத்தகப் பக்கத்தில் திருப்பவும்`,
    captured: "🎉 கிடைத்தது! இப்போது உரையைப் பிரித்தெடுக்கிறது...",
    noText:
      "😕 இந்தப் பக்கத்தில் எந்த உரையையும் கண்டுபிடிக்க முடியவில்லை. வெளிச்சத்தை அதிகரித்து மீண்டும் முயற்சிக்கவும்.",
    textFound: "📝 உரை வெற்றிகரமாக பிரித்தெடுக்கப்பட்டது!",
    cameraError:
      "📵 உங்கள் கேமராவை அணுக முடியவில்லை. உங்கள் அனுமதிகளை சரிபார்க்கவும்.",
    ocrFailed:
      "மன்னிக்கவும், புத்தகம் கண்டறிதல் மற்றும் உரை பிரித்தெடுத்தல் சரியாக வேலை செய்யவில்லை. மீண்டும் முயற்சிப்போம்!",
    notSharpEnough:
      "🔍 படம் போதுமான அளவு தெளிவாக இல்லை — நிலையான கைகளுடன் மீண்டும் முயற்சிப்போம்!",
    seeObjects: (list) => `நான் ${list} ஐப் பார்க்கிறேன்.`,
  },
};

function getRandomBlurryMessage(lang = "eng") {
  const msgs = FRIENDLY_MESSAGES[lang].blurry;
  return msgs[Math.floor(Math.random() * msgs.length)];
}

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

function isOcrGibberish(text) {
  if (!text || typeof text !== "string") return true;

  const trimmed = text.trim();
  if (trimmed.length < 10) return true;

  // 1. Symbol density check: count non-alphanumeric junk symbols (| / [ ] ~ £ = < > &)
  const noiseSymbols = (trimmed.match(/[^a-zA-Z0-9\u0B80-\u0BFF\s.,?!'\-"]/g) || []).length;
  if (noiseSymbols / trimmed.length > 0.08) {
    return true; // Over 8% junk symbols
  }

  // 2. Tokenize words (sequences of letters/numbers)
  const tokens = trimmed.match(/[a-zA-Z\u0B80-\u0BFF0-9]+/g) || [];
  if (tokens.length < 3) return true;

  // 3. Short word ratio check (1-letter or 2-letter tokens)
  const shortTokens = tokens.filter((t) => t.length <= 2);
  const shortRatio = shortTokens.length / tokens.length;
  if (tokens.length >= 4 && shortRatio > 0.48) {
    return true; // Over 48% of tokens are 1-2 letter fragments
  }

  // 4. Vowel ratio check for English words (tokens >= 3 letters)
  const engLongTokens = tokens.filter((t) => t.length >= 3 && /^[a-zA-Z]+$/.test(t));
  if (engLongTokens.length > 0) {
    const vowelsCount = engLongTokens.filter((t) => /[aeiouyAEIOUY]/.test(t)).length;
    if (vowelsCount / engLongTokens.length < 0.60) {
      return true;
    }
  } else if (tokens.length >= 4) {
    // 4+ tokens but no valid 3+ letter words
    return true;
  }

  // 5. Average word length check
  const totalChars = tokens.reduce((sum, t) => sum + t.length, 0);
  const avgLen = totalChars / tokens.length;
  if (tokens.length >= 4 && avgLen < 3.0) {
    return true;
  }

  return false;
}

async function cleanOcrText(rawText, lang = "eng") {
  // Immediately reject OCR text if it fails the gibberish / camera noise test
  if (isOcrGibberish(rawText)) {
    return "";
  }

  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  const model = import.meta.env.VITE_OPENROUTER_MODEL || "google/gemini-flash-1.5";
  if (!apiKey) {
    console.warn("OpenRouter API key missing, skipping Gemini text cleanup.");
    // Filter noise lines from rawText if API key missing
    const lines = rawText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => (l.match(/[a-zA-Z\u0B80-\u0BFF]/g) || []).length >= 3 && !isOcrGibberish(l));
    return lines.join("\n");
  }

  try {
    const systemPrompt = `You are a text cleanup assistant for an accessibility book scanner. 
Analyze the raw OCR text and reconstruct the clean book page text.
1. Remove any junk characters, random symbols, and layout noise caused by page borders, drawings, illustrations, or camera artifacts.
2. Fix spelling errors, broken words, hyphenations, spacing, and casing.
3. Preserve the original paragraph layout and line breaks of the actual text content.
4. Return ONLY the cleaned, readable book text. Do NOT add any notes, intros, summaries, explanations, or conversational filler.
If the text is completely unreadable gibberish or camera noise, return an empty string.
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
    if (isOcrGibberish(cleaned)) return "";
    return cleaned || rawText;
  } catch (err) {
    console.error("Gemini text cleanup failed:", err);
    if (isOcrGibberish(rawText)) return "";
    return rawText;
  }
}

async function runGeminiOcr(imageDataUrl, lang = "eng") {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }

  const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data URL format");
  const mimeType = match[1];
  const base64Data = match[2];

  const isOpenRouter = apiKey.startsWith("sk-or-") || apiKey.includes("ghp_") || apiKey.length > 50; 
  
  let url;
  let headers = { "Content-Type": "application/json" };
  let body;

  if (isOpenRouter) {
    url = "https://openrouter.ai/api/v1/chat/completions";
    headers["Authorization"] = `Bearer ${apiKey}`;
    body = JSON.stringify({
      model: import.meta.env.VITE_OPENROUTER_MODEL || "google/gemini-flash-1.5",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `Perform highly accurate OCR on the provided book page image. Extract ALL text in reading order, fix spelling/hyphens, but DO NOT paraphrase. Output ONLY the clean transcribed page text in ${lang}. Do not add notes/intros.` },
            {
              type: "image_url",
              image_url: { url: imageDataUrl }
            }
          ]
        }
      ]
    });
  } else {
    url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    body = JSON.stringify({
      contents: [{
        parts: [
          { text: `Perform highly accurate OCR on the provided book page image. Extract ALL text in reading order, fix spelling/hyphens, but DO NOT paraphrase. Output ONLY the clean transcribed page text in ${lang}. Do not add notes/intros.` },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]
      }]
    });
  }

  const response = await fetch(url, { method: "POST", headers, body });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "Gemini OCR request failed");
  }

  const data = await response.json();
  if (isOpenRouter) {
    return data.choices?.[0]?.message?.content?.trim() || "";
  } else {
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  }
}

export default function BookScanner({ bookTitle, onTextExtracted, onPageCaptured, onCompleteScan, onCancel, autoSaveTimeLeft }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const analysisTimerRef = useRef(null);
  const stableSinceRef = useRef(null);
  const clarityHistoryRef = useRef([]);
  const fileInputRef = useRef(null);
  const cvCornersRef = useRef(null);
  const capturedHashesRef = useRef([]);
  const lastCenterRef = useRef(null);
  const allPredictionsRef = useRef([]);
  const consecutiveLostFramesRef = useRef(0);
  const prevFrameDataRef = useRef(null);

  const [pageCount, setPageCount] = useState(0);
  const [qualityMetrics, setQualityMetrics] = useState(null);
  const [lastDHash, setLastDHash] = useState("");
  const [progressRatio, setProgressRatio] = useState(0);
  const [detectorStatusText, setDetectorStatusText] = useState("Searching for book page...");
  const [detectorStatusColor, setDetectorStatusColor] = useState("#a3a3a3");
  const [scannedPagesList, setScannedPagesList] = useState([]);
  const [selectedPreviewPage, setSelectedPreviewPage] = useState(null);

  const [mode, setMode] = useState("camera"); // "camera" | "upload"
  const [status, setStatus] = useState("idle"); // idle | guiding | capturing | processing | done | error
  const [guidance, setGuidance] = useState("");
  const [capturedImage, setCapturedImage] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [languages, setLanguages] = useState(["eng"]);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [cameraError, setCameraError] = useState(null);
  const [clarityPercent, setClarityPercent] = useState(0);
  const [clarityLabel, setClarityLabel] = useState("");
  const [detectedBox, setDetectedBox] = useState(null);
  const [detectedLabel, setDetectedLabel] = useState("");
  const [detector, setDetector] = useState(null);
  const [modelReady, setModelReady] = useState(false);
  const [bookFound, setBookFound] = useState(false);
  const [bookConfidence, setBookConfidence] = useState(0);
  const [aiStatus, setAiStatus] = useState("Loading");
  const [detectedObjects, setDetectedObjects] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isMirrored, setIsMirrored] = useState(false);
  const [allPredictions, setAllPredictions] = useState([]);

  const [backendSessionId, setBackendSessionId] = useState(null);
  const [backendStatus, setBackendStatus] = useState("connecting");

  // Initialize Spring Boot MySQL session for contiguous page management
  useEffect(() => {
    fetch("http://localhost:8080/api/pages/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: bookTitle || "Untitled Book" })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.sessionId) {
          setBackendSessionId(data.sessionId);
          setBackendStatus("connected");
          console.log("BookScanner connected to MySQL Spring Boot session:", data.sessionId);
        }
      })
      .catch((err) => {
        console.warn("Spring Boot scanner backend not reachable on 8080:", err.message);
        setBackendStatus("offline");
      });
  }, [bookTitle]);

  const [docId, setDocId] = useState("");

  // Blind Accessibility & Auto-Capture Settings
  const [isAutoCaptureEnabled, setIsAutoCaptureEnabled] = useState(true);
  const [autoCaptureHoldSec, setAutoCaptureHoldSec] = useState(1.5); // Fast 1.5s steady hold auto-capture
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isDeveloperMode, setIsDeveloperMode] = useState(false);
  const [scannerState, setScannerState] = useState("SEARCHING_BOOK");
  const [pythonResponse, setPythonResponse] = useState(null);
  const lastSpokenGuidanceRef = useRef("");

  const isSoundEnabledRef = useRef(true);
  const isAutoCaptureEnabledRef = useRef(true);
  const autoCaptureHoldSecRef = useRef(1.5);
  const isDeveloperModeRef = useRef(false);
  const hasCapturedPageRef = useRef(false);

  useEffect(() => {
    isSoundEnabledRef.current = isSoundEnabled;
  }, [isSoundEnabled]);

  useEffect(() => {
    isAutoCaptureEnabledRef.current = isAutoCaptureEnabled;
  }, [isAutoCaptureEnabled]);

  useEffect(() => {
    autoCaptureHoldSecRef.current = autoCaptureHoldSec;
  }, [autoCaptureHoldSec]);

  useEffect(() => {
    isDeveloperModeRef.current = isDeveloperMode;
  }, [isDeveloperMode]);

  const detectionFrameRef = useRef(0);
  const lastDetectedBoxRef = useRef(null);
  const lastDetectedObjectLabelRef = useRef("");
  const lastSpokenRef = useRef({ text: "", time: 0 });
  const isAnalyzingRef = useRef(false);
  const lastStableBoxRef = useRef(null);
  const lastSpokenObjectsRef = useRef("");

  const speak = useCallback(
    async (text, { force = false, priority = false } = {}) => {
      return; // Disabled AI voice completely as requested
      if (!("speechSynthesis" in window && window.speechSynthesis)) return;
      const now = Date.now();
      if (
        !force &&
        text === lastSpokenRef.current.text &&
        now - lastSpokenRef.current.time < 1800
      ) {
        return;
      }
      
      const langKey = languages[0] || "eng";
      let langTag = "en-US";
      if (langKey === "tam" || langKey === "tang") {
        langTag = "ta-IN";
      } else if (langKey === "hin") {
        langTag = "hi-IN";
      }

      if (priority) window.speechSynthesis.cancel();
      lastSpokenRef.current = { text, time: now };
      await speakTts(text, { lang: langTag });
    },
    [languages],
  );

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("guiding");
      speak("Camera ready. Looking for the book.", { force: true });
    } catch (err) {
      setCameraError(FRIENDLY_MESSAGES[languages[0] || "eng"].cameraError);
      setStatus("error");
      speak("I am sorry, I could not access the camera. Please check your permissions.", {
        force: true,
        priority: true,
      });
    }
  }, [speak]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (analysisTimerRef.current) {
      clearInterval(analysisTimerRef.current);
      analysisTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    let cancelled = false;

    async function initModel() {
      try {
        setAiStatus("Loading");
        const loadedModel = await loadModel();
        if (cancelled) return;
        setDetector(loadedModel);
        setModelReady(true);
        setAiStatus("Ready");
        speak("Book detection is ready.", { force: true });
      } catch (err) {
        console.warn("Book detection model failed to load:", err);
        setAiStatus("Failed");
        speak("I am sorry, book detection is not working properly right now.", { force: true });
      }
    }

    initModel();
    return () => {
      cancelled = true;
    };
  }, [speak]);

  // Auto-start camera in camera mode
  useEffect(() => {
    if (mode === "camera" && status === "idle") {
      startCamera();
    }
  }, [startCamera, status, mode]);

  const detectBook = useCallback(
    async (canvas) => {
      if (!detector) return null;
      try {
        const predictions = await detectObjects(canvas);
        
        // Filter for book, paper, notebook, or binder objects with confidence >= 0.30
        const BOOK_CLASSES = ["book", "paper", "notebook", "binder", "magazine", "card"];
        const bookPreds = predictions.filter(
          (p) => BOOK_CLASSES.includes(p.class.toLowerCase()) && p.score >= 0.30
        );

        allPredictionsRef.current = predictions;
        setAllPredictions(predictions);

        if (bookPreds.length > 0) {
          setDetectedObjects(["Book"]);
          const bookPred = bookPreds[0];
          setBookFound(true);
          setBookConfidence(Math.round(bookPred.score * 100));
          return {
            type: "book",
            minX: Math.max(0, bookPred.bbox[0]),
            minY: Math.max(0, bookPred.bbox[1]),
            maxX: Math.min(canvas.width || 1280, bookPred.bbox[0] + bookPred.bbox[2]),
            maxY: Math.min(canvas.height || 720, bookPred.bbox[1] + bookPred.bbox[3]),
            score: bookPred.score,
            label: "Book",
          };
        } else {
          setDetectedObjects([]);
          setBookFound(false);
          setBookConfidence(0);
          return null;
        }
      } catch (err) {
        return null;
      }
    },
    [detector],
  );

  const runObjectDetection = useCallback(async () => {
    if (!detector || !videoRef.current || !videoRef.current.videoWidth) {
      await speak("Open the camera scanner first to detect a book.", {
        force: true,
      });
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement("canvas");
    const w = (canvas.width = video.videoWidth);
    const h = (canvas.height = video.videoHeight);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, w, h);

    const found = await detectBook(canvas);
    if (!found) {
      setAiStatus("Ready");
      setDetectedObjects([]);
      await speak(
        "No book detected. Please point your camera at a book.",
        {
          force: true,
        },
      );
      return;
    }

    setAiStatus("Ready");
    await speak("Book detected! Hold camera steady.", { force: true });
  }, [detector, detectBook, speak]);

  useEffect(() => {
    const handleVoiceDetect = () => {
      runObjectDetection();
    };
    window.addEventListener("book-vault:detect-objects", handleVoiceDetect);
    return () => {
      window.removeEventListener("book-vault:detect-objects", handleVoiceDetect);
    };
  }, [runObjectDetection]);

  const detectPageBox = useCallback((ctx, w, h) => {
    const cols = 32;
    const rows = 24;
    const stepX = w / cols;
    const stepY = h / rows;
    const samples = [];

    let totalBrightness = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = Math.floor(c * stepX + stepX / 2);
        const y = Math.floor(r * stepY + stepY / 2);
        const d = ctx.getImageData(x, y, 1, 1).data;
        const brightness = (d[0] + d[1] + d[2]) / 3;
        samples.push({ x, y, brightness });
        totalBrightness += brightness;
      }
    }
    const avgBrightness = totalBrightness / samples.length;
    const threshold = avgBrightness + 22;
    const brightPoints = samples.filter((s) => s.brightness > threshold);

    // Require bright page region to cover between 25% and 85% of the frame (a real page object)
    const coverage = brightPoints.length / samples.length;
    if (coverage < 0.25 || coverage > 0.85) {
      return null;
    }

    const xs = brightPoints.map((p) => p.x);
    const ys = brightPoints.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const boxW = maxX - minX;
    const boxH = maxY - minY;

    // A real book page must take up at least 35% width and height of the camera frame
    if (boxW < w * 0.35 || boxH < h * 0.35) {
      return null;
    }

    return {
      minX,
      maxX,
      minY,
      maxY,
      coverage,
    };
  }, []);

  const getClarityScore = useCallback((ctx, x, y, width, height) => {
    const sampleCanvas = document.createElement("canvas");
    const scale = 0.2;
    sampleCanvas.width = Math.max(1, Math.floor(width * scale));
    sampleCanvas.height = Math.max(1, Math.floor(height * scale));
    const sampleCtx = sampleCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    sampleCtx.drawImage(
      ctx.canvas,
      x,
      y,
      width,
      height,
      0,
      0,
      sampleCanvas.width,
      sampleCanvas.height,
    );

    const { data } = sampleCtx.getImageData(
      0,
      0,
      sampleCanvas.width,
      sampleCanvas.height,
    );
    let total = 0;
    let totalSquares = 0;

    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      total += gray;
      totalSquares += gray * gray;
    }

    const avg = total / (data.length / 4);
    const variance = totalSquares / (data.length / 4) - avg * avg;
    return variance;
  }, []);

  const getLaplacianSharpness = useCallback((ctx, x, y, width, height) => {
    const sampleCanvas = document.createElement("canvas");
    const scale = 0.4;
    const sw = Math.max(3, Math.floor(width * scale));
    const sh = Math.max(3, Math.floor(height * scale));
    sampleCanvas.width = sw;
    sampleCanvas.height = sh;
    const sampleCtx = sampleCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    sampleCtx.drawImage(ctx.canvas, x, y, width, height, 0, 0, sw, sh);

    const { data } = sampleCtx.getImageData(0, 0, sw, sh);

    const gray = new Float32Array(sw * sh);
    for (let i = 0; i < sw * sh; i++) {
      const idx = i * 4;
      gray[i] =
        0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }

    let lapSum = 0;
    let lapSumSq = 0;
    let count = 0;
    for (let row = 1; row < sh - 1; row++) {
      for (let col = 1; col < sw - 1; col++) {
        const center = row * sw + col;
        const lap =
          gray[center - sw] +
          gray[center - 1] +
          gray[center + 1] +
          gray[center + sw] -
          4 * gray[center];
        lapSum += lap;
        lapSumSq += lap * lap;
        count++;
      }
    }

    if (count === 0) return 0;
    const mean = lapSum / count;
    const variance = lapSumSq / count - mean * mean;
    return variance;
  }, []);

  const updateClarityHistory = useCallback((laplacianScore) => {
    const history = clarityHistoryRef.current;
    history.push(laplacianScore);
    if (history.length > CLARITY_HISTORY_SIZE) {
      history.shift();
    }

    if (history.length < CLARITY_FRAMES_REQUIRED) return false;

    const recentFrames = history.slice(-CLARITY_FRAMES_REQUIRED);
    return recentFrames.every((s) => s >= MIN_LAPLACIAN_SCORE);
  }, []);

  const captureAndProcess = useCallback(
    async (box, w, h, { isManual = false } = {}) => {
      const video = videoRef.current;
      if (!video) return;



      let finalCanvas;

      // 1. Perspective Warp or Exact Bounding Box Crop to remove room background completely
      if (cvCornersRef.current) {
        const fullCanvas = document.createElement("canvas");
        fullCanvas.width = w;
        fullCanvas.height = h;
        const fullCtx = fullCanvas.getContext("2d");
        fullCtx.drawImage(video, 0, 0, w, h);

        try {
          finalCanvas = warpBookPage(fullCanvas, cvCornersRef.current);
        } catch (e) {
          console.warn("Perspective warp failed, falling back to page box crop:", e);
          cvCornersRef.current = null;
        }
      }

      if (!cvCornersRef.current || !finalCanvas) {
        const cropCanvas = document.createElement("canvas");
        // Calculate the central book framing bounds (72% width x 82% height centered)
        const guideW = Math.round(w * 0.72);
        const guideH = Math.round(h * 0.82);
        const guideX = Math.round((w - guideW) / 2);
        const guideY = Math.round((h - guideH) / 2);

        // Strict book page crop bounds to remove user face and background completely
        const cropX = box.minX ? Math.max(0, box.minX) : guideX;
        const cropY = box.minY ? Math.max(0, box.minY) : guideY;
        const cropW = box.width ? Math.min(w - cropX, box.width) : guideW;
        const cropH = box.height ? Math.min(h - cropY, box.height) : guideH;

        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cropCtx = cropCanvas.getContext("2d");

        // Draw ONLY the book page bounding region, ignoring outer background and face
        cropCtx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        // --- Deskewing ---
        const skewAngle = detectSkewAngle(cropCtx, cropW, cropH);
        finalCanvas = cropCanvas;

        if (Math.abs(skewAngle) >= 1 && Math.abs(skewAngle) <= 10) {
          finalCanvas = rotateCanvas(cropCanvas, -skewAngle);
        }
      }

      if (isMirrored && finalCanvas) {
        const mirrorCanvas = document.createElement("canvas");
        mirrorCanvas.width = finalCanvas.width;
        mirrorCanvas.height = finalCanvas.height;
        const mCtx = mirrorCanvas.getContext("2d");
        mCtx.translate(finalCanvas.width, 0);
        mCtx.scale(-1, 1);
        mCtx.drawImage(finalCanvas, 0, 0);
        finalCanvas = mirrorCanvas;
      }

      // MANDATORY BLUR & CLARITY CHECK: Reject blurry or motion-blurred images!
      const sharpnessScore = getLaplacianSharpness(
        finalCanvas.getContext("2d"),
        0,
        0,
        finalCanvas.width,
        finalCanvas.height
      );
      if (sharpnessScore < 140) {
        setStatus("guiding");
        hasCapturedPageRef.current = false;
        setDetectorStatusText("🔍 Image blurry — hold camera steady");
        setDetectorStatusColor("#ef4444");
        setGuidance("🔍 Page image is blurry! Hold still for a clear shot.");
        speak("I am sorry, the page image is blurry. Please hold steady before capturing.", { force: true });
        return;
      }

      // 2. Text-detector Quality Check
      const qualityCheck = checkFrameQuality(finalCanvas, cvCornersRef.current);
      setQualityMetrics(qualityCheck.metrics);

      // 3. Text-detector Duplicate Check (Perceptual dHash & Hamming Distance) to prevent duplication
      const pageDHash = computeDHash(finalCanvas);
      setLastDHash(pageDHash);
      const dupCheck = isDuplicateHash(pageDHash, capturedHashesRef.current, 20);

      if (dupCheck.isDuplicate) {
        hasCapturedPageRef.current = true; // Lock capturing so it doesn't scan continuously
        setStatus("guiding");
        clarityHistoryRef.current = [];
        stableSinceRef.current = null;
        setDetectorStatusText("Duplicate page detected - ignoring");
        setDetectorStatusColor("#ef4444"); // Red warning color
        setGuidance("⚠️ Same page already captured! Please turn the page to scan next.");
        speak("This page was already captured previously. Please turn the page.", {
          force: false,
        });
        return;
      }

      // 4. Register new page hash & update naming convention (Page 1, Page 2...)
      capturedHashesRef.current.push(pageDHash);
      const newPageNum = pageCount + 1;
      setPageCount(newPageNum);

      const safeTitle = (bookTitle || "book")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "_")
        .replace(/_+/g, "_");

      const pageTitle = `${bookTitle || "Book"} - Page ${newPageNum}`;
      const fileName = `${safeTitle}_page${newPageNum}.webp`;
      const timeStr = new Date().toLocaleTimeString();

      setDetectorStatusText(`${pageTitle} captured -> Saved: ${fileName}`);
      setDetectorStatusColor("#22c55e"); // Green

      // Keep clean cropped photograph of the book page without background
      const dataUrl = finalCanvas.toDataURL("image/webp", 0.85);
      setCapturedImage(dataUrl);

      // Add to live captured pages gallery array
      setScannedPagesList((prev) => [
        ...prev,
        {
          id: Date.now(),
          pageNumber: newPageNum,
          pageTitle,
          dataUrl,
          fileName,
          timestamp: timeStr,
        },
      ]);

      speak(`${pageTitle} captured`, { force: true, priority: true });

      // Pause stability timer and capture flag
      stableSinceRef.current = null;
      
      if (isAutoCaptureEnabledRef.current) {
        // Lock capture permanently until the user turns the page (detection loss resets the lock)
        hasCapturedPageRef.current = true;
      } else {
        hasCapturedPageRef.current = false;
        // Stop camera and set status to show results
        stopCamera();
        setStatus("done");
        setIsAnalyzingText(false);
        setExtractedText("");
        setStructuredObjects(null);
      }

      setIsAnalyzingText(false);
      setExtractedText("");

      // Save via Java Spring Boot MySQL backend endpoint
      if (backendSessionId) {
        try {
          finalCanvas.toBlob(async (blob) => {
            if (!blob) return;
            const formData = new FormData();
            formData.append("file", blob, `page_${newPageNum}.jpg`);
            const uploadRes = await fetch(`http://localhost:8080/api/pages/${backendSessionId}/upload?sharpness=${Math.round(laplacianSharpness)}&brightness=${Math.round(clarityScore)}`, {
              method: "POST",
              body: formData,
            });
            if (uploadRes.ok) {
              const resData = await uploadRes.json();
              console.log("Page synced to Spring Boot & MySQL:", resData);
            }
          }, "image/jpeg", 0.9);
        } catch (backendErr) {
          console.warn("Spring Boot upload sync error:", backendErr);
        }
      }

      // Save to localStorage for browser persistence
      try {
        const existingPages = JSON.parse(localStorage.getItem("scanned_book_pages") || "[]");
        existingPages.push({
          pageNumber: newPageNum,
          pageTitle,
          fileName,
          image: dataUrl,
          dhash: pageDHash,
          timestamp: new Date().toISOString(),
        });
        localStorage.setItem("scanned_book_pages", JSON.stringify(existingPages));
      } catch (e) {}

      if (onPageCaptured) {
        onPageCaptured({ pageNumber: newPageNum, pageTitle, dataUrl, fileName });
      }
    },
    [getClarityScore, getLaplacianSharpness, speak, isMirrored, languages, pageCount, onPageCaptured, backendSessionId, bookTitle],
  );

  const handleDeletePage = useCallback(async (pageNumberToDelete, e) => {
    if (e) e.stopPropagation();
    if (backendSessionId) {
      try {
        await fetch(`http://localhost:8080/api/pages/${backendSessionId}/${pageNumberToDelete}`, {
          method: "DELETE"
        });
      } catch (err) {
        console.warn("Spring Boot delete error:", err);
      }
    }
    setScannedPagesList((prev) => {
      const filtered = prev.filter((p) => p.pageNumber !== pageNumberToDelete);
      return filtered.map((p, i) => {
        const newNum = i + 1;
        return {
          ...p,
          pageNumber: newNum,
          pageTitle: `${bookTitle || "Book"} - Page ${newNum}`,
          fileName: `Page${newNum}.jpg`,
        };
      });
    });
    setPageCount((prev) => Math.max(0, prev - 1));
  }, [backendSessionId, bookTitle]);

  const analyzeFrame = useCallback(async () => {
    if (isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const w = (canvas.width = video.videoWidth);
      const h = (canvas.height = video.videoHeight);
      if (!w || !h) return;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, w, h);

      // --- Client-Side Shake Detection ---
      const motionCanvas = document.createElement("canvas");
      motionCanvas.width = 40;
      motionCanvas.height = 30;
      const motionCtx = motionCanvas.getContext("2d");
      motionCtx.drawImage(video, 0, 0, 40, 30);
      const currentFrameData = motionCtx.getImageData(0, 0, 40, 30).data;

      if (prevFrameDataRef.current) {
        let diffSum = 0;
        const len = currentFrameData.length;
        for (let i = 0; i < len; i += 4) {
          diffSum += Math.abs(currentFrameData[i] - prevFrameDataRef.current[i]);
        }
        // Bug fix: compute motionScore from diffSum (normalize by pixel count)
        const motionScore = diffSum / (40 * 30);
        const SHAKE_THRESHOLD = 35;
        const shaking = motionScore > SHAKE_THRESHOLD;
        setIsShaking(shaking);

        if (shaking) {
          setDetectorStatusText("⚠️ Camera moving — hold steady!");
          setDetectorStatusColor("#eab308");
        }
      }
      prevFrameDataRef.current = currentFrameData;
      // Bug fix: removed unconditional setIsShaking(false) that was overriding the real shake state

      // Fast local client-side detection (COCO-SSD Object Detector & OpenCV PageDetector)
      let cocoResult = null;
      if (detector) {
        cocoResult = await detectBook(canvas);
      }

      // Check if a person is in the frame to prevent false capturing of the user's face
      const isPersonDetected = allPredictionsRef.current.some(
        (p) => p.class.toLowerCase() === "person" && p.score >= 0.40
      );

      const pageResult = detectPageContour(canvas);
      const isDetected = (cocoResult && cocoResult.type === "book") || (pageResult.found && !isPersonDetected);

      if (!isDetected) {
        consecutiveLostFramesRef.current += 1;
        if (consecutiveLostFramesRef.current >= 5) {
          hasCapturedPageRef.current = false;
        }
        setScannerState("SEARCHING_BOOK");
        setDetectorStatusText("📖 Point camera at a book page");
        setDetectorStatusColor("#eab308"); // Yellow
        setGuidance("📖 Point camera at a book page to detect and scan.");
        setDetectedBox(null);
        cvCornersRef.current = null;
        stableSinceRef.current = null;
        lastCenterRef.current = null;
        setProgressRatio(0);
        setBookFound(false);
        return;
      }

      consecutiveLostFramesRef.current = 0;

      if (hasCapturedPageRef.current) {
        setDetectorStatusText("Page captured! Turn page to scan next page.");
        setDetectorStatusColor("#22c55e");
        setGuidance("Page captured! Turn page to scan next page.");
        return;
      }

      let corners = pageResult.found ? pageResult.corners : null;
      let center = pageResult.found ? pageResult.center : null;

      if (corners) {
        cvCornersRef.current = corners;
      }

      let minX, minY, maxX, maxY;
      if (cocoResult) {
        minX = cocoResult.minX;
        minY = cocoResult.minY;
        maxX = cocoResult.maxX;
        maxY = cocoResult.maxY;
        if (!center) {
          center = { x: Math.round((minX + maxX) / 2), y: Math.round((minY + maxY) / 2) };
        }
      } else {
        const xs = corners.map((p) => p.x);
        const ys = corners.map((p) => p.y);
        minX = Math.min(...xs);
        maxX = Math.max(...xs);
        minY = Math.min(...ys);
        maxY = Math.max(...ys);
      }

      const box = { minX, minY, maxX, maxY, type: cocoResult ? "coco_book" : "page_cv", label: "Book" };
      setDetectedBox({ minX, minY, width: maxX - minX, height: maxY - minY });
      setDetectedLabel("Book");
      setBookFound(true);
      setBookConfidence(cocoResult ? Math.round(cocoResult.score * 100) : 95);

      if (lastCenterRef.current) {
        const dist = Math.sqrt(
          Math.pow(center.x - lastCenterRef.current.x, 2) +
          Math.pow(center.y - lastCenterRef.current.y, 2)
        );
        if (dist > 15.0) {
          // Bug fix: reset to null so stability timer truly restarts from zero
          stableSinceRef.current = null;
        } else if (!stableSinceRef.current) {
          // Book is stable and timer hasn't started yet — start it now
          stableSinceRef.current = Date.now();
        }
      } else {
        stableSinceRef.current = Date.now();
      }
      lastCenterRef.current = center;

      const elapsedStable = stableSinceRef.current ? (Date.now() - stableSinceRef.current) / 1000 : 0;
      const targetHoldSec = autoCaptureHoldSecRef.current || 30;
      const currentProgressRatio = Math.min(1.0, elapsedStable / targetHoldSec);
      setProgressRatio(currentProgressRatio);

      if (currentProgressRatio < 1.0) {
        setScannerState("ADJUST_POSITION");
        setDetectorStatusText(`Checking stability... (${elapsedStable.toFixed(1)}s / ${targetHoldSec}s)`);
        setDetectorStatusColor("#eab308");
        setGuidance(`Hold page still for ${Math.ceil(targetHoldSec - elapsedStable)}s...`);
        speak("Hold steady", { force: false });
      } else {
        setScannerState("READY_TO_CAPTURE");
        setDetectorStatusText("Page ready! Capturing now...");
        setDetectorStatusColor("#22c55e");
        setGuidance("Page ready! Capturing now...");

        if (isAutoCaptureEnabledRef.current) {
          hasCapturedPageRef.current = true;
          stableSinceRef.current = null;
          speak("Page captured successfully", { force: true, priority: true });
          captureAndProcess(box, w, h);
        } else {
          setGuidance("Page ready! Tap screen or press Spacebar to capture.");
          speak("Hold steady", { force: true });
        }
      }
    } finally {
      isAnalyzingRef.current = false;
    }
  }, [captureAndProcess, speak]);

  useEffect(() => {
    if (status !== "guiding") return;
    analysisTimerRef.current = setInterval(() => {
      analyzeFrame();
    }, 200);
    return () => clearInterval(analysisTimerRef.current);
  }, [status, analyzeFrame]);

  const manualCapture = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = (canvas.width = video.videoWidth);
    const h = (canvas.height = video.videoHeight);
    if (!w || !h) {
      setGuidance("📷 Camera not ready yet — just a moment...");
      return;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, w, h);

    // Verify a book or page contour is present before allowing capture
    let cocoResult = null;
    if (detector) {
      cocoResult = await detectBook(canvas);
    }
    const pageResult = detectPageContour(canvas);
    const isPersonDetected = allPredictionsRef.current.some(
      (p) => p.class.toLowerCase() === "person" && p.score >= 0.40
    );
    const isBookDetected = (cocoResult && cocoResult.type === "book") || (pageResult.found && !isPersonDetected);

    if (!isBookDetected) {
      setGuidance("📖 No book detected — please point your camera at a book page.");
      speak("I am sorry, no book page is detected. Please point your camera at a book page before capturing.", {
        force: true,
        priority: true,
      });
      setDetectorStatusText("Capture rejected: No book page detected");
      setDetectorStatusColor("#ef4444");
      return;
    }

    if (pageResult.found && pageResult.corners) {
      cvCornersRef.current = pageResult.corners;
      const xs = pageResult.corners.map((p) => p.x);
      const ys = pageResult.corners.map((p) => p.y);
      const box = {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
      };
      captureAndProcess(box, w, h, { isManual: true });
    } else if (cocoResult && cocoResult.type === "book") {
      const box = {
        minX: cocoResult.minX,
        minY: cocoResult.minY,
        maxX: cocoResult.maxX,
        maxY: cocoResult.maxY,
      };
      captureAndProcess(box, w, h, { isManual: true });
    }
  }, [captureAndProcess, detector, detectBook, speak]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        manualCapture();
      }
    };
    const handleVoiceCapture = () => {
      manualCapture();
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("book-vault:capture_scan", handleVoiceCapture);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("book-vault:capture_scan", handleVoiceCapture);
    };
  }, [manualCapture]);

  // Listen for continuous voice "stop" command to halt continuous book scanning
  useEffect(() => {
    if (status !== "guiding" && status !== "capturing") return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    let recognition;
    try {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.toLowerCase().trim();
          if (
            transcript.includes("stop") ||
            transcript.includes("pause") ||
            transcript.includes("done") ||
            transcript.includes("finish") ||
            transcript.includes("podhum") ||
            transcript.includes("nillu") ||
            transcript.includes("cancel")
          ) {
            try { recognition.stop(); } catch (e) {}
            stopCamera();
            setStatus("idle");
            setDetectorStatusText("Scanning stopped by user command");
            setDetectorStatusColor("#ef4444");
            setGuidance("Scanner stopped. Tap Start Scanning to resume.");
            speak("I am sorry, stopping book capture now as requested.", { force: true, priority: true });
            break;
          }
        }
      };

      recognition.onerror = () => {};
      recognition.start();
    } catch (e) {}

    return () => {
      if (recognition) {
        try { recognition.stop(); } catch (e) {}
      }
    };
  }, [status, stopCamera, speak]);

  const runOcr = useCallback(
    async (imageDataUrl) => {
      try {
        const Tesseract = (await import("tesseract.js")).default;
        const validLangs = Array.from(
          new Set(languages.map((l) => (l === "tang" ? "eng" : l))),
        );
        const langString = validLangs.join("+");

        const worker = await Tesseract.createWorker(langString, 1, {
          logger: (m) => {
            if (m.status === "recognizing text") {
              setOcrProgress(Math.round(m.progress * 100));
            }
          },
        });

        await worker.setParameters({
          tessedit_ocr_engine_mode: 1, // OEM_LSTM_ONLY
          tessedit_pageseg_mode: 3, // PSM_AUTO_OSD
        });

        const { data } = await worker.recognize(imageDataUrl);
        await worker.terminate();

        let rawText = (data.text || "").trim();
        let text = rawText;

        if (!rawText || isOcrGibberish(rawText)) {
          console.log("Tesseract OCR result was empty or gibberish. Trying Gemini OCR fallback...");
          try {
            text = await runGeminiOcr(imageDataUrl, languages[0] || "eng");
            rawText = text;
          } catch (geminiErr) {
            console.error("Gemini OCR fallback failed:", geminiErr);
          }
        } else {
          try {
            text = await cleanOcrText(rawText, languages[0] || "eng");
          } catch (e) {
            text = rawText;
          }
        }

        const finalText = text || rawText || "Page image captured successfully.";
        setExtractedText(finalText);

        // Update scannedPagesList item with extracted text
        setScannedPagesList((prev) =>
          prev.map((item) =>
            item.dataUrl === imageDataUrl ? { ...item, extractedText: finalText } : item
          )
        );

        speak("Text extracted successfully!", { force: true });
        if (onTextExtracted) {
          onTextExtracted(finalText, imageDataUrl);
        }
      } catch (err) {
        console.warn("Tesseract OCR failed. Trying Gemini OCR fallback...", err);
        try {
          const geminiText = await runGeminiOcr(imageDataUrl, languages[0] || "eng");
          if (geminiText) {
            setExtractedText(geminiText);
            setScannedPagesList((prev) =>
              prev.map((item) =>
                item.dataUrl === imageDataUrl ? { ...item, extractedText: geminiText } : item
              )
            );
            speak("Text extracted successfully using AI fallback!", { force: true });
            if (onTextExtracted) {
              onTextExtracted(geminiText, imageDataUrl);
            }
            return;
          }
        } catch (geminiErr) {
          console.error("Gemini OCR fallback failed after Tesseract crash:", geminiErr);
        }

        setStatus("error");
        setCameraError(FRIENDLY_MESSAGES[languages[0] || "eng"].ocrFailed);
        speak(FRIENDLY_MESSAGES[languages[0] || "eng"].ocrFailed, {
          force: true,
          priority: true,
        });

        if (onTextExtracted) {
          onTextExtracted("Page image captured.", imageDataUrl);
        }
      }
    },
    [languages, speak, onTextExtracted],
  );

  // Handle uploaded image file
  const handleImageUpload = useCallback(
    async (file) => {
      if (!file) return;
      setUploadedFile(file);

      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target.result;

        if (!detector && !isOpenCvReady()) {
          setStatus("error");
          setCameraError("Book detector is still initializing. Please wait a moment and try again.");
          speak("Book detector is still initializing. Please wait.", { force: true });
          return;
        }

        const img = new Image();
        img.onload = async () => {
          setStatus("processing");
          setGuidance("Scanning image for book page...");
          speak("Analyzing image.", { force: true });

          let finalCanvas = null;
          let cvPageQuad = null;

          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          const tempCtx = tempCanvas.getContext("2d");
          tempCtx.drawImage(img, 0, 0);

          if (isOpenCvReady()) {
            try {
              cvPageQuad = detectBookQuadrilateral(tempCanvas);
            } catch (err) {
              console.warn("OpenCV quadrilateral detection failed on upload:", err);
            }
          }

          if (cvPageQuad) {
            try {
              finalCanvas = warpBookPage(tempCanvas, cvPageQuad.corners);
              enhanceWarpedPage(finalCanvas);
              speak("Book page detected and aligned. Extracting text now.", { force: true });
            } catch (err) {
              console.warn("OpenCV warping failed on upload:", err);
            }
          }

          if (!finalCanvas && detector) {
            const found = await detectBook(img);
            const isBook = found && found.type === "book";

            if (isBook) {
              const w = img.width;
              const h = img.height;
              const pad = 0.03;
              const cropX = Math.max(0, found.minX - w * pad);
              const cropY = Math.max(0, found.minY - h * pad);
              const cropW = Math.min(w - cropX, found.maxX - found.minX + w * pad * 2);
              const cropH = Math.min(h - cropY, found.maxY - found.minY + h * pad * 2);

              const cropCanvas = document.createElement("canvas");
              cropCanvas.width = cropW;
              cropCanvas.height = cropH;
              const cropCtx = cropCanvas.getContext("2d");
              cropCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

              const skewAngle = detectSkewAngle(cropCtx, cropW, cropH);
              finalCanvas = cropCanvas;
              if (Math.abs(skewAngle) >= 1 && Math.abs(skewAngle) <= 10) {
                finalCanvas = rotateCanvas(cropCanvas, -skewAngle);
              }
              if (isOpenCvReady()) {
                try {
                  enhanceWarpedPage(finalCanvas);
                } catch (err) {}
              }
              speak("Book detected and cropped. Extracting text now.", { force: true });
            }
          }

          let finalDataUrl = dataUrl;
          if (finalCanvas) {
            finalDataUrl = finalCanvas.toDataURL("image/webp", 0.85);
          } else {
            console.log("No book bounding box detected in upload. Proceeding with full image OCR.");
            if (isOpenCvReady()) {
              try {
                enhanceWarpedPage(tempCanvas);
                finalDataUrl = tempCanvas.toDataURL("image/webp", 0.85);
              } catch (err) {}
            }
            speak("No book detected. Extracting text from full image.", { force: true });
          }

          setCapturedImage(finalDataUrl);
          setGuidance(FRIENDLY_MESSAGES[languages[0] || "eng"].captured);
          runOcr(finalDataUrl);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [speak, detector, detectBook, languages, runOcr],
  );

  const retryScan = useCallback(() => {
    setCapturedImage(null);
    setExtractedText("");
    setOcrProgress(0);
    setCameraError(null);
    setClarityPercent(0);
    setClarityLabel("");
    setUploadedFile(null);
    clarityHistoryRef.current = [];
    if (mode === "camera") {
      setStatus("guiding");
      speak("Let's try again. Point at the book.", {
        force: true,
        priority: true,
      });
    } else {
      setStatus("idle");
    }
  }, [speak, mode]);

  const handleConvertToObjects = useCallback(async () => {
    if (!docId || !extractedText) return;
    setIsConvertingObjects(true);
    setStructuredObjects(null);
    try {
      const springApiUrl = import.meta.env.VITE_SPRING_BOOT_API_URL || import.meta.env.VITE_SERVER_URL || "http://localhost:3001";
      const response = await fetch(`${springApiUrl}/api/books/convert-objects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_id: docId,
          extracted_text: extractedText,
          image_base64: capturedImage
        })
      });

      if (!response.ok) throw new Error("Conversion failed");
      const data = await response.json();
      setStructuredObjects(data.structured_objects);
      speak("Conversion complete!", { force: true });
    } catch (err) {
      console.error("Objects conversion failed:", err);
      speak("I am sorry, structured conversion failed.", { force: true });
    } finally {
      setIsConvertingObjects(false);
    }
  }, [docId, extractedText, capturedImage, speak]);

  const toggleLanguage = (code) => {
    setLanguages((prev) =>
      prev.includes(code) && prev.length > 1
        ? prev.filter((c) => c !== code)
        : prev.includes(code)
          ? prev
          : [...prev, code],
    );
  };

  const clarityColor =
    clarityPercent < 40
      ? "#ef4444"
      : clarityPercent < 70
        ? "#f59e0b"
        : "#22c55e";

  return (
    <div className="scanner-wrap">
      {onCancel && (
        <button
          type="button"
          className="btn-back"
          onClick={(e) => {
            e.preventDefault();
            onCancel();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            fontWeight: 500,
            fontSize: "14px",
            marginBottom: "14px",
            padding: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to Methods
        </button>
      )}
      {/* Mode Toggle */}
      <div className="method-picker" style={{ marginBottom: 14 }}>
        <button
          onClick={() => {
            setMode("camera");
            if (status === "idle") startCamera();
          }}
          className={`method-card ${mode === "camera" ? "selected" : ""}`}
        >
          <div className="method-card-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <div className="method-card-title">Live Camera</div>
          <div className="method-card-subtitle">Auto-detect & scan</div>
        </button>
        <button
          onClick={() => {
            setMode("upload");
            stopCamera();
            setStatus("idle");
          }}
          className={`method-card ${mode === "upload" ? "selected" : ""}`}
        >
          <div className="method-card-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div className="method-card-title">Upload Image</div>
          <div className="method-card-subtitle">From your gallery</div>
        </button>
      </div>

      {/* CAMERA MODE */}
      {mode === "camera" && status !== "done" && (
        <>
          {/* Auto Capture Stability Speed Bar */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justify: "space-between",
            background: "rgba(30, 41, 59, 0.6)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            padding: "8px 14px",
            borderRadius: "12px",
            marginBottom: "12px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            fontSize: "12px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#e2e8f0", fontWeight: 600 }}>
              <span>⏱️ Capture Hold Timer:</span>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              {[
                { label: "⚡ 1.5s", sec: 1.5 },
                { label: "🎯 3s", sec: 3 },
                { label: "⏳ 30s", sec: 30 }
              ].map((item) => (
                <button
                  key={item.sec}
                  type="button"
                  onClick={() => setAutoCaptureHoldSec(item.sec)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "8px",
                    border: "none",
                    background: autoCaptureHoldSec === item.sec ? "#22c55e" : "rgba(255, 255, 255, 0.1)",
                    color: autoCaptureHoldSec === item.sec ? "#ffffff" : "#cbd5e1",
                    fontWeight: autoCaptureHoldSec === item.sec ? 700 : 500,
                    fontSize: "11px",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="scanner-video-box">
            {/* Optional Developer Debug Overlay */}
            {isDeveloperMode && (
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  left: 10,
                  right: 10,
                  zIndex: 40,
                  background: "rgba(10, 15, 30, 0.92)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  borderRadius: 12,
                  padding: "10px 12px",
                  color: "#f8fafc",
                  fontSize: 11,
                  fontFamily: "monospace",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  pointerEvents: "auto",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 4 }}>
                  <span style={{ fontWeight: "bold", color: "#38bdf8" }}>🛠️ DEVELOPER DEBUG OVERLAY</span>
                  <span style={{ background: "#0369a1", padding: "2px 6px", borderRadius: 4, color: "#fff", fontSize: 10 }}>DEV MODE</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 8px" }}>
                  <div><strong>State:</strong> <span style={{ color: "#facc15" }}>{scannerState}</span></div>
                  <div><strong>Camera Active:</strong> <span style={{ color: streamRef.current ? "#4ade80" : "#f87171" }}>{streamRef.current ? "YES" : "NO"}</span></div>
                  <div><strong>Page Detected:</strong> {pythonResponse?.pageDetected ? "YES ✅" : "NO ❌"}</div>
                  <div><strong>Position:</strong> <span style={{ color: "#38bdf8" }}>{pythonResponse?.positionGuidance || "N/A"}</span></div>
                  <div><strong>Blur Score:</strong> {pythonResponse?.quality?.blur ?? "N/A"}</div>
                  <div><strong>Brightness:</strong> {pythonResponse?.quality?.brightness ?? "N/A"}</div>
                  <div><strong>Quality Valid:</strong> {pythonResponse?.quality?.valid ? "YES ✅" : "NO ❌"}</div>
                  <div><strong>Confidence:</strong> {pythonResponse?.confidence ? `${Math.round(pythonResponse.confidence * 100)}%` : "0%"}</div>
                </div>
                <div style={{ marginTop: 6, paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}>
                  <strong>Guidance Prompt:</strong> "{pythonResponse?.guidance || detectorStatusText}"
                </div>
                {capturedImage && (
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#4ade80", fontWeight: "bold" }}>Last Capture Preview:</span>
                    <img src={capturedImage} alt="Dev Preview" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4, border: "1px solid #38bdf8" }} />
                  </div>
                )}
              </div>
            )}

            <video 
              ref={videoRef} 
              playsInline 
              muted 
              className={`scanner-video ${isMirrored ? "mirrored" : ""}`} 
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />



            {/* Sweeping Laser Scan Line */}

            {/* Sweeping Laser Scan Line */}
            {(status === "capturing" || status === "processing") && (
              <div className="scanner-laser-line" />
            )}

            {/* Dedicated Book Page Framing Overlay (Focuses purely on the book) */}
            {status === "guiding" && (
              <div className="scanner-book-guide-overlay">
                <div className="scanner-book-guide-frame">
                  <div className="scanner-book-guide-header-badge">
                    📖 ALIGN BOOK PAGE HERE
                  </div>
                  <div className="scanner-book-guide-spine" />
                  <div className="scanner-book-guide-corner top-left" />
                  <div className="scanner-book-guide-corner top-right" />
                  <div className="scanner-book-guide-corner bottom-left" />
                  <div className="scanner-book-guide-corner bottom-right" />
                </div>
              </div>
            )}

            {/* Premium Detection box overlay with Corner Brackets */}
            {detectedBox && (
              <div
                className={`scanner-target-box ${detectedLabel === "Book" ? "is-book" : "is-page"}`}
                style={{
                  position: "absolute",
                  left: isMirrored
                    ? `${((videoRef.current?.videoWidth || 1) - detectedBox.minX - detectedBox.width) / (videoRef.current?.videoWidth || 1) * 100}%`
                    : `${(detectedBox.minX / (videoRef.current?.videoWidth || 1)) * 100}%`,
                  top: `${(detectedBox.minY / (videoRef.current?.videoHeight || 1)) * 100}%`,
                  width: `${(detectedBox.width / (videoRef.current?.videoWidth || 1)) * 100}%`,
                  height: `${(detectedBox.height / (videoRef.current?.videoHeight || 1)) * 100}%`,
                  border: "3px solid #22c55e",
                  boxShadow: "0 0 18px rgba(34, 197, 94, 0.75), inset 0 0 12px rgba(34, 197, 94, 0.25)",
                  borderRadius: "10px",
                  pointerEvents: "none",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  zIndex: 25,
                }}
              >
                <div className="scanner-corner tl" style={{ borderColor: "#22c55e" }} />
                <div className="scanner-corner tr" style={{ borderColor: "#22c55e" }} />
                <div className="scanner-corner bl" style={{ borderColor: "#22c55e" }} />
                <div className="scanner-corner br" style={{ borderColor: "#22c55e" }} />
                <div className="scanner-target-pulse" style={{ borderColor: "#22c55e" }} />
              </div>
            )}
            
            {detectedLabel && detectedBox && (
              <div
                style={{
                  position: "absolute",
                  left: isMirrored
                    ? `${((videoRef.current?.videoWidth || 1) - detectedBox.minX - detectedBox.width) / (videoRef.current?.videoWidth || 1) * 100}%`
                    : `${(detectedBox.minX / (videoRef.current?.videoWidth || 1)) * 100}%`,
                  top: `calc(${(detectedBox.minY / (videoRef.current?.videoHeight || 1)) * 100}% - 26px)`,
                  padding: "3px 10px",
                  borderRadius: 8,
                  background: detectedLabel === "Book"
                    ? "rgba(34,197,94,0.85)"
                    : "rgba(224,122,58,0.85)",
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                  pointerEvents: "none",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                }}
              >
                {detectedLabel === "Book" ? "📖 " : "🔍 "}
                {detectedLabel}
              </div>
            )}

            {/* Clarity meter */}
            {status === "guiding" && clarityPercent > 0 && (
              <div className="scanner-clarity-bar">
                <div className="scanner-clarity-track">
                  <div
                    className="scanner-clarity-fill"
                    style={{
                      width: `${clarityPercent}%`,
                      background: clarityColor,
                    }}
                  />
                </div>
                <span className="scanner-clarity-label">{clarityLabel}</span>
              </div>
            )}

            <div
              className="scanner-ai-panel"
              role="status"
              aria-live="polite"
            >
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: "#f0eee8", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: aiStatus === "Ready" ? "#22c55e" : "#f59e0b", display: "inline-block", boxShadow: aiStatus === "Ready" ? "0 0 6px #22c55e" : "0 0 6px #f59e0b" }} />
                {aiStatus}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
                {detectedObjects.length > 0
                  ? detectedObjects.join(", ")
                  : "Scanning…"}
              </div>
              {bookFound && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#a7f3d0",
                    marginTop: 4,
                    fontWeight: 600,
                  }}
                >
                  📖 {bookConfidence}% confident
                </div>
              )}
              {pageCount > 0 && (
                <div style={{ fontSize: 11, color: "#93c5fd", marginTop: 4, fontWeight: 600 }}>
                  📄 Scanned: {pageCount} {pageCount === 1 ? "page" : "pages"}
                </div>
              )}
              {lastDHash && (
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2, fontFamily: "monospace" }}>
                  dHash: {lastDHash.substring(0, 8)}...
                </div>
              )}
            </div>

            {/* Guidance overlay */}
            {status === "guiding" && (
              <div
                className="scanner-guidance"
                role="status"
                aria-live="polite"
              >
                {guidance ||
                  FRIENDLY_MESSAGES[languages[0] || "eng"].lookingForBook}
              </div>
            )}

            {/* Text-detector Phase 1 Status Banner & Progress Bar */}
            {status === "guiding" && (
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: "rgba(20, 20, 20, 0.88)",
                  padding: "10px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                  borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                  zIndex: 5,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ color: detectorStatusColor, fontWeight: 700, fontSize: 13 }}>
                    {detectorStatusText}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>
                    Text-detector Active
                  </span>
                </div>
                {progressRatio > 0 && (
                  <div style={{ width: "100%", height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${progressRatio * 100}%`, height: "100%", background: detectorStatusColor, transition: "width 0.1s ease-out" }} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Camera Controls Redesigned */}
          <div className="scanner-controls-container">
            {(status === "guiding" || status === "capturing" || status === "processing") && (
              <div className="scanner-camera-actions">
                <button
                  type="button"
                  className="scanner-btn-circle-secondary"
                  onClick={(e) => {
                    e.preventDefault();
                    stopCamera();
                    setStatus("idle");
                  }}
                  title="Stop Camera"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>

                <button
                  type="button"
                  className={`scanner-shutter-btn ${(status === "capturing" || status === "processing") ? "active" : ""} ${isAutoCaptureEnabled ? "auto" : ""}`}
                  onClick={(e) => {
                    e.preventDefault();
                    manualCapture();
                  }}
                  title={isAutoCaptureEnabled ? "Auto-capture active. Tap to override." : "Capture page now"}
                  disabled={status === "capturing" || status === "processing"}
                >
                  <div className="shutter-inner" />
                </button>

                <button
                  type="button"
                  className={`scanner-btn-circle-secondary ${isMirrored ? "active" : ""}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setIsMirrored((prev) => !prev);
                  }}
                  title="Flip Horizontal / Fix Mirror Reflection"
                  style={{ background: isMirrored ? "#ea580c" : undefined, color: isMirrored ? "#ffffff" : undefined }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 1 21 5 17 9" />
                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <polyline points="7 23 3 19 7 15" />
                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
                </button>
              </div>
            )}

            {(status === "guiding" || status === "capturing" || status === "processing") && scannedPagesList.length > 0 && (
              <button
                type="button"
                className="scanner-btn-primary"
                style={{
                  marginTop: 14,
                  width: "100%",
                  padding: "14px 20px",
                  borderRadius: "14px",
                  background: "linear-gradient(135deg, #e07a3a, #ca8a04)",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(224, 122, 58, 0.3)",
                  transition: "transform 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"}
                onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                onClick={(e) => {
                  e.preventDefault();
                  stopCamera();
                  if (onCompleteScan) {
                    onCompleteScan(scannedPagesList);
                  } else {
                    setStatus("done");
                  }
                }}
              >
                <span>➡️ Finish Scan & Review</span>
                <span style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  padding: "2px 8px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 800
                }}>
                  {scannedPagesList.length} {scannedPagesList.length === 1 ? "page" : "pages"}
                </span>
              </button>
            )}

          {/* Captured Image Down Preview Card */}
          {capturedImage && !isAutoCaptureEnabled && (
              <div style={{
                marginTop: 12,
                width: "100%",
                padding: "12px 14px",
                borderRadius: 14,
                background: "#ffffff",
                border: "2px solid #22c55e",
                boxShadow: "0 8px 20px rgba(34, 197, 94, 0.15)",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}>
                <div style={{
                  width: 75,
                  height: 95,
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid #cbd5e1",
                  flexShrink: 0,
                  background: "#000"
                }}>
                  <img
                    src={capturedImage}
                    alt="Captured Book Preview"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{
                      background: "#22c55e",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 6,
                    }}>
                      ✅ Saved to MongoDB
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
                      Page {pageCount}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Cropped book object saved to database <code style={{ color: "#0284c7" }}>book_vault</code>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const safeTitle = (bookTitle || "book")
                          .trim()
                          .toLowerCase()
                          .replace(/[^a-z0-9_-]/g, "_")
                          .replace(/_+/g, "_");
                        setSelectedPreviewPage({
                          pageNumber: pageCount,
                          dataUrl: capturedImage,
                          fileName: `${safeTitle}_page${pageCount}.webp`,
                          timestamp: new Date().toLocaleTimeString()
                        });
                      }}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 8,
                        background: "#f1f5f9",
                        color: "#334155",
                        border: "1px solid #cbd5e1",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      👁️ View Image
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCapturedImage(null);
                        hasCapturedPageRef.current = false;
                      }}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 8,
                        background: "#e07a3a",
                        color: "#ffffff",
                        border: "none",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      📸 Scan Next Page
                    </button>
                  </div>
                </div>
              </div>
            )}

            {status === "idle" && (
              <button
                type="button"
                className="scanner-btn-primary"
                onClick={(e) => {
                  e.preventDefault();
                  startCamera();
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ marginRight: 8, verticalAlign: "middle" }}
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Start Scanning
              </button>
            )}

            {(status === "done" || status === "error") && (
              <div style={{ display: "flex", gap: "10px", width: "100%" }}>
                <button
                  type="button"
                  className="scanner-btn-primary"
                  style={{ flex: 1 }}
                  onClick={(e) => {
                    e.preventDefault();
                    retryScan();
                    startCamera();
                  }}
                >
                  🔄 Scan Another Page
                </button>
                {onCancel && (
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: "12px 18px",
                      borderRadius: "14px",
                      border: "1px solid var(--border)",
                      background: "rgba(221,214,200,0.3)",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: 600,
                      transition: "all 0.15s"
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      onCancel();
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Captured Pages Gallery Strip in App */}
          {scannedPagesList.length > 0 && (
            <div style={{
              marginTop: 16,
              padding: "14px 18px",
              borderRadius: 16,
              background: "rgba(255, 255, 255, 0.95)",
              border: "1px solid rgba(0, 0, 0, 0.08)",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>📸 Captured Pages Gallery</span>
                  <span style={{
                    background: "#e07a3a",
                    color: "#fff",
                    borderRadius: 12,
                    padding: "2px 8px",
                    fontSize: 12,
                    fontWeight: 700,
                  }}>
                    {scannedPagesList.length}
                  </span>
                </div>
                {autoSaveTimeLeft !== undefined && scannedPagesList.length > 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: autoSaveTimeLeft <= 5 ? "#ef4444" : "#e07a3a",
                      background: autoSaveTimeLeft <= 5 ? "#fef2f2" : "#fffbeb",
                      border: `1px solid ${autoSaveTimeLeft <= 5 ? "#fecaca" : "#fde68a"}`,
                      padding: "4px 10px",
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontFamily: "monospace",
                    }}>
                      ⏱️ Auto-save in {Math.floor(autoSaveTimeLeft / 60)}:{String(autoSaveTimeLeft % 60).padStart(2, '0')}
                    </span>
                    <span style={{ fontSize: 11, color: "#64748b" }}>Tap thumbnail to view</span>
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: "#64748b" }}>Tap thumbnail to view full image</span>
                )}
              </div>

              <div style={{
                display: "flex",
                gap: 12,
                overflowX: "auto",
                paddingBottom: 6,
                scrollbarWidth: "thin",
              }}>
                {scannedPagesList.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    onClick={() => setSelectedPreviewPage(item)}
                    style={{
                      flexShrink: 0,
                      width: 95,
                      cursor: "pointer",
                      borderRadius: 10,
                      overflow: "hidden",
                      border: "2px solid #e2e8f0",
                      transition: "transform 0.15s, border-color 0.15s",
                      background: "#fff",
                      position: "relative",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.04)";
                      e.currentTarget.style.borderColor = "#e07a3a";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.borderColor = "#e2e8f0";
                    }}
                  >
                    <button
                      type="button"
                      onClick={(e) => handleDeletePage(item.pageNumber, e)}
                      title="Delete Page"
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "rgba(239, 68, 68, 0.9)",
                        color: "#fff",
                        border: "none",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 5,
                        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                      }}
                    >
                      ✕
                    </button>
                    <img
                      src={item.dataUrl}
                      alt={`Page ${item.pageNumber}`}
                      style={{ width: "100%", height: 115, objectFit: "cover", display: "block" }}
                    />
                    <div style={{
                      padding: "4px 6px",
                      background: "#f8fafc",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#334155",
                      textAlign: "center",
                      borderTop: "1px solid #f1f5f9",
                    }}>
                      Page {item.pageNumber}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extracted Text Display Card */}
          {extractedText && (
            <div
              style={{
                marginTop: 16,
                padding: "18px 20px",
                borderRadius: 16,
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                boxShadow: "0 10px 28px rgba(0, 0, 0, 0.08)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    color: "#0f172a",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>📝 Extracted Page Text</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => speak(extractedText, { force: true })}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 10,
                      background: "#eff6ff",
                      color: "#2563eb",
                      border: "1px solid #bfdbfe",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    🔊 Listen (TTS)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(extractedText);
                      speak("Text copied to clipboard", { force: true });
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 10,
                      background: "#f8fafc",
                      color: "#475569",
                      border: "1px solid #cbd5e1",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    📋 Copy Text
                  </button>
                </div>
              </div>
              <div
                style={{
                  maxHeight: 180,
                  overflowY: "auto",
                  padding: 14,
                  borderRadius: 12,
                  background: "#f8fafc",
                  border: "1px solid #f1f5f9",
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "#334155",
                  whiteSpace: "pre-wrap",
                  fontFamily: "sans-serif",
                }}
              >
                {extractedText}
              </div>
            </div>
          )}

          {/* Full Image Preview Modal */}
          {selectedPreviewPage && (
            <div style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.85)",
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
              backdropFilter: "blur(6px)",
            }}>
              <div style={{
                background: "#fff",
                borderRadius: 20,
                maxWidth: 550,
                width: "100%",
                maxHeight: "90vh",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
              }}>
                <div style={{
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #e2e8f0",
                }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                      📖 Scanned Page {selectedPreviewPage.pageNumber}
                    </h3>
                    <span style={{ fontSize: 12, color: "#64748b" }}>{selectedPreviewPage.fileName} ({selectedPreviewPage.timestamp})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPreviewPage(null)}
                    style={{
                      border: "none",
                      background: "#f1f5f9",
                      borderRadius: "50%",
                      width: 32,
                      height: 32,
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: 16,
                      color: "#475569",
                    }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ padding: 16, overflowY: "auto", textAlign: "center", background: "#f8fafc" }}>
                  <img
                    src={selectedPreviewPage.dataUrl}
                    alt={`Full Page ${selectedPreviewPage.pageNumber}`}
                    style={{ maxWidth: "100%", maxHeight: "65vh", borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  />
                </div>
                <div style={{ padding: "12px 20px", display: "flex", justifyContent: "flex-end", borderTop: "1px solid #e2e8f0" }}>
                  <button
                    type="button"
                    onClick={() => setSelectedPreviewPage(null)}
                    style={{
                      padding: "10px 20px",
                      borderRadius: 12,
                      background: "#e07a3a",
                      color: "#fff",
                      border: "none",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Close Preview
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* UPLOAD MODE */}
      {mode === "upload" && !capturedImage && (
        <div
          className={`drop-zone`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add("dragging");
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove("dragging");
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("dragging");
            const file = e.dataTransfer.files?.[0];
            if (file && file.type.startsWith("image/")) handleImageUpload(file);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
            }}
          />
          <div className="drop-zone-icon">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#e07a3a"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <div className="drop-zone-title">
            Drop an image here or tap to browse
          </div>
          <div className="drop-zone-subtitle">
            Supports JPG, PNG, WEBP — photos of book pages work best
          </div>
        </div>
      )}

      {/* Status Messages */}
      <div aria-live="polite" className="scanner-status">
        {status === "capturing" && (
          <>
            <span className="spinner-small" />
            Capturing image...
          </>
        )}
        {status === "processing" && (
          <div className="ocr-progress-wrap" style={{ width: "100%" }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
              📝 Reading text from image...
            </div>
            <div className="ocr-progress-track">
              <div
                className="ocr-progress-fill"
                style={{ width: `${ocrProgress}%` }}
              />
            </div>
            <div className="ocr-progress-label">{ocrProgress}% complete</div>
          </div>
        )}
        {status === "error" && !capturedImage && (
          <div className="scanner-error-card" style={{ width: "100%" }}>
            <div className="scanner-error-icon">📵</div>
            <div className="scanner-error-title">
              Oops! Something went wrong
            </div>
            <div className="scanner-error-message">
              {cameraError ||
                FRIENDLY_MESSAGES[languages[0] || "eng"].ocrFailed}
            </div>
            <div className="scanner-error-tips">
              <h4>💡 Quick fixes</h4>
              <ul>
                <li>Check that your browser has camera permission</li>
                <li>Try refreshing the page</li>
                <li>Make sure no other app is using the camera</li>
                <li>Use "Upload Image" mode as an alternative</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* ── UNIFIED RESULTS VIEW (For both camera & upload modes when page is captured) ── */}
      {status === "done" && capturedImage && (
        <div className="scanner-results-container" style={{
          marginTop: 20,
          background: "rgba(255, 255, 255, 0.95)",
          borderRadius: 24,
          padding: "28px 24px",
          border: "1px solid rgba(0, 0, 0, 0.08)",
          boxShadow: "0 15px 35px rgba(0, 0, 0, 0.08)",
          fontFamily: "'Inter', sans-serif"
        }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: "1px solid #f1f5f9", paddingBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#1e293b" }}>
                📸 Page Scanned Successfully
              </h2>
              <span style={{ fontSize: 13, color: "#64748b" }}>Background removed. Review extracted contents.</span>
            </div>
            {docId && (
              <div style={{ background: "#f0fdf4", color: "#16a34a", padding: "4px 12px", borderRadius: 12, fontSize: 12, fontWeight: 700, border: "1px solid #bbf7d0" }}>
                Stored in MongoDB
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 24, alignItems: "start" }}>
            {/* Left side: Cropped image with background removed */}
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 10px 0", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cropped Photograph</p>
              <div style={{
                borderRadius: 16,
                overflow: "hidden",
                boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
                border: "2px solid #e2e8f0",
                display: "inline-block",
                maxWidth: "100%",
                background: "#f8fafc"
              }}>
                <img
                  src={capturedImage}
                  alt="Captured page cropped"
                  style={{ maxWidth: "100%", maxHeight: "350px", display: "block" }}
                />
              </div>
            </div>

            {/* Right side: OCR extraction and structured objects */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Extracted Text Area */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Extracted Text (Editable)</label>
                  {isAnalyzingText && <span style={{ fontSize: 12, color: "#2563eb", fontWeight: 600 }} className="pulse-text">🔮 AI OCR Running...</span>}
                </div>
                {isAnalyzingText ? (
                  <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", flexDirection: "column", gap: 12 }}>
                    <span className="spinner-small" />
                    <span style={{ fontSize: 13, color: "#64748b" }}>AI Agent is reading the page...</span>
                  </div>
                ) : (
                  <textarea
                    style={{
                      width: "100%",
                      height: 140,
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid #cbd5e1",
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: "#334155",
                      resize: "vertical",
                      fontFamily: "sans-serif"
                    }}
                    value={extractedText}
                    onChange={(e) => setExtractedText(e.target.value)}
                    placeholder="Extracted text will appear here..."
                  />
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => speak(extractedText, { force: true })}
                  disabled={!extractedText || isAnalyzingText}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: "#eff6ff",
                    color: "#2563eb",
                    border: "1px solid #bfdbfe",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6
                  }}
                >
                  🔊 Listen (TTS)
                </button>
                <button
                  type="button"
                  onClick={handleConvertToObjects}
                  disabled={!extractedText || isAnalyzingText || isConvertingObjects}
                  style={{
                    flex: 1.5,
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                    color: "#fff",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    boxShadow: "0 4px 12px rgba(124, 58, 237, 0.25)"
                  }}
                >
                  {isConvertingObjects ? "⚡ Parsing..." : "🔮 Convert to Objects"}
                </button>
              </div>

              {/* Structured Objects Table */}
              {isConvertingObjects && (
                <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", flexDirection: "column", gap: 10 }}>
                  <span className="spinner-small" />
                  <span style={{ fontSize: 13, color: "#64748b" }}>Gemini is structuring vocabulary, terms and entities...</span>
                </div>
              )}

              {structuredObjects && structuredObjects.length > 0 && (
                <div className="fade-in" style={{ marginTop: 8 }}>
                  <p style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>⚡ Extracted Structured Objects ({structuredObjects.length})</p>
                  <div style={{
                    maxHeight: 200,
                    overflowY: "auto",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc"
                  }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "#cbd5e1", color: "#1e293b", fontWeight: 700 }}>
                          <th style={{ padding: "8px 12px", borderBottom: "1px solid #94a3b8" }}>Name/Term</th>
                          <th style={{ padding: "8px 12px", borderBottom: "1px solid #94a3b8" }}>Description</th>
                          <th style={{ padding: "8px 12px", borderBottom: "1px solid #94a3b8" }}>Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {structuredObjects.map((obj, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #e2e8f0", background: i % 2 === 0 ? "#ffffff" : "#f1f5f9" }}>
                            <td style={{ padding: "8px 12px", fontWeight: 600, color: "#0f172a" }}>{obj.name}</td>
                            <td style={{ padding: "8px 12px", color: "#334155" }}>{obj.description}</td>
                            <td style={{ padding: "8px 12px" }}>
                              <span style={{
                                padding: "2px 8px",
                                borderRadius: 8,
                                fontSize: 11,
                                fontWeight: 700,
                                background: obj.category.toLowerCase() === "character" ? "#dbeafe" : obj.category.toLowerCase() === "vocabulary" ? "#fef3c7" : "#dcfce7",
                                color: obj.category.toLowerCase() === "character" ? "#1e40af" : obj.category.toLowerCase() === "vocabulary" ? "#92400e" : "#166534"
                              }}>{obj.category}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Results Actions */}
          <div style={{ display: "flex", gap: 12, marginTop: 28, borderTop: "1px solid #f1f5f9", paddingTop: 20 }}>
            <button
              type="button"
              className="scanner-btn-primary"
              style={{ flex: 1, padding: "14px 20px", fontSize: 14, borderRadius: 12 }}
              onClick={(e) => {
                e.preventDefault();
                setCapturedImage(null);
                setExtractedText("");
                setStructuredObjects(null);
                setOcrProgress(0);
                setDocId("");
                if (mode === "camera") {
                  startCamera();
                } else {
                  setStatus("idle");
                }
              }}
            >
              🔄 Scan Next Page
            </button>
            <button
              type="button"
              className="btn-orange"
              style={{ flex: 1.2, padding: "14px 20px", fontSize: 14, borderRadius: 12, fontWeight: 700 }}
              onClick={(e) => {
                e.preventDefault();
                const pages = scannedPagesList;
                if (pages.length === 0 && capturedImage) {
                  const safeTitle = (bookTitle || "book")
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9_-]/g, "_")
                    .replace(/_+/g, "_");
                  pages.push({
                    pageNumber: pageCount,
                    pageTitle: `${bookTitle || "Book"} - Page ${pageCount}`,
                    dataUrl: capturedImage,
                    fileName: `${safeTitle}_page${pageCount}.webp`
                  });
                }
                if (onCompleteScan) {
                  onCompleteScan(pages);
                }
              }}
            >
              💾 Save & Finish Scan
            </button>
          </div>
        </div>
      )}

      {/* Structured objects conversion handler */}
      {(() => {
        window.handleConvertToObjects = handleConvertToObjects;
      })()}
    </div>
  );
}
