const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const DB_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
  user: process.env.MYSQL_USER || 'farmer',
  password: process.env.MYSQL_PASSWORD || 'farmer123',
  database: process.env.MYSQL_DB || 'farmo_ai_db',
  multipleStatements: true
};

async function setupDatabase() {
  console.log('\n===============================================================');
  console.log('🚀  BOOK VAULT — COMPLETE MYSQL DATABASE INITIALIZATION');
  console.log(`📡  Target: ${DB_CONFIG.user}@${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`);
  console.log('===============================================================\n');

  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅  [1/6] Successfully connected to MySQL database.\n');

    // ── STEP 1: CLEAN UP LEGACY / UNRELATED TABLES ──────────────
    console.log('🧹  [2/6] Cleaning up legacy/unrelated tables...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    const legacyTables = [
      'disease_logs',
      'disease_scans',
      'farmer_crops',
      'market_prices',
      'products',
      'unified_farmer_products',
      'ai_consultations',
      'farmers',
      'users'
    ];

    for (const tbl of legacyTables) {
      try {
        await connection.query(`DROP TABLE IF EXISTS ${tbl}`);
      } catch (_) {}
    }

    try {
      await connection.query('DROP VIEW IF EXISTS view_unified_all_in_one');
    } catch (_) {}
    try {
      await connection.query('DROP VIEW IF EXISTS user_logins_view');
    } catch (_) {}
    try {
      await connection.query('DROP VIEW IF EXISTS registered_users_view');
    } catch (_) {}

    // ── STEP 2: CREATE & STRUCTURE CORE TABLES WITH CONSISTENT BIGINT ──
    console.log('🏗️   [3/6] Structuring Book Vault relational tables...');

    // Drop existing foreign keys first before modifying column types
    const dropFk = async (table, constraint) => {
      try { await connection.query(`ALTER TABLE ${table} DROP FOREIGN KEY ${constraint}`); } catch (_) {}
    };

    await dropFk('books', 'fk_books_user');
    await dropFk('pages', 'fk_pages_book');
    await dropFk('login_history', 'fk_login_user');
    await dropFk('bookmarks', 'fk_bookmarks_user');
    await dropFk('bookmarks', 'fk_bookmarks_book');

    // 1. ADMIN_USERS TABLE (Administrator Credentials: Username & Password)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(150) NOT NULL UNIQUE,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'ADMIN',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_admin_username (username),
        INDEX idx_admin_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. BIOMETRIC_USERS TABLE (Biometric Face Login: Descriptors)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS biometric_users (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        face_descriptor LONGTEXT NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'READER',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_biometric_name (name),
        INDEX idx_biometric_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. STANDARD_USERS TABLE (Standard Password Users)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS standard_users (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'READER',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_standard_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. APP_USERS TABLE (Unified Registry for Relational Integrity)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL DEFAULT 'face_biometric_auth',
        role VARCHAR(20) NOT NULL DEFAULT 'READER',
        face_descriptor LONGTEXT NULL,
        auth_type VARCHAR(30) NOT NULL DEFAULT 'BIOMETRIC',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_app_users_email (email),
        INDEX idx_app_users_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    try {
      await connection.query('ALTER TABLE app_users MODIFY COLUMN id BIGINT AUTO_INCREMENT');
      const [userCols] = await connection.query('DESCRIBE app_users');
      const uColNames = userCols.map(c => c.Field.toLowerCase());
      if (!uColNames.includes('updated_at')) {
        await connection.query('ALTER TABLE app_users ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
      }
      if (!uColNames.includes('auth_type')) {
        await connection.query("ALTER TABLE app_users ADD COLUMN auth_type VARCHAR(30) NOT NULL DEFAULT 'BIOMETRIC'");
      }
    } catch (_) {}

    // 2. BOOKS TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS books (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NULL,
        title VARCHAR(500) NOT NULL,
        author VARCHAR(255) DEFAULT 'Unknown',
        language VARCHAR(20) DEFAULT 'eng',
        full_text LONGTEXT NULL,
        content LONGTEXT NULL,
        cover_image LONGTEXT NULL,
        source VARCHAR(50) DEFAULT 'manual',
        last_position_char INT DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_books_user (user_id),
        INDEX idx_books_title (title(255))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    try {
      await connection.query('ALTER TABLE books MODIFY COLUMN id BIGINT AUTO_INCREMENT');
      await connection.query('ALTER TABLE books MODIFY COLUMN user_id BIGINT NULL');
      const [bookCols] = await connection.query('DESCRIBE books');
      const bColNames = bookCols.map(c => c.Field.toLowerCase());
      if (!bColNames.includes('author')) {
        await connection.query("ALTER TABLE books ADD COLUMN author VARCHAR(255) DEFAULT 'Unknown' AFTER title");
      }
      if (!bColNames.includes('language')) {
        await connection.query("ALTER TABLE books ADD COLUMN language VARCHAR(20) DEFAULT 'eng' AFTER author");
      }
      if (!bColNames.includes('full_text')) {
        await connection.query('ALTER TABLE books ADD COLUMN full_text LONGTEXT NULL AFTER language');
      }
      if (!bColNames.includes('content')) {
        await connection.query('ALTER TABLE books ADD COLUMN content LONGTEXT NULL AFTER full_text');
      }
      if (!bColNames.includes('cover_image')) {
        await connection.query('ALTER TABLE books ADD COLUMN cover_image LONGTEXT NULL AFTER content');
      }
      if (!bColNames.includes('source')) {
        await connection.query("ALTER TABLE books ADD COLUMN source VARCHAR(50) DEFAULT 'manual' AFTER cover_image");
      }
      if (!bColNames.includes('last_position_char')) {
        await connection.query('ALTER TABLE books ADD COLUMN last_position_char INT DEFAULT 0 AFTER source');
      }
      if (!bColNames.includes('updated_at')) {
        await connection.query('ALTER TABLE books ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
      }
    } catch (_) {}

    // 3. PAGES TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS pages (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        book_id BIGINT NULL,
        page_number INT NOT NULL,
        image_data LONGTEXT NOT NULL,
        extracted_text LONGTEXT NULL,
        dhash VARCHAR(64) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_pages_book (book_id),
        INDEX idx_pages_number (page_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    try {
      await connection.query('ALTER TABLE pages MODIFY COLUMN id BIGINT AUTO_INCREMENT');
      await connection.query('ALTER TABLE pages MODIFY COLUMN book_id BIGINT NULL');
    } catch (_) {}

    // 4. LOGIN_HISTORY TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS login_history (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NULL,
        user_name VARCHAR(150) NULL,
        user_email VARCHAR(150) NULL,
        auth_method VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL,
        match_distance DOUBLE NULL,
        note VARCHAR(255) NULL,
        login_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_login_user (user_id),
        INDEX idx_login_time (login_time),
        INDEX idx_login_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    try {
      await connection.query('ALTER TABLE login_history MODIFY COLUMN id BIGINT AUTO_INCREMENT');
      await connection.query('ALTER TABLE login_history MODIFY COLUMN user_id BIGINT NULL');
      const [loginCols] = await connection.query('DESCRIBE login_history');
      const lColNames = loginCols.map(c => c.Field.toLowerCase());
      if (!lColNames.includes('note')) {
        await connection.query('ALTER TABLE login_history ADD COLUMN note VARCHAR(255) NULL AFTER match_distance');
      }
    } catch (_) {}

    // 5. BOOKMARKS & PROGRESS TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NULL,
        book_id BIGINT NOT NULL,
        page_number INT DEFAULT 1,
        char_position INT DEFAULT 0,
        note VARCHAR(500) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_bookmarks_user (user_id),
        INDEX idx_bookmarks_book (book_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    try {
      await connection.query('ALTER TABLE bookmarks MODIFY COLUMN id BIGINT AUTO_INCREMENT');
      await connection.query('ALTER TABLE bookmarks MODIFY COLUMN user_id BIGINT NULL');
      await connection.query('ALTER TABLE bookmarks MODIFY COLUMN book_id BIGINT NOT NULL');
    } catch (_) {}

    // ── STEP 3: REBUILD FOREIGN KEY CONSTRAINTS ─────────────────
    await connection.query(`
      ALTER TABLE books ADD CONSTRAINT fk_books_user 
      FOREIGN KEY (user_id) REFERENCES app_users (id) ON DELETE SET NULL ON UPDATE CASCADE
    `);
    await connection.query(`
      ALTER TABLE pages ADD CONSTRAINT fk_pages_book 
      FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE ON UPDATE CASCADE
    `);
    await connection.query(`
      ALTER TABLE login_history ADD CONSTRAINT fk_login_user 
      FOREIGN KEY (user_id) REFERENCES app_users (id) ON DELETE SET NULL ON UPDATE CASCADE
    `);
    await connection.query(`
      ALTER TABLE bookmarks ADD CONSTRAINT fk_bookmarks_user 
      FOREIGN KEY (user_id) REFERENCES app_users (id) ON DELETE CASCADE ON UPDATE CASCADE
    `);
    await connection.query(`
      ALTER TABLE bookmarks ADD CONSTRAINT fk_bookmarks_book 
      FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE ON UPDATE CASCADE
    `);

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('    ✓ All 5 core tables verified and structured with foreign keys.\n');

    // ── STEP 4: CREATE VIEWS ────────────────────────────────────
    console.log('👁️   [4/6] Creating database views...');
    try {
      await connection.query(`
        CREATE OR REPLACE VIEW registered_users_view AS
        SELECT 
          u.id AS user_id,
          u.name AS user_name,
          u.email AS email_address,
          u.role AS user_role,
          CASE 
            WHEN u.face_descriptor IS NOT NULL AND LENGTH(u.face_descriptor) > 10 THEN 'Biometric Enrolled'
            ELSE 'Password Only'
          END AS biometric_status,
          (SELECT COUNT(*) FROM books b WHERE b.user_id = u.id) AS total_books,
          (SELECT COUNT(*) FROM login_history lh WHERE lh.user_id = u.id) AS total_logins,
          u.created_at AS registered_at
        FROM app_users u;
      `);
      console.log('    ✓ View created: `registered_users_view`');
    } catch (e) {
      console.log('    ℹ Note on registered_users_view:', e.message);
    }

    try {
      await connection.query(`
        CREATE OR REPLACE VIEW user_logins_view AS
        SELECT 
          lh.id AS log_id,
          COALESCE(lh.user_name, u.name, 'Unknown') AS user_name,
          COALESCE(lh.user_email, u.email, '—') AS user_email,
          lh.auth_method,
          lh.status,
          lh.match_distance,
          lh.login_time
        FROM login_history lh
        LEFT JOIN app_users u ON u.id = lh.user_id;
      `);
      console.log('    ✓ View created: `user_logins_view`');
    } catch (e) {
      console.log('    ℹ Note on user_logins_view:', e.message);
    }

    // ── STEP 5: SEED INITIAL DATA IF EMPTY ──────────────────────
    console.log('\n🌱  [5/6] Checking and seeding initial sample data...');

    const [[usersCount]] = await connection.query('SELECT COUNT(*) AS count FROM app_users');
    if (usersCount.count === 0) {
      await connection.query(`
        INSERT INTO app_users (name, email, password, role, face_descriptor)
        VALUES (
          'Admin Reader',
          'admin@readease.vault',
          '$2a$10$tPxG7R5B5cWbW1R3wV6O4O9V5tQ0Pz6wX2s7R9F5rY9U2z1e2c1q.',
          'ADMIN',
          NULL
        );
      `);

      const sampleFaceVector = JSON.stringify(Array(128).fill(0.1));
      await connection.query(`
        INSERT INTO app_users (name, email, password, role, face_descriptor)
        VALUES (
          'John Doe',
          'johndoe@bookvault.local',
          'face_biometric_auth',
          'READER',
          ?
        );
      `, [sampleFaceVector]);

      console.log('    ✓ Default users seeded: Admin Reader and John Doe (Biometric).');
    } else {
      console.log(`    ✓ Existing users preserved (${usersCount.count} users found).`);
    }

    const [[booksCount]] = await connection.query('SELECT COUNT(*) AS count FROM books');
    if (booksCount.count === 0) {
      const [[firstUser]] = await connection.query('SELECT id FROM app_users ORDER BY id ASC LIMIT 1');
      const userId = firstUser ? firstUser.id : null;

      await connection.query(`
        INSERT INTO books (user_id, title, author, language, full_text, content, source)
        VALUES (
          ?,
          'The Art of Accessible Reading',
          'ReadEase Foundation',
          'eng',
          'Welcome to ReadEase and Book Vault. This application allows visually impaired and blind readers to explore documents and books through continuous speech synthesis, intelligent text recognition, and natural voice navigation.',
          'Welcome to ReadEase and Book Vault. This application allows visually impaired and blind readers to explore documents and books through continuous speech synthesis, intelligent text recognition, and natural voice navigation.',
          'manual'
        );
      `, [userId]);
      console.log('    ✓ Sample book seeded: "The Art of Accessible Reading".');
    } else {
      console.log(`    ✓ Existing books preserved (${booksCount.count} books found).`);
    }

    // ── STEP 6: VERIFY & PRINT STATUS ───────────────────────────
    console.log('\n📊  [6/6] Database Structure & Table Verification:');
    console.log('===============================================================');
    const [allTables] = await connection.query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"');
    for (const row of allTables) {
      const tableName = Object.values(row)[0];
      const [[cnt]] = await connection.query(`SELECT COUNT(*) AS count FROM ${tableName}`);
      const [fks] = await connection.query(`
        SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = '${DB_CONFIG.database}' AND TABLE_NAME = '${tableName}' AND REFERENCED_TABLE_NAME IS NOT NULL
      `);
      const fkInfo = fks.length > 0 ? ` [FK: ${fks.map(f => `${f.COLUMN_NAME} ➔ ${f.REFERENCED_TABLE_NAME}.${f.REFERENCED_COLUMN_NAME}`).join(', ')}]` : '';
      console.log(`  📁 Table: ${tableName.padEnd(16)} | Rows: ${String(cnt.count).padEnd(4)}${fkInfo}`);
    }
    console.log('===============================================================');
    console.log('✨  ALL BOOK VAULT DATABASE TABLES CONNECTED & READY!\n');

  } catch (error) {
    console.error('\n❌  Error during MySQL database initialization:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setupDatabase();
