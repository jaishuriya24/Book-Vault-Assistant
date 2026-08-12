const mysql = require('mysql2/promise');

const passwords = ['', 'root', 'admin', 'password', '1234', '123456', 'readease', 'bookvault', 'root123'];

async function tryConnect(password) {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: password
    });
    console.log(`SUCCESS with password: "${password}"`);
    await connection.end();
    return true;
  } catch (err) {
    console.log(`FAILED with password: "${password}":`, err.message);
    return false;
  }
}

async function run() {
  for (const pw of passwords) {
    if (await tryConnect(pw)) {
      break;
    }
  }
}

run();
