/**
 * AgroCycle Multi-User Marketplace Real-Time Synchronization Automated Test Suite
 *
 * Validates:
 * 1. GET /api/health & GET /api/health/db connectivity
 * 2. Shared PostgreSQL persistence
 * 3. BROWSER A (Farmer) POST -> Backend -> PostgreSQL -> Socket.IO -> BROWSER B (Buyer) real-time delivery
 * 4. Quantity update real-time sync (1000kg -> 700kg)
 * 5. Strict ownership authorization protection (Farmer B cannot edit Farmer A's listing)
 * 6. Listing deletion / deactivation real-time event delivery
 */

import { io } from 'socket.io-client';
import { query } from './src/db/pool.js';

const BACKEND_URL = 'http://localhost:5000';

async function runTest() {
  console.log('=================================================================');
  console.log('  AGROCYCLE MULTI-USER REAL-TIME SYNCHRONIZATION AUDIT');
  console.log('=================================================================\n');

  let testsPassed = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      testsPassed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      throw new Error(`Test assertion failed: ${message}`);
    }
  }

  // 1. Health checks
  console.log('--- STEP 1: VERIFY BACKEND & DATABASE CONNECTIVITY ---');
  const healthRes = await fetch(`${BACKEND_URL}/api/health`).then(r => r.json());
  assert(healthRes.status === 'ok', 'GET /api/health returns status "ok"');

  const dbHealthRes = await fetch(`${BACKEND_URL}/api/health/db`).then(r => r.json());
  assert(dbHealthRes.status === 'ok' && dbHealthRes.database === 'connected', 'GET /api/health/db reports PostgreSQL connected');

  // 2. Setup Buyer Browser WebSocket connection
  console.log('\n--- STEP 2: CONNECT SIMULATED BUYER BROWSER OVER WEBSOCKET ---');
  const buyerSocket = io(BACKEND_URL, {
    transports: ['websocket', 'polling']
  });

  const buyerEvents = {
    created: [],
    updated: [],
    deleted: []
  };

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Buyer socket connection timeout')), 4000);
    buyerSocket.on('connect', () => {
      clearTimeout(timeout);
      console.log(`  [Buyer Socket] Connected to Socket.IO server (ID: ${buyerSocket.id})`);
      resolve();
    });
  });

  buyerSocket.on('listing:created', (data) => {
    console.log(`  [Buyer Socket] 📩 Received "listing:created":`, data.title, `(${data.quantity_kg} kg @ ₹${data.asking_price}/kg)`);
    buyerEvents.created.push(data);
  });

  buyerSocket.on('listing:updated', (data) => {
    console.log(`  [Buyer Socket] 📩 Received "listing:updated":`, data.id, `(New Quantity: ${data.quantity_kg} kg, Status: ${data.status})`);
    buyerEvents.updated.push(data);
  });

  buyerSocket.on('listing:deleted', (data) => {
    console.log(`  [Buyer Socket] 📩 Received "listing:deleted":`, data.id);
    buyerEvents.deleted.push(data);
  });

  assert(buyerSocket.connected, 'Buyer B session successfully connected to real-time socket server');

  // 3. Farmer creates produce listing via REST POST /api/listings
  console.log('\n--- STEP 3: FARMER A POSTS PRODUCE LISTING ---');
  const farmerUserId = `usr_farmer_sync_test_${Date.now()}`;
  const testListingId = `wp_test_sync_${Date.now()}`;

  const postPayload = {
    id: testListingId,
    creator_id: farmerUserId,
    creator_role: 'farmer',
    farmer_name: 'Farmer Murugan',
    contact_phone: '9840123456',
    crop_type: 'Tomato',
    quantity_kg: 1000,
    condition: 'fresh',
    asking_price: 25,
    location: 'Alanganallur, Madurai',
    district: 'Madurai',
    state: 'Tamil Nadu',
    title: '1,000 kg Fresh Tomato Harvest'
  };

  const createRes = await fetch(`${BACKEND_URL}/api/listings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': farmerUserId
    },
    body: JSON.stringify(postPayload)
  });

  assert(createRes.status === 201, 'POST /api/listings returned HTTP 201 Created');
  const createData = await createRes.json();
  assert(createData.data.crop_type === 'Tomato', 'Created listing has crop_type "Tomato"');
  assert(Number(createData.data.quantity_kg) === 1000, 'Created listing has quantity 1,000 kg');
  assert(Number(createData.data.asking_price) === 25, 'Created listing has asking_price ₹25/kg');

  // Verify DB record directly
  const dbCheck1 = await query('SELECT * FROM marketplace_listings WHERE id = $1', [testListingId]);
  assert(dbCheck1.rows.length === 1, 'Listing is strictly persisted in PostgreSQL database');

  // Wait for Buyer Socket to receive listing:created
  await new Promise(r => setTimeout(r, 600));
  const receivedCreated = buyerEvents.created.find(e => e.id === testListingId);
  assert(Boolean(receivedCreated), 'Buyer B Browser received "listing:created" event in real-time without refresh');
  assert(Number(receivedCreated.quantity_kg) === 1000, 'Buyer B received correct initial quantity (1,000 kg)');

  // 4. Farmer updates quantity to 700 kg
  console.log('\n--- STEP 4: FARMER A UPDATES QUANTITY (1,000 kg -> 700 kg) ---');
  const updateRes = await fetch(`${BACKEND_URL}/api/listings/${testListingId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': farmerUserId
    },
    body: JSON.stringify({
      quantity_kg: 700
    })
  });

  assert(updateRes.status === 200, 'PATCH /api/listings/:id returned HTTP 200 OK');
  const updateData = await updateRes.json();
  assert(Number(updateData.data.quantity_kg) === 700, 'Updated listing has quantity 700 kg in backend response');

  // Wait for Buyer Socket to receive listing:updated
  await new Promise(r => setTimeout(r, 600));
  const receivedUpdated = buyerEvents.updated.find(e => e.id === testListingId);
  assert(Boolean(receivedUpdated), 'Buyer B Browser received "listing:updated" event in real-time');
  assert(Number(receivedUpdated.quantity_kg) === 700, 'Buyer B automatically sees updated quantity (700 kg)');

  // 5. Test Ownership Authorization (Farmer B / Impostor tries to edit Farmer A's listing)
  console.log('\n--- STEP 5: AUTHORIZATION CHECK (Farmer B cannot edit Farmer A\'s listing) ---');
  const unauthorizedRes = await fetch(`${BACKEND_URL}/api/listings/${testListingId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': 'usr_impostor_farmer_999'
    },
    body: JSON.stringify({
      quantity_kg: 50
    })
  });

  assert(unauthorizedRes.status === 403, 'Unauthorized edit request correctly rejected with HTTP 403 Forbidden');

  // 6. Farmer deactivates / deletes listing
  console.log('\n--- STEP 6: FARMER A DELETES / DEACTIVATES LISTING ---');
  const deleteRes = await fetch(`${BACKEND_URL}/api/listings/${testListingId}`, {
    method: 'DELETE',
    headers: {
      'X-User-Id': farmerUserId
    }
  });

  assert(deleteRes.status === 200, 'DELETE /api/listings/:id returned HTTP 200 OK');

  // Wait for Buyer Socket to receive listing:deleted
  await new Promise(r => setTimeout(r, 600));
  const receivedDeleted = buyerEvents.deleted.find(e => e.id === testListingId);
  assert(Boolean(receivedDeleted), 'Buyer B Browser received "listing:deleted" event in real-time');

  // Verify removal from DB
  const dbCheck2 = await query('SELECT * FROM marketplace_listings WHERE id = $1', [testListingId]);
  assert(dbCheck2.rows.length === 0, 'Listing is deleted from PostgreSQL database');

  // Cleanup
  buyerSocket.disconnect();

  console.log('\n=================================================================');
  console.log(`  🎉 ALL ${testsPassed}/${totalTests} SYNCHRONIZATION AUDIT TESTS PASSED!`);
  console.log('=================================================================\n');

  process.exit(0);
}

runTest().catch((err) => {
  console.error('\n❌ Test Suite Failed with error:', err);
  process.exit(1);
});
