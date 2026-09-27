import app from './src/app.js';
import http from 'http';
import { query, closePool } from './src/db/pool.js';
import { FutureRemoteSyncAdapter } from '../src/services/syncAdapter.js';

const server = http.createServer(app);
const PORT = 5097;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

async function runPhase4Tests() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`[Phase 4 Test Runner] Server running on port ${PORT}`);

  const testUserId = `test_farmer_p4_${Date.now()}`;
  const testAssessmentId = `vs_p4_${Date.now()}`;
  const testListingId = `wp_p4_${Date.now()}`;
  const testLocationId = `loc_${testUserId}_default`;
  const testBuyerId = `test_buyer_p4_${Date.now()}`;

  const adapter = new FutureRemoteSyncAdapter({ apiBaseUrl: BASE_URL });

  try {
    console.log('\n===========================================================');
    console.log('>>> AGROCYCLE PHASE 4: REMOTE SYNC INTEGRATION TESTS <<<');
    console.log('===========================================================');

    // -------------------------------------------------------------------------
    // TEST 1: User Profile Remote Sync
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing User Sync -> PostgreSQL ---');
    const userAction = {
      actionType: 'SAVE_USER_PROFILE',
      entityType: 'users',
      entityId: testUserId,
      userId: testUserId,
      idempotencyKey: `idemp_user_${testUserId}`,
      createdAt: new Date().toISOString(),
      payload: {
        userId: testUserId,
        display_name: 'Farmer Murugan',
        phone: '9876543299',
        activeRole: 'farmer',
        verificationStatus: 'verified',
        language: 'tamil'
      }
    };

    const userSyncResult = await adapter.syncAction(userAction);
    console.log('[Test 1.1: User Sync Execution]', userSyncResult.success, userSyncResult.target);
    if (!userSyncResult.success) throw new Error('User sync failed');

    // Verify record in live Neon PostgreSQL
    const userDbRes = await query('SELECT * FROM users WHERE user_id = $1', [testUserId]);
    console.log('[Test 1.2: PostgreSQL User Verification]', userDbRes.rows.length, userDbRes.rows[0]?.display_name);
    if (userDbRes.rows.length === 0 || userDbRes.rows[0].display_name !== 'Farmer Murugan') {
      throw new Error('User not found in PostgreSQL');
    }

    // -------------------------------------------------------------------------
    // TEST 2: Farm Location Remote Sync
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Farm Location Sync -> PostgreSQL ---');
    const locationAction = {
      actionType: 'SAVE_LOCATION',
      entityType: 'userLocations',
      entityId: testLocationId,
      userId: testUserId,
      idempotencyKey: `idemp_loc_${testLocationId}`,
      createdAt: new Date().toISOString(),
      payload: {
        id: testLocationId,
        userId: testUserId,
        farmId: 'default',
        farmName: 'Murugan Organic Farm',
        latitude: 9.9252,
        longitude: 78.1198,
        accuracy: 4.5,
        city: 'Madurai',
        district: 'Madurai',
        state: 'Tamil Nadu',
        isDefault: true
      }
    };

    const locSyncResult = await adapter.syncAction(locationAction);
    console.log('[Test 2.1: Location Sync Execution]', locSyncResult.success);
    if (!locSyncResult.success) throw new Error('Location sync failed');

    const locDbRes = await query('SELECT * FROM farms_and_locations WHERE id = $1', [testLocationId]);
    console.log('[Test 2.2: PostgreSQL Location Verification]', locDbRes.rows.length, locDbRes.rows[0]?.farm_name);
    if (locDbRes.rows.length === 0 || locDbRes.rows[0].district !== 'Madurai') {
      throw new Error('Location not found in PostgreSQL');
    }

    // -------------------------------------------------------------------------
    // TEST 3: Field Assessment (5 Spatial Samples + Layer B Recommendation)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Field Assessment Sync -> PostgreSQL ---');
    const assessmentAction = {
      actionType: 'SAVE_FIELD_ASSESSMENT',
      entityType: 'scanHistory',
      entityId: testAssessmentId,
      userId: testUserId,
      idempotencyKey: `idemp_scan_${testAssessmentId}`,
      createdAt: new Date().toISOString(),
      payload: {
        id: testAssessmentId,
        userId: testUserId,
        cropName: 'Tomato',
        cultivatedAcres: 3.0,
        condition: 'salvageable_biomass',
        primaryDisease: 'Early Blight',
        severityScore: 34.2,
        confidence: 96.5,
        visualCoverage: 41.0,
        samples: [
          { zone: 'north', hasDisease: true, primaryDisease: 'Early Blight' },
          { zone: 'east', hasDisease: true, primaryDisease: 'Early Blight' },
          { zone: 'south', hasDisease: false },
          { zone: 'west', hasDisease: false },
          { zone: 'centre', hasDisease: true, primaryDisease: 'Early Blight' }
        ],
        recommendation: {
          feature: 'Urban Waste Matcher',
          action: 'Divert to Industrial Sauce Processing Unit',
          estimatedSalvageInr: 24000
        },
        commercialContext: {
          availableQuantity: 600,
          quantityUnit: 'kg',
          expectedPrice: 22
        }
      }
    };

    const scanSyncResult = await adapter.syncAction(assessmentAction);
    console.log('[Test 3.1: Assessment Sync Execution]', scanSyncResult.success);
    if (!scanSyncResult.success) throw new Error('Assessment sync failed');

    const scanDbRes = await query('SELECT * FROM field_assessments WHERE id = $1', [testAssessmentId]);
    console.log('[Test 3.2: PostgreSQL Assessment Verification]', scanDbRes.rows.length, scanDbRes.rows[0]?.crop_name);
    if (scanDbRes.rows.length === 0 || scanDbRes.rows[0].spatial_samples?.length !== 5) {
      throw new Error('Field assessment with 5 samples not verified in PostgreSQL');
    }

    // -------------------------------------------------------------------------
    // TEST 4: Marketplace Listing with Assessment Handoff
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Marketplace Listing Sync -> PostgreSQL ---');
    const listingAction = {
      actionType: 'CREATE_MARKETPLACE_LISTING',
      entityType: 'marketplaceListings',
      entityId: testListingId,
      userId: testUserId,
      idempotencyKey: `idemp_listing_${testListingId}`,
      createdAt: new Date().toISOString(),
      payload: {
        id: testListingId,
        creatorId: testUserId,
        sourceAssessmentId: testAssessmentId,
        source: 'viability-scanner',
        title: 'Industrial Sauce Grade Off-Grade Tomatoes',
        cropType: 'Tomato',
        quantityKg: 600,
        condition: 'slightly_damaged',
        askingPrice: 22,
        location: 'Madurai, Tamil Nadu',
        district: 'Madurai',
        state: 'Tamil Nadu',
        farmerName: 'Farmer Murugan',
        status: 'listed'
      }
    };

    const listingSyncResult = await adapter.syncAction(listingAction);
    console.log('[Test 4.1: Listing Sync Execution]', listingSyncResult.success);
    if (!listingSyncResult.success) throw new Error('Listing sync failed');

    const listingDbRes = await query('SELECT * FROM marketplace_listings WHERE id = $1', [testListingId]);
    console.log('[Test 4.2: PostgreSQL Listing Verification]', listingDbRes.rows.length, listingDbRes.rows[0]?.title);
    if (listingDbRes.rows.length === 0 || listingDbRes.rows[0].source_assessment_id !== testAssessmentId) {
      throw new Error('Listing with source assessment linkage not verified in PostgreSQL');
    }

    // -------------------------------------------------------------------------
    // TEST 5: Buyer Requirement Sync
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Buyer Requirement Sync -> PostgreSQL ---');
    const buyerAction = {
      actionType: 'SAVE_BUYER_REQUIREMENT',
      entityType: 'buyerRequirements',
      entityId: testBuyerId,
      userId: testBuyerId,
      idempotencyKey: `idemp_buyer_${testBuyerId}`,
      createdAt: new Date().toISOString(),
      payload: {
        buyerId: testBuyerId,
        businessName: 'Madurai Pure Pulp Processors',
        businessType: 'Food Processing',
        crop: 'Tomato',
        variety: 'Processing Grade',
        quantityRequired: 2000,
        unit: 'kg',
        targetPrice: 24,
        buyingRadiusKm: 75,
        district: 'Madurai',
        state: 'Tamil Nadu'
      }
    };

    const buyerSyncResult = await adapter.syncAction(buyerAction);
    console.log('[Test 5.1: Buyer Req Sync Execution]', buyerSyncResult.success);
    if (!buyerSyncResult.success) throw new Error('Buyer sync failed');

    const buyerDbRes = await query('SELECT * FROM buyer_requirements WHERE id = $1', [testBuyerId]);
    console.log('[Test 5.2: PostgreSQL Buyer Req Verification]', buyerDbRes.rows.length, buyerDbRes.rows[0]?.business_name);
    if (buyerDbRes.rows.length === 0 || buyerDbRes.rows[0].quantity_required !== '2000.00') {
      throw new Error('Buyer requirement not found in PostgreSQL');
    }

    // -------------------------------------------------------------------------
    // TEST 6 & 7: Idempotency & Duplicate Replay Protection
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Idempotency & Duplicate Prevention ---');
    const duplicateListingResult = await adapter.syncAction(listingAction);
    console.log('[Test 6.1: Replaying Sync Action with Same Idempotency Key]', duplicateListingResult.serverData?.replayed);
    if (!duplicateListingResult.serverData?.replayed) {
      throw new Error('Idempotency replay was not detected');
    }

    // Verify row count remains exactly 1 (no duplicate row)
    const countRes = await query('SELECT COUNT(*) FROM marketplace_listings WHERE id = $1', [testListingId]);
    console.log('[Test 6.2: Verified No Duplicate Row Created in DB]', countRes.rows[0].count);
    if (parseInt(countRes.rows[0].count, 10) !== 1) {
      throw new Error('Duplicate row was created in database!');
    }

    // -------------------------------------------------------------------------
    // TEST 8: Verify Sync Events Audit Log
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Sync Events Audit Trail ---');
    const auditRes = await query('SELECT * FROM sync_events WHERE user_id = $1 ORDER BY processed_at ASC', [testUserId]);
    console.log(`[Test 7.1: Sync Events Logged for User] Found ${auditRes.rows.length} events:`);
    for (const evt of auditRes.rows) {
      console.log(`   • Action: ${evt.action_type} | Entity: ${evt.entity_type} | Status: ${evt.status}`);
    }
    if (auditRes.rows.length < 4) {
      throw new Error('Expected at least 4 sync audit events');
    }

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Cleanup Test Fixtures ---');
    await query('DELETE FROM marketplace_listings WHERE id = $1', [testListingId]);
    await query('DELETE FROM field_assessments WHERE id = $1', [testAssessmentId]);
    await query('DELETE FROM buyer_requirements WHERE id = $1', [testBuyerId]);
    await query('DELETE FROM farms_and_locations WHERE id = $1', [testLocationId]);
    await query('DELETE FROM sync_events WHERE user_id IN ($1, $2)', [testUserId, testBuyerId]);
    await query('DELETE FROM users WHERE user_id IN ($1, $2)', [testUserId, testBuyerId]);
    console.log('[Test 8.1: Test Records Cleaned Up from Live DB]');

    console.log('\n===========================================================');
    console.log('>>> ALL PHASE 4 REMOTE SYNC INTEGRATION TESTS PASSED! <<<');
    console.log('===========================================================\n');
  } catch (err) {
    console.error('\n[PHASE 4 TEST ERROR]:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    await closePool();
  }
}

runPhase4Tests();
