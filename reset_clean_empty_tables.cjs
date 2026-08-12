const mysql = require('mysql2/promise');
require('dotenv').config();

async function cleanAll() {
  const dbs = ['bookvault', 'farmo_ai_db'];

  for (const db of dbs) {
    const conn = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'farmer',
      password: 'farmer123',
      multipleStatements: true
    });

    await conn.query(`USE ${db}`);
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('DROP TABLE IF EXISTS biometric_users');
    await conn.query('DROP TABLE IF EXISTS admin_users');

    // Clean Schema: Table 1 (Admin Login)
    await conn.query(`
      CREATE TABLE admin_users (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(150) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        role VARCHAR(20) NOT NULL DEFAULT 'ADMIN',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Clean Schema: Table 2 (User Biometric Login - ZERO dummy inserts)
    await conn.query(`
      CREATE TABLE biometric_users (
        user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        biometric_saved LONGTEXT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log(`✅ Cleaned database '${db}': tables created with 0 dummy records (ready for live user input)!`);
    await conn.end();
  }
}

cleanAll();
