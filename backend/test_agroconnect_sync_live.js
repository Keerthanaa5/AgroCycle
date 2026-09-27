import { query, getPool } from './src/db/pool.js';

const API_BASE = 'http://localhost:5000/api/v1';

async function runLiveSyncTests() {
  console.log('===========================================================');
  console.log('>>> AGROCONNECT SYNCHRONIZATION END-TO-END VERIFICATION <<<');
  console.log('===========================================================\n');

  const testUserId = `test_farmer_sync_${Date.now()}`;
  const testPosts = [
    {
      actionType: 'CREATE_AGROCONNECT_POST',
      entityId: `ac_sync_waste_${Date.now()}`,
      userId: testUserId,
      entityType: 'agroConnectActivity',
      payload: {
        id: `ac_sync_waste_${Date.now()}`,
        creatorId: testUserId,
        creatorRole: 'farmer',
        creatorName: 'Sync Test Farmer Ramesh',
        creatorPhone: '9876500001',
        title: '500kg Fresh Paddy Straw Available for Exchange',
        crop_type: 'Paddy',
        post_type: 'offering_waste',
        quantity_kg: 500,
        condition: 'fresh',
        location: 'Alanganallur, Madurai',
        description: 'Freshly harvested paddy straw available for local farmers.',
        status: 'available',
        interactions: [],
        connections: []
      }
    },
    {
      actionType: 'CREATE_AGROCONNECT_POST',
      entityId: `ac_sync_resource_${Date.now()}`,
      userId: testUserId,
      entityType: 'agroConnectActivity',
      payload: {
        id: `ac_sync_resource_${Date.now()}`,
        creatorId: testUserId,
        creatorRole: 'farmer',
        creatorName: 'Sync Test Farmer Ramesh',
        title: 'Seeking Groundnut Seedlings for Intercropping',
        crop_type: 'Groundnut',
        post_type: 'requesting_resource',
        resource_needed: 'High-Yield Groundnut Seeds / Seedlings',
        quantity_kg: 50,
        location: 'Usilampatti, Madurai',
        description: 'Looking for quality seed stock for next week sowing.',
        status: 'available',
        interactions: [],
        connections: []
      }
    },
    {
      actionType: 'CREATE_AGROCONNECT_POST',
      entityId: `ac_sync_advice_${Date.now()}`,
      userId: testUserId,
      entityType: 'agroConnectActivity',
      payload: {
        id: `ac_sync_advice_${Date.now()}`,
        creatorId: testUserId,
        creatorRole: 'farmer',
        creatorName: 'Sync Test Farmer Ramesh',
        title: 'Advice on Leaf Curl Symptoms in Tomato',
        crop_type: 'Tomato',
        post_type: 'seeking_advice',
        topic: 'Early Leaf Curl and Stunted Growth',
        location: 'Vadipatti, Madurai',
        description: 'Observing leaf curl after heavy rains. Seeking advice from experienced growers.',
        status: 'available',
        interactions: [],
        connections: []
      }
    },
    {
      actionType: 'CREATE_AGROCONNECT_POST',
      entityId: `ac_sync_knowledge_${Date.now()}`,
      userId: testUserId,
      entityType: 'agroConnectActivity',
      payload: {
        id: `ac_sync_knowledge_${Date.now()}`,
        creatorId: testUserId,
        creatorRole: 'farmer',
        creatorName: 'Sync Test Farmer Ramesh',
        title: 'In-situ Sugarcane Trash Mulching Technique',
        crop_type: 'Sugarcane',
        post_type: 'sharing_knowledge',
        topic: 'In-situ Trash Mulching and Soil Moisture Retention',
        location: 'Melur, Madurai',
        description: 'Spread trash between rows after harvest. Retains moisture and decomposes into organic matter.',
        status: 'available',
        interactions: [],
        connections: []
      }
    },
    // Old/Legacy schema format test
    {
      actionType: 'CREATE_AGROCONNECT_POST',
      entityId: `ac_sync_legacy_${Date.now()}`,
      userId: testUserId,
      entityType: 'agro',
      payload: {
        id: `ac_sync_legacy_${Date.now()}`,
        crop: 'Maize',
        quantity: 250,
        user: 'Sync Test Farmer Ramesh',
        phone: '9876500001',
        location: 'Madurai North',
        post_type: 'offering_waste',
        condition: 'slightly_damaged',
        details: 'Legacy format maize stalk bundle'
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const item of testPosts) {
    const idempotencyKey = `${item.userId}_${item.actionType}_${item.entityId}`;
    try {
      const res = await fetch(`${API_BASE}/sync/agroconnectactivity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          actionType: item.actionType,
          entityId: item.entityId,
          userId: item.userId,
          payload: item.payload,
          clientCreatedAt: new Date().toISOString()
        })
      });

      const body = await res.json();
      if (res.ok && body.synced === true) {
        console.log(`[PASS] Sync ${item.payload.post_type || 'legacy'}: ${item.entityId} -> 200 OK (Server ID: ${body.serverId})`);
        passed++;
      } else {
        console.error(`[FAIL] Sync ${item.entityId}: ${res.status}`, body);
        failed++;
      }
    } catch (err) {
      console.error(`[ERROR] Sync ${item.entityId}:`, err.message);
      failed++;
    }
  }

  // Test Idempotency Replay
  console.log('\n--- Testing Idempotency Replay ---');
  const replayItem = testPosts[0];
  const replayKey = `${replayItem.userId}_${replayItem.actionType}_${replayItem.entityId}`;
  try {
    const res = await fetch(`${API_BASE}/sync/agroconnectactivity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': replayKey
      },
      body: JSON.stringify({
        actionType: replayItem.actionType,
        entityId: replayItem.entityId,
        userId: replayItem.userId,
        payload: replayItem.payload
      })
    });
    const body = await res.json();
    if (res.ok && body.replayed === true) {
      console.log(`[PASS] Idempotency Replay: 200 OK (replayed: true)`);
      passed++;
    } else {
      console.error(`[FAIL] Idempotency Replay:`, body);
      failed++;
    }
  } catch (err) {
    console.error(`[ERROR] Idempotency Replay:`, err.message);
    failed++;
  }

  // Verify in PostgreSQL Database
  console.log('\n--- Verifying PostgreSQL Database Persistence ---');
  try {
    const dbPosts = await query(
      'SELECT id, creator_id, title, crop_type, post_type, location, quantity_kg FROM agroconnect_posts WHERE creator_id = $1 ORDER BY created_at ASC',
      [testUserId]
    );
    console.log(`Found ${dbPosts.rows.length} records in PostgreSQL agroconnect_posts for user ${testUserId}:`);
    console.table(dbPosts.rows);

    if (dbPosts.rows.length === testPosts.length) {
      console.log(`[PASS] All ${testPosts.length} posts successfully stored in PostgreSQL agroconnect_posts!`);
      passed++;
    } else {
      console.error(`[FAIL] Expected ${testPosts.length} posts, found ${dbPosts.rows.length}`);
      failed++;
    }

    const syncEvents = await query(
      'SELECT id, user_id, action_type, entity_type, entity_id, status FROM sync_events WHERE user_id = $1',
      [testUserId]
    );
    console.log(`Found ${syncEvents.rows.length} sync_events in PostgreSQL:`);
    console.table(syncEvents.rows);

    if (syncEvents.rows.length === testPosts.length) {
      console.log(`[PASS] All ${testPosts.length} sync events logged in PostgreSQL sync_events!`);
      passed++;
    } else {
      console.error(`[FAIL] Expected ${testPosts.length} sync_events, found ${syncEvents.rows.length}`);
      failed++;
    }
  } catch (err) {
    console.error('[ERROR] DB verification:', err.message);
    failed++;
  }

  // Verify GET API endpoint
  console.log('\n--- Verifying AgroConnect GET API Endpoint ---');
  try {
    const getRes = await fetch(`${API_BASE}/agroconnect/posts?creator_id=${testUserId}`);
    const getData = await getRes.json();
    if (getRes.ok && getData.data?.length === testPosts.length) {
      console.log(`[PASS] GET /api/v1/agroconnect/posts returned all ${testPosts.length} synced posts!`);
      passed++;
    } else {
      console.error(`[FAIL] GET /api/v1/agroconnect/posts:`, getData);
      failed++;
    }
  } catch (err) {
    console.error('[ERROR] GET API endpoint:', err.message);
    failed++;
  }

  // Cleanup test records
  console.log('\n--- Cleaning Up Test Data ---');
  try {
    await query('DELETE FROM agroconnect_posts WHERE creator_id = $1', [testUserId]);
    await query('DELETE FROM sync_events WHERE user_id = $1', [testUserId]);
    await query('DELETE FROM users WHERE user_id = $1', [testUserId]);
    console.log('[PASS] Test records cleanly removed from live PostgreSQL DB.');
  } catch (err) {
    console.warn('[WARN] Cleanup error:', err.message);
  }

  const p = getPool();
  if (p) await p.end();

  console.log('\n===========================================================');
  console.log(`>>> AGROCONNECT SYNC TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED <<<`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runLiveSyncTests();
