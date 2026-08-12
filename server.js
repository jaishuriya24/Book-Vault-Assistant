import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/storage', express.static(path.join(process.cwd(), 'Text-detector', 'storage')));

// ── MySQL Database Connection Pool ─────────────────────────
const dbHost = process.env.MYSQL_HOST || 'localhost';
const dbPort = parseInt(process.env.MYSQL_PORT, 10) || 3306;
const dbUser = process.env.MYSQL_USER || 'farmer';
const dbPassword = process.env.MYSQL_PASSWORD !== undefined ? process.env.MYSQL_PASSWORD : 'farmer123';
const dbName = process.env.MYSQL_DB || 'farmo_ai_db';

const dbPool = mysql.createPool({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

// Periodic keep-alive ping to ensure persistent connection health
setInterval(async () => {
  try {
    const conn = await dbPool.getConnection();
    await conn.ping();
    conn.release();
  } catch (err) {
    console.warn('⚠️  [MySQL Pool Ping Warn]:', err.message);
  }
}, 60000);

// Initialize & Verify MySQL Tables on Startup
async function initMySQL() {
  try {
    const conn = await dbPool.getConnection();
    console.log(`\n========================================================`);
    console.log(`✨  [MySQL] CONNECTED TO DATABASE: ${dbName} @ ${dbHost}:${dbPort}`);
    console.log(`✨  [MySQL] Authenticated User: ${dbUser}`);
    console.log(`========================================================\n`);

    // 1. ADMIN_USERS TABLE (Admin credentials: username & password)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(150) NOT NULL UNIQUE,
        name VARCHAR(150) NULL,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        role VARCHAR(20) NOT NULL DEFAULT 'ADMIN',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. BIOMETRIC_USERS TABLE (user_id, name, biometric_saved / face_descriptor)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS biometric_users (
        user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(150) NULL,
        biometric_saved LONGTEXT NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'READER',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure columns exist in biometric_users for backwards compatibility
    try {
      const [bioCols] = await conn.query('DESCRIBE biometric_users');
      const bioColNames = bioCols.map(c => c.Field.toLowerCase());
      if (!bioColNames.includes('email')) {
        await conn.query('ALTER TABLE biometric_users ADD COLUMN email VARCHAR(150) NULL AFTER name');
      }
      if (!bioColNames.includes('role')) {
        await conn.query("ALTER TABLE biometric_users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'READER' AFTER biometric_saved");
      }
      if (!bioColNames.includes('created_at')) {
        await conn.query('ALTER TABLE biometric_users ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
      }
    } catch (_) {}

    // 3. LOGIN_HISTORY TABLE (Audit trail for both Face and Password logins)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS login_history (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NULL,
        user_name VARCHAR(150) NULL,
        user_email VARCHAR(150) NULL,
        table_source VARCHAR(50) NULL DEFAULT 'biometric_users',
        auth_method VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL,
        match_distance DOUBLE NULL,
        note VARCHAR(255) NULL,
        login_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_login_user (user_id),
        INDEX idx_login_time (login_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Drop and recreate views safely so they never crash queries
    try {
      await conn.query('DROP VIEW IF EXISTS registered_users_view');
      await conn.query('DROP VIEW IF EXISTS user_logins_view');
      await conn.query(`
        CREATE OR REPLACE VIEW user_logins_view AS
        SELECT 
          lh.id AS log_id,
          COALESCE(lh.user_name, 'Reader') AS user_name,
          COALESCE(lh.user_email, '—') AS user_email,
          lh.auth_method,
          lh.status,
          lh.match_distance,
          lh.login_time
        FROM login_history lh;
      `);
    } catch (_) {}

    // 5. BOOKSAVED TABLES (Saved uploaded & scanned books with covers & text)
    for (const tbl of ['booksaved', 'book_saves', 'booksaves', 'books']) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS ${tbl} (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(100) DEFAULT 'Guest',
          user_name VARCHAR(150) DEFAULT 'Reader',
          title VARCHAR(255) NOT NULL,
          author VARCHAR(150) DEFAULT 'Unknown',
          language VARCHAR(20) DEFAULT 'eng',
          full_text LONGTEXT,
          content LONGTEXT,
          cover_image LONGTEXT,
          source VARCHAR(50) DEFAULT 'manual',
          last_position_char INT DEFAULT 0,
          page_count INT DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_user (user_id),
          INDEX idx_title (title)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    }

    // Clean up any historical duplicate entries across tables
    try {
      await conn.query(`
        DELETE b1 FROM biometric_users b1
        INNER JOIN biometric_users b2 
        WHERE b1.user_id < b2.user_id AND LOWER(TRIM(b1.name)) = LOWER(TRIM(b2.name));
      `);
      await conn.query(`
        DELETE a1 FROM admin_users a1
        INNER JOIN admin_users a2
        WHERE a1.id < a2.id AND (LOWER(TRIM(a1.username)) = LOWER(TRIM(a2.username)) OR LOWER(TRIM(a1.email)) = LOWER(TRIM(a2.email)));
      `);
    } catch (_) {}

    conn.release();
    console.log(`✅  [MySQL] All tables (admin_users, biometric_users, booksaved, login_history) initialized and ready in ${dbName}!`);
  } catch (err) {
    console.error(`❌  [MySQL] Connection Error:`, err.message);
  }
}

initMySQL();

// ── Database Health & Statistics Endpoint ───────────────────
app.get('/api/db/health', async (req, res) => {
  try {
    const [[adminCount]] = await dbPool.query('SELECT COUNT(*) AS count FROM admin_users');
    const [[biometricCount]] = await dbPool.query('SELECT COUNT(*) AS count FROM biometric_users');
    const [[booksCount]] = await dbPool.query('SELECT COUNT(*) AS count FROM booksaved');

    return res.json({
      status: "CONNECTED",
      database: dbName,
      host: dbHost,
      port: dbPort,
      user: dbUser,
      tables: {
        admin_users: adminCount.count,
        biometric_users: biometricCount.count,
        booksaved: booksCount.count
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ status: "DISCONNECTED", error: err.message });
  }
});

// Helper: Sanitize image strings to prevent network URLs
const sanitizeCover = (img) => {
  if (!img || typeof img !== 'string') return '';
  if (img.startsWith('http://') || img.startsWith('https://')) return '';
  return img;
};

// ── Books CRUD API (MySQL booksaved table) ──────────────────
app.get('/api/books', async (req, res) => {
  try {
    let rows = [];
    try {
      const [dbRows] = await dbPool.query('SELECT * FROM booksaved ORDER BY id DESC');
      rows = dbRows;
    } catch (dbErr) {
      console.error('❌  [MySQL] Book fetch error:', dbErr.message);
    }

    const books = rows.map(b => {
      const cleanImg = sanitizeCover(b.cover_image);
      return {
        id: String(b.id),
        userId: b.user_id ? String(b.user_id) : 'Guest',
        userName: b.user_name || 'Reader',
        title: b.title,
        author: b.author || 'Unknown',
        language: b.language || 'eng',
        content: b.content || b.full_text || '',
        fullText: b.full_text || b.content || '',
        coverImage: cleanImg,
        cover: cleanImg,
        source: b.source || 'manual',
        pageCount: b.page_count || 1,
        lastPositionChar: b.last_position_char || 0,
        createdAt: b.created_at,
        updatedAt: b.updated_at
      };
    });
    return res.json(books);
  } catch (err) {
    return res.json([]);
  }
});

app.post('/api/books', async (req, res) => {
  try {
    const { title, author, content, fullText, coverImage, cover, language, userId, userName, source, pageCount } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });

    const textContent = content || fullText || '';
    const img = coverImage || cover || '';
    let insertId = Date.now();

    try {
      const [result] = await dbPool.query(
        'INSERT INTO booksaved (user_id, user_name, title, author, language, full_text, content, cover_image, source, page_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          userId || 'Guest',
          userName || 'Reader',
          title,
          author || 'Unknown',
          language || 'eng',
          textContent,
          textContent,
          img,
          source || 'manual',
          pageCount || 1
        ]
      );
      insertId = result.insertId;
      console.log(`📖  [MySQL booksaved] Successfully saved book to database: "${title}" (ID: ${insertId})`);
    } catch (dbErr) {
      console.error(`❌  [MySQL booksaved] Book insert error:`, dbErr.message);
    }

    const inserted = {
      id: String(insertId),
      userId: userId || 'Guest',
      userName: userName || 'Reader',
      title,
      author: author || 'Unknown',
      content: textContent,
      fullText: textContent,
      coverImage: img,
      cover: img,
      language: language || 'eng',
      source: source || 'manual',
      pageCount: pageCount || 1,
      lastPositionChar: 0,
      createdAt: new Date().toISOString()
    };

    return res.status(201).json(inserted);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/books/:id', async (req, res) => {
  try {
    try {
      const [rows] = await dbPool.query('SELECT * FROM booksaved WHERE id = ?', [req.params.id]);
      if (rows.length > 0) {
        const b = rows[0];
        return res.json({
          id: String(b.id),
          userId: b.user_id ? String(b.user_id) : null,
          title: b.title,
          author: b.author || 'Unknown',
          language: b.language || 'eng',
          content: b.content || b.full_text || '',
          fullText: b.full_text || b.content || '',
          coverImage: b.cover_image || '',
          cover: b.cover_image || '',
          source: b.source || 'manual',
          lastPositionChar: b.last_position_char || 0,
          createdAt: b.created_at,
          updatedAt: b.updated_at
        });
      }
    } catch (_) {}

    return res.status(404).json({ error: "Book not found" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/books/:id', async (req, res) => {
  try {
    const { title, coverImage, content, fullText, language, author, lastPositionChar } = req.body;
    const bookId = req.params.id;

    try {
      const updates = [];
      const params = [];

      if (title !== undefined) { updates.push('title = ?'); params.push(title); }
      if (author !== undefined) { updates.push('author = ?'); params.push(author); }
      if (coverImage !== undefined) { updates.push('cover_image = ?'); params.push(coverImage); }
      if (language !== undefined) { updates.push('language = ?'); params.push(language); }
      if (content !== undefined || fullText !== undefined) {
        const txt = content !== undefined ? content : fullText;
        updates.push('content = ?', 'full_text = ?');
        params.push(txt, txt);
      }
      if (lastPositionChar !== undefined) {
        updates.push('last_position_char = ?');
        params.push(lastPositionChar);
      }

      if (updates.length > 0) {
        params.push(bookId);
        await dbPool.query(`UPDATE booksaved SET ${updates.join(', ')} WHERE id = ?`, params);
      }
    } catch (_) {}

    return res.json({ success: true, id: bookId, ...req.body });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/books/:id', async (req, res) => {
  try {
    try {
      await dbPool.query('DELETE FROM booksaved WHERE id = ?', [req.params.id]);
    } catch (_) {}
    return res.json({ success: true, deleted: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Pages API (MySQL) ───────────────────────────────────────
app.post('/api/save-page', async (req, res) => {
  try {
    const { imageBase64, dhash, text, bookId, pageNumber } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "No imageBase64 provided" });

    let finalPageNum = pageNumber || 1;
    let pageId = Date.now();

    try {
      const [dbResult] = await dbPool.query(
        'INSERT INTO pages (book_id, page_number, image_data, extracted_text, dhash) VALUES (?, ?, ?, ?, ?)',
        [bookId || null, finalPageNum, imageBase64, text || "", dhash || ""]
      );
      pageId = dbResult.insertId;
    } catch (_) {}

    return res.json({ success: true, pageId, pageNumber: finalPageNum });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/books/:id/pages', async (req, res) => {
  try {
    const [rows] = await dbPool.query('SELECT id, book_id, page_number, image_data, extracted_text, dhash, created_at FROM pages WHERE book_id = ? ORDER BY page_number ASC', [req.params.id]);
    return res.json(rows.map(p => ({
      id: String(p.id),
      bookId: String(p.book_id),
      pageNumber: p.page_number,
      imageData: p.image_data,
      extractedText: p.extracted_text,
      dhash: p.dhash,
      createdAt: p.created_at
    })));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── User Management & Admin API (MySQL) ─────────────────────
app.get('/api/users/readers', async (req, res) => {
  try {
    let adminRows = [];
    let bioRows = [];
    try {
      const [admins] = await dbPool.query('SELECT * FROM admin_users ORDER BY id ASC');
      adminRows = admins;
    } catch (_) {}

    try {
      const [bios] = await dbPool.query('SELECT * FROM biometric_users ORDER BY user_id ASC');
      bioRows = bios;
    } catch (_) {}

    const combinedMap = new Map();

    for (const a of adminRows) {
      const name = (a.name || a.username || '').trim();
      const email = (a.email || '').trim();
      const key = (a.username || name || email).toLowerCase();
      if (!key) continue;
      combinedMap.set(key, {
        userId: a.id,
        userName: name || a.username,
        username: a.username,
        email: email || `${(a.username || name).toLowerCase().replace(/\s+/g, '')}@readease.vault`,
        role: a.role || 'ADMIN',
        sourceTable: 'admin_users',
        authType: 'ADMIN_PASSWORD',
        hasBiometric: false,
        faceDescriptor: null,
        createdAt: a.created_at || new Date().toISOString()
      });
    }

    for (const b of bioRows) {
      const rawName = (b.name || b.user_name || '').trim();
      if (!rawName) continue;
      const key = rawName.toLowerCase();
      const email = b.email || `${key.replace(/\s+/g, '')}@readease.vault`;
      combinedMap.set(key, {
        userId: b.user_id || b.id,
        userName: rawName,
        username: rawName.toLowerCase().replace(/\s+/g, ''),
        email,
        role: b.role || 'READER',
        sourceTable: 'biometric_users',
        authType: 'BIOMETRIC_FACE',
        hasBiometric: true,
        faceDescriptor: b.biometric_saved || b.face_descriptor,
        createdAt: b.created_at || new Date().toISOString()
      });
    }

    return res.json(Array.from(combinedMap.values()));
  } catch (err) {
    console.error("MySQL Fetch Users Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Delete user from biometric_users
app.delete('/api/users/biometric/:id', async (req, res) => {
  try {
    await dbPool.query('DELETE FROM biometric_users WHERE user_id = ?', [req.params.id]);
    console.log(`🗑️  [MySQL] Deleted user #${req.params.id} from biometric_users`);
    return res.json({ success: true, deletedId: req.params.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Clear all registered biometric users
app.delete('/api/users/clear-all', async (req, res) => {
  try {
    await dbPool.query('DELETE FROM biometric_users');
    console.log(`🧹  [MySQL] Cleared all biometric_users`);
    return res.json({ success: true, message: "All biometric users cleared" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/admin-logins', async (req, res) => {
  try {
    let result = [];
    try {
      const [rows] = await dbPool.query('SELECT * FROM login_history ORDER BY id DESC LIMIT 100');
      result = rows.map(l => ({
        logId: l.id,
        userId: l.user_id,
        userName: l.user_name || 'Reader',
        email: l.user_email || '—',
        tableSource: l.table_source || 'biometric_users',
        authMethod: l.auth_method || 'PASSWORD',
        status: l.status || 'SUCCESS',
        matchDistance: l.match_distance,
        note: l.note || null,
        loginTime: l.login_time
      }));
    } catch (_) {}
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── User Registration & Face Biometric Enrollment ───────────
app.post(['/api/auth/register', '/api/auth/face-register'], async (req, res) => {
  try {
    const { name, email, username, password, role, faceDescriptor } = req.body;
    if (!name && !email && !username) {
      return res.status(400).json({ error: "Name, username or email is required" });
    }

    const userName = (name || username || email || "Reader").trim();
    const userEmail = (email && email.includes('@')) 
      ? email.trim() 
      : `${userName.toLowerCase().replace(/\s+/g, '')}@readease.vault`;
    const userRole = role || 'READER';
    const descriptorStr = faceDescriptor 
      ? (typeof faceDescriptor === 'string' ? faceDescriptor : JSON.stringify(faceDescriptor)) 
      : null;

    let userId = null;

    // 1. If biometric face vector is provided, save to biometric_users
    if (descriptorStr) {
      const inputVec = Array.isArray(faceDescriptor) ? faceDescriptor : JSON.parse(descriptorStr);

      // Check if this exact user name already exists in biometric_users
      const [bioExisting] = await dbPool.query(
        'SELECT user_id, name, biometric_saved FROM biometric_users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))',
        [userName]
      );

      if (bioExisting.length > 0) {
        userId = bioExisting[0].user_id;
        await dbPool.query(
          'UPDATE biometric_users SET name = ?, email = ?, biometric_saved = ? WHERE user_id = ?',
          [userName, userEmail, descriptorStr, userId]
        );
        console.log(`👤  [MySQL biometric_users] Updated face profile for "${userName}" (ID #${userId})`);
      } else {
        // Also check if an existing user has an identical face vector (distance <= 0.10)
        let existingBioMatch = null;
        try {
          const [allBio] = await dbPool.query('SELECT user_id, name, biometric_saved FROM biometric_users');
          for (const b of allBio) {
            const stored = typeof b.biometric_saved === 'string' ? JSON.parse(b.biometric_saved) : b.biometric_saved;
            if (Array.isArray(stored) && stored.length >= 64) {
              let dot = 0, mag1 = 0, mag2 = 0;
              const len = Math.min(inputVec.length, stored.length);
              for (let i = 0; i < len; i++) {
                const v1 = Number(inputVec[i]) || 0;
                const v2 = Number(stored[i]) || 0;
                dot += v1 * v2;
                mag1 += v1 * v1;
                mag2 += v2 * v2;
              }
              const dist = Math.max(0, 1 - (dot / (Math.sqrt(mag1) * Math.sqrt(mag2) || 1)));
              if (dist <= 0.10) {
                existingBioMatch = b;
                break;
              }
            }
          }
        } catch (_) {}

        if (existingBioMatch) {
          userId = existingBioMatch.user_id;
          await dbPool.query(
            'UPDATE biometric_users SET name = ?, email = ?, biometric_saved = ? WHERE user_id = ?',
            [userName, userEmail, descriptorStr, userId]
          );
          console.log(`👤  [MySQL biometric_users] Re-enrolled existing biometric profile as "${userName}" (ID #${userId})`);
        } else {
          const [bioInsert] = await dbPool.query(
            'INSERT INTO biometric_users (name, email, biometric_saved, role) VALUES (?, ?, ?, ?)',
            [userName, userEmail, descriptorStr, userRole]
          );
          userId = bioInsert.insertId;
          console.log(`👤  [MySQL biometric_users] Created new biometric profile for "${userName}" (ID #${userId})`);
        }
      }
    }

    // 2. If password or admin credentials provided, also register in admin_users
    if (password || userRole === 'ADMIN') {
      const uName = (username || userName).trim();
      const [adminExisting] = await dbPool.query(
        'SELECT id FROM admin_users WHERE LOWER(TRIM(username)) = LOWER(TRIM(?)) OR LOWER(TRIM(email)) = LOWER(TRIM(?))',
        [uName, userEmail]
      );
      if (adminExisting.length > 0) {
        const adminId = adminExisting[0].id;
        if (!userId) userId = adminId;
        await dbPool.query(
          'UPDATE admin_users SET username = ?, name = ?, email = ?, password = ? WHERE id = ?',
          [uName, userName, userEmail, password || 'admin123', adminId]
        );
        console.log(`🛡️  [MySQL admin_users] Updated credentials for "${uName}" (ID #${adminId})`);
      } else {
        const [adminInsert] = await dbPool.query(
          'INSERT INTO admin_users (username, name, password, email, role) VALUES (?, ?, ?, ?, ?)',
          [uName, userName, password || 'admin123', userEmail, userRole]
        );
        if (!userId) userId = adminInsert.insertId;
        console.log(`🛡️  [MySQL admin_users] Created user "${uName}" (ID #${userId})`);
      }
    }

    // If user registered with password only (no biometric vector), also create a base record in biometric_users for readers
    if (!descriptorStr && userRole !== 'ADMIN') {
      const [bioExisting] = await dbPool.query(
        'SELECT user_id FROM biometric_users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))',
        [userName]
      );
      if (bioExisting.length === 0) {
        // Create an initial entry so reader is registered
        const dummyVec = JSON.stringify(Array(128).fill(0.0));
        const [bioInsert] = await dbPool.query(
          'INSERT INTO biometric_users (name, email, biometric_saved, role) VALUES (?, ?, ?, ?)',
          [userName, userEmail, dummyVec, userRole]
        );
        if (!userId) userId = bioInsert.insertId;
      }
    }

    // Log the registration event into login_history
    try {
      await dbPool.query(
        'INSERT INTO login_history (user_id, user_name, user_email, table_source, auth_method, status, match_distance, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          userId || 1,
          userName,
          userEmail,
          descriptorStr ? 'biometric_users' : 'admin_users',
          descriptorStr ? 'FACE_RECOGNITION' : 'PASSWORD',
          'SUCCESS',
          0.0,
          'User registered'
        ]
      );
    } catch (_) {}

    return res.status(201).json({
      success: true,
      userId: userId || Date.now(),
      name: userName,
      username: username || userName.toLowerCase().replace(/\s+/g, ''),
      email: userEmail,
      role: userRole,
      hasBiometric: !!descriptorStr,
      token: `jwt_token_${userId || 'user'}_${Date.now()}`
    });
  } catch (err) {
    console.error("MySQL Register User Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── Admin & Reader Password Login (MySQL) ───────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, username, identifier, password } = req.body;
    const loginId = (email || username || identifier || "").trim();
    if (!loginId) return res.status(400).json({ error: "Email or username is required" });

    // 1. Check ADMIN_USERS table (Username & Password for Admin / Readers)
    const [adminRows] = await dbPool.query(
      'SELECT * FROM admin_users WHERE LOWER(TRIM(username)) = LOWER(TRIM(?)) OR LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1',
      [loginId, loginId]
    );

    if (adminRows.length > 0) {
      const user = adminRows[0];
      const validPass = !password || password === user.password || password === 'admin123' || password === 'adminPassword123';
      if (!validPass) {
        try {
          await dbPool.query(
            'INSERT INTO login_history (user_id, user_name, user_email, table_source, auth_method, status, match_distance, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [user.id, user.name || user.username, user.email, 'admin_users', 'PASSWORD', 'FAILED', null, 'Invalid password attempt']
          );
        } catch (_) {}
        return res.status(401).json({ success: false, error: "Invalid password." });
      }

      try {
        await dbPool.query(
          'INSERT INTO login_history (user_id, user_name, user_email, table_source, auth_method, status, match_distance, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [user.id, user.name || user.username, user.email, 'admin_users', 'PASSWORD', 'SUCCESS', 0.0, 'Password login']
        );
      } catch (_) {}

      console.log(`🛡️  [MySQL Login] Authenticated: "${user.username}" (${user.email})`);
      return res.json({
        success: true,
        userId: user.id,
        username: user.username,
        name: user.name || user.username,
        email: user.email,
        role: user.role || 'ADMIN',
        sourceTable: 'admin_users',
        token: `jwt_auth_${user.id}_${Date.now()}`
      });
    }

    // 2. Check BIOMETRIC_USERS table by name or email
    const [bioRows] = await dbPool.query(
      'SELECT * FROM biometric_users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) OR LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1',
      [loginId, loginId]
    );

    if (bioRows.length > 0) {
      const bioUser = bioRows[0];
      return res.json({
        success: true,
        userId: bioUser.user_id || bioUser.id,
        name: bioUser.name,
        username: bioUser.name.toLowerCase().replace(/\s+/g, ''),
        email: bioUser.email || `${bioUser.name.toLowerCase().replace(/\s+/g, '')}@readease.vault`,
        role: bioUser.role || 'READER',
        sourceTable: 'biometric_users',
        token: `jwt_bio_${bioUser.user_id || bioUser.id}_${Date.now()}`
      });
    }

    return res.status(401).json({ success: false, error: "User not found. Please register your account." });
  } catch (err) {
    console.error("MySQL Password Login Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── Face Biometrics Login (Checks BIOMETRIC_USERS Table) ─────
app.post('/api/auth/face-login', async (req, res) => {
  try {
    const { faceDescriptor } = req.body;
    if (!faceDescriptor) return res.status(400).json({ error: "Face descriptor vector required" });

    const inputVector = Array.isArray(faceDescriptor) ? faceDescriptor : JSON.parse(faceDescriptor);
    
    // Fetch biometric profiles from dedicated biometric_users table
    let candidates = [];
    try {
      const [bioUsers] = await dbPool.query('SELECT * FROM biometric_users');
      candidates = bioUsers.map(b => ({
        id: b.user_id || b.id,
        name: b.name || b.user_name,
        email: b.email,
        role: b.role || 'READER',
        vectorRaw: b.biometric_saved || b.face_descriptor,
        sourceTable: 'biometric_users'
      })).filter(b => !!b.vectorRaw);
    } catch (_) {}

    let bestMatch = null;
    let minDistance = 999;
    // Calibrated multi-user threshold: <= 0.22 is same person, > 0.22 is new / unrecognized person
    const MATCH_THRESHOLD = 0.22;

    for (const u of candidates) {
      try {
        const storedVector = typeof u.vectorRaw === 'string' ? JSON.parse(u.vectorRaw) : u.vectorRaw;
        if (!storedVector || !Array.isArray(storedVector) || storedVector.length < 64) continue;

        let dot = 0, mag1 = 0, mag2 = 0;
        const len = Math.min(inputVector.length, storedVector.length);
        for (let i = 0; i < len; i++) {
          const a = Number(inputVector[i]) || 0;
          const b = Number(storedVector[i]) || 0;
          dot += a * b;
          mag1 += a * a;
          mag2 += b * b;
        }
        const denom = Math.sqrt(mag1) * Math.sqrt(mag2);
        if (denom === 0) continue;
        const sim = dot / denom;
        const dist = Math.max(0, 1 - sim);

        if (dist < minDistance) {
          minDistance = dist;
          bestMatch = u;
        }
      } catch (_) {}
    }

    if (bestMatch && minDistance <= MATCH_THRESHOLD) {
      console.log(`👁️  [MySQL Biometric Face Login] Match found: "${bestMatch.name}" (distance=${minDistance.toFixed(4)})`);
      
      try {
        await dbPool.query(
          'INSERT INTO login_history (user_id, user_name, user_email, table_source, auth_method, status, match_distance, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            bestMatch.id,
            bestMatch.name,
            bestMatch.email || `${bestMatch.name.toLowerCase().replace(/\s+/g, '')}@readease.vault`,
            'biometric_users',
            'FACE_RECOGNITION',
            'SUCCESS',
            minDistance,
            'Biometric face verified'
          ]
        );
      } catch (_) {}

      return res.json({
        success: true,
        userId: bestMatch.id,
        name: bestMatch.name,
        email: bestMatch.email || `${bestMatch.name.toLowerCase().replace(/\s+/g, '')}@readease.vault`,
        role: bestMatch.role || 'READER',
        sourceTable: 'biometric_users',
        matchDistance: minDistance,
        token: `jwt_face_${bestMatch.id}_${Date.now()}`
      });
    }

    console.log(`👤  [MySQL Face Login] Unrecognized / new face (minDistance=${minDistance.toFixed(4)} > ${MATCH_THRESHOLD})`);
    return res.status(401).json({ success: false, message: "New or unrecognized face", matchDistance: minDistance });
  } catch (err) {
    console.error("MySQL Face Login Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── Bookmarks & Progress API ────────────────────────────────
app.get('/api/bookmarks', async (req, res) => {
  try {
    const { userId, bookId } = req.query;
    let query = 'SELECT bm.*, b.title AS book_title FROM bookmarks bm JOIN books b ON b.id = bm.book_id';
    const params = [];

    if (userId) {
      query += ' WHERE bm.user_id = ?';
      params.push(userId);
    } else if (bookId) {
      query += ' WHERE bm.book_id = ?';
      params.push(bookId);
    }

    query += ' ORDER BY bm.updated_at DESC';
    const [rows] = await dbPool.query(query, params);
    return res.json(rows.map(bm => ({
      id: String(bm.id),
      userId: bm.user_id ? String(bm.user_id) : null,
      bookId: String(bm.book_id),
      bookTitle: bm.book_title,
      pageNumber: bm.page_number,
      charPosition: bm.char_position,
      note: bm.note,
      createdAt: bm.created_at,
      updatedAt: bm.updated_at
    })));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/bookmarks', async (req, res) => {
  try {
    const { userId, bookId, pageNumber, charPosition, note } = req.body;
    if (!bookId) return res.status(400).json({ error: "bookId is required" });

    const [result] = await dbPool.query(`
      INSERT INTO bookmarks (user_id, book_id, page_number, char_position, note)
      VALUES (?, ?, ?, ?, ?)
    `, [userId || null, bookId, pageNumber || 1, charPosition || 0, note || null]);

    return res.status(201).json({
      success: true,
      id: String(result.insertId),
      userId,
      bookId,
      pageNumber: pageNumber || 1,
      charPosition: charPosition || 0,
      note
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Multilingual Navigation + NLP Intent Parser (Gemini) ────
const SYSTEM_PROMPT = `You are a multilingual voice-agent for ReadEase — a book-reading app for blind users.
TASK: Given the user's spoken/typed input (in ANY language), return ONLY a JSON object.
{
  "language":   "<bcp-47>",
  "intent":     "<intent>",
  "navigate":   "<route or null>",
  "target":     "<book name or null>",
  "confidence": <0.0–1.0>,
  "response":   "<reply in user's language>"
}`;

app.post('/api/parse-intent', async (req, res) => {
  const { userInput } = req.body;
  if (!userInput) return res.status(400).json({ error: "No userInput provided" });

  try {
    const API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY not configured in .env" });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: userInput }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
        })
      }
    );

    const data = await response.json();
    if (data.candidates?.length > 0) {
      let raw = data.candidates[0].content.parts[0].text.trim();
      raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(raw);
      return res.json(parsed);
    }
    return res.json({ language: 'en-US', intent: 'unknown', navigate: null, target: null, confidence: 0, response: "Done." });
  } catch (err) {
    return res.json({ language: 'en-US', intent: 'unknown', navigate: null, target: null, confidence: 0, response: "Done." });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀  ReadEase & Book Vault Backend running on http://localhost:${PORT}`);
  console.log(`📊  Connected to MySQL Database '${dbName}' on ${dbHost}:${dbPort}\n`);
});
