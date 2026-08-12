const mysql = require('mysql2/promise');
require('dotenv').config();

async function applyToAllDatabases() {
  const dbs = ['bookvault', 'farmo_ai_db'];
  for (const db of dbs) {
    console.log('\n======================================================');
    console.log(`📦 Applying Schema & Populating Tables in: ${db}`);
    console.log('======================================================');
    const conn = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'farmer',
      password: 'farmer123',
      multipleStatements: true
    });
    await conn.query(`CREATE DATABASE IF NOT EXISTS ${db}`);
    await conn.query(`USE ${db}`);
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // Drop existing
    const tables = ['bookmarks', 'pages', 'login_history', 'books', 'biometric_users', 'standard_users', 'admin_users', 'app_users'];
    for (const t of tables) {
      await conn.query(`DROP TABLE IF EXISTS ${t}`);
    }
    
    // Table 1: admin_users
    await conn.query(`
      CREATE TABLE admin_users (
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
    
    // Table 2: biometric_users
    await conn.query(`
      CREATE TABLE biometric_users (
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
    
    // Table 3: standard_users
    await conn.query(`
      CREATE TABLE standard_users (
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
    
    // Table 4: app_users
    await conn.query(`
      CREATE TABLE app_users (
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
    
    // Table 5: books
    await conn.query(`
      CREATE TABLE books (
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
        INDEX idx_books_title (title(255)),
        CONSTRAINT fk_books_user FOREIGN KEY (user_id) REFERENCES app_users (id) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // Table 6: pages
    await conn.query(`
      CREATE TABLE pages (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        book_id BIGINT NULL,
        page_number INT NOT NULL,
        image_data LONGTEXT NOT NULL,
        extracted_text LONGTEXT NULL,
        dhash VARCHAR(64) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_pages_book (book_id),
        INDEX idx_pages_number (page_number),
        CONSTRAINT fk_pages_book FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // Table 7: login_history
    await conn.query(`
      CREATE TABLE login_history (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NULL,
        user_name VARCHAR(150) NULL,
        user_email VARCHAR(150) NULL,
        table_source VARCHAR(50) NOT NULL DEFAULT 'biometric_users',
        auth_method VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL,
        match_distance DOUBLE NULL,
        note VARCHAR(255) NULL,
        login_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_login_user (user_id),
        INDEX idx_login_time (login_time),
        INDEX idx_login_status (status),
        CONSTRAINT fk_login_user FOREIGN KEY (user_id) REFERENCES app_users (id) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // Table 8: bookmarks
    await conn.query(`
      CREATE TABLE bookmarks (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NULL,
        book_id BIGINT NOT NULL,
        page_number INT DEFAULT 1,
        char_position INT DEFAULT 0,
        note VARCHAR(500) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_bookmarks_user (user_id),
        INDEX idx_bookmarks_book (book_id),
        CONSTRAINT fk_bookmarks_user FOREIGN KEY (user_id) REFERENCES app_users (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_bookmarks_book FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    
    // Seed initial data
    await conn.query(`
      INSERT INTO admin_users (username, name, email, password, role)
      VALUES ('admin', 'Admin Reader', 'admin@readease.vault', 'admin123', 'ADMIN')
    `);
    
    await conn.query(`
      INSERT INTO standard_users (name, email, password, role)
      VALUES ('Standard Reader', 'reader@bookvault.local', 'reader123', 'READER')
    `);
    
    await conn.query(`
      INSERT INTO app_users (name, email, password, role, auth_type)
      VALUES ('Admin Reader', 'admin@readease.vault', 'admin123', 'ADMIN', 'PASSWORD'),
             ('Standard Reader', 'reader@bookvault.local', 'reader123', 'READER', 'PASSWORD')
    `);
    
    // List tables
    const [tablesList] = await conn.query('SHOW TABLES');
    console.log(`✅ All ${tablesList.length} tables successfully created in database '${db}':`);
    for (const row of tablesList) {
      console.log(`   📁 ${Object.values(row)[0]}`);
    }
    
    await conn.end();
  }
  console.log('\n🎉 ALL MYSQL DATABASES & TABLES INITIALIZED PERFECTLY!\n');
}

applyToAllDatabases();
