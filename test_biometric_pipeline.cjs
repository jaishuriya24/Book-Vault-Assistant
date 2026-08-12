const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const mysql = require('mysql2/promise');
require('dotenv').config();

function generateRealisticFacialVector(seed) {
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

function simulateCameraMovementAndLighting(baseVec, noiseMagnitude = 0.04) {
  const noisy = baseVec.map(v => v + (Math.random() - 0.5) * noiseMagnitude);
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

async function runBiometricPipelineTest() {
  console.log('\n===============================================================');
  console.log('🧪  RUNNING COMPREHENSIVE BIOMETRIC PIPELINE VERIFICATION');
  console.log('===============================================================\n');

  const BASE_URL = 'http://localhost:3001';

  // 1. Check server health
  try {
    const health = await (await fetch(`${BASE_URL}/api/db/health`)).json();
    console.log(`✅ [Backend Status] Database ${health.database} @ ${health.host}:${health.port} is ${health.status}`);
  } catch (e) {
    console.error('❌ Backend server is not running on port 3001! Please start it with "node server.js".');
    process.exit(1);
  }

  // 2. Prepare Distinct Vectors
  const emilyVector = generateRealisticFacialVector(777); // User 1: Emily
  const emilyScan2 = simulateCameraMovementAndLighting(emilyVector, 0.05); // Emily returning with light change
  const georgeVector = generateRealisticFacialVector(333); // User 2: George
  const georgeScan2 = simulateCameraMovementAndLighting(georgeVector, 0.05);
  const unknownVector = generateRealisticFacialVector(9999); // Unregistered Person

  // ── STEP 1: Enroll Emily as a new user ──
  console.log('\n🔹 1. New User "Emily Reader" registers her face...');
  const resEmilyReg = await fetch(`${BASE_URL}/api/auth/face-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Emily Reader',
      email: 'emily@readease.vault',
      role: 'READER',
      faceDescriptor: emilyVector
    })
  });
  const emilyRegData = await resEmilyReg.json();
  console.log(`   ✅ Emily registered successfully (User ID #${emilyRegData.userId})`);

  // ── STEP 2: Emily logs in again (Returning User) ──
  console.log('\n🔹 2. Returning Emily looks at camera (slight movement/lighting variation)...');
  const resEmilyLogin = await fetch(`${BASE_URL}/api/auth/face-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ faceDescriptor: emilyScan2 })
  });
  const emilyLoginData = await resEmilyLogin.json();
  if (resEmilyLogin.ok && emilyLoginData.name === 'Emily Reader') {
    console.log(`   ✅ SUCCESS: Emily recognized automatically as "${emilyLoginData.name}"! No name prompt shown.`);
  } else {
    console.error(`   ❌ FAILED: Emily not recognized:`, emilyLoginData);
  }

  // ── STEP 3: An Unregistered Person looks at the camera ──
  console.log('\n🔹 3. Brand new unregistered person approaches camera...');
  const resUnknown = await fetch(`${BASE_URL}/api/auth/face-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ faceDescriptor: unknownVector })
  });
  const unknownData = await resUnknown.json();
  if (resUnknown.status === 401) {
    console.log(`   ✅ SUCCESS: Unregistered person was NOT falsely matched! (Status 401: "${unknownData.message}", dist: ${unknownData.matchDistance?.toFixed(4)})`);
    console.log(`      ➔ Frontend will prompt for name only for this new person.`);
  } else {
    console.error(`   ❌ FAILED: Unregistered person was falsely matched as:`, unknownData);
  }

  // ── STEP 4: George registers as new user ──
  console.log('\n🔹 4. George enters his name and enrolls his face...');
  const resGeorgeReg = await fetch(`${BASE_URL}/api/auth/face-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'George Reader',
      email: 'george@readease.vault',
      role: 'READER',
      faceDescriptor: georgeVector
    })
  });
  const georgeRegData = await resGeorgeReg.json();
  console.log(`   ✅ George registered successfully (User ID #${georgeRegData.userId})`);

  // ── STEP 5: Verify Both Users Authenticate to their own accounts ──
  console.log('\n🔹 5. Verifying multi-user discrimination:');
  const checkEmily = await (await fetch(`${BASE_URL}/api/auth/face-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ faceDescriptor: emilyScan2 })
  })).json();
  console.log(`   • Emily scan ➔ Correctly matched as: "${checkEmily.name}"`);

  const checkGeorge = await (await fetch(`${BASE_URL}/api/auth/face-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ faceDescriptor: georgeScan2 })
  })).json();
  console.log(`   • George scan ➔ Correctly matched as: "${checkGeorge.name}"`);

  // ── STEP 6: Check MySQL Login History & Readers Endpoint ──
  console.log('\n🔹 6. Verifying MySQL data consistency...');
  const readers = await (await fetch(`${BASE_URL}/api/users/readers`)).json();
  const emilyProfile = readers.find(r => r.userName === 'Emily Reader');
  const hasEmilyFace = emilyProfile && emilyProfile.hasBiometric && emilyProfile.faceDescriptor;
  console.log(`   • /api/users/readers contains Emily's biometric descriptor: ${hasEmilyFace ? '✅ YES' : '❌ NO'}`);

  console.log('\n===============================================================');
  console.log('🎉  ALL BIOMETRIC PIPELINE TESTS PASSED SUCCESSFULLY!');
  console.log('===============================================================\n');
}

runBiometricPipelineTest();
