import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'farmer',
  password: process.env.MYSQL_PASSWORD || 'farmer123',
  database: process.env.MYSQL_DB || 'bookvault',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  maxAllowedPacket: 67108864, // 64MB for image payloads
};

let pool = null;

export async function getDbPool() {
  if (!pool) {
    try {
      // First ensure database exists
      const initConn = await mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
      });
      await initConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
      await initConn.end();

      pool = mysql.createPool(dbConfig);
      await initTables();
      console.log('✅ [MySQL] Database pool initialized successfully on port 3306 (bookvault)');
    } catch (err) {
      console.warn('⚠️ [MySQL] Could not connect to MySQL server:', err.message);
      return null;
    }
  }
  return pool;
}

async function initTables() {
  if (!pool) return;
  try {
    // 1. booksaved table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS booksaved (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(100) DEFAULT 'Guest',
        user_name VARCHAR(150) DEFAULT 'Reader',
        title VARCHAR(500) NOT NULL,
        author VARCHAR(255) DEFAULT 'Unknown',
        genre VARCHAR(100) DEFAULT 'General',
        language VARCHAR(20) DEFAULT 'eng',
        full_text LONGTEXT NULL,
        content LONGTEXT NULL,
        pages_json LONGTEXT NULL,
        cover_image LONGTEXT NULL,
        source VARCHAR(50) DEFAULT 'manual',
        last_position_char INT DEFAULT 0,
        page_count INT DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Ensure columns exist if table was created previously with older schema
    const [colsPages] = await pool.query("SHOW COLUMNS FROM booksaved LIKE 'pages_json'");
    if (colsPages.length === 0) {
      await pool.query('ALTER TABLE booksaved ADD COLUMN pages_json LONGTEXT AFTER content');
    }
    const [colsGenre] = await pool.query("SHOW COLUMNS FROM booksaved LIKE 'genre'");
    if (colsGenre.length === 0) {
      await pool.query("ALTER TABLE booksaved ADD COLUMN genre VARCHAR(100) DEFAULT 'General' AFTER author");
    }

    // 2. book_pages table for individual page relational storage
    await pool.query(`
      CREATE TABLE IF NOT EXISTS book_pages (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        book_id BIGINT NULL,
        page_number INT NOT NULL,
        page_title VARCHAR(255) NULL,
        image_data LONGTEXT NULL,
        extracted_text LONGTEXT NULL,
        dhash VARCHAR(255) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_book_id (book_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. scan_sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scan_sessions (
        session_id VARCHAR(64) PRIMARY KEY,
        book_title VARCHAR(255) DEFAULT 'Untitled Book',
        total_pages INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. scanned_pages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scanned_pages (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(64) NOT NULL,
        page_number INT NOT NULL,
        file_name VARCHAR(100) NOT NULL,
        file_path VARCHAR(255) NULL,
        extracted_text LONGTEXT NULL,
        image_data LONGTEXT NULL,
        file_size BIGINT DEFAULT 0,
        sharpness_score DOUBLE DEFAULT 0,
        brightness_score DOUBLE DEFAULT 0,
        is_book_detected TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_session_id (session_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('✅ [MySQL] All database tables verified & synchronized!');
  } catch (err) {
    console.error('❌ [MySQL] Table init error:', err);
  }
}

/**
 * Vite Dev Server Middleware Plugin for direct MySQL API handling
 */
export function mysqlApiPlugin() {
  return {
    name: 'vite-plugin-mysql-api',
    configureServer(server) {
      // Connect to pool when server starts
      getDbPool();

      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        // Only handle /api/ requests
        if (!url.startsWith('/api/')) {
          return next();
        }

        // Helper to parse JSON body
        const readBody = () => new Promise((resolve) => {
          let data = '';
          req.on('data', (chunk) => { data += chunk; });
          req.on('end', () => {
            try {
              resolve(data ? JSON.parse(data) : {});
            } catch {
              resolve({});
            }
          });
        });

        const sendJson = (statusCode, payload) => {
          res.statusCode = statusCode;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.end(JSON.stringify(payload));
        };

        if (req.method === 'OPTIONS') {
          return sendJson(200, { ok: true });
        }

        const p = await getDbPool();

        // ── 1. DB STATUS & HEALTH ──
        if (url === '/api/db/status' && req.method === 'GET') {
          if (!p) {
            return sendJson(503, {
              status: 'offline',
              connected: false,
              host: dbConfig.host,
              port: dbConfig.port,
              database: dbConfig.database,
              message: 'MySQL is offline or unreachable on port 3306.'
            });
          }
          try {
            const [bookRows] = await p.query('SELECT COUNT(*) as count FROM booksaved');
            const [pageRows] = await p.query('SELECT COUNT(*) as count FROM book_pages');
            let userCount = 0;
            try {
              const [userRows] = await p.query('SELECT COUNT(*) as count FROM biometric_users');
              userCount = userRows[0]?.count || 0;
            } catch {}

            return sendJson(200, {
              status: 'connected',
              connected: true,
              host: dbConfig.host,
              port: dbConfig.port,
              database: dbConfig.database,
              serverVersion: 'MySQL 8.0',
              tables: {
                booksaved: bookRows[0]?.count || 0,
                book_pages: pageRows[0]?.count || 0,
                biometric_users: userCount
              },
              timestamp: new Date().toISOString()
            });
          } catch (err) {
            return sendJson(500, { status: 'error', error: err.message });
          }
        }

        // ── 1.5. OLLAMA / AI PARSE VOICE API HANDLER ──
        if ((url === '/api/parse-voice' || url === '/api/parse-intent') && req.method === 'POST') {
          const body = await readBody();
          const transcript = (body.transcript || body.userInput || '').trim();
          const isAuthenticated = !!body.authenticated;
          const currentRoute = body.currentRoute || '/';
          const pendingField = body.pendingField || '';
          const lower = transcript.toLowerCase();
          
          if (!transcript) {
            return sendJson(200, { action: 'CONVERSATION', query: '', target: '', field: '', value: '', feedbackTts: "I'm sorry, I didn't hear anything. How can I help you with Book Vault?", valid: true });
          }

          // 1. Run Deterministic Rule Matcher FIRST
          const typeMatch = transcript.match(/^(?:type|enter|typing)\s+(.+)$/i);
          if (typeMatch && typeMatch[1] && !lower.includes('who are') && !lower.includes('what is') && !lower.includes('how are')) {
            let payload = typeMatch[1].trim();
            const namePrefixMatch = payload.match(/^(?:my\s+)?name\s+(?:as|is|to|=|\:)?\s+(.+)$/i);
            if (namePrefixMatch && namePrefixMatch[1]) {
              payload = namePrefixMatch[1].trim();
            }
            return sendJson(200, { action: 'TYPE_TEXT', query: payload, target: '', field: pendingField || 'name', value: payload, feedbackTts: `Typing ${payload}.`, _source: 'Deterministic Rule', valid: true });
          }

          if (lower === 'open my book' || lower === 'open book' || lower === 'open a book') {
            return sendJson(200, { action: 'OPEN_BOOK', query: '', target: 'reader', field: '', value: '', feedbackTts: 'Opening book.', _source: 'Deterministic Rule', valid: true });
          }
          if (lower === 'read this book' || lower === 'read book' || lower === 'start reading') {
            return sendJson(200, { action: 'READ_PAGE', query: '', target: 'reader', field: '', value: '', feedbackTts: 'Starting reading.', _source: 'Deterministic Rule', valid: true });
          }
          if (lower.includes('scan page') || lower.includes('scan book') || lower === 'scan') {
            return sendJson(200, { action: 'SCAN_PAGE', query: '', target: 'scanner', field: '', value: '', feedbackTts: 'Opening book scanner.', _source: 'Deterministic Rule', valid: true });
          }
          if (lower.includes('search my library') || lower.includes('search library')) {
            return sendJson(200, { action: 'SEARCH_BOOK', query: '', target: 'search', field: '', value: '', feedbackTts: 'Opening library search.', _source: 'Deterministic Rule', valid: true });
          }
          if (lower.includes('change settings') || lower.includes('open settings') || lower === 'settings') {
            return sendJson(200, { action: 'OPEN_SETTINGS', query: '', target: 'settings', field: '', value: '', feedbackTts: 'Opening settings.', _source: 'Deterministic Rule', valid: true });
          }

          // 2. Try Local Ollama LLM if no deterministic rule matched
          try {
            const prompt = `You are Book Vault AI, an intelligent conversational voice assistant for the Book Vault web app.\n\n` +
              `FEW-SHOT EXAMPLES:\n` +
              `User: "I cannot type it so type my name as Alex"\n` +
              `JSON: {"action":"TYPE_TEXT","query":"Alex","target":"","field":"name","value":"Alex","feedbackTts":"Typing Alex."}\n\n` +
              `User: "who are you"\n` +
              `JSON: {"action":"CONVERSATION","query":"","target":"","field":"","value":"","feedbackTts":"I'm Doraemon, your Book Vault AI assistant!"}\n\n` +
              `RULES:\n` +
              `1. Return JSON for general conversation Q&A or unhandled commands.\n\n` +
              `Speech: "${transcript}"\n\n` +
              `Return ONLY a raw JSON object matching schema: {"action":"CONVERSATION","query":"","target":"","field":"","value":"","feedbackTts":"<spoken reply>"}`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const ollamaRes = await fetch('http://localhost:11434/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify({
                model: 'qwen3.5:0.8b',
                system: 'You are Book Vault AI assistant. Output ONLY a valid JSON object.',
                prompt,
                stream: false,
                format: 'json'
              })
            });
            clearTimeout(timeoutId);

            if (ollamaRes.ok) {
              const data = await ollamaRes.json();
              let rawResp = (data.response || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
              const jsonMatch = rawResp.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed && parsed.action) {
                  return sendJson(200, {
                    action: parsed.action.toUpperCase(),
                    query: parsed.query || '',
                    target: parsed.target || '',
                    field: parsed.field || '',
                    value: parsed.value || '',
                    feedbackTts: parsed.feedbackTts || `Executing ${parsed.action}`,
                    speakingSpeed: parsed.speakingSpeed || null,
                    _source: 'Ollama LLM (qwen3.5:0.8b)',
                    valid: true
                  });
                }
              }
            }
          } catch (e) {
            console.warn('[Vite Plugin] Local Ollama offline or timed out:', e.message);
          }

          // 2. Fallback Rule Matcher if Ollama LLM is offline or timing out
          if (lower.includes('guide you through') || lower.includes('book wallet') || lower.includes('what would you like to do') || lower.includes('how can i help you') || lower.includes('didn\'t quite understand')) {
            return sendJson(200, { action: 'CONVERSATION', query: '', target: '', field: '', value: '', feedbackTts: '', _source: 'Rule Fallback', valid: true });
          }

          // Scan / Add Book Matching
          if (lower.includes('scan') || lower.includes('scan a book') || lower.includes('help me to scan') || lower.includes('scan page') || lower.includes('capture')) {
            return sendJson(200, { action: 'SCAN_PAGE', query: '', target: 'scanner', field: '', value: '', feedbackTts: "Sure! Opening the book scanner now.", _source: 'Rule Fallback', valid: true });
          }

          // Flexible Name Extraction from any sentence (e.g. "I cannot type it so type my name as Alex")
          const nameMatch = lower.match(/(?:type|enter|set|fill|put|make|use)\s+(?:my\s+)?name\s+(?:as|to|is|=|\:)?\s+([a-z0-9_\s]+)/i) ||
                            lower.match(/(?:my\s+)?name\s+(?:is|as|to)?\s+([a-z0-9_\s]+)/i);
          if (nameMatch && nameMatch[1] && !lower.includes('who are') && !lower.includes('what is')) {
            const val = nameMatch[1].trim();
            const tts = currentRoute === '/signup' ? `Setting your name to ${val}. What email address should I use?` : `Setting name to ${val}.`;
            return sendJson(200, { action: 'SET_FORM_FIELD', query: '', target: '', field: 'name', value: val, feedbackTts: tts, _source: 'Rule Fallback', valid: true });
          }

          // Flexible Email Extraction
          const emailMatch = lower.match(/(?:type|enter|set|fill|put|use)\s+(?:my\s+)?email\s+(?:as|to|is|=|\:)?\s+([a-z0-9_\@\.\s]+)/i) ||
                             lower.match(/(?:my\s+)?email\s+(?:is|as|to)?\s+([a-z0-9_\@\.\s]+)/i);
          if (emailMatch && emailMatch[1]) {
            const val = emailMatch[1].trim();
            return sendJson(200, { action: 'SET_FORM_FIELD', query: '', target: '', field: 'email', value: val, feedbackTts: `Setting your email to ${val}.`, _source: 'Rule Fallback', valid: true });
          }
          if (lower.startsWith("set my password to ") || lower.startsWith("enter password ") || lower.startsWith("password is ")) {
            const val = transcript.replace(/^(set my password to|enter password|password is)\s+/i, "").trim();
            return sendJson(200, { action: 'SET_FORM_FIELD', query: '', target: '', field: 'password', value: val, feedbackTts: "Password entered.", _source: 'Rule Fallback', valid: true });
          }

          if ((currentRoute === '/signin' || currentRoute === '/facelogin' || currentRoute === '/signup') && !lower.includes(' ') && lower.length >= 2) {
            if (!['hello', 'hi', 'help', 'next', 'prev', 'back', 'scan', 'read', 'stop', 'pause', 'yes', 'no'].includes(lower)) {
              const val = transcript.trim();
              const tts = currentRoute === '/signup' ? `Setting your name to ${val}. What email address should I use?` : `Setting name to ${val}.`;
              return sendJson(200, { action: 'SET_FORM_FIELD', query: '', target: '', field: 'name', value: val, feedbackTts: tts, _source: 'Rule Fallback', valid: true });
            }
          }

          if (lower.includes('who are you') || lower.includes('what is your name') || lower.includes('whats your name')) {
            return sendJson(200, { action: 'CONVERSATION', query: '', target: '', field: '', value: '', feedbackTts: "I'm Doraemon, your Book Vault AI assistant! I can help you read books, fill forms, turn pages, and explore your library.", _source: 'Rule Fallback', valid: true });
          }
          if (lower.includes('how are you')) {
            return sendJson(200, { action: 'CONVERSATION', query: '', target: '', field: '', value: '', feedbackTts: "I'm doing great! Ready to help you with your books. What would you like to do?", _source: 'Rule Fallback', valid: true });
          }

          if (lower.includes('settings') || lower.includes('change settings') || lower.includes('open settings') || lower.includes('go to settings')) {
            return sendJson(200, { action: 'OPEN_SETTINGS', query: '', target: 'settings', field: '', value: '', feedbackTts: "Opening settings.", _source: 'Rule Fallback', valid: true });
          }
          if (lower.includes('profile') || lower.includes('open profile') || lower.includes('my profile')) {
            return sendJson(200, { action: 'OPEN_PROFILE', query: '', target: 'profile', field: '', value: '', feedbackTts: "Opening your profile.", _source: 'Rule Fallback', valid: true });
          }

          if (!isAuthenticated) {
            if (lower.includes('my book') || lower.includes('my library') || lower.includes('reading history') ||
                lower.includes('was i reading') || lower.includes('do i have') || lower.includes('my latest book')) {
              return sendJson(200, { action: 'CONVERSATION', query: '', target: '', field: '', value: '', feedbackTts: "You'll need to sign in first so I can access your library.", _source: 'Rule Fallback', valid: true });
            }
          }

          // Fallback conversational matcher
          if (lower === 'hello' || lower === 'hi' || lower.startsWith('hi ') || lower.startsWith('hello ')) {
            const reply = isAuthenticated
              ? "Hello! I'm Book Vault. I'm here to help you read and manage your books. What would you like to do?"
              : "Hello! I'm Book Vault. I can help you sign in, create an account, use facial login, or guide you through the application. What would you like to do?";
            return sendJson(200, { action: 'CONVERSATION', query: '', target: '', field: '', value: '', feedbackTts: reply, valid: true });
          }
          if (lower.includes('what can you do')) {
            const reply = isAuthenticated
              ? "I can help you navigate Book Vault, search your library, open books, turn pages, read aloud, save bookmarks, scan new pages, and adjust settings."
              : "I can help you sign in, create an account, use facial login, or guide you through Book Vault.";
            return sendJson(200, { action: 'CONVERSATION', query: '', target: '', field: '', value: '', feedbackTts: reply, valid: true });
          }
          if (lower.includes('are you there')) {
            return sendJson(200, { action: 'CONVERSATION', query: '', target: '', field: '', value: '', feedbackTts: "Yes, I'm right here! How can I help you?", valid: true });
          }
          if (lower.includes('i\'m lost') || lower.includes('im lost') || lower.includes('where am i') || lower.includes('i\'m confused') || lower.includes('im confused')) {
            return sendJson(200, { action: 'CONVERSATION', query: '', target: '', field: '', value: '', feedbackTts: "You are currently in Book Vault. You can ask me to open your library, scan a new book, turn pages, or go to settings.", valid: true });
          }
          if (lower.includes('face login') || lower.includes('facial login')) {
            return sendJson(200, { action: 'OPEN_FACELOGIN', query: '', target: 'facelogin', field: '', value: '', feedbackTts: 'Of course. Opening facial login.', valid: true });
          }
          if (lower.includes('create an account') || lower.includes('sign up') || lower.includes('register')) {
            return sendJson(200, { action: 'OPEN_SIGNUP', query: '', target: 'signup', field: '', value: '', feedbackTts: 'Sure! Opening sign-up. What is your name?', valid: true });
          }
          if (lower.includes('help me log in') || lower.includes('sign in') || lower.includes('i want to log in')) {
            return sendJson(200, { action: 'OPEN_SIGNIN', query: '', target: 'signin', field: '', value: '', feedbackTts: 'Of course. You can use password login or facial login. Which would you prefer?', valid: true });
          }

          if (lower.includes('i want to read my book') || lower.includes('read my book')) {
            return sendJson(200, { action: 'OPEN_LATEST_BOOK', query: '', target: 'reader', field: '', value: '', feedbackTts: 'Opening your latest book.', valid: true });
          }
          if (lower.includes('continue reading')) {
            return sendJson(200, { action: 'CONTINUE_READING', query: '', target: 'reader', field: '', value: '', feedbackTts: 'Continuing from where you left off.', valid: true });
          }
          if (lower.includes('next page') || lower.includes('next')) {
            return sendJson(200, { action: 'NEXT_PAGE', query: '', target: '', field: '', value: '', feedbackTts: 'Going to the next page.', valid: true });
          }
          if (lower.includes('prev page') || lower.includes('previous page') || lower.includes('prev')) {
            return sendJson(200, { action: 'PREVIOUS_PAGE', query: '', target: '', field: '', value: '', feedbackTts: 'Going back to previous page.', valid: true });
          }
          if (lower.includes('pause') || lower.includes('stop reading')) {
            return sendJson(200, { action: 'PAUSE_READING', query: '', target: '', field: '', value: '', feedbackTts: 'Reading paused.', valid: true });
          }
          if (lower.includes('read page') || lower.includes('start reading') || lower.includes('read this page') || lower.includes('read')) {
            return sendJson(200, { action: 'READ_PAGE', query: '', target: '', field: '', value: '', feedbackTts: 'Starting reading.', valid: true });
          }
          if (lower.includes('scan') || lower.includes('camera')) {
            return sendJson(200, { action: 'SCAN_PAGE', query: '', target: 'scanner', field: '', value: '', feedbackTts: 'Opening book scanner.', valid: true });
          }
          if (lower.includes('library') || lower.includes('open my library')) {
            return sendJson(200, { action: 'OPEN_LIBRARY', query: '', target: 'library', field: '', value: '', feedbackTts: 'Opening library.', valid: true });
          }
          if (lower.includes('settings') || lower.includes('open settings')) {
            return sendJson(200, { action: 'OPEN_SETTINGS', query: '', target: 'settings', field: '', value: '', feedbackTts: 'Opening settings.', valid: true });
          }
          if (lower.includes('bookmark')) {
            return sendJson(200, { action: 'BOOKMARK_PAGE', query: '', target: '', field: '', value: '', feedbackTts: 'Page bookmarked.', valid: true });
          }
          if (lower.includes('slower voice') || lower.includes('read slower') || lower.includes('make the voice slower')) {
            return sendJson(200, { action: 'SET_VOICE_SPEED', query: '', target: '', field: '', value: '', feedbackTts: 'Slowing down voice reading speed.', speakingSpeed: 0.8, valid: true });
          }
          if (lower.includes('faster voice') || lower.includes('read faster') || lower.includes('make the voice faster')) {
            return sendJson(200, { action: 'SET_VOICE_SPEED', query: '', target: '', field: '', value: '', feedbackTts: 'Speeding up voice reading speed.', speakingSpeed: 1.3, valid: true });
          }

          return sendJson(200, {
            action: 'CONVERSATION',
            query: '',
            target: '',
            field: '',
            value: '',
            feedbackTts: "I'm sorry, I didn't quite understand. You can ask me to open a book, read, scan, search your library, change settings, or just talk to me.",
            valid: true
          });
        }

        // ── 2. DB TABLES EXPLORER ──
        if (url.startsWith('/api/db/tables') && req.method === 'GET') {
          if (!p) return sendJson(503, { error: 'MySQL offline' });
          try {
            const [books] = await p.query('SELECT id, user_id, user_name, title, author, language, page_count, created_at FROM booksaved ORDER BY id DESC LIMIT 50');
            const [pages] = await p.query('SELECT id, book_id, page_number, page_title, SUBSTRING(extracted_text, 1, 100) as text_snippet, created_at FROM book_pages ORDER BY id DESC LIMIT 50');
            return sendJson(200, { books, pages });
          } catch (err) {
            return sendJson(500, { error: err.message });
          }
        }

        // ── 3. LIST ALL BOOKS: GET /api/books?userId=... ──
        if ((url === '/api/books' || url.startsWith('/api/books?')) && req.method === 'GET') {
          if (!p) return sendJson(503, { error: 'MySQL offline' });
          try {
            const parsedUrl = new URL(url, 'http://localhost');
            const targetUser = parsedUrl.searchParams.get('userId') || parsedUrl.searchParams.get('user');

            let query = 'SELECT * FROM booksaved ORDER BY id DESC';
            let params = [];

            if (targetUser && targetUser !== 'all' && targetUser !== 'ADMIN') {
              query = 'SELECT * FROM booksaved WHERE LOWER(TRIM(user_id)) = LOWER(TRIM(?)) ORDER BY id DESC';
              params = [targetUser];
            }

            const [rows] = await p.query(query, params);

            // Parse pages_json for each book
            const books = rows.map((b) => {
              let pages = [];
              if (b.pages_json) {
                try {
                  pages = typeof b.pages_json === 'string' ? JSON.parse(b.pages_json) : b.pages_json;
                } catch {
                  pages = [];
                }
              }
              return {
                id: String(b.id),
                userId: b.user_id || 'Guest',
                userName: b.user_name || 'Reader',
                title: b.title,
                author: b.author || 'Unknown',
                language: b.language || 'eng',
                content: b.content || b.full_text || '',
                fullText: b.full_text || b.content || '',
                cover: b.cover_image,
                coverImage: b.cover_image,
                pageCount: b.page_count || 1,
                source: b.source || 'manual',
                createdAt: b.created_at,
                updatedAt: b.updated_at,
                pages: pages.length > 0 ? pages : [{ pageNumber: 1, pageTitle: 'Page 1', image: b.cover_image, extractedText: b.content || b.full_text || '' }]
              };
            });

            return sendJson(200, books);
          } catch (err) {
            return sendJson(500, { error: err.message });
          }
        }

        // ── 4. GET SINGLE BOOK: GET /api/books/:id ──
        const bookIdMatch = url.match(/^\/api\/books\/(\d+)$/);
        if (bookIdMatch && req.method === 'GET') {
          if (!p) return sendJson(503, { error: 'MySQL offline' });
          const id = bookIdMatch[1];
          try {
            const [rows] = await p.query('SELECT * FROM booksaved WHERE id = ?', [id]);
            if (rows.length === 0) return sendJson(404, { error: 'Book not found' });
            const b = rows[0];
            let pages = [];
            if (b.pages_json) {
              try { pages = JSON.parse(b.pages_json); } catch {}
            }
            if (pages.length === 0) {
              const [pageRows] = await p.query('SELECT * FROM book_pages WHERE book_id = ? ORDER BY page_number ASC', [id]);
              pages = pageRows.map(pr => ({
                pageNumber: pr.page_number,
                pageTitle: pr.page_title || `Page ${pr.page_number}`,
                image: pr.image_data || b.cover_image,
                extractedText: pr.extracted_text || ''
              }));
            }
            return sendJson(200, {
              ...b,
              id: String(b.id),
              cover: b.cover_image,
              pages
            });
          } catch (err) {
            return sendJson(500, { error: err.message });
          }
        }

        // ── 5. CREATE BOOK: POST /api/books ──
        if (url === '/api/books' && req.method === 'POST') {
          if (!p) return sendJson(503, { error: 'MySQL offline' });
          try {
            const body = await readBody();
            const title = (body.title || 'Untitled Book').trim();
            const author = body.author || 'Unknown';
            const genre = body.genre || 'General';
            const language = body.language || 'eng';
            const userId = body.userId || body.user_id || 'Guest';
            const userName = body.userName || body.user_name || 'Reader';
            const coverImage = body.coverImage || body.cover || '';
            const source = body.source || 'manual';
            const pageCount = body.pageCount || (body.pages ? body.pages.length : 1) || 1;
            const fullText = body.fullText || body.content || '';
            const content = body.content || body.fullText || '';
            const pagesJson = body.pages ? JSON.stringify(body.pages) : JSON.stringify([{ pageNumber: 1, pageTitle: 'Page 1', image: coverImage, extractedText: content }]);

            const [result] = await p.query(`
              INSERT INTO booksaved
                (user_id, user_name, title, author, language, full_text, content, pages_json, cover_image, source, last_position_char, page_count, created_at)
              VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NOW())
            `, [userId, userName, title, author, language, fullText, content, pagesJson, coverImage, source, pageCount]);

            const insertedId = result.insertId;

            // Insert relational pages if provided
            if (Array.isArray(body.pages) && body.pages.length > 0) {
              for (const page of body.pages) {
                await p.query(`
                  INSERT INTO book_pages (book_id, page_number, page_title, image_data, extracted_text, created_at)
                  VALUES (?, ?, ?, ?, ?, NOW())
                `, [
                  insertedId,
                  page.pageNumber || 1,
                  page.pageTitle || `Page ${page.pageNumber || 1}`,
                  page.image || page.dataUrl || coverImage,
                  page.extractedText || page.text || ''
                ]);
              }
            }

            console.log(`✅ [MySQL] Saved book '${title}' (ID: ${insertedId}) with ${pageCount} pages to MySQL!`);
            return sendJson(201, {
              id: String(insertedId),
              title,
              author,
              userId,
              pageCount,
              cover: coverImage,
              content,
              pages: body.pages || [],
              status: 'saved_in_mysql'
            });
          } catch (err) {
            console.error('MySQL book insert error:', err);
            return sendJson(500, { error: err.message });
          }
        }

        // ── 6. UPDATE BOOK: PUT /api/books/:id ──
        if (bookIdMatch && req.method === 'PUT') {
          if (!p) return sendJson(503, { error: 'MySQL offline' });
          const id = bookIdMatch[1];
          try {
            const body = await readBody();
            const title = body.title;
            const author = body.author;
            const content = body.content || body.fullText;
            const pagesJson = body.pages ? JSON.stringify(body.pages) : null;
            const coverImage = body.coverImage || body.cover;

            await p.query(`
              UPDATE booksaved
              SET title = COALESCE(?, title),
                  author = COALESCE(?, author),
                  content = COALESCE(?, content),
                  full_text = COALESCE(?, full_text),
                  pages_json = COALESCE(?, pages_json),
                  cover_image = COALESCE(?, cover_image),
                  updated_at = NOW()
              WHERE id = ?
            `, [title, author, content, content, pagesJson, coverImage, id]);

            return sendJson(200, { message: 'Book updated in MySQL', id });
          } catch (err) {
            return sendJson(500, { error: err.message });
          }
        }

        // ── 6b. UPDATE POSITION: PATCH /api/books/:id/position or /api/books/:id ──
        const positionMatch = url.match(/^\/api\/books\/(\d+)\/position$/);
        if ((positionMatch || bookIdMatch) && req.method === 'PATCH') {
          if (!p) return sendJson(503, { error: 'MySQL offline' });
          const id = (positionMatch ? positionMatch[1] : bookIdMatch[1]);
          try {
            const body = await readBody();
            const lastPos = body.last_position_char ?? body.lastPositionChar ?? body.charIndex ?? 0;
            const pageNum = body.page_number ?? body.pageNumber ?? body.page ?? 1;

            await p.query(`
              UPDATE booksaved
              SET last_position_char = ?,
                  updated_at = NOW()
              WHERE id = ?
            `, [lastPos, id]);

            return sendJson(200, { success: true, message: 'Position updated in MySQL', id, last_position_char: lastPos, page_number: pageNum });
          } catch (err) {
            return sendJson(500, { error: err.message });
          }
        }

        // ── 7. DELETE BOOK: DELETE /api/books/:id ──
        if (bookIdMatch && req.method === 'DELETE') {
          if (!p) return sendJson(503, { error: 'MySQL offline' });
          const id = bookIdMatch[1];
          try {
            await p.query('DELETE FROM book_pages WHERE book_id = ?', [id]);
            await p.query('DELETE FROM booksaved WHERE id = ?', [id]);
            console.log(`🗑️ [MySQL] Deleted book ID: ${id} and its pages`);
            return sendJson(200, { message: 'Book deleted from MySQL', id });
          } catch (err) {
            return sendJson(500, { error: err.message });
          }
        }

        // ── 8. SCANNER SESSION: POST /api/pages/session ──
        if (url === '/api/pages/session' && req.method === 'POST') {
          if (!p) return sendJson(503, { error: 'MySQL offline' });
          try {
            const body = await readBody();
            const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const bookTitle = body.title || 'Untitled Book';
            await p.query('INSERT INTO scan_sessions (session_id, book_title, total_pages, created_at) VALUES (?, ?, 0, NOW())', [sessionId, bookTitle]);
            return sendJson(200, { sessionId, bookTitle, status: 'connected_to_mysql' });
          } catch (err) {
            return sendJson(500, { error: err.message });
          }
        }

        // ── 9. SCANNER UPLOAD PAGE: POST /api/pages/:sessionId/upload ──
        const sessionUploadMatch = url.match(/^\/api\/pages\/([^\/]+)\/upload/);
        if (sessionUploadMatch && req.method === 'POST') {
          if (!p) return sendJson(503, { error: 'MySQL offline' });
          const sessionId = sessionUploadMatch[1];
          try {
            const body = await readBody();
            const pageNumber = parseInt(body.pageNumber || '1', 10);
            const fileName = body.fileName || `page_${pageNumber}.webp`;
            const imageData = body.dataUrl || body.image || '';
            const extractedText = body.extractedText || '';

            await p.query(`
              INSERT INTO scanned_pages
                (session_id, page_number, file_name, file_path, extracted_text, image_data, sharpness_score, brightness_score, is_book_detected, created_at)
              VALUES
                (?, ?, ?, '', ?, ?, ?, ?, 1, NOW())
            `, [sessionId, pageNumber, fileName, extractedText, imageData, body.sharpness || 80, body.brightness || 80]);

            await p.query('UPDATE scan_sessions SET total_pages = total_pages + 1 WHERE session_id = ?', [sessionId]);

            return sendJson(200, { message: 'Page stored in MySQL scanned_pages', sessionId, pageNumber });
          } catch (err) {
            return sendJson(500, { error: err.message });
          }
        }

        // ── 11. DEDUPLICATION & CLEANUP: POST /api/db/cleanup-duplicates ──
        if (url === '/api/db/cleanup-duplicates' && req.method === 'POST') {
          if (!p) return sendJson(503, { error: 'MySQL offline' });
          try {
            // Drop duplicate tables
            await p.query('DROP TABLE IF EXISTS book_saves');
            await p.query('DROP TABLE IF EXISTS booksaves');

            // Deduplicate books
            const [dupBooks] = await p.query(`
              DELETE b1 FROM booksaved b1
              INNER JOIN booksaved b2
              WHERE b1.id > b2.id AND LOWER(TRIM(b1.title)) = LOWER(TRIM(b2.title)) AND b1.user_id = b2.user_id
            `);

            // Deduplicate biometric users
            const [dupUsers] = await p.query(`
              DELETE u1 FROM biometric_users u1
              INNER JOIN biometric_users u2
              WHERE u1.user_id > u2.user_id AND LOWER(TRIM(u1.name)) = LOWER(TRIM(u2.name))
            `);

            // Clean orphaned pages
            const [dupPages] = await p.query(`
              DELETE p FROM book_pages p
              LEFT JOIN booksaved b ON p.book_id = b.id
              WHERE b.id IS NULL AND p.book_id IS NOT NULL
            `);

            const [tables] = await p.query('SHOW TABLES');

            return sendJson(200, {
              success: true,
              message: 'Database deduplicated and cleaned successfully!',
              removedDuplicateBooks: dupBooks.affectedRows,
              removedDuplicateUsers: dupUsers.affectedRows,
              removedOrphanedPages: dupPages.affectedRows,
              activeTables: tables.map(t => Object.values(t)[0])
            });
          } catch (err) {
            return sendJson(500, { error: err.message });
          }
        }

        // ── 12. AUTH & USERS MICROSERVICE ENDPOINTS ──
        if (url.startsWith('/api/users/readers') && req.method === 'GET') {
          if (!p) return sendJson(200, [{ id: 1, name: 'Guest', userName: 'Guest' }, { id: 2, name: 'Reader', userName: 'Reader' }]);
          try {
            const [rows] = await p.query('SELECT user_id as id, name as userName, name, biometric_saved FROM biometric_users ORDER BY user_id DESC');
            return sendJson(200, rows);
          } catch (err) {
            return sendJson(200, [{ id: 1, name: 'Guest', userName: 'Guest' }, { id: 2, name: 'Reader', userName: 'Reader' }]);
          }
        }

        if (url.startsWith('/api/users/admin-logins') && req.method === 'GET') {
          if (!p) return sendJson(200, []);
          try {
            const [logs] = await p.query('SELECT id as logId, user_id as userId, user_name as userName, user_email as email, login_time as loginTime, auth_method as authMethod, status, match_distance as matchDistance FROM login_history ORDER BY login_time DESC LIMIT 100');
            return sendJson(200, logs);
          } catch (err) {
            return sendJson(200, []);
          }
        }

        if ((url === '/api/users' || url.startsWith('/api/users?')) && req.method === 'GET') {
          if (!p) return sendJson(200, [{ id: 1, name: 'System Administrator', email: 'admin@bookvault.io', role: 'ADMIN' }]);
          try {
            const [appUsers] = await p.query('SELECT id, name, email, role, created_at FROM app_users ORDER BY id ASC');
            if (appUsers.length > 0) return sendJson(200, appUsers);
            const [bioUsers] = await p.query('SELECT user_id as id, name, name as email, "READER" as role, created_at FROM biometric_users ORDER BY user_id ASC');
            return sendJson(200, bioUsers);
          } catch (err) {
            return sendJson(200, [{ id: 1, name: 'System Administrator', email: 'admin@bookvault.io', role: 'ADMIN' }]);
          }
        }

        if (url.startsWith('/api/users/biometric') && req.method === 'POST') {
          if (!p) return sendJson(503, { error: 'MySQL offline' });
          try {
            const body = await readBody();
            const name = (body.name || body.userName || 'Reader').trim();
            const biometricData = body.biometricData || body.faceDescriptors || JSON.stringify(body.descriptors || []);

            // Check if user already exists
            const [existing] = await p.query('SELECT * FROM biometric_users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))', [name]);
            if (existing.length > 0) {
              await p.query('UPDATE biometric_users SET biometric_saved = ? WHERE user_id = ?', [biometricData, existing[0].user_id]);
              return sendJson(200, { message: `Updated biometrics for ${name}`, userId: existing[0].user_id });
            } else {
              const [res] = await p.query('INSERT INTO biometric_users (name, biometric_saved) VALUES (?, ?)', [name, biometricData]);
              return sendJson(201, { message: `Registered biometrics for ${name}`, userId: res.insertId });
            }
          } catch (err) {
            return sendJson(500, { error: err.message });
          }
        }



        // ── 14. AI VISION & INTENT MICROSERVICE ENDPOINTS ──
        if (url === '/api/parse-intent' && req.method === 'POST') {
          try {
            const body = await readBody();
            const text = (body.text || body.query || '').toLowerCase();
            let intent = 'UNKNOWN';
            let params = {};

            if (text.includes('read') || text.includes('open') || text.includes('book')) {
              intent = 'OPEN_BOOK';
            } else if (text.includes('scan') || text.includes('capture') || text.includes('camera')) {
              intent = 'START_SCANNER';
            } else if (text.includes('next') || text.includes('page')) {
              intent = 'NEXT_PAGE';
            } else if (text.includes('stop') || text.includes('pause')) {
              intent = 'PAUSE_READING';
            } else if (text.includes('resume') || text.includes('continue')) {
              intent = 'RESUME_READING';
            } else if (text.includes('library')) {
              intent = 'NAVIGATE_LIBRARY';
            }

            return sendJson(200, { intent, confidence: 0.95, text, params });
          } catch (err) {
            return sendJson(500, { error: err.message });
          }
        }

        // Fallback for unhandled /api/ calls
        return next();
      });
    }
  };
}
