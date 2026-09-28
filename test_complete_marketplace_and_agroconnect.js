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

async function runTest() {
  console.log('========================================================================');
  console.log('🧪 COMPREHENSIVE BROWSER FLOW TEST: MARKETPLACE & AGROCONNECT SYNC');
  console.log('========================================================================');

  let errors = 0;

  // 1. Socket connections
  const farmerSocket = io('http://localhost:5000', { transports: ['websocket', 'polling'] });
  const buyerSocket = io('http://localhost:5000', { transports: ['websocket', 'polling'] });

  await new Promise(r => {
    let count = 0;
    const chk = () => { count++; if (count === 2) r(); };
    farmerSocket.on('connect', chk);
    buyerSocket.on('connect', chk);
  });
  console.log('  ✅ Real-time Socket sessions established');

  const receivedMarketplace = [];
  const receivedAgro = [];

  buyerSocket.on('listing:created', data => receivedMarketplace.push(data));
  buyerSocket.on('agroconnect:created', data => receivedAgro.push(data));

  // 2. Test Urban Waste Matcher / Waste Market Online Post Flow
  console.log('\n--- 1. URBAN WASTE MATCHER / MARKETPLACE ONLINE FLOW ---');
  const marketListingId = `wp_test_online_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const marketPayload = {
    id: marketListingId,
    creator_id: 'usr_farmer_ramesh_01',
    creator_role: 'farmer',
    crop_type: 'Fresh Organic Tomatoes',
    quantity_kg: 500,
    condition: 'slightly_damaged',
    asking_price: 20,
    status: 'listed',
    location: 'Madurai Central Market',
    farmer_name: 'Ramesh Patel',
    contact_phone: '9876543210',
    image_url: null,
    source_assessment_id: null,
    title: 'Fresh Organic Tomatoes Crop Waste'
  };

  const marketRes = await fetch('http://localhost:5173/api/v1/marketplace/listings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(marketPayload)
  });

  const marketJson = await marketRes.json();
  console.log('  Marketplace POST status:', marketRes.status);
  console.log('  Marketplace Response status:', marketJson.status);

  if (marketRes.status === 201 && marketJson.status === 'success') {
    console.log('  ✅ Marketplace listing created with HTTP 201 Created (NOT pending sync)');
  } else {
    console.error('  ❌ Marketplace listing creation failed:', marketJson);
    errors++;
  }

  // 3. Test AgroConnect Online Post Flow
  console.log('\n--- 2. AGROCONNECT CROP COMMUNITY ONLINE FLOW ---');
  const agroPostId = `ap_test_online_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const agroPayload = {
    id: agroPostId,
    creator_id: 'usr_farmer_ramesh_01',
    creator_role: 'farmer',
    creator_name: 'Ramesh Patel',
    contact_phone: '9876543210',
    title: '500kg Wheat Stalks for Mulching',
    crop_type: 'Wheat',
    quantity_kg: 500,
    condition: 'fresh',
    location: 'Madurai Rural',
    post_type: 'offering_waste',
    topic: null,
    resource_needed: null,
    description: 'Wheat harvest residue available for animal feed or mulching',
    image_url: null,
    status: 'available'
  };

  const agroRes = await fetch('http://localhost:5173/api/v1/agroconnect/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(agroPayload)
  });

  const agroJson = await agroRes.json();
  console.log('  AgroConnect POST status:', agroRes.status);
  console.log('  AgroConnect Response status:', agroJson.status);

  if (agroRes.status === 201 && agroJson.status === 'success') {
    console.log('  ✅ AgroConnect post created with HTTP 201 Created (NOT pending sync)');
  } else {
    console.error('  ❌ AgroConnect post creation failed:', agroJson);
    errors++;
  }

  // Wait for real-time socket events
  await new Promise(r => setTimeout(r, 600));

  // 4. Verify Real-Time Propagation to other session
  console.log('\n--- 3. MULTI-SESSION REAL-TIME SOCKET VERIFICATION ---');
  const foundMarket = receivedMarketplace.find(m => m.id === marketListingId);
  const foundAgro = receivedAgro.find(a => a.id === agroPostId);

  if (foundMarket) {
    console.log('  ✅ Buyer session received marketplace listing:created event live');
  } else {
    console.error('  ❌ Buyer did not receive marketplace listing event');
    errors++;
  }

  if (foundAgro) {
    console.log('  ✅ Other session received agroconnect:created event live');
  } else {
    console.error('  ❌ Other session did not receive agroconnect post event');
    errors++;
  }

  // 5. Verify PostgreSQL Persistence
  console.log('\n--- 4. POSTGRESQL PERSISTENCE VERIFICATION ---');
  const dbMarket = await pool.query('SELECT id, crop_type, quantity_kg, asking_price, status FROM marketplace_listings WHERE id = $1', [marketListingId]);
  const dbAgro = await pool.query('SELECT id, crop_type, quantity_kg, post_type, status FROM agroconnect_posts WHERE id = $1', [agroPostId]);

  if (dbMarket.rows.length === 1) {
    console.log('  ✅ Marketplace listing persisted in PostgreSQL:', dbMarket.rows[0]);
  } else {
    console.error('  ❌ Marketplace listing NOT found in PostgreSQL');
    errors++;
  }

  if (dbAgro.rows.length === 1) {
    console.log('  ✅ AgroConnect post persisted in PostgreSQL:', dbAgro.rows[0]);
  } else {
    console.error('  ❌ AgroConnect post NOT found in PostgreSQL');
    errors++;
  }

  // 6. Test Offline Sync Endpoint (/api/v1/sync/...)
  console.log('\n--- 5. OFFLINE QUEUE DRAIN & SYNC GATEWAY VERIFICATION ---');
  const offlineDraftId = `wp_test_offline_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const syncPayload = {
    userId: 'usr_farmer_ramesh_01',
    actionType: 'CREATE_MARKETPLACE_LISTING',
    entityId: offlineDraftId,
    payload: {
      id: offlineDraftId,
      creator_id: 'usr_farmer_ramesh_01',
      crop_type: 'Offline Recovered Millet Waste',
      quantity_kg: 300,
      condition: 'damaged',
      asking_price: 15,
      status: 'listed',
      location: 'Salem Hub'
    }
  };

  const syncRes = await fetch('http://localhost:5173/api/v1/sync/marketplacelisting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(syncPayload)
  });

  const syncJson = await syncRes.json();
  console.log('  Sync Gateway POST status:', syncRes.status);
  console.log('  Sync Gateway Response:', syncJson);

  if (syncRes.status === 200 && syncJson.synced) {
    console.log('  ✅ Offline draft synchronized via sync gateway to PostgreSQL');
    const dbSync = await pool.query('SELECT id, crop_type FROM marketplace_listings WHERE id = $1', [offlineDraftId]);
    if (dbSync.rows.length === 1) {
      console.log('  ✅ Offline draft verified in PostgreSQL:', dbSync.rows[0]);
    } else {
      console.error('  ❌ Offline draft missing from PostgreSQL');
      errors++;
    }
  } else {
    console.error('  ❌ Sync gateway call failed');
    errors++;
  }

  // Clean up test data
  await pool.query('DELETE FROM marketplace_listings WHERE id IN ($1, $2)', [marketListingId, offlineDraftId]);
  await pool.query('DELETE FROM agroconnect_posts WHERE id = $1', [agroPostId]);

  farmerSocket.disconnect();
  buyerSocket.disconnect();
  await pool.end();

  console.log('\n========================================================================');
  if (errors === 0) {
    console.log('🎉 ALL MARKETPLACE & AGROCONNECT RUNTIME TESTS PASSED (0 errors)');
  } else {
    console.log(`❌ FAILED WITH ${errors} ERRORS`);
  }
  console.log('========================================================================');
}

runTest().catch(console.error);
