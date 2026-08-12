const mysql = require('mysql2/promise');

async function checkAll() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'farmer',
    password: 'farmer123',
  });

  const [dbs] = await conn.query('SHOW DATABASES');
  console.log('\n=== ALL MYSQL DATABASES ===');
  console.table(dbs);

  for (const dbObj of dbs) {
    const dbName = Object.values(dbObj)[0];
    if (['information_schema', 'performance_schema', 'sys'].includes(dbName)) continue;
    try {
      const [tables] = await conn.query(`SHOW FULL TABLES FROM \`${dbName}\``);
      console.log(`\n--- TABLES IN "${dbName}" ---`);
      console.table(tables);
    } catch (e) {
      console.log(`Could not read ${dbName}:`, e.message);
    }
  }

  await conn.end();
}

checkAll().catch(console.error);
