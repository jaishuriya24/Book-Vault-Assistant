/**
 * Voice Command Service for Book Vault
 * Priority 1: Client-Side Deterministic Command Router
 * Priority 2: Ollama LLM (qwen3.5:0.8b) Fallback for General Conversation
 */

const API_BASE = import.meta.env.VITE_SPRING_BOOT_API_URL || 'http://localhost:8082';

const ALLOWED_ACTIONS = new Set([
  'CONVERSATION',
  'TYPE_TEXT',
  'NAVIGATE',
  'OPEN_FACELOGIN',
  'OPEN_SIGNUP',
  'OPEN_SIGNIN',
  'SET_FORM_FIELD',
  'SUBMIT_SIGNUP',
  'SUBMIT_LOGIN',
  'OTP_SUBMIT',
  'LIST_BOOKS',
  'OPEN_LATEST_BOOK',
  'CONTINUE_READING',
  'NEXT_PAGE',
  'PREVIOUS_PAGE',
  'READ_PAGE',
  'PAUSE_READING',
  'PAGE_SUMMARY',
  'SEARCH_BOOK',
  'OPEN_BOOK',
  'BOOKMARK_PAGE',
  'SCAN_PAGE',
  'OPEN_LIBRARY',
  'OPEN_SETTINGS',
  'SET_VOICE_SPEED',
  'OPEN_PROFILE',
  'CLOSE_MODAL',
  'CANCEL',
  'STOP',
  'HELP',
  'UNKNOWN'
]);

/**
 * Client-Side Deterministic Command Router.
 * Matches spoken voice commands instantly without sending to Ollama LLM.
 * Returns { matched: true, action, query, payload, target, ... } if matched, or { matched: false } if unknown.
 */
