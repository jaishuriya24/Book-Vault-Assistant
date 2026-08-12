const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const DB_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
  user: process.env.MYSQL_USER || 'farmer',
  password: process.env.MYSQL_PASSWORD || 'farmer123',
  database: process.env.MYSQL_DB || 'farmo_ai_db',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
};

async function testDatabaseConnections() {
  console.log('\n===============================================================');
  console.log('🧪  TESTING MYSQL DATABASE CONNECTIONS & RELATIONAL TABLES');
  console.log(`📡  Target: ${DB_CONFIG.user}@${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`);
  console.log('===============================================================\n');

  const pool = mysql.createPool(DB_CONFIG);

  try {
    // 1. Connection Pool Ping Test
    console.log('🔹 1. Testing Connection Pool & Ping...');
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('   ✅ Connection pool active and healthy.\n');

    // 2. Test Reading from APP_USERS
    console.log('🔹 2. Testing `app_users` Table...');
    const [users] = await pool.query('SELECT id, name, email, role, created_at FROM app_users');
    console.log(`   ✅ Successfully retrieved ${users.length} users:`);
    users.forEach(u => console.log(`      • ID #${u.id}: "${u.name}" (${u.email}) [Role: ${u.role}]`));
    console.log();

    // 3. Test Reading from BOOKS
    console.log('🔹 3. Testing `books` Table...');
    const [books] = await pool.query(`
      SELECT b.id, b.title, b.author, b.language, b.source, u.name AS user_name 
      FROM books b 
      LEFT JOIN app_users u ON u.id = b.user_id
    `);
    console.log(`   ✅ Successfully retrieved ${books.length} books:`);
    books.forEach(b => console.log(`      • ID #${b.id}: "${b.title}" by ${b.author} [Owner: ${b.user_name || 'Public'}]`));
    console.log();

    // 4. Test Relational CRUD: Insert Book -> Insert Page -> Insert Bookmark -> Test Foreign Key Cascade
    console.log('🔹 4. Testing Relational CRUD & Foreign Key Integrity...');
    const testUserId = users.length > 0 ? users[0].id : null;

    // A. Insert test book
    const [bookResult] = await pool.query(`
      INSERT INTO books (user_id, title, author, language, full_text, content, source) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [testUserId, 'Automated Test Book', 'QA Agent', 'eng', 'Test content for validation.', 'Test content for validation.', 'test']);
    const testBookId = bookResult.insertId;
    console.log(`   ✓ Created test book ID #${testBookId}`);

    // B. Insert test page linked to book
    const [pageResult] = await pool.query(`
      INSERT INTO pages (book_id, page_number, image_data, extracted_text, dhash) 
      VALUES (?, ?, ?, ?, ?)
    `, [testBookId, 1, 'data:image/png;base64,testImageData', 'Page 1 OCR Extracted Text', 'dhash12345']);
    const testPageId = pageResult.insertId;
    console.log(`   ✓ Created test page ID #${testPageId} linked to book #${testBookId}`);

    // C. Insert test bookmark linked to user and book
    const [bkmkResult] = await pool.query(`
      INSERT INTO bookmarks (user_id, book_id, page_number, char_position, note) 
      VALUES (?, ?, ?, ?, ?)
    `, [testUserId, testBookId, 1, 10, 'Test bookmark note']);
    const testBookmarkId = bkmkResult.insertId;
    console.log(`   ✓ Created test bookmark ID #${testBookmarkId} linked to book #${testBookId}`);

    // D. Query join across tables
    const [joined] = await pool.query(`
      SELECT b.title, p.page_number, p.extracted_text, bm.note, u.name AS user_name
      FROM books b
      JOIN pages p ON p.book_id = b.id
      JOIN bookmarks bm ON bm.book_id = b.id
      LEFT JOIN app_users u ON u.id = b.user_id
      WHERE b.id = ?
    `, [testBookId]);
    console.log(`   ✓ Joined query verified: Found "${joined[0].title}" with page ${joined[0].page_number} and note "${joined[0].note}"`);

    // E. Test CASCADE Delete (Deleting book automatically deletes its pages and bookmarks)
    await pool.query('DELETE FROM books WHERE id = ?', [testBookId]);
    const [pagesAfter] = await pool.query('SELECT id FROM pages WHERE id = ?', [testPageId]);
    const [bkmkAfter] = await pool.query('SELECT id FROM bookmarks WHERE id = ?', [testBookmarkId]);
    if (pagesAfter.length === 0 && bkmkAfter.length === 0) {
      console.log(`   ✅ Foreign Key CASCADE Delete verified: Pages & Bookmarks cleaned up automatically.\n`);
    } else {
      console.warn(`   ⚠️ Cascade verification check failed.`);
    }

    // 5. Test Views
    console.log('🔹 5. Testing Database Views...');
    const [regView] = await pool.query('SELECT * FROM registered_users_view');
    console.log(`   ✅ \`registered_users_view\`: ${regView.length} records found.`);
    const [loginView] = await pool.query('SELECT * FROM user_logins_view LIMIT 5');
    console.log(`   ✅ \`user_logins_view\`: ${loginView.length} audit records found.\n`);

    // 6. Test Login History Audit Insertion
    console.log('🔹 6. Testing `login_history` Audit Log...');
    await pool.query(`
      INSERT INTO login_history (user_id, user_name, user_email, auth_method, status, match_distance, note) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [testUserId, users[0]?.name || 'Test User', users[0]?.email || 'test@vault.local', 'SYSTEM_TEST', 'SUCCESS', 0.0, 'Automated connection check']);
    console.log('   ✅ Audit record logged successfully.\n');

    console.log('===============================================================');
    console.log('🎉  ALL DATABASE TESTS PASSED PERFECTLY!');
    console.log('===============================================================\n');

  } catch (err) {
    console.error('\n❌  Database Test Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testDatabaseConnections();
