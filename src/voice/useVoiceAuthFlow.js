import { useCallback, useEffect, useRef, useState } from "react";
import { getPrompts, AUTH_LANGS } from "./authPrompts";

export const AUTH_STATE = {
  IDLE: "IDLE",
  GREETING: "GREETING",
  AWAITING_CHOICE: "AWAITING_CHOICE",       // login or register
  LISTENING_USERNAME: "LISTENING_USERNAME",
  CONFIRM_USERNAME: "CONFIRM_USERNAME",
  LISTENING_PIN: "LISTENING_PIN",
  CONFIRM_PIN: "CONFIRM_PIN",
  SUBMITTING: "SUBMITTING",
  SUCCESS: "SUCCESS",
  FAILURE: "FAILURE",
};

// digit words -> numerals, so "one two three four" -> "1234"
const DIGIT_WORDS = {
  zero: "0", one: "1", two: "2", three: "3", four: "4",
  five: "5", six: "6", seven: "7", eight: "8", nine: "9",
};

function extractDigits(transcript) {
  const tokens = transcript.toLowerCase().trim().split(/\s+/);
  return tokens
    .map((t) => (DIGIT_WORDS[t] !== undefined ? DIGIT_WORDS[t] : t.replace(/\D/g, "")))
    .join("")
    .slice(0, 6); // hard cap, PIN shouldn't run long
}

/**
 * @param {object} opts
 * @param {(username: string, pin: string) => Promise<{ok: boolean, error?: string}>} opts.onLogin
 * @param {(username: string, pin: string) => Promise<{ok: boolean, error?: string}>} opts.onRegister
 * @param {string} opts.langKey - one of AUTH_LANGS keys, e.g. "en", "ta"
 */
export function useVoiceAuthFlow({ onLogin, onRegister, langKey = "en" }) {
  const [state, setState] = useState(AUTH_STATE.IDLE);
  const [mode, setMode] = useState(null); // "login" | "register"
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState(null);

  const recognitionRef = useRef(null);
  const prompts = getPrompts(langKey);
  const langCode = (AUTH_LANGS[langKey] || AUTH_LANGS.en).code;

  const speak = useCallback((text) => {
    return new Promise((resolve) => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = langCode;
      utter.onend = resolve;
      utter.onerror = resolve;
      window.speechSynthesis.speak(utter);
    });
  }, [langCode]);

  const listenOnce = useCallback(() => {
    return new Promise((resolve) => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        resolve({ ok: false, transcript: "" });
        return;
      }
      const recog = new SR();
      recognitionRef.current = recog;
      recog.lang = langCode;
      recog.maxAlternatives = 1;
      recog.interimResults = false;

      recog.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        resolve({ ok: true, transcript });
      };
      recog.onerror = () => resolve({ ok: false, transcript: "" });
      recog.onspeechend = () => recog.stop();
      recog.start();
    });
  }, [langCode]);

  // Main driver — call this to kick off the whole flow
  const startFlow = useCallback(async () => {
    setErrorMsg(null);
    setState(AUTH_STATE.GREETING);
    await speak(prompts.greeting);

    setState(AUTH_STATE.AWAITING_CHOICE);
    const { transcript: choiceRaw } = await listenOnce();
    const choice = choiceRaw.toLowerCase();
    const chosenMode = choice.includes("register") ? "register" : "login";
    setMode(chosenMode);

    setState(AUTH_STATE.LISTENING_USERNAME);
    await speak(prompts.askUsername);
    const { transcript: userRaw } = await listenOnce();
    const cleanUsername = userRaw.trim();
    setUsername(cleanUsername);

    setState(AUTH_STATE.CONFIRM_USERNAME);
    await speak(prompts.confirmUsername(cleanUsername));
    const { transcript: confirmU } = await listenOnce();
    if (!confirmU.toLowerCase().includes("yes") && !confirmU.includes("आम") && !confirmU.includes("aama")) {
      setState(AUTH_STATE.FAILURE);
      setErrorMsg("username not confirmed");
      await speak(prompts.failure);
      return;
    }

    setState(AUTH_STATE.LISTENING_PIN);
    await speak(prompts.askPin);
    const { transcript: pinRaw } = await listenOnce();
    const cleanPin = extractDigits(pinRaw);
    setPin(cleanPin);

    setState(AUTH_STATE.CONFIRM_PIN);
    await speak(prompts.confirmPin(cleanPin));
    const { transcript: confirmP } = await listenOnce();
    if (!confirmP.toLowerCase().includes("yes") && !confirmP.includes("आम") && !confirmP.includes("aama")) {
      setState(AUTH_STATE.FAILURE);
      setErrorMsg("pin not confirmed");
      await speak(prompts.failure);
      return;
    }

    setState(AUTH_STATE.SUBMITTING);
    await speak(prompts.submitting);

    const action = chosenMode === "register" ? onRegister : onLogin;
    const result = await action(cleanUsername, cleanPin);

    if (result?.ok) {
      setState(AUTH_STATE.SUCCESS);
      await speak(chosenMode === "register" ? prompts.registerSuccess : prompts.success);
    } else {
      setState(AUTH_STATE.FAILURE);
      setErrorMsg(result?.error || "unknown error");
      await speak(prompts.failure);
    }
  }, [speak, listenOnce, onLogin, onRegister, prompts]);

  // Auto-greet as soon as the auth page mounts — no wake word needed here
  useEffect(() => {
    startFlow();
    return () => {
      window.speechSynthesis.cancel();
      recognitionRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, mode, username, pin, errorMsg, restart: startFlow };
}