export function matchDeterministicCommand(transcript, appContext = {}) {
  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    return { matched: false };
  }

  const rawTranscript = transcript.trim();
  const lower = rawTranscript.toLowerCase();

  console.log("[VOICE][ROUTER][INPUT]", JSON.stringify(rawTranscript));

  // Ignore self-echo of assistant's own TTS output
  if (lower.includes('guide you through') || lower.includes('book wallet') || lower.includes('what would you like to do') || lower.includes('how can i help you') || lower.includes('didn\'t quite understand')) {
    const res = { matched: true, action: 'CONVERSATION', query: '', target: '', field: '', value: '', feedbackTts: '', _source: 'Rule Fallback', valid: true };
    console.log("[VOICE][ROUTER][RESULT]", res);
    return res;
  }

  // ── 0. GREETINGS & CASUAL INTENTS (Deterministic Match) ──
  if (/^(?:hello|hi|hey|hello there|hi there|hey there|greetings|doraemon)$/i.test(lower) || lower.startsWith('hello ') || lower.startsWith('hi ') || lower.startsWith('hey ')) {
    const res = {
      matched: true,
      action: 'CONVERSATION',
      query: '',
      target: '',
      field: '',
      value: '',
      feedbackTts: "Hello! I'm Doraemon. I'm here to help you read and manage your books. What would you like to do?",
      _source: 'Deterministic Router',
      valid: true
    };
    console.log("[VOICE][ROUTER][RESULT]", res);
    return res;
  }

  if (lower.includes('who are you') || lower.includes('what is your name') || lower.includes('whats your name')) {
    const res = {
      matched: true,
      action: 'CONVERSATION',
      query: '',
      target: '',
      field: '',
      value: '',
      feedbackTts: "I'm Doraemon, your Book Vault AI assistant! I can help you read books, fill forms, turn pages, scan new pages, and explore your library.",
      _source: 'Deterministic Router',
      valid: true
    };
    console.log("[VOICE][ROUTER][RESULT]", res);
    return res;
  }

  if (lower.includes('how are you')) {
    const res = {
      matched: true,
      action: 'CONVERSATION',
      query: '',
      target: '',
      field: '',
      value: '',
      feedbackTts: "I'm doing great! Ready to help you with your books. What would you like to do?",
      _source: 'Deterministic Router',
      valid: true
    };
    console.log("[VOICE][ROUTER][RESULT]", res);
    return res;
  }

  if (lower.includes('what can you do')) {
    const res = {
      matched: true,
      action: 'CONVERSATION',
      query: '',
      target: '',
      field: '',
      value: '',
      feedbackTts: "I can help you navigate Book Vault, search your library, open books, turn pages, read aloud, save bookmarks, scan new pages, and adjust settings.",
      _source: 'Deterministic Router',
      valid: true
    };
    console.log("[VOICE][ROUTER][RESULT]", res);
    return res;
  }

  // ── 0.5. CLOSE / CANCEL / EXIT / STOP COMMANDS ──
  if (
    lower.includes('close') ||
    lower.includes('exit') ||
    lower.includes('cancel') ||
    lower.includes('stop') ||
    lower.includes('dismiss')
  ) {
    const res = {
      matched: true,
      action: 'CLOSE_MODAL',
      query: '',
      target: '',
      field: '',
      value: '',
      feedbackTts: 'Closing.',
      _source: 'Deterministic Router',
      valid: true
    };
    console.log("[VOICE][ROUTER][RESULT]", res);
    return res;
  }

  // ── 1. TYPE_TEXT COMMANDS (Preserving exact payload case) ──
  // Match "type Alex", "type my name alerts", "type Hello World", "enter Alex", "typing Alex"
  const typeMatch = rawTranscript.match(/^\s*(?:type|enter|typing)\s+(.+?)\s*$/i);
  if (typeMatch && typeMatch[1] && !lower.includes('who are') && !lower.includes('what is') && !lower.includes('how are')) {
    let payload = typeMatch[1].trim();
    // Strip redundant leading "my name as" or "my name" if user said "type my name as Alex"
    const namePrefixMatch = payload.match(/^(?:my\s+)?name\s+(?:as|is|to|=|\:)?\s+(.+)$/i);
    if (namePrefixMatch && namePrefixMatch[1]) {
      payload = namePrefixMatch[1].trim();
    }
    const res = {
      matched: true,
      action: 'TYPE_TEXT',
      query: payload,
      target: '',
      field: appContext.pendingField || 'name',
      value: payload,
      feedbackTts: `Typing ${payload}.`,
      _source: 'Deterministic Router',
      valid: true
    };
    console.log("[VOICE][ROUTER][RESULT]", res);
    return res;
  }

  // Match flexible form filling like "set name to Alex" or "fill name Alex"
  const fillMatch = rawTranscript.match(/(?:set|fill|put|make|use)\s+(?:my\s+)?name\s+(?:as|to|is|=|\:)?\s+(.+)/i);
  if (fillMatch && fillMatch[1]) {
    const val = fillMatch[1].trim();
    const res = {
      matched: true,
      action: 'TYPE_TEXT',
      query: val,
      target: '',
      field: 'name',
      value: val,
      feedbackTts: `Setting name to ${val}.`,
      _source: 'Deterministic Router',
      valid: true
    };
    console.log("[VOICE][ROUTER][RESULT]", res);
    return res;
  }

  // ── 2. OPEN BOOK COMMANDS ──
  if (lower === 'open my book' || lower === 'open book' || lower === 'open a book' || lower.startsWith('open book ')) {
    const bookTitleQuery = lower.startsWith('open book ') ? rawTranscript.substring(10).trim() : '';
    const res = {
      matched: true,
      action: 'OPEN_BOOK',
      query: bookTitleQuery,
      target: 'reader',
      feedbackTts: 'Opening book.',
      _source: 'Deterministic Router',
      valid: true
    };
    console.log("[VOICE][ROUTER][RESULT]", res);
    return res;
  }

  // ── 3. READ BOOK COMMANDS ──
  if (lower === 'read this book' || lower === 'read book' || lower === 'start reading' || lower === 'read page' || lower === 'read aloud') {
    const res = {
      matched: true,
      action: 'READ_PAGE',
      query: '',
      target: 'reader',
      feedbackTts: 'Starting reading.',
      _source: 'Deterministic Router',
      valid: true
    };
    console.log("[VOICE][ROUTER][RESULT]", res);
    return res;
  }

  // ── 4. SCAN PAGE / BOOK COMMANDS ──
  if (lower.includes('scan page') || lower.includes('scan book') || lower.includes('scan a book') || lower === 'scan' || lower.includes('help me to scan') || lower.includes('open scanner')) {
    const res = {
      matched: true,
      action: 'SCAN_PAGE',
      query: '',
      target: 'scanner',
      feedbackTts: 'Opening book scanner.',
      _source: 'Deterministic Router',
      valid: true
    };
    console.log("[VOICE][ROUTER][RESULT]", res);
    return res;
  }

  // ── 5. SEARCH LIBRARY COMMANDS ──
  if (lower.includes('search my library') || lower.includes('search library') || lower.startsWith('search for books') || lower.startsWith('search ')) {
    const searchQuery = lower.replace('search my library', '').replace('search library', '').replace('search for books about', '').replace('search', '').trim();
    const res = {
      matched: true,
      action: 'SEARCH_BOOK',
      query: searchQuery,
      target: 'search',
      feedbackTts: searchQuery ? `Searching for ${searchQuery}` : 'Opening search.',
      _source: 'Deterministic Router',
      valid: true
    };
    console.log("[VOICE][ROUTER][RESULT]", res);
    return res;
  }

  // ── 6. SETTINGS COMMANDS ──
  if (lower.includes('change settings') || lower.includes('open settings') || lower === 'settings' || lower.includes('go to settings')) {
    const res = {
      matched: true,
      action: 'OPEN_SETTINGS',
      query: '',
      target: 'settings',
      feedbackTts: 'Opening settings.',
      _source: 'Deterministic Router',
      valid: true
    };
    console.log("[VOICE][ROUTER][RESULT]", res);
    return res;
  }

  // ── 7. OTHER NAVIGATION & READER ACTIONS ──
  if (lower.includes('next page') || lower.includes('turn page')) {
    const res = { matched: true, action: 'NEXT_PAGE', query: '', target: '', feedbackTts: 'Going to the next page.', _source: 'Deterministic Router', valid: true };
    console.log("[VOICE][ROUTER][RESULT]", res);
    return res;
  }
  if (lower.includes('previous page') || lower.includes('prev page')) {
    const res = { matched: true, action: 'PREVIOUS_PAGE', query: '', target: '', feedbackTts: 'Going to previous page.', _source: 'Deterministic Router', valid: true };
    console.log("[VOICE][ROUTER][RESULT]", res);
    return res;
  }
  if (lower.includes('pause') || lower.includes('stop reading')) {
    const res = { matched: true, action: 'PAUSE_READING', query: '', target: '', feedbackTts: 'Reading paused.', _source: 'Deterministic Router', valid: true };
    console.log("[VOICE][ROUTER][RESULT]", res);
    return res;
  }
  if (lower.includes('go back to my library') || lower.includes('open library') || lower.includes('my library') || lower.includes('list my books')) {
    const res = { matched: true, action: 'OPEN_LIBRARY', query: '', target: 'library', feedbackTts: 'Opening library.', _source: 'Deterministic Router', valid: true };
    console.log("[VOICE][ROUTER][RESULT]", res);
    return res;
  }
  if (lower.includes('open latest book') || lower.includes('continue reading')) {
    const res = { matched: true, action: 'OPEN_LATEST_BOOK', query: '', target: 'reader', feedbackTts: 'Opening your latest book.', _source: 'Deterministic Router', valid: true };
    console.log("[VOICE][ROUTER][RESULT]", res);
    return res;
  }
  if (lower.includes('facial login') || lower.includes('face login')) {
    const res = { matched: true, action: 'OPEN_FACELOGIN', query: '', target: 'facelogin', feedbackTts: 'Opening facial login.', _source: 'Deterministic Router', valid: true };
    console.log("[VOICE][ROUTER][RESULT]", res);
    return res;
  }
  if (lower.includes('create an account') || lower.includes('sign up') || lower.includes('register')) {
    const res = { matched: true, action: 'OPEN_SIGNUP', query: '', target: 'signup', feedbackTts: 'Opening sign up.', _source: 'Deterministic Router', valid: true };
    console.log("[VOICE][ROUTER][RESULT]", res);
    return res;
  }
  if (lower.includes('sign in') || lower.includes('help me log in')) {
    const res = { matched: true, action: 'OPEN_SIGNIN', query: '', target: 'signin', feedbackTts: 'Opening sign in.', _source: 'Deterministic Router', valid: true };
    console.log("[VOICE][ROUTER][RESULT]", res);
    return res;
  }
  if (lower.includes('profile') || lower.includes('open profile')) {
    const res = { matched: true, action: 'OPEN_PROFILE', query: '', target: 'profile', feedbackTts: 'Opening profile.', _source: 'Deterministic Router', valid: true };
    console.log("[VOICE][ROUTER][RESULT]", res);
    return res;
  }

  // ── 8. VOICE SPEED & RATE COMMANDS ──
  const speedNumMatch = lower.match(/(?:speed|rate|voice\s+speed)\s+(?:to\s+)?(?:slow\s+|fast\s+|slower\s+|faster\s+)?(\d+(?:\.\d+)?)/i) ||
                        lower.match(/(\d+(?:\.\d+)?)\s*(?:x|speed)/i);

  if (speedNumMatch && speedNumMatch[1]) {
    const targetSpeed = parseFloat(speedNumMatch[1]);
    const res = {
      matched: true,
      action: 'SET_VOICE_SPEED',
      query: '',
      target: '',
      field: '',
      value: '',
      speakingSpeed: targetSpeed,
      feedbackTts: `Setting voice reading speed to ${targetSpeed}x.`,
      _source: 'Deterministic Router',
      valid: true
    };
    console.log("[VOICE][ROUTER][RESULT]", res);
    return res;
  }

  if (lower.includes('speed') || lower.includes('slower') || lower.includes('faster') || lower.includes('read slow') || lower.includes('read fast')) {
    let targetSpeed = 1.0;
    if (lower.includes('slow')) targetSpeed = 0.7;
    else if (lower.includes('fast')) targetSpeed = 1.3;

    const res = {
      matched: true,
      action: 'SET_VOICE_SPEED',
      query: '',
      target: '',
      field: '',
      value: '',
      speakingSpeed: targetSpeed,
      feedbackTts: `Adjusting voice reading speed to ${targetSpeed}x.`,
      _source: 'Deterministic Router',
      valid: true
    };
    console.log("[VOICE][ROUTER][RESULT]", res);
    return res;
  }

  // No deterministic command matched
  return { matched: false };
}

