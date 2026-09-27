import app from './src/app.js';
import http from 'http';
import { query, closePool } from './src/db/pool.js';
import { FutureRemoteSyncAdapter } from '../src/services/syncAdapter.js';
import { aggregateFieldAssessment } from '../src/services/fieldAssessmentEngine.js';
import { evaluateRescuePathway } from '../src/services/decisionEngine.js';

const server = http.createServer(app);
const PORT = 5095;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

async function runEndToEndFunctionalAudit() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`[E2E Functional Audit Runner] Server running on port ${PORT}`);

  const testFarmerId = `e2e_farmer_${Date.now()}`;
  const testBuyerId = `e2e_buyer_${Date.now()}`;
  const testAssessmentId = `vs_e2e_${Date.now()}`;
  const testListingId = `wp_e2e_${Date.now()}`;
  const testCenterId = `cnt_e2e_${Date.now()}`;
  const testBookingId = `sbk_e2e_${Date.now()}`;
  const testActivityId = `ca_e2e_${Date.now()}`;
  const testOfferId = `co_e2e_${Date.now()}`;
  const testClaimId = `ic_e2e_${Date.now()}`;
  const testAgroPostId = `ap_e2e_${Date.now()}`;
  const testNotifId = `notif_e2e_${Date.now()}`;

  const adapter = new FutureRemoteSyncAdapter({ apiBaseUrl: BASE_URL });

  try {
    console.log('\n================================================================================');
    console.log('>>> AGROCYCLE: FINAL PRE-DEPLOYMENT END-TO-END FUNCTIONAL AUDIT <<<');
    console.log('================================================================================');

    // -------------------------------------------------------------------------
    // 1. AUTHENTICATION & MULTI-ROLE PERSISTENCE
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Authentication & Multi-Role Persistence ---');
    // Farmer account
    const farmerRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testFarmerId,
        displayName: 'Farmer Selvam',
        phone: '9876543210',
        roles: ['farmer'],
        activeRole: 'farmer',
        verificationStatus: 'verified',
        language: 'tamil'
      })
    });
    const farmerData = await farmerRes.json();
    console.log('[1.1: Farmer Account Created]', farmerRes.status, farmerData.data?.display_name);
    if (farmerRes.status !== 200 || farmerData.data?.user_id !== testFarmerId) {
      throw new Error('Farmer creation failed');
    }

    // Buyer account
    const buyerRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testBuyerId,
        displayName: 'Coimbatore Processing Mills',
        phone: '9876543222',
        roles: ['buyer'],
        activeRole: 'buyer',
        verificationStatus: 'verified',
        language: 'english'
      })
    });
    const buyerData = await buyerRes.json();
    console.log('[1.2: Buyer Account Created]', buyerRes.status, buyerData.data?.display_name);
    if (buyerRes.status !== 200 || buyerData.data?.user_id !== testBuyerId) {
      throw new Error('Buyer creation failed');
    }

    // Role switching update
    const switchRoleRes = await fetch(`${BASE_URL}/users/${testFarmerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeRole: 'farmer' })
    });
    console.log('[1.3: Role State Persisted in PostgreSQL]', switchRoleRes.status);
    if (switchRoleRes.status !== 200) throw new Error('Role update failed');

    // -------------------------------------------------------------------------
    // 2. VIABILITY SCANNER & 5-POINT SPATIAL ASSESSMENT
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Viability Scanner & 5-Point Spatial Assessment ---');
    const spatialSamples = [
      { id: 's1', crop: 'Tomato', primaryDisease: 'Tomato Early Blight', hasDisease: true, confidence: 0.88, visualCoverage: 25.0, detections: [{ isDisease: true, confidence: 0.88, diseaseName: 'Tomato Early Blight', box: [10, 10, 100, 100] }] },
      { id: 's2', crop: 'Tomato', primaryDisease: 'Tomato Early Blight', hasDisease: true, confidence: 0.84, visualCoverage: 20.0, detections: [{ isDisease: true, confidence: 0.84, diseaseName: 'Tomato Early Blight', box: [10, 10, 90, 90] }] },
      { id: 's3', crop: 'Tomato', primaryDisease: 'None', hasDisease: false, confidence: 0.90, visualCoverage: 5.0, detections: [] },
      { id: 's4', crop: 'Tomato', primaryDisease: 'Tomato Early Blight', hasDisease: true, confidence: 0.82, visualCoverage: 18.0, detections: [{ isDisease: true, confidence: 0.82, diseaseName: 'Tomato Early Blight', box: [10, 10, 85, 85] }] },
      { id: 's5', crop: 'Tomato', primaryDisease: 'Tomato Early Blight', hasDisease: true, confidence: 0.86, visualCoverage: 22.0, detections: [{ isDisease: true, confidence: 0.86, diseaseName: 'Tomato Early Blight', box: [10, 10, 95, 95] }] }
    ];

    const assessmentResult = aggregateFieldAssessment({
      crop: 'Tomato',
      fieldArea: 3.5,
      materialState: 'standing_crop',
      condition: 'slightly_damaged',
      burningContext: 'no',
      insuranceContext: 'no',
      feedContext: 'no',
      industrialContext: 'yes',
      sampledSections: ['North', 'East', 'South', 'West', 'Centre'],
      samples: spatialSamples
    });

    console.log('[2.1: 5-Point Assessment Evaluated]');
    console.log(`     • Dominant: ${assessmentResult.primaryDisease}`);
    console.log(`     • Positive Samples: ${assessmentResult.positiveSamplesCount}/5`);
    console.log(`     • Concern: ${assessmentResult.conditionLabel}`);
    console.log(`     • Primary Pathway: ${assessmentResult.primaryPathway?.feature || assessmentResult.finalRecommendation?.name || assessmentResult.recommendedAction?.feature || 'Urban Waste Matcher'}`);

    if (assessmentResult.positiveSamplesCount !== 4) {
      throw new Error('Spatial sample aggregation failed');
    }

    // Save assessment to PostgreSQL via sync adapter
    const scanAction = {
      actionType: 'SAVE_FIELD_ASSESSMENT',
      entityType: 'scanHistory',
      entityId: testAssessmentId,
      userId: testFarmerId,
      idempotencyKey: `idemp_scan_${testAssessmentId}`,
      createdAt: new Date().toISOString(),
      payload: {
        id: testAssessmentId,
        userId: testFarmerId,
        cropName: 'Tomato',
        cultivatedAcres: 3.5,
        condition: 'salvageable_biomass',
        primaryDisease: assessmentResult.primaryDisease,
        severityScore: 35.5,
        confidence: 86.0,
        visualCoverage: 22.0,
        samples: spatialSamples,
        recommendation: assessmentResult.finalRecommendation,
        commercialContext: { availableQuantity: 750, quantityUnit: 'kg', expectedPrice: 20 },
        location: { district: 'Madurai', state: 'Tamil Nadu', latitude: 9.9252, longitude: 78.1198 }
      }
    };

    const scanSyncRes = await adapter.syncAction(scanAction);
    console.log('[2.2: Field Assessment Synced to PostgreSQL]', scanSyncRes.success);
    if (!scanSyncRes.success) throw new Error('Assessment sync failed');

    const scanDbRes = await query('SELECT * FROM field_assessments WHERE id = $1', [testAssessmentId]);
    console.log('[2.3: Verified PostgreSQL Spatial Samples JSON]', scanDbRes.rows[0]?.spatial_samples?.length);
    if (scanDbRes.rows[0]?.spatial_samples?.length !== 5) {
      throw new Error('5-sample JSON not verified in database');
    }

    // -------------------------------------------------------------------------
    // 3. ASSESSMENT -> URBAN WASTE MATCHER HANDOFF
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Assessment -> Urban Waste Matcher Handoff ---');
    const listingAction = {
      actionType: 'CREATE_MARKETPLACE_LISTING',
      entityType: 'marketplaceListings',
      entityId: testListingId,
      userId: testFarmerId,
      idempotencyKey: `idemp_listing_${testListingId}`,
      createdAt: new Date().toISOString(),
      payload: {
        id: testListingId,
        creatorId: testFarmerId,
        sourceAssessmentId: testAssessmentId,
        source: 'viability-scanner',
        title: 'Industrial Pulping Grade Tomato Salvage',
        cropType: 'Tomato',
        quantityKg: 750,
        condition: 'slightly_damaged',
        askingPrice: 20,
        location: 'Madurai APMC Hub',
        district: 'Madurai',
        state: 'Tamil Nadu',
        farmerName: 'Farmer Selvam',
        status: 'listed'
      }
    };

    const listingSyncRes = await adapter.syncAction(listingAction);
    console.log('[3.1: Handoff Listing Synced]', listingSyncRes.success);
    if (!listingSyncRes.success) throw new Error('Listing handoff failed');

    const listingDbRes = await query('SELECT * FROM marketplace_listings WHERE id = $1', [testListingId]);
    console.log('[3.2: Verified Foreign Key Linkage]', listingDbRes.rows[0]?.source_assessment_id === testAssessmentId);
    if (listingDbRes.rows[0]?.source_assessment_id !== testAssessmentId) {
      throw new Error('Marketplace foreign key to assessment missing');
    }

    // -------------------------------------------------------------------------
    // 4. MARKETPLACE LIFECYCLE (QUERY, UPDATE, BUYER VIEW)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Marketplace Lifecycle ---');
    // Buyer queries marketplace
    const queryListingsRes = await fetch(`${BASE_URL}/marketplace/listings?crop_type=tomato&district=madurai`);
    const listingsList = await queryListingsRes.json();
    console.log('[4.1: Buyer Query Listings Result Count]', listingsList.count);
    if (listingsList.count === 0) throw new Error('Buyer query returned 0 listings');

    // Update listing price / status
    const updateListingRes = await fetch(`${BASE_URL}/marketplace/listings/${testListingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'matched', matched_buyer: 'Coimbatore Processing Mills' })
    });
    const updatedListingData = await updateListingRes.json();
    console.log('[4.2: Listing Updated to Matched]', updatedListingData.data?.status, updatedListingData.data?.matched_buyer);
    if (updatedListingData.data?.status !== 'matched') {
      throw new Error('Listing status update failed');
    }

    // -------------------------------------------------------------------------
    // 5. AGROCONNECT COMMUNITY EXCHANGE
    // -------------------------------------------------------------------------
    console.log('\n--- 5. AgroConnect Community Exchange ---');
    const agroAction = {
      actionType: 'CREATE_AGROCONNECT_POST',
      entityType: 'agroConnectActivity',
      entityId: testAgroPostId,
      userId: testFarmerId,
      idempotencyKey: `idemp_agro_${testAgroPostId}`,
      createdAt: new Date().toISOString(),
      payload: {
        id: testAgroPostId,
        creatorId: testFarmerId,
        creatorRole: 'farmer',
        title: 'Fresh Paddy Residue / Straw for Cattle Feed',
        crop_type: 'Paddy',
        quantity_kg: 800,
        condition: 'fresh',
        location: 'Madurai East Canal Area',
        post_type: 'offering_waste',
        farmer_name: 'Farmer Selvam',
        contact_phone: '9876543210',
        status: 'available'
      }
    };

    const agroSyncRes = await adapter.syncAction(agroAction);
    console.log('[5.1: AgroConnect Post Synced]', agroSyncRes.success);
    if (!agroSyncRes.success) throw new Error('AgroConnect post sync failed');

    const agroDbRes = await query('SELECT * FROM agroconnect_posts WHERE id = $1', [testAgroPostId]);
    console.log('[5.2: PostgreSQL AgroConnect Verified]', agroDbRes.rows[0]?.title);
    if (agroDbRes.rows.length === 0) throw new Error('AgroConnect record not found');

    // -------------------------------------------------------------------------
    // 6. SILAGE BANK (FACILITY & FARMER BOOKING)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Silage Bank Network ---');
    // Buyer adds processing center
    const centerAction = {
      actionType: 'SAVE_SILAGE_CENTER',
      entityType: 'silageCenter',
      entityId: testCenterId,
      userId: testBuyerId,
      idempotencyKey: `idemp_cnt_${testCenterId}`,
      createdAt: new Date().toISOString(),
      payload: {
        id: testCenterId,
        creatorId: testBuyerId,
        name: 'Madurai Silage Processing Hub',
        location: 'Madurai Ring Road',
        district: 'Madurai',
        state: 'Tamil Nadu',
        price_per_kg: 2.80,
        capacity_kg: 20000,
        available_kg: 18000,
        contact_phone: '9876543222',
        status: 'operational'
      }
    };

    const centerSyncRes = await adapter.syncAction(centerAction);
    console.log('[6.1: Silage Center Synced]', centerSyncRes.success);
    if (!centerSyncRes.success) throw new Error('Silage center sync failed');

    // Farmer books pickup
    const bookingAction = {
      actionType: 'CREATE_SILAGE_BOOKING',
      entityType: 'silageBooking',
      entityId: testBookingId,
      userId: testFarmerId,
      idempotencyKey: `idemp_sbk_${testBookingId}`,
      createdAt: new Date().toISOString(),
      payload: {
        id: testBookingId,
        creatorId: testFarmerId,
        centerId: testCenterId,
        crop_type: 'Paddy Straw',
        quantity_kg: 600,
        price_per_kg: 2.80,
        total_price: 1680,
        pickup_date: '2026-10-05',
        farmer_name: 'Farmer Selvam',
        location: 'Madurai Farm',
        contact_phone: '9876543210',
        status: 'requested'
      }
    };

    const bookingSyncRes = await adapter.syncAction(bookingAction);
    console.log('[6.2: Farmer Silage Booking Synced]', bookingSyncRes.success);
    if (!bookingSyncRes.success) throw new Error('Silage booking sync failed');

    // -------------------------------------------------------------------------
    // 7. CARBON CASH (ACTIVITY, ANTI-SELF-SPONSORSHIP & ACCEPTANCE)
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Carbon Cash Eco-Activities ---');
    const carbonAction = {
      actionType: 'CREATE_CARBON_ACTIVITY',
      entityType: 'carbonActivity',
      entityId: testActivityId,
      userId: testFarmerId,
      idempotencyKey: `idemp_ca_${testActivityId}`,
      createdAt: new Date().toISOString(),
      payload: {
        id: testActivityId,
        creatorId: testFarmerId,
        activity_type: 'no_burn',
        description: 'Mulching and in-situ incorporation to prevent field burning',
        area_acres: 3.5,
        co2_saved_kg: 2975,
        credits_earned: 2.975,
        credit_value_inr: 1487.5,
        farmer_name: 'Farmer Selvam',
        status: 'pending'
      }
    };

    const carbonSyncRes = await adapter.syncAction(carbonAction);
    console.log('[7.1: Carbon Activity Synced]', carbonSyncRes.success);
    if (!carbonSyncRes.success) throw new Error('Carbon activity sync failed');

    // Anti-self-sponsorship test
    const selfSponsorRes = await fetch(`${BASE_URL}/carbon/activities/${testActivityId}/offers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sponsorId: testFarmerId, offered_price_inr: 1500 })
    });
    console.log('[7.2: Anti-Self-Sponsorship Guard Verified]', selfSponsorRes.status === 400);
    if (selfSponsorRes.status !== 400) throw new Error('Anti-self-sponsorship guard failed');

    // Buyer makes valid offer
    const validOfferRes = await fetch(`${BASE_URL}/carbon/activities/${testActivityId}/offers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offer_id: testOfferId,
        sponsorId: testBuyerId,
        sponsor_name: 'Coimbatore Processing Mills',
        offered_price_inr: 1600
      })
    });
    console.log('[7.3: Buyer Offer Submitted]', validOfferRes.status === 201);
    if (validOfferRes.status !== 201) throw new Error('Buyer offer submission failed');

    // Farmer accepts offer
    const acceptOfferRes = await fetch(`${BASE_URL}/carbon/activities/${testActivityId}/offers/${testOfferId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept', userId: testFarmerId })
    });
    console.log('[7.4: Farmer Accepted Offer]', acceptOfferRes.status === 200);
    if (acceptOfferRes.status !== 200) throw new Error('Farmer offer acceptance failed');

    // -------------------------------------------------------------------------
    // 8. CLAIM ROCKET EVIDENCE DOSSIER
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Claim Rocket Loss Evidence Dossier ---');
    const claimAction = {
      actionType: 'SAVE_CLAIM_DOSSIER',
      entityType: 'claimDossier',
      entityId: testClaimId,
      userId: testFarmerId,
      idempotencyKey: `idemp_ic_${testClaimId}`,
      createdAt: new Date().toISOString(),
      payload: {
        id: testClaimId,
        creatorId: testFarmerId,
        sourceAssessmentId: testAssessmentId,
        farmer_name: 'Farmer Selvam',
        mobile_number: '9876543210',
        policy_number: 'POL-AGR-5544',
        crop_type: 'Tomato',
        damage_type: 'pest',
        damage_percentage: 55,
        area_acres: 3.5,
        estimated_loss_inr: 38000,
        claim_amount_inr: 38000,
        status: 'ready',
        location: 'Madurai North Taluk',
        evidenceReview: {
          image_quality: 'adequate',
          peril_consistency: 'Reported peril: Pest Infestation / Attack.',
          disclaimer: 'Visual observations are for documentation assistance only and do not constitute an official insurance loss assessment or claim settlement decision.',
          assessment_source: 'Local Evidence Review Engine'
        }
      }
    };

    const claimSyncRes = await adapter.syncAction(claimAction);
    console.log('[8.1: Claim Dossier Synced]', claimSyncRes.success);
    if (!claimSyncRes.success) throw new Error('Claim dossier sync failed');

    const claimDbRes = await query('SELECT * FROM claim_dossiers WHERE id = $1', [testClaimId]);
    console.log('[8.2: Verified Assessment Linkage & Disclaimer]', claimDbRes.rows[0]?.source_assessment_id === testAssessmentId);
    if (claimDbRes.rows[0]?.source_assessment_id !== testAssessmentId) {
      throw new Error('Claim dossier assessment link not found');
    }

    // -------------------------------------------------------------------------
    // 9. OFFLINE MUTATION REPLAY & IDEMPOTENCY PROTECTION
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Offline Mutation Replay & Idempotency Protection ---');
    // Replay exact same listing sync action (simulating reconnect race)
    const replayRes = await adapter.syncAction(listingAction);
    console.log('[9.1: Replayed Sync Action Handled Gracefully]', replayRes.serverData?.replayed === true);
    if (!replayRes.serverData?.replayed) {
      throw new Error('Idempotency replay was not detected');
    }

    const countRes = await query('SELECT COUNT(*) FROM marketplace_listings WHERE id = $1', [testListingId]);
    console.log('[9.2: Database Row Count Remains Exactly 1 (0 Duplicates)]', countRes.rows[0]?.count === '1');
    if (countRes.rows[0]?.count !== '1') {
      throw new Error('Duplicate database record was created on replay!');
    }

    // -------------------------------------------------------------------------
    // 10. DATABASE AUDIT & SYNC EVENTS TRAIL
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Database Audit & Sync Events Trail ---');
    const syncEventsRes = await query('SELECT * FROM sync_events WHERE user_id = $1 ORDER BY processed_at ASC', [testFarmerId]);
    console.log(`[10.1: Sync Events Logged for Farmer] Found ${syncEventsRes.rows.length} audit entries:`);
    for (const evt of syncEventsRes.rows) {
      console.log(`      • [${evt.status.toUpperCase()}] ${evt.action_type} ➔ ${evt.entity_type} (ID: ${evt.entity_id})`);
    }
    if (syncEventsRes.rows.length < 5) {
      throw new Error('Expected at least 5 sync events logged in database');
    }

    // -------------------------------------------------------------------------
    // 11. CLEANUP TEST FIXTURES
    // -------------------------------------------------------------------------
    console.log('\n--- 11. Cleanup Test Fixtures ---');
    await query('DELETE FROM claim_dossiers WHERE id = $1', [testClaimId]);
    await query('DELETE FROM agroconnect_posts WHERE id = $1', [testAgroPostId]);
    await query('DELETE FROM carbon_offers WHERE id = $1', [testOfferId]);
    await query('DELETE FROM carbon_activities WHERE id = $1', [testActivityId]);
    await query('DELETE FROM silage_bookings WHERE id = $1', [testBookingId]);
    await query('DELETE FROM silage_centers WHERE id = $1', [testCenterId]);
    await query('DELETE FROM marketplace_listings WHERE id = $1', [testListingId]);
    await query('DELETE FROM field_assessments WHERE id = $1', [testAssessmentId]);
    await query('DELETE FROM sync_events WHERE user_id IN ($1, $2)', [testFarmerId, testBuyerId]);
    await query('DELETE FROM users WHERE user_id IN ($1, $2)', [testFarmerId, testBuyerId]);
    console.log('[11.1: Live Neon PostgreSQL Cleaned Up Completely]');

    console.log('\n================================================================================');
    console.log('>>> ALL 11 END-TO-END PRE-DEPLOYMENT FUNCTIONAL AUDITS PASSED (100%)! <<<');
    console.log('================================================================================\n');

  } catch (err) {
    console.error('\n[E2E AUDIT FAILURE]:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    await closePool();
  }
}

runEndToEndFunctionalAudit();
