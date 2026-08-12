// src/voice/authPrompts.js
// Prompt strings for Kutty's voice-driven login/register flow.
// Follows the same language set already used in ReadEase's book-reading flow.

export const AUTH_LANGS = {
  en: { code: "en-IN", label: "English" },
  hi: { code: "hi-IN", label: "Hindi" },
  ta: { code: "ta-IN", label: "Tamil" },
  te: { code: "te-IN", label: "Telugu" },
  kn: { code: "kn-IN", label: "Kannada" },
  ml: { code: "ml-IN", label: "Malayalam" },
  bn: { code: "bn-IN", label: "Bengali" },
  mr: { code: "mr-IN", label: "Marathi" },
};

export const AUTH_PROMPTS = {
  en: {
    greeting: "Hi, I'm Kutty. Would you like to login or register? Just say login or register.",
    askUsername: "Please say your username, letter by letter or as one word.",
    confirmUsername: (u) => `I heard ${u}. Say yes to confirm, or say repeat to try again.`,
    askPin: "Please say your 4 digit PIN, one digit at a time.",
    confirmPin: (p) => `Your PIN is ${p.length} digits. Say yes to confirm, or say repeat to try again.`,
    submitting: "One moment, checking your details.",
    success: "You're logged in. Welcome back!",
    registerSuccess: "Your account is created and you're logged in.",
    failure: "That didn't work. Let's try again from the start.",
    noSpeechHeard: "I didn't catch that. Please say it again.",
    switchLangHint: "Say the name of your language to switch, for example, Tamil.",
  },
  ta: {
    greeting: "வணக்கம், நான் குட்டி. உள்நுழைய வேண்டுமா அல்லது பதிவு செய்ய வேண்டுமா? லாகின் அல்லது ரெஜிஸ்டர் என்று சொல்லுங்கள்.",
    askUsername: "உங்கள் யூசர்நேமை சொல்லுங்கள்.",
    confirmUsername: (u) => `${u} என்று கேட்டேன். சரி எனில் ஆம் என்று சொல்லுங்கள், இல்லை எனில் மீண்டும் என்று சொல்லுங்கள்.`,
    askPin: "உங்கள் 4 இலக்க பின் எண்ணை ஒவ்வொரு இலக்கமாக சொல்லுங்கள்.",
    confirmPin: (p) => `${p.length} இலக்கங்கள் கேட்டேன். சரி எனில் ஆம், இல்லை எனில் மீண்டும் என்று சொல்லுங்கள்.`,
    submitting: "ஒரு நிமிடம், சரிபார்க்கிறேன்.",
    success: "நீங்கள் உள்நுழைந்துவிட்டீர்கள். வரவேற்கிறேன்!",
    registerSuccess: "உங்கள் கணக்கு உருவாக்கப்பட்டு உள்நுழைந்துவிட்டீர்கள்.",
    failure: "அது வேலை செய்யவில்லை. மீண்டும் முயற்சிக்கலாம்.",
    noSpeechHeard: "எனக்கு கேட்கவில்லை. மீண்டும் சொல்லுங்கள்.",
    switchLangHint: "மொழியை மாற்ற, மொழியின் பெயரை சொல்லுங்கள்.",
  },
  // TODO: fill in hi / te / kn / ml / bn / mr the same shape as en/ta above
  // (kept short here — copy the `en` block and translate each string)
};

// Fallback for non-implemented languages to keep them from breaking
AUTH_PROMPTS.hi = AUTH_PROMPTS.en;
AUTH_PROMPTS.te = AUTH_PROMPTS.en;
AUTH_PROMPTS.kn = AUTH_PROMPTS.en;
AUTH_PROMPTS.ml = AUTH_PROMPTS.en;
AUTH_PROMPTS.bn = AUTH_PROMPTS.en;
AUTH_PROMPTS.mr = AUTH_PROMPTS.en;

export function getPrompts(langKey) {
  return AUTH_PROMPTS[langKey] || AUTH_PROMPTS.en;
}
