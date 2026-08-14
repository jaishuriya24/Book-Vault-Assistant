import { useState, useEffect, useCallback } from "react";
import notify from "../services/notificationService";

const DEFAULT_SETTINGS = {
  // Voice & Audio Settings
  voiceAnnouncements: true,
  speechRate: 1.0,
  speechPitch: 1.0,
  selectedVoice: "",
  mascotEnabled: true,
  mascotLanguage: "eng", // 'eng' | 'tam' | 'hin'
  audioBeeps: true,

  // Voice Commands
  voiceControlEnabled: false,
  microphoneSensitivity: "normal", // 'low' | 'normal' | 'high'

  // Account & Biometrics
  faceQuickLogin: true,

  // Camera & Scanner (Blind Assist)
  autoCapture: true,
  autoCaptureDelay: 2.0, // seconds
  hapticFeedback: true,
  spokenFramingAssist: true,
  defaultCameraDevice: "user", // 'user' (front) | 'environment' (back)

  // Reading & Visual Accessibility
  highContrast: false,
  colorTheme: "dark", // 'dark' | 'oled' | 'sepia' | 'cream' | 'white' | 'yellow-black'
  fontSize: 18, // px
  fontFamily: "Inter, sans-serif",
  dyslexicFont: false,
  ttsHighlight: true,

  // System & General
  defaultScreen: "/library",
  appLanguage: "en",
};

export function useSettings(activeUser = "Guest") {
  const storageKey = `bookvault_user_settings_${activeUser || "Guest"}`;

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn("Failed to load settings from localStorage:", e);
    }
    return DEFAULT_SETTINGS;
  });

  // Save settings whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch (e) {
      console.warn("Failed to save settings to localStorage:", e);
    }
  }, [settings, storageKey]);

  // Helper to speak audio announcements for blind users
  const speakAnnouncement = useCallback(
    (text, force = false) => {
      if ((settings.voiceAnnouncements || force) && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel(); // Stop current speech so new setting announcement is immediate
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = settings.speechRate || 1.0;
          utterance.pitch = settings.speechPitch || 1.0;

          // Apply selected voice if available
          if (settings.selectedVoice) {
            const voices = window.speechSynthesis.getVoices();
            const voiceObj = voices.find((v) => v.name === settings.selectedVoice);
            if (voiceObj) utterance.voice = voiceObj;
          }

          window.speechSynthesis.speak(utterance);
        } catch (e) {
          console.warn("Speech synthesis error:", e);
        }
      }
    },
    [settings.voiceAnnouncements, settings.speechRate, settings.speechPitch, settings.selectedVoice]
  );

  // Update a single setting field with optional vocal confirmation
  const updateSetting = useCallback(
    (key, value, announceText = null) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        return next;
      });

      if (settings.audioBeeps) {
        notify.playChime("info");
      }

      if (announceText) {
        speakAnnouncement(announceText);
      }
    },
    [settings.audioBeeps, speakAnnouncement]
  );

  // Reset all settings to defaults
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    notify.success("All settings have been reset to factory defaults.");
    speakAnnouncement("All settings have been reset to factory defaults.", true);
  }, [speakAnnouncement]);

  return {
    settings,
    updateSetting,
    resetSettings,
    speakAnnouncement,
  };
}

export default useSettings;
