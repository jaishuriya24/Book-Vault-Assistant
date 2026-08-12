// src/services/elevenLabsTTS.js
/**
 * ElevenLabs TTS frontend helper.
 * Calls the FastAPI /api/tts endpoint, streams the returned MP3 audio,
 * and falls back to the browser's native SpeechSynthesis when the request fails.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

/**
 * Speak text using ElevenLabs.
 * @param {string} text - Text to synthesize.
 * @param {string} language - "en" or "ta" (defaults to "en").
 * @returns {Promise<void>} Resolves when playback ends.
 */
export async function speakElevenLabs(text, language = "en") {
  try {
    const response = await fetch(`${API_BASE}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language }),
    });

    if (!response.ok) throw new Error(`TTS request failed: ${response.status}`);

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    return new Promise((resolve) => {
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      audio.play();
    });
  } catch (err) {
    console.warn("ElevenLabs TTS error – falling back to browser voice:", err);
    return speakBrowserFallback(text, language);
  }
}

/**
 * Fallback using the built‑in SpeechSynthesis API.
 * @param {string} text
 * @param {string} language
 */
function speakBrowserFallback(text, language = "en") {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window && window.speechSynthesis)) {
      resolve();
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = language === "ta" ? "ta-IN" : "en-US";
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    window.speechSynthesis.speak(utter);
  });
}

/**
 * Language codes for SpeechRecognition (used elsewhere).
 */
export const RECOGNITION_LANG_CODES = {
  en: "en-US",
  ta: "ta-IN",
};
