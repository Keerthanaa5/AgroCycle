/**
 * test_agroconnect_e2e.js
 * Comprehensive End-to-End Functional Test Suite for AgroConnect
 * Tests 4 crop-focused post types, farmer-to-farmer interactions,
 * notifications, connection management, ownership authorization,
 * offline sync, and idempotency protection against live Neon PostgreSQL.
 */

import http from 'http';
import app from './src/app.js';
import { query, closePool } from './src/db/pool.js';
import { FutureRemoteSyncAdapter } from '../src/services/syncAdapter.js';

const TEST_PORT = 5094;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

async function runAgroConnectTests() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`[AgroConnect Test Runner] Server running on port ${TEST_PORT}`);

  const timestamp = Date.now();
  const farmerAId = `test_farmer_a_${timestamp}`;
  const farmerBId = `test_farmer_b_${timestamp}`;

  const postWasteId = `test_ac_waste_${timestamp}`;
  const postResourceId = `test_ac_res_${timestamp}`;
  const postAdviceId = `test_ac_adv_${timestamp}`;
  const postKnowledgeId = `test_ac_kno_${timestamp}`;

  const adapter = new FutureRemoteSyncAdapter({ apiBaseUrl: BASE_URL });

  try {
    console.log('\n===========================================================');
    console.log('>>> AGROCYCLE: AGROCONNECT FUNCTIONAL TEST SUITE <<<');
    console.log('===========================================================');

    // -------------------------------------------------------------------------
    // 1. Setup Test Farmers
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Setup Test Farmers ---');
    await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: farmerAId,
        displayName: 'Farmer Selvam',
        phone: '9876543210',
        activeRole: 'farmer'
      })
    });

    await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: farmerBId,
        displayName: 'Farmer Murugan',
        phone: '9876543211',
        activeRole: 'farmer'
      })
    });
    console.log('[1.1: Test Farmers Initialized in DB]');

    // -------------------------------------------------------------------------
    // 2. Post Type 1: Offering Crop Waste
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Post Type 1: Offering Crop Waste ---');
    const wasteRes = await fetch(`${BASE_URL}/agroconnect/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: postWasteId,
        userId: farmerAId,
        post_type: 'offering_waste',
        crop_type: 'Paddy',
        quantity_kg: 500,
        condition: 'fresh',
        location: 'Alanganallur, Madurai',
        title: '500kg Green Corn Stalks & Paddy Straw Available'
      })
    });
    const wasteData = await wasteRes.json();
    console.log('[2.1: Offering Waste Post Created]', wasteRes.status, wasteData.data?.title);
    if (wasteRes.status !== 201 || wasteData.data?.post_type !== 'offering_waste') {
      throw new Error('Offering waste post creation failed');
    }

    // -------------------------------------------------------------------------
    // 3. Post Type 2: Requesting Crop Resource
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Post Type 2: Requesting Crop Resource ---');
    const resRes = await fetch(`${BASE_URL}/agroconnect/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: postResourceId,
        userId: farmerBId,
        post_type: 'requesting_resource',
        crop_type: 'Groundnut',
        resource_needed: 'Organic Cow Dung Manure',
        quantity_kg: 200,
        location: 'Melur, Madurai',
        description: 'Need well-decomposed organic manure for groundnut sowing'
      })
    });
    const resData = await resRes.json();
    console.log('[3.1: Requesting Resource Post Created]', resRes.status, resData.data?.resource_needed);
    if (resRes.status !== 201 || resData.data?.resource_needed !== 'Organic Cow Dung Manure') {
      throw new Error('Requesting resource post creation failed');
    }

    // -------------------------------------------------------------------------
    // 4. Post Type 3: Seeking Crop Advice
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Post Type 3: Seeking Crop Advice ---');
    const adviceRes = await fetch(`${BASE_URL}/agroconnect/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: postAdviceId,
        userId: farmerAId,
        post_type: 'seeking_advice',
        crop_type: 'Tomato',
        topic: 'Early leaf yellowing and curling',
        location: 'Madurai North',
        description: 'Tomato crop showing yellow spots on lower leaves for the last 3 days. Any natural remedies?'
      })
    });
    const adviceData = await adviceRes.json();
    console.log('[4.1: Seeking Advice Post Created]', adviceRes.status, adviceData.data?.topic);
    if (adviceRes.status !== 201 || adviceData.data?.topic !== 'Early leaf yellowing and curling') {
      throw new Error('Seeking advice post creation failed');
    }

    // -------------------------------------------------------------------------
    // 5. Post Type 4: Sharing Crop Knowledge
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Post Type 4: Sharing Crop Knowledge ---');
    const knowRes = await fetch(`${BASE_URL}/agroconnect/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: postKnowledgeId,
        userId: farmerBId,
        post_type: 'sharing_knowledge',
        crop_type: 'Sugarcane',
        topic: 'In-situ trash mulching technique',
        location: 'Vadipatti',
        description: 'Mulching sugarcane leaves between rows conserved 40% soil moisture during dry spell and stopped weeds.'
      })
    });
    const knowData = await knowRes.json();
    console.log('[5.1: Sharing Knowledge Post Created]', knowRes.status, knowData.data?.topic);
    if (knowRes.status !== 201 || knowData.data?.topic !== 'In-situ trash mulching technique') {
      throw new Error('Sharing knowledge post creation failed');
    }

    // -------------------------------------------------------------------------
    // 6. Validation: Prevent Invalid Post Types
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Validation: Prevent Invalid Post Types ---');
    const invalidRes = await fetch(`${BASE_URL}/agroconnect/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: farmerAId,
        post_type: 'commercial_produce_sale',
        crop_type: 'Tomato',
        quantity_kg: 500
      })
    });
    console.log('[6.1: Invalid Post Type Blocked (Expected 400)]', invalidRes.status === 400);
    if (invalidRes.status !== 400) throw new Error('Invalid post type was not rejected');

    // -------------------------------------------------------------------------
    // 7. Query & Search Filtering
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Query & Search Filtering ---');
    const queryRes = await fetch(`${BASE_URL}/agroconnect/posts?crop_type=tomato`);
    const queryData = await queryRes.json();
    console.log('[7.1: Query by Crop "Tomato" Result Count]', queryData.count);
    if (queryData.count === 0) throw new Error('Crop query returned 0');

    const typeQueryRes = await fetch(`${BASE_URL}/agroconnect/posts?post_type=seeking_advice`);
    const typeQueryData = await typeQueryRes.json();
    console.log('[7.2: Query by Post Type "seeking_advice" Result Count]', typeQueryData.count);
    if (typeQueryData.count === 0) throw new Error('Post type query returned 0');

    // -------------------------------------------------------------------------
    // 8. Farmer-to-Farmer Interaction & Automatic Notification
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Farmer Interaction & Notifications ---');
    const interactRes = await fetch(`${BASE_URL}/agroconnect/posts/${postWasteId}/interact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        farmer_id: farmerBId,
        farmer_name: 'Farmer Murugan',
        interaction_type: 'interested',
        message: 'I am interested in using your paddy straw for composting.',
        contact_phone: '9876543211'
      })
    });
    const interactData = await interactRes.json();
    console.log('[8.1: Interaction Submitted to Post]', interactRes.status, interactData.data?.interaction?.interaction_type);
    if (interactRes.status !== 200) throw new Error('Farmer interaction submission failed');

    // Verify Notification generated for Farmer A (creator)
    const notifRes = await fetch(`${BASE_URL}/notifications/${farmerAId}`);
    const notifData = await notifRes.json();
    console.log('[8.2: Notification for Farmer A Received]', notifData.count > 0, notifData.data?.[0]?.title);
    if (notifData.count === 0 || !notifData.data?.[0]?.title.includes('Farmer Murugan')) {
      throw new Error('Notification was not dispatched to post creator');
    }

    // -------------------------------------------------------------------------
    // 9. Connection Acceptance & Notification
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Connection Acceptance ---');
    const connectRes = await fetch(`${BASE_URL}/agroconnect/posts/${postWasteId}/connect`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: farmerAId,
        requestingFarmerId: farmerBId,
        requestingFarmerName: 'Farmer Murugan',
        action: 'accept'
      })
    });
    const connectData = await connectRes.json();
    console.log('[9.1: Connection Accepted by Post Creator]', connectRes.status, connectData.data?.connections?.length);
    if (connectRes.status !== 200 || connectData.data?.connections?.length === 0) {
      throw new Error('Connection acceptance failed');
    }

    // Verify Notification dispatched to Farmer B (requesting farmer)
    const notifBRes = await fetch(`${BASE_URL}/notifications/${farmerBId}`);
    const notifBData = await notifBRes.json();
    console.log('[9.2: Acceptance Notification for Farmer B Received]', notifBData.count > 0);
    if (notifBData.count === 0) throw new Error('Acceptance notification missing for Farmer B');

    // -------------------------------------------------------------------------
    // 10. Ownership Authorization Checks
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Ownership Authorization Checks ---');
    // Unauthorized edit attempt by Farmer B on Farmer A's post
    const unauthEditRes = await fetch(`${BASE_URL}/agroconnect/posts/${postWasteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: farmerBId,
        title: 'Hacked Title'
      })
    });
    console.log('[10.1: Non-Owner Edit Blocked (Expected 403)]', unauthEditRes.status === 403);
    if (unauthEditRes.status !== 403) throw new Error('Non-owner edit was not blocked');

    // Owner edits post successfully
    const authEditRes = await fetch(`${BASE_URL}/agroconnect/posts/${postWasteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: farmerAId,
        title: 'Updated: 500kg Green Corn Stalks & Paddy Straw'
      })
    });
    console.log('[10.2: Owner Edit Allowed (Expected 200)]', authEditRes.status === 200);
    if (authEditRes.status !== 200) throw new Error('Owner edit failed');

    // -------------------------------------------------------------------------
    // 11. Offline Remote Sync & Idempotency Protection
    // -------------------------------------------------------------------------
    console.log('\n--- 11. Remote Sync Adapter & Idempotency ---');
    const syncAction = {
      actionType: 'CREATE_AGROCONNECT_POST',
      entityType: 'agroConnectActivity',
      entityId: `test_ac_sync_${timestamp}`,
      userId: farmerAId,
      idempotencyKey: `idemp_ac_${timestamp}`,
      createdAt: new Date().toISOString(),
      payload: {
        id: `test_ac_sync_${timestamp}`,
        creatorId: farmerAId,
        creatorRole: 'farmer',
        title: 'Clean Maize Leaves for Cattle Feed',
        crop_type: 'Maize',
        quantity_kg: 350,
        condition: 'fresh',
        location: 'Madurai East',
        post_type: 'offering_waste',
        farmer_name: 'Farmer Selvam',
        contact_phone: '9876543210',
        status: 'available'
      }
    };

    const syncRes1 = await adapter.syncAction(syncAction);
    console.log('[11.1: Remote Sync Execution]', syncRes1.success);
    if (!syncRes1.success) throw new Error('AgroConnect remote sync failed');

    // Replay exact same sync action (Idempotency test)
    const syncRes2 = await adapter.syncAction(syncAction);
    console.log('[11.2: Sync Replay Handled Idempotently]', syncRes2.serverData?.replayed === true);
    if (!syncRes2.serverData?.replayed) throw new Error('Sync replay was not detected');

    const dbCountRes = await query('SELECT COUNT(*) FROM agroconnect_posts WHERE id = $1', [`test_ac_sync_${timestamp}`]);
    console.log('[11.3: Zero Duplicate Rows in DB]', dbCountRes.rows[0]?.count === '1');
    if (dbCountRes.rows[0]?.count !== '1') throw new Error('Duplicate row was created');

    // -------------------------------------------------------------------------
    // 12. Cleanup Test Fixtures
    // -------------------------------------------------------------------------
    console.log('\n--- 12. Cleanup Test Fixtures ---');
    await query('DELETE FROM notifications WHERE user_id IN ($1, $2)', [farmerAId, farmerBId]);
    await query('DELETE FROM agroconnect_posts WHERE creator_id IN ($1, $2)', [farmerAId, farmerBId]);
    await query('DELETE FROM agroconnect_posts WHERE id = $1', [`test_ac_sync_${timestamp}`]);
    await query('DELETE FROM sync_events WHERE user_id IN ($1, $2)', [farmerAId, farmerBId]);
    await query('DELETE FROM users WHERE user_id IN ($1, $2)', [farmerAId, farmerBId]);
    console.log('[12.1: Live Neon PostgreSQL Cleaned Up Completely]');

    console.log('\n===========================================================');
    console.log('>>> ALL AGROCONNECT FUNCTIONAL AUDIT TESTS PASSED (100%)! <<<');
    console.log('===========================================================\n');
  } catch (err) {
    console.error('\n[AGROCONNECT TEST FAILURE]:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    await closePool();
  }
}

runAgroConnectTests();
