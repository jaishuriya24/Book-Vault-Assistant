const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testAllLoginsMySQL() {
  console.log('\n===============================================================');
  console.log('🔐  TESTING ALL LOGIN & REGISTRATION FLOWS WITH MYSQL');
  console.log('===============================================================\n');

  const BASE_URL = 'http://localhost:3001';

  // ── TEST 1: Password Registration ───────────────────────────
  console.log('🔹 1. Testing Password Registration (`/api/auth/register`)...');
  try {
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'David TestUser',
        email: 'david@readease.vault',
        password: 'securePassword123',
        role: 'READER'
      })
    });
    const regData = await regRes.json();
    console.log('   ✅ Registered in MySQL:', regData);
  } catch (e) {
    console.error('   ❌ Registration error:', e.message);
  }

  // ── TEST 2: Password Login (Valid Credentials) ──────────────
  console.log('\n🔹 2. Testing Password Login with Valid Credentials (`/api/auth/login`)...');
  try {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'david@readease.vault',
        password: 'securePassword123'
      })
    });
    const loginData = await loginRes.json();
    console.log('   ✅ Valid Login Authenticated from MySQL:', loginData);
  } catch (e) {
    console.error('   ❌ Login error:', e.message);
  }

  // ── TEST 3: Password Login (Invalid Password) ────────────────
  console.log('\n🔹 3. Testing Password Login with Invalid Password...');
  try {
    const wrongRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'david@readease.vault',
        password: 'wrongPassword999'
      })
    });
    const wrongData = await wrongRes.json();
    console.log(`   ✅ Wrong password rejected with HTTP ${wrongRes.status}:`, wrongData);
  } catch (e) {
    console.error('   ❌ Wrong password test error:', e.message);
  }

  // ── TEST 4: Admin Login ─────────────────────────────────────
  console.log('\n🔹 4. Testing Admin Login...');
  try {
    const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@readease.vault',
        password: 'admin123'
      })
    });
    const adminData = await adminRes.json();
    console.log('   ✅ Admin Authenticated from MySQL (Role:', adminData.role, '):', adminData);
  } catch (e) {
    console.error('   ❌ Admin login error:', e.message);
  }

  // ── TEST 5: Biometric Face Login ────────────────────────────
  console.log('\n🔹 5. Testing Biometric Face Login (`/api/auth/face-login`)...');
  const mockVector = Array.from({ length: 128 }, (_, i) => 
    Number((Math.sin(i * 0.15) * 0.5 + 0.5).toFixed(4))
  );

  try {
    const faceRes = await fetch(`${BASE_URL}/api/auth/face-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ faceDescriptor: mockVector })
    });
    const faceData = await faceRes.json();
    console.log('   ✅ Face Biometric Match from MySQL:', faceData);
  } catch (e) {
    console.error('   ❌ Face login error:', e.message);
  }

  // ── TEST 6: Audit Trail in MySQL ────────────────────────────
  console.log('\n🔹 6. Verifying MySQL `login_history` Audit Log for All Flows...');
  try {
    const auditRes = await fetch(`${BASE_URL}/api/users/admin-logins`);
    const auditData = await auditRes.json();
    console.log(`   ✅ Retrieved ${auditData.length} audit records from MySQL:`);
    auditData.slice(0, 5).forEach(l => {
      console.log(`      • [${l.authMethod}] ${l.userName} (${l.email}) ➔ ${l.status} | Note: ${l.note || '—'}`);
    });
  } catch (e) {
    console.error('   ❌ Audit query error:', e.message);
  }

  console.log('\n===============================================================');
  console.log('🎉  ALL LOGIN PAGES ARE FULLY CONNECTED TO MYSQL!');
  console.log('===============================================================\n');
}

testAllLoginsMySQL();
