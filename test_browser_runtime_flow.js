import { io } from 'socket.io-client';
import pg from './backend/node_modules/pg/lib/index.js';
import dotenv from './backend/node_modules/dotenv/lib/main.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/agrocycle_db'
});

async function runVerification() {
  console.log('======================================================================');
  console.log('🧪 VERIFYING AGROCYCLE BROWSER MARKETPLACE RUNTIME & DB PERSISTENCE');
  console.log('======================================================================');

  let errors = 0;

  // 1. Test Vite Dev Server Proxy endpoint (what browser uses)
  console.log('\n[Step 1] Testing Vite Dev Server /api Proxy...');
  try {
    const viteRes = await fetch('http://localhost:5173/api/v1/health');
    const viteData = await viteRes.json();
    if (viteRes.status === 200 && viteData.status === 'ok') {
      console.log('  ✅ Vite Dev Server Proxy (/api/v1/health) is working: 200 OK');
    } else {
      console.error('  ❌ Vite Proxy returned unexpected response:', viteRes.status, viteData);
      errors++;
    }
  } catch (e) {
    console.error('  ❌ Failed to reach Vite Proxy:', e.message);
    errors++;
  }

  // 2. Connect 2 Real-Time Socket Sessions (Browser A = Farmer, Browser B = Buyer)
  console.log('\n[Step 2] Connecting Real-Time Browser Sessions via Socket.IO...');
  const socketFarmer = io('http://localhost:5000', { transports: ['websocket', 'polling'] });
  const socketBuyer = io('http://localhost:5000', { transports: ['websocket', 'polling'] });

  await new Promise((resolve) => {
    let connected = 0;
    const check = () => {
      connected++;
      if (connected === 2) resolve();
    };
    socketFarmer.on('connect', check);
    socketBuyer.on('connect', check);
  });
  console.log('  ✅ Browser A (Farmer socket:', socketFarmer.id, ') connected');
  console.log('  ✅ Browser B (Buyer socket:', socketBuyer.id, ') connected');

  // Set up real-time listener on Buyer browser (Browser B)
  const buyerReceivedEvents = [];
  socketBuyer.on('listing:created', (data) => {
    console.log('  📡 [Browser B Buyer Socket] Received real-time listing:created event:', data.id, '-', data.crop_type);
    buyerReceivedEvents.push({ type: 'created', data });
  });

  socketBuyer.on('listing:updated', (data) => {
    console.log('  📡 [Browser B Buyer Socket] Received real-time listing:updated event:', data.id);
    buyerReceivedEvents.push({ type: 'updated', data });
  });

  socketBuyer.on('listing:deleted', (data) => {
    console.log('  📡 [Browser B Buyer Socket] Received real-time listing:deleted event:', data.id);
    buyerReceivedEvents.push({ type: 'deleted', data });
  });

  // 3. Simulate Farmer clicking "Publish Marketplace Listing" in Browser A
  console.log('\n[Step 3] Farmer in Browser A publishes a new produce listing via HTTP POST...');
  const testListingId = `wp_browser_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const farmerPayload = {
    id: testListingId,
    creator_id: 'usr_farmer_ramesh_01',
    creator_role: 'farmer',
    crop_type: 'Fresh Tomato Grade-A Surplus',
    quantity_kg: 750,
    condition: 'slightly_damaged',
    asking_price: 24,
    status: 'listed',
    location: 'Coimbatore Wholesale Market Hub',
    farmer_name: 'Ramesh Patel',
    contact_phone: '9876543210',
    image_url: null,
    source_assessment_id: null,
    title: 'Fresh Tomato Grade-A Surplus Crop Waste'
  };

  const publishRes = await fetch('http://localhost:5173/api/v1/marketplace/listings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(farmerPayload)
  });

  const publishBody = await publishRes.json();
  console.log('  Publish HTTP Status:', publishRes.status);
  console.log('  Publish Response Body:', publishBody);

  if (publishRes.status === 201 && publishBody.status === 'success' && publishBody.data?.id === testListingId) {
    console.log('  ✅ Listing published successfully via Vite Proxy: HTTP 201 Created');
  } else {
    console.error('  ❌ Listing publication failed!');
    errors++;
  }

  // 4. Wait a brief moment for socket propagation
  await new Promise(r => setTimeout(r, 600));

  // 5. Verify Browser B received the live socket event without refresh
  console.log('\n[Step 4] Checking if Browser B received live broadcast without refresh...');
  const createdEvent = buyerReceivedEvents.find(e => e.type === 'created' && e.data?.id === testListingId);
  if (createdEvent) {
    console.log('  ✅ Browser B received real-time broadcast: verified!');
  } else {
    console.error('  ❌ Browser B did NOT receive real-time listing:created event');
    errors++;
  }

  // 6. Verify PostgreSQL Database has the record stored
  console.log('\n[Step 5] Checking PostgreSQL Database for persistence...');
  try {
    const dbRes = await pool.query('SELECT * FROM marketplace_listings WHERE id = $1', [testListingId]);
    if (dbRes.rows.length === 1) {
      const row = dbRes.rows[0];
      console.log('  ✅ PostgreSQL row found:');
      console.log('     ID:', row.id);
      console.log('     Creator ID:', row.creator_id);
      console.log('     Crop Type:', row.crop_type);
      console.log('     Quantity (kg):', row.quantity_kg);
      console.log('     Asking Price (₹):', row.asking_price);
      console.log('     Created At:', row.created_at);
    } else {
      console.error('  ❌ Record not found in PostgreSQL!');
      errors++;
    }
  } catch (e) {
    console.error('  ❌ Database query failed:', e.message);
    errors++;
  }

  // 7. Verify GET /api/v1/marketplace/listings returns the new listing
  console.log('\n[Step 6] Verifying GET /api/v1/marketplace/listings returns the listing...');
  const getRes = await fetch('http://localhost:5173/api/v1/marketplace/listings');
  const getBody = await getRes.json();
  const foundInFeed = getBody.data?.some(l => l.id === testListingId);
  if (foundInFeed) {
    console.log('  ✅ GET /api/v1/marketplace/listings contains the new listing in the shared feed');
  } else {
    console.error('  ❌ New listing missing from GET feed');
    errors++;
  }

  // 8. Clean up test listing
  console.log('\n[Step 7] Cleaning up test listing...');
  const delRes = await fetch(`http://localhost:5173/api/v1/marketplace/listings/${testListingId}?userId=usr_farmer_ramesh_01`, {
    method: 'DELETE'
  });
  if (delRes.status === 200) {
    console.log('  ✅ Test listing cleaned up successfully');
  }

  socketFarmer.disconnect();
  socketBuyer.disconnect();
  await pool.end();

  console.log('\n======================================================================');
  if (errors === 0) {
    console.log('🎉 ALL RUNTIME BROWSER FLOW AND POSTGRESQL VERIFICATIONS PASSED (0 errors)');
  } else {
    console.log(`❌ VERIFICATION FAILED WITH ${errors} ERRORS`);
  }
  console.log('======================================================================');
}

runVerification().catch(console.error);
