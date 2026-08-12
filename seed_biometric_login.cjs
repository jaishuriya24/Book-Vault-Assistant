const mysql = require('mysql2/promise');
require('dotenv').config();

async function setBiometricData() {
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

    // 1. Set Admin Credentials
    await conn.query(`
      INSERT INTO admin_users (username, password, email, role)
      VALUES ('admin', 'admin123', 'admin@readease.vault', 'ADMIN')
      ON DUPLICATE KEY UPDATE password = 'admin123';
    `);

    // 2. Set Biometric Face Users (user_id, name, biometric_saved)
    const vec1 = JSON.stringify(Array.from({length: 128}, (_, i) => Number((Math.sin(i * 0.2) * 0.08).toFixed(4))));
    const vec2 = JSON.stringify(Array.from({length: 128}, (_, i) => Number((Math.cos(i * 0.3) * 0.08).toFixed(4))));
    const vec3 = JSON.stringify(Array.from({length: 128}, (_, i) => Number((Math.sin(i * 0.35 + 0.1) * 0.08).toFixed(4))));

    await conn.query(`
      INSERT INTO biometric_users (name, biometric_saved)
      VALUES 
      ('Reader User', ?),
      ('Emily Reader', ?),
      ('George Reader', ?);
    `, [vec1, vec2, vec3]);

    console.log(`\n✅ Biometric Login is now SET in database '${db}'!`);
    const [rows] = await conn.query('SELECT user_id, name, SUBSTRING(biometric_saved, 1, 35) AS biometric_saved_preview FROM biometric_users');
    console.table(rows);
    await conn.end();
  }
}

setBiometricData();
