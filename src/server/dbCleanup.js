import mysql from 'mysql2/promise';

export async function cleanupDuplicates() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'farmer',
    password: process.env.MYSQL_PASSWORD || 'farmer123',
    database: process.env.MYSQL_DB || 'bookvault',
  });

  try {
    // 1. Drop redundant legacy duplicate tables
    await pool.query('DROP TABLE IF EXISTS book_saves');
    await pool.query('DROP TABLE IF EXISTS booksaves');
    console.log('✅ Dropped duplicate tables: book_saves, booksaves');

    // 2. Remove duplicate book rows with identical title and user_id (keeping the earliest record)
    const [dupBooks] = await pool.query(`
      DELETE b1 FROM booksaved b1
      INNER JOIN booksaved b2
      WHERE b1.id > b2.id AND LOWER(TRIM(b1.title)) = LOWER(TRIM(b2.title)) AND b1.user_id = b2.user_id
    `);
    console.log(`✅ Removed duplicate books: ${dupBooks.affectedRows} rows cleaned`);

    // 2b. Remove default placeholder mock books
    const [mockBooks] = await pool.query(`
      DELETE FROM booksaved
      WHERE title IN ('The Great Gatsby', 'Dune: Part One', 'Atomic Habits', 'The Great AI Revolution')
         OR (user_id = 'Guest' AND author IN ('F. Scott Fitzgerald', 'Frank Herbert', 'James Clear', 'Antigravity AI'))
    `);
    console.log(`✅ Removed default mock books: ${mockBooks.affectedRows} rows cleaned`);

    // 3. Remove duplicate users with identical name
    const [dupUsers] = await pool.query(`
      DELETE u1 FROM biometric_users u1
      INNER JOIN biometric_users u2
      WHERE u1.user_id > u2.user_id AND LOWER(TRIM(u1.name)) = LOWER(TRIM(u2.name))
    `);
    console.log(`✅ Removed duplicate users: ${dupUsers.affectedRows} rows cleaned`);

    // 4. Remove orphaned book_pages that reference non-existent books
    const [dupPages] = await pool.query(`
      DELETE p FROM book_pages p
      LEFT JOIN booksaved b ON p.book_id = b.id
      WHERE b.id IS NULL AND p.book_id IS NOT NULL
    `);
    console.log(`✅ Removed orphaned pages: ${dupPages.affectedRows} rows cleaned`);

    const [tables] = await pool.query('SHOW TABLES');
    console.log('--- CLEANED TABLES IN BOOKVAULT ---');
    console.table(tables);

    return {
      success: true,
      removedDuplicateBooks: dupBooks.affectedRows,
      removedDuplicateUsers: dupUsers.affectedRows,
      removedOrphanedPages: dupPages.affectedRows,
      tables: tables.map(t => Object.values(t)[0])
    };
  } catch (err) {
    console.error('Error during cleanup:', err);
    return { success: false, error: err.message };
  } finally {
    await pool.end();
  }
}

// Auto-run when executed directly
if (process.argv[1]?.endsWith('dbCleanup.js')) {
  cleanupDuplicates().then(() => process.exit(0));
}
