const mysql = require('mysql2/promise');
require('dotenv').config();

async function truncateAll() {
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

    // Wipe any existing rows
    await conn.query('TRUNCATE TABLE admin_users');
    await conn.query('TRUNCATE TABLE biometric_users');

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log(`✅ Database '${db}' is 100% EMPTY (0 rows). Ready for live user registration!`);
    
    const [[aCount]] = await conn.query('SELECT COUNT(*) AS total FROM admin_users');
    const [[bCount]] = await conn.query('SELECT COUNT(*) AS total FROM biometric_users');
    console.log(`   admin_users rows: ${aCount.total} | biometric_users rows: ${bCount.total}`);

    await conn.end();
  }
}

truncateAll();
