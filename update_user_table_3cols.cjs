const mysql = require('mysql2/promise');
require('dotenv').config();

async function update3Cols() {
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

    // Create biometric_users with EXACTLY 3 columns requested by user:
    // 1. user_id
    // 2. name
    // 3. biometric_saved
    await conn.query(`
      CREATE TABLE biometric_users (
        user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        biometric_saved LONGTEXT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // Seed initial demo faces
    const sampleVec1 = JSON.stringify(Array.from({length: 128}, (_, i) => Number((Math.sin(i * 0.2) * 0.08).toFixed(4))));
    const sampleVec2 = JSON.stringify(Array.from({length: 128}, (_, i) => Number((Math.cos(i * 0.3) * 0.08).toFixed(4))));

    await conn.query(`
      INSERT INTO biometric_users (name, biometric_saved)
      VALUES 
      ('Emily Reader', ?),
      ('George Reader', ?);
    `, [sampleVec1, sampleVec2]);

    console.log(`✅ Updated biometric_users in '${db}' with 3 columns (user_id, name, biometric_saved)`);
    await conn.end();
  }
}

update3Cols();
