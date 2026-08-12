const mysql = require('mysql2/promise');

async function testBooksavedSuite() {
  const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

  console.log('========================================================================');
  console.log('📚 BOOK VAULT — MYSQL "booksaved" TABLE & COVER IMAGE TEST SUITE');
  console.log('🎯 Target Backend: http://localhost:3001');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 5;

  // 1. Health check with booksaved table count
  try {
    const health = await (await fetch('http://localhost:3001/api/db/health')).json();
    if (health.status === 'CONNECTED' && health.tables && health.tables.booksaved !== undefined) {
      console.log('✅ [1/5 PASS] Database Health & MySQL tables:', health.tables);
      passed++;
    } else {
      console.log('❌ [1/5 FAIL] Health check failed:', health);
    }
  } catch (e) {
    console.log('❌ [1/5 FAIL] Health Error:', e.message);
  }

  // 2. Add New Book with Image Cover into booksaved
  let createdBookId = null;
  const sampleCover = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  
  try {
    const newBook = {
      title: 'Dune (Chronicles Edition)',
      author: 'Frank Herbert',
      coverImage: sampleCover,
      cover: sampleCover,
      content: 'A beginning is the time for taking the most delicate care that the balances are correct...',
      pageCount: 5,
      userId: 'jAI',
      userName: 'jAI',
      source: 'camera'
    };

    const res = await (await fetch('http://localhost:3001/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBook)
    })).json();

    createdBookId = res.id;
    if (createdBookId && res.title === newBook.title && res.coverImage.startsWith('data:image')) {
      console.log('✅ [2/5 PASS] Successfully inserted book into "booksaved" table:', {
        id: res.id,
        title: res.title,
        coverLength: res.coverImage.length,
        pageCount: res.pageCount
      });
      passed++;
    } else {
      console.log('❌ [2/5 FAIL] Book creation failed:', res);
    }
  } catch (e) {
    console.log('❌ [2/5 FAIL] Insert Error:', e.message);
  }

  // 3. Fetch Books from MySQL booksaved & Verify Image
  try {
    const books = await (await fetch('http://localhost:3001/api/books')).json();
    const found = books.find(b => String(b.id) === String(createdBookId));
    if (found && found.cover && found.cover.startsWith('data:image')) {
      console.log('✅ [3/5 PASS] Retrieved book from MySQL "booksaved" table with cover image intact:', {
        id: found.id,
        title: found.title,
        hasCover: !!found.cover
      });
      passed++;
    } else {
      console.log('❌ [3/5 FAIL] Book not found in list or cover missing:', found);
    }
  } catch (e) {
    console.log('❌ [3/5 FAIL] Fetch Error:', e.message);
  }

  // 4. Query MySQL "booksaved" Table Directly
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'farmer',
      password: 'farmer123',
      database: 'bookvault'
    });

    const [rows] = await conn.query('SELECT id, title, page_count, LENGTH(cover_image) AS cover_bytes FROM booksaved WHERE id = ?', [createdBookId]);
    if (rows.length > 0 && rows[0].cover_bytes > 0) {
      console.log('✅ [4/5 PASS] Direct SQL check on "booksaved" table succeeded:', rows[0]);
      passed++;
    } else {
      console.log('❌ [4/5 FAIL] MySQL direct row not found in booksaved:', rows);
    }
    await conn.end();
  } catch (e) {
    console.log('❌ [4/5 FAIL] MySQL Query Error:', e.message);
  }

  // 5. Update Book Cover & Clean Up
  try {
    const updatedCover = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const putRes = await (await fetch(`http://localhost:3001/api/books/${createdBookId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Dune (Updated Cover)', coverImage: updatedCover })
    })).json();

    if (putRes.success) {
      console.log('✅ [5/5 PASS] Updated book cover in MySQL "booksaved" successfully!');
      passed++;
    } else {
      console.log('❌ [5/5 FAIL] Update failed:', putRes);
    }
  } catch (e) {
    console.log('❌ [5/5 FAIL] Update Error:', e.message);
  }

  console.log('\n========================================================================');
  console.log(`📊 FINAL RESULT: ${passed}/${total} TESTS PASSED`);
  if (passed === total) {
    console.log('🎉 MYSQL "booksaved" TABLE & COVER IMAGE PIPELINE FULLY VERIFIED!');
  }
  console.log('========================================================================');
}

testBooksavedSuite().catch(console.error);
