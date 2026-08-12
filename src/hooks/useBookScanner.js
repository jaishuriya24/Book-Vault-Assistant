import { useState, useRef, useCallback, useEffect } from "react";
import { isImageBlurry } from "../utils/blurDetection";
import { extractText } from "../services/ocrService";

const speak = (text, { lang = "en-US" } = {}) => {
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

const askAndListen = (prompt, { lang = "ta-IN" } = {}) => {
  return new Promise((resolve, reject) => {
    const begin = async () => {
      if (prompt) await speak(prompt, { lang: "ta-IN" });

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        reject(new Error("Speech recognition not supported"));
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (e) => resolve(e.results[0][0].transcript.trim());
      recognition.onerror = (e) => reject(new Error(e.error));
      recognition.start();
    };
    begin();
  });
};

const YES_WORDS = ["yes", "aama", "sari", "seri", "ok", "okay", "haan"];
const NO_WORDS = ["no", "illa", "vendaam", "wait", "stop"];
const parseYesNo = (text) => {
  const t = text.toLowerCase();
  if (YES_WORDS.some((w) => t.includes(w))) return true;
  if (NO_WORDS.some((w) => t.includes(w))) return false;
  return null;
};

export function useBookScanner({ onSave }) {
  const [step, setStep] = useState("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const fileInputRef = useRef(null);
  const retryCount = useRef(0);
  const scannedText = useRef("");

  const startScan = useCallback(async () => {
    setStep("confirming");
    retryCount.current = 0;
    try {
      const response = await askAndListen("Book scan panna virumburingala? Yes or No sollu.", { lang: "ta-IN" });
      const isYes = parseYesNo(response);
      if (isYes === true || response.toLowerCase().includes("scan")) {
        await speak("Sari, camera thirakkirathu. Book-a nillaiya pidi.");
        if (fileInputRef.current) fileInputRef.current.click();
      } else {
        await speak("Scan cancel panniyachu.");
        setStep("idle");
      }
    } catch (e) {
      
      await speak("Camera thirakkirathu. Book-a nillaiya pidi.");
      if (fileInputRef.current) fileInputRef.current.click();
    }
  }, []);

  useEffect(() => {
    const handleStartScanEvent = () => {
      startScan();
    };
    window.addEventListener("start-book-scan", handleStartScanEvent);
    return () => {
      window.removeEventListener("start-book-scan", handleStartScanEvent);
    };
  }, [startScan]);

  const onFileInputChange = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      await speak("Scan cancel panniyachu.");
      setStep("idle");
      return;
    }

    setStep("analyzing");
    setStatusMessage("Padam analyze pandren...");
    await speak("Padam analyze pandren...");

    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = async () => {
      const { blurry, variance } = isImageBlurry(img, 25);
      console.log(`Blur variance: ${variance.toFixed(2)}`);

      if (blurry) {
        if (retryCount.current < 3) {
          retryCount.current++;
          await speak("Padam konjam mangala irukku. Asaikkama marubadiyum try pannu.");
          if (fileInputRef.current) fileInputRef.current.click();
        } else {
          await speak("Mondru thadava try panniyum theliva illai. Velichatha athigappaduthi appuram try pannu.");
          setStep("idle");
        }
        return;
      }

      setStep("ocr");
      setStatusMessage("Ezhutha edukkuren...");
      await speak("Padam theliva irukku. Ezhutha edukkuren. Konjam wait pannu...");

      try {
        const text = await extractText(img.src);
        if (!text) {
          await speak("Intha page la ezhuthu edhuvum illai.");
          setStep("idle");
          return;
        }

        scannedText.current = text;
        
        setStep("askingTitle");
        try {
          const titleResp = await askAndListen("Ezhutha eduthachu! Intha book-ku oru title sollu.");
          const title = titleResp || "Scanned Book";
          
          if (onSave) onSave({ title, text, id: Date.now().toString() });
          await speak(`${title} save panniyachu! Naan padikkiren. ${text}`);
          setStep("idle");
        } catch(e) {
          if (onSave) onSave({ title: "Scanned Book", text, id: Date.now().toString() });
          await speak(`Save panniyachu! Naan padikkiren. ${text}`);
          setStep("idle");
        }
      } catch (err) {
        console.error("OCR Error:", err);
        await speak("Ezhutha padikkum pothu problem. Appuram try pannu.");
        setStep("idle");
      }
    };
  };

  return { step, statusMessage, startScan, fileInputRef, onFileInputChange };
}
