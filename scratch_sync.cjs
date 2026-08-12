const mysql = require('mysql2/promise');
require('dotenv').config();

async function syncDatabases() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'farmer',
    password: 'farmer123'
  });

  const [bios] = await conn.query('SELECT * FROM farmo_ai_db.biometric_users');
  for (const b of bios) {
    await conn.query(
      'INSERT INTO bookvault.biometric_users (name, email, face_descriptor, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE face_descriptor = VALUES(face_descriptor)',
      [b.name, b.email, b.face_descriptor, b.role]
    );
  }

  const [apps] = await conn.query('SELECT * FROM farmo_ai_db.app_users');
  for (const a of apps) {
    await conn.query(
      'INSERT INTO bookvault.app_users (name, email, password, role, face_descriptor, auth_type) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE auth_type = VALUES(auth_type)',
      [a.name, a.email, a.password, a.role, a.face_descriptor, a.auth_type]
    );
  }

  const [[bvBio]] = await conn.query('SELECT COUNT(*) c FROM bookvault.biometric_users');
  const [[bvAdmin]] = await conn.query('SELECT COUNT(*) c FROM bookvault.admin_users');
  const [[bvStd]] = await conn.query('SELECT COUNT(*) c FROM bookvault.standard_users');

  console.log(`✅ [bookvault DB] admin_users: ${bvAdmin.c}, biometric_users: ${bvBio.c}, standard_users: ${bvStd.c}`);
  await conn.end();
}

syncDatabases();
