/**
 * nlpService.js — Multilingual Navigation + Language Detection
 * =============================================================
 * Calls /api/parse-intent (Gemini 1.5 Flash on server.js) and returns
 * a structured result with language, intent, navigation target, and
 * a natural-language response in the user's own language.
 *
 * Usage:
 *   import { parseIntent, executeIntent } from '../services/nlpService';
 *
 *   const result = await parseIntent("library திற");
 *   // { language:"ta-IN", intent:"navigate", navigate:"library", ... }
 *
 *   executeIntent(result, navigate);   // auto-navigates using react-router
 */

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

// ── Route map: intent "navigate" value → react-router-dom path ─────────────
const ROUTE_MAP = {
  library:  '/library',
  scanner:  '/add-book',
  'add-book': '/add-book',
  profile:  '/profile',
  settings: '/settings',
  signin:   '/signin',
  signup:   '/signup',
  search:   '/search',
  reader:   '/reader',        // needs /:id appended separately
  home:     '/library',
  otp:      '/otp',
};

// ── BCP-47 → human label (for UI display / TTS) ────────────────────────────
export const LANG_LABELS = {
  'en-US': 'English',
  'ta-IN': 'Tamil',
  'hi-IN': 'Hindi',
  'te-IN': 'Telugu',
  'ml-IN': 'Malayalam',
  'kn-IN': 'Kannada',
  'bn-IN': 'Bengali',
  'mr-IN': 'Marathi',
  'gu-IN': 'Gujarati',
};

/**
 * parseIntent(userText)
 * ---------------------
 * Sends userText to Gemini via /api/parse-intent.
 * Returns a normalized intent object — never throws.
 *
 * @param {string} userText — raw spoken or typed input in any language
 * @returns {Promise<{
 *   language: string,
 *   intent: string,
 *   navigate: string|null,
 *   target: string|null,
 *   confidence: number,
 *   response: string
 * }>}
 */
export async function parseIntent(userText) {
  const FALLBACK = {
    language: 'en-US',
    intent: 'unknown',
    navigate: null,
    target: null,
    confidence: 0,
    response: "Sorry, I didn't understand. Please try again.",
  };

  if (!userText?.trim()) return FALLBACK;

  try {
    const res = await fetch(`${SERVER_URL}/api/parse-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInput: userText }),
    });

    if (!res.ok) {
      console.warn('[nlpService] Server error:', res.status);
      return FALLBACK;
    }

    const data = await res.json();

    return {
      language:   data.language   ?? FALLBACK.language,
      intent:     data.intent     ?? FALLBACK.intent,
      navigate:   data.navigate   ?? null,
      target:     data.target     ?? null,
      confidence: data.confidence ?? 1.0,
      response:   data.response   ?? FALLBACK.response,
    };
  } catch (err) {
    console.error('[nlpService] parseIntent error:', err.message);
    return FALLBACK;
  }
}

/**
 * executeIntent(parsed, navigateFn, handlers)
 * -------------------------------------------
 * Dispatches the parsed intent to the appropriate action.
 * Pass the react-router-dom `navigate` function from useNavigate().
 *
 * @param {object} parsed       — result from parseIntent()
 * @param {function} navigateFn — react-router navigate()
 * @param {object} handlers     — optional callbacks for non-nav intents:
 *   {
 *     onSearchBook(target),
 *     onOpenCamera(),
 *     onCaptureScan(),
 *     onPause(),
 *     onResume(),
 *     onRepeat(),
 *     onNextPage(),
 *     onPrevPage(),
 *     onReadAloud(),
 *     onStopReading(),
 *     onLogout(),
 *     onUnknown(parsed),
 *   }
 * @returns {{ handled: boolean, route: string|null }}
 */
export function executeIntent(parsed, navigateFn, handlers = {}) {
  const { intent, navigate: routeKey, target } = parsed;

  // ── Navigation intents ────────────────────────────────────────────────
  if (intent === 'navigate' && routeKey) {
    const path = ROUTE_MAP[routeKey] ?? `/${routeKey}`;
    if (navigateFn) navigateFn(path);
    return { handled: true, route: path };
  }

  // ── Non-navigation intents → call handler if provided ─────────────────
  const h = handlers;
  switch (intent) {
    case 'search_book':   h.onSearchBook?.(target);  break;
    case 'open_camera':   h.onOpenCamera?.();         break;
    case 'capture_scan':  h.onCaptureScan?.();        break;
    case 'pause':         h.onPause?.();              break;
    case 'resume':        h.onResume?.();             break;
    case 'repeat':        h.onRepeat?.();             break;
    case 'next_page':     h.onNextPage?.();           break;
    case 'prev_page':     h.onPrevPage?.();           break;
    case 'read_aloud':    h.onReadAloud?.();          break;
    case 'stop_reading':  h.onStopReading?.();        break;
    case 'logout':        h.onLogout?.();             break;
    default:              h.onUnknown?.(parsed);      break;
  }

  return { handled: intent !== 'unknown', route: null };
}

// ── Legacy compat export (used by SignIn.jsx / old code) ──────────────────
export async function classifyIntent(transcript) {
  const result = await parseIntent(transcript);
  // Map new intent names back to old "action" shape so existing callers don't break
  const ACTION_MAP = {
    search_book:  'search_book',
    open_camera:  'open_camera',
    capture_scan: 'capture_scan',
    pause:        'pause',
    resume:       'resume',
    repeat:       'repeat',
    navigate:     'navigate',
    unknown:      'unknown',
  };
  return {
    intent:   ACTION_MAP[result.intent] ?? 'unknown',
    action:   ACTION_MAP[result.intent] ?? 'unknown',  // old field name
    navigate: result.navigate,
    target:   result.target,
    language: result.language,
    response: result.response,
  };
}

export const NLPService = {
  processVoiceCommand: classifyIntent,
  parseIntent,
  executeIntent,
};

export default NLPService;
