// src/utils/languageDetect.js
//
// Decides which language Book Vault should REPLY in, based on what the
// user said. We don't try to do full language identification — we only
// need a 3-way decision: 'ta' (Tamil script), 'tanglish' (Tamil words
// typed/spoken in English letters), or 'en' (English).
//
// Rule of thumb used across the app:
//   - Tamil unicode present            -> 'ta'
//   - No Tamil unicode, but Tanglish
//     keywords present                 -> 'tanglish' (reply in Tamil,
//                                          since that's what the user is
//                                          actually speaking, just
//                                          romanized)
//   - Otherwise                        -> 'en'

// Tamil unicode block: U+0B80–U+0BFF
const TAMIL_UNICODE_RE = /[\u0B80-\u0BFF]/;

// A small, extensible list of common Tanglish tokens seen in everyday
// spoken Tamil-in-English-letters. This is intentionally short — extend
// it as you collect real transcripts from users.
const TANGLISH_KEYWORDS = [
  "enna", "epadi", "eppadi", "vanakkam", "nalla", "illa", "irukku",
  "venum", "vendam", "poidalam", "podunga", "sollunga", "peru", "pேru",
  "puthagam", "puthakam", "padikanum", "padikkanum", "thiruppi",
  "nிறுthu", "nிறutu", "nிறthu", "nikkirthu", "seri", "romba",
  "ungaluku", "eppo", "yaaru", "enge", "yenna", "sari", "okay pannunga",
  "login pannunga", "register pannunga", "moodunga", "thirakkunga",
];

/**
 * Detect which language the assistant should reply in.
 * @param {string} text - raw transcript from speech recognition
 * @returns {'ta' | 'tanglish' | 'en'}
 */
export function detectReplyLanguage(text) {
  if (!text || typeof text !== "string") return "en";

  if (TAMIL_UNICODE_RE.test(text)) return "ta";

  const lower = text.toLowerCase();
  const hasTanglish = TANGLISH_KEYWORDS.some((kw) => lower.includes(kw));
  if (hasTanglish) return "tanglish";

  return "en";
}

/**
 * Collapse 'tanglish' into 'ta' for the purposes of choosing a TTS voice
 * and NLU reply language — Tanglish input still gets a Tamil voice reply,
 * since that's the language the user is actually communicating in.
 */
export function toSpeechLang(replyLanguage) {
  return replyLanguage === "en" ? "en-IN" : "ta-IN";
}

export default { detectReplyLanguage, toSpeechLang };
