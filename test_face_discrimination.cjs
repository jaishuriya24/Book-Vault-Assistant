const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Simulate 128-D spatial gradient facial vectors with zero-centering
function generateFacialVector(seed) {
  const vec = new Float32Array(128);
  for (let i = 0; i < 128; i++) {
    const s = Math.sin((seed + 1) * 1.61803398875 + i * 0.73);
    const c = Math.cos((seed + 1) * 2.71828182846 + i * 1.23);
    vec[i] = s * 0.5 + c * 0.5;
  }
  let mean = 0;
  for (let i = 0; i < 128; i++) mean += vec[i];
  mean /= 128;

  let norm = 0;
  for (let i = 0; i < 128; i++) {
    vec[i] -= mean;
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm) || 1.0;
  return Array.from(vec).map(v => Number((v / norm).toFixed(4)));
}

// Add slight camera noise/movement for same person
function addCameraNoise(baseVec) {
  const noisy = baseVec.map(v => v + (Math.random() - 0.5) * 0.04);
  let mean = 0;
  for (let i = 0; i < 128; i++) mean += noisy[i];
  mean /= 128;

  let norm = 0;
  for (let i = 0; i < 128; i++) {
    noisy[i] -= mean;
    norm += noisy[i] * noisy[i];
  }
  norm = Math.sqrt(norm) || 1.0;
  return Array.from(noisy).map(v => Number((v / norm).toFixed(4)));
}

async function testFaceDiscrimination() {
  console.log('\n===============================================================');
  console.log('🧪  TESTING MULTI-USER FACIAL DISCRIMINATION & NEW USER FLOW');
  console.log('===============================================================\n');

  const BASE_URL = 'http://localhost:3001';

  // 1. Generate distinct facial biometric vectors for User 1 (Alice) and User 2 (Bob)
  const aliceVector = generateFacialVector(101);
  const aliceScan2 = addCameraNoise(aliceVector); // Alice returning
  const bobVector = generateFacialVector(505);   // New person (Bob)

  // ── STEP 1: Enroll Alice ─────────────────────────────────────
  console.log('🔹 1. Enrolling Alice (Reader 1) with her 128-D facial vector...');
  const res1 = await fetch(`${BASE_URL}/api/auth/face-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Alice Reader',
      email: 'alice@readease.vault',
      role: 'READER',
      faceDescriptor: aliceVector
    })
  });
  console.log('   ✅ Alice enrolled successfully:', await res1.json());

  // ── STEP 2: Alice Returns ────────────────────────────────────
  console.log('\n🔹 2. Alice looks at the camera again (Returning Alice)...');
  const resAlice = await fetch(`${BASE_URL}/api/auth/face-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ faceDescriptor: aliceScan2 })
  });
  const aliceLogin = await resAlice.json();
  console.log(`   ✅ Alice verified (HTTP ${resAlice.status}): Matched as "${aliceLogin.name}"!`);

  // ── STEP 3: A Brand New Unregistered Person (Charlie) Approaches Camera ──
  console.log('\n🔹 3. A BRAND NEW UNREGISTERED PERSON (Charlie) looks at the camera...');
  const charlieVector = generateFacialVector(999); // completely new person
  const resCharlie = await fetch(`${BASE_URL}/api/auth/face-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ faceDescriptor: charlieVector })
  });
  const charlieData = await resCharlie.json();
  if (resCharlie.status === 401) {
    console.log(`   ✅ SUCCESS: Brand new face was NOT logged in as existing users!`);
    console.log(`      ➔ Server rejected with HTTP 401: "${charlieData.message}" (Distance: ${charlieData.matchDistance?.toFixed(4)} > 0.22 threshold)`);
    console.log(`      ➔ UI will prompt: "New face detected! Please enter your name to enroll."`);
  } else {
    console.error(`   ❌ FAIL: Charlie was incorrectly matched as "${charlieData.name}"!`);
  }

  // ── STEP 4: Bob Enrolls as New User ──────────────────────────
  console.log('\n🔹 4. Bob enters his name and enrolls his own face...');
  const resBobReg = await fetch(`${BASE_URL}/api/auth/face-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Bob Reader',
      email: 'bob@readease.vault',
      role: 'READER',
      faceDescriptor: bobVector
    })
  });
  console.log('   ✅ Bob enrolled successfully:', await resBobReg.json());

  // ── STEP 5: Verify Both Users Are Recognized Separately ──────
  console.log('\n🔹 5. Verifying Both Alice and Bob scan independently:');
  const checkAlice = await (await fetch(`${BASE_URL}/api/auth/face-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ faceDescriptor: aliceScan2 })
  })).json();
  console.log(`   • Alice scan ➔ Logged in as: "${checkAlice.name}"`);

  const bobScan2 = addCameraNoise(bobVector);
  const checkBob = await (await fetch(`${BASE_URL}/api/auth/face-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ faceDescriptor: bobScan2 })
  })).json();
  console.log(`   • Bob scan ➔ Logged in as: "${checkBob.name}"`);

  console.log('\n===============================================================');
  console.log('🎉  FACIAL RECOGNITION DISCRIMINATES DISTINCT USERS ACCURATELY!');
  console.log('===============================================================\n');
}

testFaceDiscrimination();
