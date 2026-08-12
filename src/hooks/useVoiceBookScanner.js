import { useState, useRef, useCallback } from 'react';

const speak = (text, { lang = "ta-IN" } = {}) => {
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

const BLUR_THRESHOLD = 25; // Laplacian variance threshold for blurry images
const MAX_RETRIES = 3;

export function useVoiceBookScanner(onSave) {
  const [status, setStatus] = useState('idle');
  const [promptText, setPromptText] = useState('');
  const retryCount = useRef(0);
  const fileInputRef = useRef(null);
  const scannedTextRef = useRef('');

  const speakAndSet = (text) => {
    setPromptText(text);
    speak(text);
  };

  const initSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    return recognition;
  };

  const startScan = useCallback(() => {
    setStatus('confirming');
    retryCount.current = 0;
    speakAndSet("Oru book scan panna virumburingala? Yes or No sollu.");
    
    const recognition = initSpeechRecognition();
    if (recognition) {
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        if (transcript.includes('yes') || transcript.includes('aama') || transcript.includes('scan') || transcript.includes('ok')) {
          openCamera();
        } else {
          speakAndSet("Sari, scan cancel panniyachu.");
          setStatus('idle');
        }
      };
      recognition.onerror = () => {
        // Fallback if recognition fails
        openCamera();
      };
      setTimeout(() => {
          try { recognition.start(); } catch(e){}
      }, 3000);
    } else {
      // Fallback if no speech recognition
      setTimeout(() => openCamera(), 2500);
    }
  }, []);

  const openCamera = () => {
    setStatus('capturing');
    speakAndSet("Camera thirakkirathu. Book-a nillaiya pidi.");
    setTimeout(() => {
      if (fileInputRef.current) fileInputRef.current.click();
    }, 2500); // Wait for TTS before opening camera (which might pause JS execution on some mobile browsers)
  };

  const getLaplacianVariance = (imgElement) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Scale down for faster processing and noise reduction
    const scale = Math.min(1, 800 / Math.max(imgElement.width, imgElement.height));
    canvas.width = Math.floor(imgElement.width * scale);
    canvas.height = Math.floor(imgElement.height * scale);
    
    ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    
    const gray = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }

    let lapSum = 0;
    let lapSumSq = 0;
    let count = 0;
    for (let row = 1; row < height - 1; row++) {
      for (let col = 1; col < width - 1; col++) {
        const center = row * width + col;
        const lap = gray[center - width] + gray[center - 1] + gray[center + 1] + gray[center + width] - 4 * gray[center];
        lapSum += lap;
        lapSumSq += lap * lap;
        count++;
      }
    }
    
    if (count === 0) return 0;
    const mean = lapSum / count;
    return (lapSumSq / count) - (mean * mean);
  };

  const processImage = async (file) => {
    setStatus('analyzing');
    speakAndSet("Padam analyze pandren...");
    
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = async () => {
      const variance = getLaplacianVariance(img);
      console.log(`[VoiceBookScanner] Laplacian Variance: ${variance.toFixed(2)} (Threshold: ${BLUR_THRESHOLD})`);
      
      if (variance < BLUR_THRESHOLD) {
        if (retryCount.current < MAX_RETRIES) {
          retryCount.current++;
          speakAndSet("Padam konjam mangala irukku. Asaikkama marubadiyum try pannu.");
          setTimeout(() => {
            if (fileInputRef.current) fileInputRef.current.click();
          }, 3500);
        } else {
          speakAndSet("Mondru thadava try panniyum theliva illai. Velichatha athigappaduthi appuram try pannu.");
          setStatus('idle');
        }
        return;
      }
      
      // Clear image
      speakAndSet("Padam theliva irukku. Ezhutha edukkuren. Konjam wait pannu...");
      
      try {
        const Tesseract = (await import('tesseract.js')).default;
        const worker = await Tesseract.createWorker('eng+tam');
        const { data: { text } } = await worker.recognize(img.src);
        await worker.terminate();
        
        const cleanText = text.trim();
        if (!cleanText) {
          speakAndSet("Intha page la ezhuthu edhuvum illai.");
          setStatus('idle');
          return;
        }
        
        scannedTextRef.current = cleanText;
        askForTitle();
      } catch (err) {
        console.error("OCR Error:", err);
        speakAndSet("Ezhutha padikkum pothu problem. Appuram try pannu.");
        setStatus('idle');
      }
    };
  };

  const askForTitle = () => {
    setStatus('askingTitle');
    speakAndSet("Ezhutha eduthachu! Intha book-ku oru title sollu.");
    
    const recognition = initSpeechRecognition();
    if (recognition) {
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        saveAndRead(transcript);
      };
      recognition.onerror = () => {
        saveAndRead("Scanned Book");
      };
      setTimeout(() => {
          try { recognition.start(); } catch(e){}
      }, 3500); // Wait for TTS to finish before listening
    } else {
      setTimeout(() => saveAndRead("Scanned Book"), 3500);
    }
  };

  const saveAndRead = (title) => {
    setStatus('saving');
    const text = scannedTextRef.current;
    
    if (onSave) {
      onSave({ title, text, id: Date.now().toString() });
    }
    
    speakAndSet(`${title} save panniyachu! Naan padikkiren... ${text}`);
    setStatus('idle');
  };

  const onFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) {
      // User cancelled camera
      speakAndSet("Scan cancel panniyachu.");
      setStatus('idle');
      return;
    }
    processImage(file);
  };

  const cancelScan = () => {
    speakAndSet("Scan cancel panniyachu.");
    setStatus('idle');
  };

  return {
    startScan,
    cancelScan,
    onFileSelect,
    status,
    promptText,
    fileInputRef
  };
}