/**
 * Send user speech transcript to deterministic command router, or fall back to Ollama AI endpoint for conversation.
 */
export async function parseVoiceCommand(transcript, appContext = {}) {
  if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
    return {
      action: 'CONVERSATION',
      query: '',
      target: '',
      feedbackTts: "I'm sorry, I didn't hear anything. How can I help you with Book Vault?",
      valid: true
    };
  }

  const rawTranscript = transcript.trim();

  // 1. Try deterministic command router FIRST
  const localMatch = matchDeterministicCommand(rawTranscript, appContext);
  if (localMatch && localMatch.matched) {
    console.log(`[ACTION] ${localMatch.action} -> "${localMatch.query || localMatch.value || ''}"`);
    return localMatch;
  }

  // 2. If no deterministic command matched, forward to Ollama for conversation
  console.warn(
    "[VOICE][OLLAMA] FALLBACK - deterministic router did NOT match",
    JSON.stringify(rawTranscript)
  );

  const payload = {
    transcript: rawTranscript,
    authenticated: !!appContext.authenticated,
    activeUser: appContext.activeUser || 'Guest',
    currentRoute: appContext.currentRoute || '/',
    activeBookTitle: appContext.activeBookTitle || '',
    activePageNumber: appContext.activePageNumber || 1,
    bookCount: appContext.bookCount || 0,
    userBookTitles: Array.isArray(appContext.userBookTitles) ? appContext.userBookTitles : [],
    activePageText: appContext.activePageText || '',
    pendingField: appContext.pendingField || '',
    pendingAction: appContext.pendingAction || ''
  };

  try {
    const res = await fetch(`${API_BASE}/api/parse-voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      return validateCommandResponse(data, appContext.authenticated);
    }
  } catch (err) {
    console.warn('[voiceCommandService] Backend offline, using conversation fallback:', err.message);
  }

  return {
    action: 'CONVERSATION',
    query: '',
    target: '',
    feedbackTts: "I'm sorry, I didn't quite understand. You can ask me to open a book, read, scan, search your library, change settings, or just talk to me.",
    _source: 'Fallback Rule',
    valid: true
  };
}

/**
 * Validate every AI response payload before returning to application dispatcher
 */
export function validateCommandResponse(data, isAuthenticated = false) {
  if (!data || typeof data !== 'object') {
    return {
      action: 'CONVERSATION',
      query: '',
      target: '',
      feedbackTts: "I didn't quite catch that. How can I help you?",
      _source: 'Rule Fallback',
      valid: true
    };
  }

  const rawAction = (data.action || 'CONVERSATION').toUpperCase();
  const isValidAction = ALLOWED_ACTIONS.has(rawAction);
  const action = isValidAction ? rawAction : 'CONVERSATION';

  let feedbackTts = data.feedbackTts || '';
  if (!feedbackTts) {
    feedbackTts = "I didn't quite catch that. How can I help you?";
  }

  return {
    action,
    query: data.query || '',
    target: data.target || '',
    field: data.field || '',
    value: data.value || '',
    feedbackTts,
    speakingSpeed: data.speakingSpeed || null,
    _source: data._source || 'Ollama LLM (qwen3.5:0.8b)',
    valid: true
  };
}

