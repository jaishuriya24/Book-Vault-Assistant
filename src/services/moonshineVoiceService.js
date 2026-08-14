/**
 * Moonshine Voice JS Service for Book Vault
 * Real-time, on-device Speech-to-Text via @moonshine-ai/moonshine-js
 */
import * as Moonshine from '@moonshine-ai/moonshine-js';

let transcriberInstance = null;
let isInitializing = false;

/**
 * Start real-time microphone voice recognition with MoonshineJS engine.
 * @param {Function} onCommittedCallback - Callback when an utterance is finalized (committed).
 * @param {Function} onUpdatedCallback - Optional callback for live partial transcript updates.
 */
export async function startVoiceRecognition(onCommittedCallback, onUpdatedCallback) {
  if (transcriberInstance) {
    return transcriberInstance;
  }
  if (isInitializing) return null;

  isInitializing = true;
  console.log("🎙️ [VOICE] microphone initializing with MoonshineJS...");

  try {
    const transcriber = new Moonshine.MicrophoneTranscriber(
      "model/tiny",
      {
        onTranscriptionCommitted(text) {
          if (text && typeof text === 'string' && text.trim()) {
            const finalUtterance = text.trim();
            console.log("[VOICE][STT][COMMITTED]", JSON.stringify(finalUtterance));
            if (onCommittedCallback) {
              onCommittedCallback(finalUtterance);
            }
          }
        },
        onTranscriptionUpdated(text) {
          if (text && typeof text === 'string' && text.trim() && onUpdatedCallback) {
            onUpdatedCallback(text.trim());
          }
        }
      },
      false
    );

    await transcriber.start();
    transcriberInstance = transcriber;
    isInitializing = false;
    console.log("🎙️ [VOICE] microphone started");
    return transcriber;
  } catch (err) {
    console.warn("🎙️ [VOICE] MoonshineJS initialization failed, using Web Speech API fallback:", err.message);
    isInitializing = false;
    return null;
  }
}

/**
 * Backwards compatible alias for startVoiceRecognition
 */
export async function startMoonshineListening(onLineCallback, onTextCallback) {
  return startVoiceRecognition(onLineCallback, onTextCallback);
}

/**
 * Stop active voice recognition instance and clean up resources.
 */
export function stopVoiceRecognition() {
  if (transcriberInstance) {
    try {
      if (typeof transcriberInstance.stop === 'function') {
        transcriberInstance.stop();
      }
    } catch (e) {
      console.warn("Error stopping Moonshine transcriber:", e.message || e);
    }
    transcriberInstance = null;
    console.log("🎙️ [VOICE] microphone stopped");
  }
}

/**
 * Backwards compatible alias for stopMoonshineListening
 */
export function stopMoonshineListening() {
  stopVoiceRecognition();
}

