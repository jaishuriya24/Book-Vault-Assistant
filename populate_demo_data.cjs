const mysql = require('mysql2/promise');
require('dotenv').config();

async function populateDemo() {
  const dbs = ['bookvault', 'farmo_ai_db'];
  for (const db of dbs) {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'farmer',
      password: 'farmer123',
      database: db
    });

    // Biometric demo user 1: John Doe
    const sampleVec1 = JSON.stringify(Array.from({length: 128}, (_, i) => Number((Math.sin(i * 0.2) * 0.08).toFixed(4))));
    await conn.query(
      'INSERT INTO biometric_users (name, email, face_descriptor, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE face_descriptor = VALUES(face_descriptor)',
      ['John Doe', 'johndoe@bookvault.local', sampleVec1, 'READER']
    );

    // Biometric demo user 2: Emily Reader
    const sampleVec2 = JSON.stringify(Array.from({length: 128}, (_, i) => Number((Math.cos(i * 0.3) * 0.08).toFixed(4))));
    await conn.query(
      'INSERT INTO biometric_users (name, email, face_descriptor, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE face_descriptor = VALUES(face_descriptor)',
      ['Emily Reader', 'emily@readease.vault', sampleVec2, 'READER']
    );

    // Demo login history
    await conn.query(`
      INSERT INTO login_history (user_name, user_email, table_source, auth_method, status, match_distance, note)
      VALUES 
      ('Admin Reader', 'admin@readease.vault', 'admin_users', 'ADMIN_PASSWORD', 'SUCCESS', 0.0, 'Administrator login'),
      ('John Doe', 'johndoe@bookvault.local', 'biometric_users', 'FACE_RECOGNITION', 'SUCCESS', 0.0421, 'Matched John Doe (dist: 0.0421)'),
      ('Emily Reader', 'emily@readease.vault', 'biometric_users', 'FACE_RECOGNITION', 'SUCCESS', 0.0385, 'Matched Emily Reader (dist: 0.0385)'),
      ('Standard Reader', 'reader@bookvault.local', 'standard_users', 'PASSWORD', 'SUCCESS', 0.0, 'Standard password login')
    `);

    console.log(`✅ Populated demo records in database '${db}'`);
    conn.end();
  }
}
populateDemo();
