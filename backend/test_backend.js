import app from './src/app.js';
import http from 'http';
import { closePool, query } from './src/db/pool.js';

const server = http.createServer(app);
const PORT = 5098;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

async function runAllTests() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`[Test Runner] Test server started on port ${PORT}`);

  const testUserId = `test_farmer_${Date.now()}`;
  const testBuyerId = `test_buyer_${Date.now()}`;
  let testAssessmentId = null;
  let testListingId = null;
  let testBuyerReqId = null;

  try {
    // -------------------------------------------------------------------------
    // 1. HEALTH CHECKS
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Health Checks ---');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    console.log('[Test 1.1: Service Health]', healthRes.status, healthData.status);
    if (healthRes.status !== 200 || healthData.status !== 'ok') throw new Error('Health check failed');

    const dbHealthRes = await fetch(`${BASE_URL}/health/db`);
    const dbHealthData = await dbHealthRes.json();
    console.log('[Test 1.2: DB Health]', dbHealthRes.status, dbHealthData.status, 'Connected:', dbHealthData.connected);
    if (dbHealthRes.status !== 200 || !dbHealthData.connected) throw new Error('DB health check failed');

    // -------------------------------------------------------------------------
    // 2. USERS / PROFILE API
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Users API ---');
    // Create / Upsert User
    const createUserRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUserId,
        display_name: 'Test Farmer Selvam',
        phone: '9876543210',
        activeRole: 'farmer',
        language: 'tamil'
      })
    });
    const createUserData = await createUserRes.json();
    console.log('[Test 2.1: Create User]', createUserRes.status, createUserData.data?.user_id);
    if (createUserRes.status !== 200 || createUserData.data?.user_id !== testUserId) {
      throw new Error(`Create user failed: ${JSON.stringify(createUserData)}`);
    }

    // Get User By ID
    const getUserRes = await fetch(`${BASE_URL}/users/${testUserId}`);
    const getUserData = await getUserRes.json();
    console.log('[Test 2.2: Get User]', getUserRes.status, getUserData.data?.display_name);
    if (getUserRes.status !== 200 || getUserData.data?.display_name !== 'Test Farmer Selvam') {
      throw new Error(`Get user failed: ${JSON.stringify(getUserData)}`);
    }

    // Update User
    const updateUserRes = await fetch(`${BASE_URL}/users/${testUserId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verification_status: 'verified' })
    });
    const updateUserData = await updateUserRes.json();
    console.log('[Test 2.3: Update User]', updateUserRes.status, updateUserData.data?.verification_status);
    if (updateUserRes.status !== 200 || updateUserData.data?.verification_status !== 'verified') {
      throw new Error(`Update user failed: ${JSON.stringify(updateUserData)}`);
    }

    // Validation failure check
    const invalidUserRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    console.log('[Test 2.4: User Validation Error (Expected 400)]', invalidUserRes.status);
    if (invalidUserRes.status !== 400) throw new Error('Expected 400 validation error');

    // -------------------------------------------------------------------------
    // 3. FARMS & LOCATIONS API
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Farms & Locations API ---');
    const saveLocRes = await fetch(`${BASE_URL}/locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUserId,
        farmId: 'farm_north_zone',
        farmName: 'North Field Tomato Plot',
        latitude: 9.9252,
        longitude: 78.1198,
        accuracy: 5.2,
        city: 'Madurai',
        district: 'Madurai',
        state: 'Tamil Nadu'
      })
    });
    const saveLocData = await saveLocRes.json();
    console.log('[Test 3.1: Save Location]', saveLocRes.status, saveLocData.data?.farm_name);
    if (saveLocRes.status !== 200 || saveLocData.data?.farm_id !== 'farm_north_zone') {
      throw new Error(`Save location failed: ${JSON.stringify(saveLocData)}`);
    }

    const getLocsRes = await fetch(`${BASE_URL}/locations/${testUserId}`);
    const getLocsData = await getLocsRes.json();
    console.log('[Test 3.2: Get User Locations]', getLocsRes.status, 'Count:', getLocsData.data?.length);
    if (getLocsRes.status !== 200 || getLocsData.data?.length === 0) {
      throw new Error(`Get locations failed: ${JSON.stringify(getLocsData)}`);
    }

    // -------------------------------------------------------------------------
    // 4. FIELD ASSESSMENTS API
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Field Assessments API ---');
    const createAssessmentRes = await fetch(`${BASE_URL}/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUserId,
        cropName: 'Tomato',
        cultivatedAcres: 2.5,
        condition: 'slightly_damaged',
        primaryDisease: 'Early Blight',
        severityScore: 28.5,
        confidence: 94.2,
        visualCoverage: 32.0,
        samples: [
          { zone: 'north', hasDisease: true, primaryDisease: 'Early Blight' },
          { zone: 'centre', hasDisease: false }
        ],
        recommendation: {
          feature: 'Urban Waste Matcher',
          action: 'List on Urban Waste Matcher for food processing',
          estimatedSalvageInr: 18500
        },
        commercialContext: {
          availableQuantity: 450,
          quantityUnit: 'kg',
          expectedPrice: 24
        }
      })
    });
    const createAssessmentData = await createAssessmentRes.json();
    testAssessmentId = createAssessmentData.data?.id;
    console.log('[Test 4.1: Create Assessment]', createAssessmentRes.status, 'ID:', testAssessmentId);
    if (createAssessmentRes.status !== 201 || !testAssessmentId) {
      throw new Error(`Create assessment failed: ${JSON.stringify(createAssessmentData)}`);
    }

    const getAssessmentRes = await fetch(`${BASE_URL}/assessments/${testAssessmentId}`);
    const getAssessmentData = await getAssessmentRes.json();
    console.log('[Test 4.2: Get Assessment By ID]', getAssessmentRes.status, getAssessmentData.data?.crop_name);
    if (getAssessmentRes.status !== 200 || getAssessmentData.data?.crop_name !== 'Tomato') {
      throw new Error(`Get assessment failed: ${JSON.stringify(getAssessmentData)}`);
    }

    // -------------------------------------------------------------------------
    // 5. MARKETPLACE LISTINGS API
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Marketplace Listings API ---');
    const createListingRes = await fetch(`${BASE_URL}/marketplace/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creatorId: testUserId,
        sourceAssessmentId: testAssessmentId,
        title: 'Freshly Harvested Off-Grade Tomatoes',
        cropType: 'Tomato',
        quantityKg: 450,
        condition: 'slightly_damaged',
        askingPrice: 24,
        district: 'Madurai',
        state: 'Tamil Nadu',
        farmerName: 'Farmer Selvam'
      })
    });
    const createListingData = await createListingRes.json();
    testListingId = createListingData.data?.id;
    console.log('[Test 5.1: Create Listing]', createListingRes.status, 'ID:', testListingId);
    if (createListingRes.status !== 201 || !testListingId) {
      throw new Error(`Create listing failed: ${JSON.stringify(createListingData)}`);
    }

    // Query listings with filter
    const listMarketRes = await fetch(`${BASE_URL}/marketplace/listings?crop_type=tomato&district=madurai`);
    const listMarketData = await listMarketRes.json();
    console.log('[Test 5.2: Query Listings]', listMarketRes.status, 'Count:', listMarketData.count);
    if (listMarketRes.status !== 200 || listMarketData.count === 0) {
      throw new Error(`Query listings failed: ${JSON.stringify(listMarketData)}`);
    }

    // Update listing status
    const updateListingRes = await fetch(`${BASE_URL}/marketplace/listings/${testListingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'matched', matched_buyer: 'Vaigai Food Processors' })
    });
    const updateListingData = await updateListingRes.json();
    console.log('[Test 5.3: Update Listing Status]', updateListingRes.status, updateListingData.data?.status);
    if (updateListingRes.status !== 200 || updateListingData.data?.status !== 'matched') {
      throw new Error(`Update listing failed: ${JSON.stringify(updateListingData)}`);
    }

    // -------------------------------------------------------------------------
    // 6. BUYER REQUIREMENTS API
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Buyer Requirements API ---');
    const createBuyerReqRes = await fetch(`${BASE_URL}/buyers/requirements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buyerId: testBuyerId,
        businessName: 'Vaigai Agro Food Processors Ltd.',
        businessType: 'Processing Unit',
        crop: 'Tomato',
        variety: 'Sauce Grade',
        quantityRequired: 1200,
        targetPrice: 26,
        buyingRadiusKm: 60,
        district: 'Madurai',
        state: 'Tamil Nadu'
      })
    });
    const createBuyerReqData = await createBuyerReqRes.json();
    testBuyerReqId = createBuyerReqData.data?.id;
    console.log('[Test 6.1: Create Buyer Requirement]', createBuyerReqRes.status, 'ID:', testBuyerReqId);
    if (createBuyerReqRes.status !== 201 || !testBuyerReqId) {
      throw new Error(`Create buyer req failed: ${JSON.stringify(createBuyerReqData)}`);
    }

    const listBuyerReqRes = await fetch(`${BASE_URL}/buyers/requirements?crop=tomato`);
    const listBuyerReqData = await listBuyerReqRes.json();
    console.log('[Test 6.2: Query Buyer Requirements]', listBuyerReqRes.status, 'Count:', listBuyerReqData.count);
    if (listBuyerReqRes.status !== 200 || listBuyerReqData.count === 0) {
      throw new Error(`Query buyer req failed: ${JSON.stringify(listBuyerReqData)}`);
    }

    // -------------------------------------------------------------------------
    // 7. OFFLINE SYNC API
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Offline Sync API ---');
    const testIdempotencyKey = `idemp_${Date.now()}_abc`;
    const syncRes1 = await fetch(`${BASE_URL}/sync/marketplacelisting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': testIdempotencyKey
      },
      body: JSON.stringify({
        actionType: 'CREATE_LISTING',
        entityId: `wp_sync_${Date.now()}`,
        userId: testUserId,
        payload: {
          crop_type: 'Banana',
          quantity_kg: 300,
          condition: 'slightly_damaged',
          asking_price: 18,
          farmer_name: 'Farmer Selvam'
        }
      })
    });
    const syncData1 = await syncRes1.json();
    console.log('[Test 7.1: Sync Action 1]', syncRes1.status, 'Synced:', syncData1.synced);
    if (syncRes1.status !== 200 || !syncData1.synced) {
      throw new Error(`Sync action 1 failed: ${JSON.stringify(syncData1)}`);
    }

    // Replay with exact same idempotency key (must return replayed = true without duplication)
    const syncRes2 = await fetch(`${BASE_URL}/sync/marketplacelisting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': testIdempotencyKey
      },
      body: JSON.stringify({
        actionType: 'CREATE_LISTING',
        entityId: `wp_sync_${Date.now()}`,
        userId: testUserId,
        payload: {}
      })
    });
    const syncData2 = await syncRes2.json();
    console.log('[Test 7.2: Idempotency Replay]', syncRes2.status, 'Replayed:', syncData2.replayed);
    if (syncRes2.status !== 200 || !syncData2.replayed) {
      throw new Error(`Idempotency replay check failed: ${JSON.stringify(syncData2)}`);
    }

    // Get user sync history
    const syncHistRes = await fetch(`${BASE_URL}/sync/${testUserId}`);
    const syncHistData = await syncHistRes.json();
    console.log('[Test 7.3: User Sync History]', syncHistRes.status, 'Events Count:', syncHistData.count);
    if (syncHistRes.status !== 200 || syncHistData.count === 0) {
      throw new Error(`User sync history failed: ${JSON.stringify(syncHistData)}`);
    }

    // -------------------------------------------------------------------------
    // 8. 404 & CLEANUP
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Error Handling & Cleanup ---');
    const notFoundRes = await fetch(`${BASE_URL}/unknown-route-test`);
    console.log('[Test 8.1: Catch-all 404]', notFoundRes.status);
    if (notFoundRes.status !== 404) throw new Error('Expected 404 for unknown route');

    // Clean up test records from live DB
    await query('DELETE FROM marketplace_listings WHERE id = $1', [testListingId]);
    await query('DELETE FROM field_assessments WHERE id = $1', [testAssessmentId]);
    await query('DELETE FROM buyer_requirements WHERE id = $1', [testBuyerReqId]);
    await query('DELETE FROM farms_and_locations WHERE user_id = $1', [testUserId]);
    await query('DELETE FROM sync_events WHERE user_id = $1', [testUserId]);
    await query('DELETE FROM users WHERE user_id IN ($1, $2)', [testUserId, testBuyerId]);
    console.log('[Test 8.2: Test Fixtures Cleaned Up from Live DB]');

    console.log('\n===========================================================');
    console.log('>>> ALL REST API & DATABASE INTEGRATION TESTS PASSED! <<<');
    console.log('===========================================================\n');
  } catch (err) {
    console.error('\n[FATAL TEST FAILURE]:', err.message);
    process.exitCode = 1;
  } finally {
    server.close();
    await closePool();
  }
}

runAllTests();
