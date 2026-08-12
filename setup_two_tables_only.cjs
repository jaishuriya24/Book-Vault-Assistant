const mysql = require('mysql2/promise');
require('dotenv').config();

async function createTwoTablesOnly() {
  const dbs = ['bookvault', 'farmo_ai_db'];

  for (const db of dbs) {
    console.log(`\n======================================================`);
    console.log(`🧹 Setting up EXACTLY 2 Tables in Database: '${db}'`);
    console.log(`======================================================`);

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

    // Drop all other base tables so ONLY 2 tables remain
    const [allTbls] = await conn.query('SHOW FULL TABLES WHERE Table_Type = "BASE TABLE"');
    for (const t of allTbls) {
      const tName = Object.values(t)[0];
      try {
        await conn.query(`DROP TABLE IF EXISTS ${tName}`);
      } catch (_) {}
    }

    // ── TABLE 1: ADMIN_USERS ──────────────────────────────────────
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

    // ── TABLE 2: BIOMETRIC_USERS ──────────────────────────────────
    await conn.query(`
      CREATE TABLE biometric_users (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        face_descriptor LONGTEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // Seed Table 1 (Admin)
    await conn.query(`
      INSERT INTO admin_users (username, password, email, role)
      VALUES ('admin', 'admin123', 'admin@readease.vault', 'ADMIN');
    `);

    // Seed Table 2 (Biometric Faces)
    const sampleVec1 = JSON.stringify(Array.from({length: 128}, (_, i) => Number((Math.sin(i * 0.2) * 0.08).toFixed(4))));
    const sampleVec2 = JSON.stringify(Array.from({length: 128}, (_, i) => Number((Math.cos(i * 0.3) * 0.08).toFixed(4))));

    await conn.query(`
      INSERT INTO biometric_users (name, face_descriptor)
      VALUES 
      ('Emily Reader', ?),
      ('George Reader', ?);
    `, [sampleVec1, sampleVec2]);

    // Check count of tables
    const [finalTables] = await conn.query('SHOW TABLES');
    console.log(`✅ EXACTLY ${finalTables.length} tables exist in '${db}':`);
    for (const row of finalTables) {
      console.log(`   📁 ${Object.values(row)[0]}`);
    }

    await conn.end();
  }

  console.log('\n🎉 DATABASE CLEANED: ONLY 2 TABLES EXIST NOW!\n');
}

createTwoTablesOnly();
