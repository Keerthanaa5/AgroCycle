import app from './src/app.js';
import http from 'http';
import { query, closePool } from './src/db/pool.js';
import { FutureRemoteSyncAdapter } from '../src/services/syncAdapter.js';

const server = http.createServer(app);
const PORT = 5096;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

async function runPhase5Tests() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`[Phase 5 Test Runner] Server running on port ${PORT}`);

  const testFarmerId = `test_farmer_p5_${Date.now()}`;
  const testBuyerId = `test_buyer_p5_${Date.now()}`;
  const testCenterId = `cnt_p5_${Date.now()}`;
  const testBookingId = `sbk_p5_${Date.now()}`;
  const testActivityId = `ca_p5_${Date.now()}`;
  const testOfferId = `co_p5_${Date.now()}`;
  const testClaimId = `ic_p5_${Date.now()}`;
  const testAgroPostId = `ap_p5_${Date.now()}`;
  const testNotifId = `notif_p5_${Date.now()}`;

  const adapter = new FutureRemoteSyncAdapter({ apiBaseUrl: BASE_URL });

  try {
    console.log('\n===========================================================');
    console.log('>>> AGROCYCLE PHASE 5: DOMAIN MODULES INTEGRATION TESTS <<<');
    console.log('===========================================================');

    // -------------------------------------------------------------------------
    // TEST 1: Silage Center Sync & REST Verification
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Silage Center Sync -> PostgreSQL ---');
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
        creatorRole: 'buyer',
        name: 'Vellore Feed & Silage Hub',
        location: 'Vellore, Tamil Nadu',
        district: 'Vellore',
        state: 'Tamil Nadu',
        price_per_kg: 2.75,
        capacity_kg: 15000,
        available_kg: 12000,
        contact_phone: '9876543220',
        status: 'operational'
      }
    };

    const centerSyncRes = await adapter.syncAction(centerAction);
    console.log('[Test 1.1: Silage Center Sync]', centerSyncRes.success);
    if (!centerSyncRes.success) throw new Error('Silage center sync failed');

    const centerDbRes = await query('SELECT * FROM silage_centers WHERE id = $1', [testCenterId]);
    console.log('[Test 1.2: PostgreSQL Center Verification]', centerDbRes.rows.length, centerDbRes.rows[0]?.name);
    if (centerDbRes.rows.length === 0 || centerDbRes.rows[0].price_per_kg !== '2.75') {
      throw new Error('Silage center record not verified in PostgreSQL');
    }

    // -------------------------------------------------------------------------
    // TEST 2: Silage Booking Sync & Status Transition
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Silage Booking Sync -> PostgreSQL ---');
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
        crop_type: 'Maize Fodder',
        quantity_kg: 500,
        price_per_kg: 2.75,
        total_price: 1375,
        pickup_date: '2026-10-01',
        farmer_name: 'Farmer Murugan',
        location: 'Vellore Farm',
        contact_phone: '9876543299',
        status: 'requested'
      }
    };

    const bookingSyncRes = await adapter.syncAction(bookingAction);
    console.log('[Test 2.1: Silage Booking Sync]', bookingSyncRes.success);
    if (!bookingSyncRes.success) throw new Error('Silage booking sync failed');

    const bookingDbRes = await query('SELECT * FROM silage_bookings WHERE id = $1', [testBookingId]);
    console.log('[Test 2.2: PostgreSQL Booking Verification]', bookingDbRes.rows.length, bookingDbRes.rows[0]?.crop_type);
    if (bookingDbRes.rows.length === 0 || bookingDbRes.rows[0].total_price !== '1375.00') {
      throw new Error('Silage booking record not verified in PostgreSQL');
    }

    // Direct REST status update by buyer/operator
    const statusUpdateRes = await fetch(`${BASE_URL}/silage/bookings/${testBookingId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' })
    });
    const statusData = await statusUpdateRes.json();
    console.log('[Test 2.3: Silage Booking Status Update]', statusData.status, statusData.data?.status);
    if (statusData.data?.status !== 'confirmed') {
      throw new Error('Silage booking status update failed');
    }

    // -------------------------------------------------------------------------
    // TEST 3: Carbon Activity & Anti-Self-Sponsorship Protection
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Carbon Activity Sync & Anti-Self-Sponsorship ---');
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
        creatorRole: 'farmer',
        activity_type: 'composting',
        description: 'Aerobic composting of paddy straw residue',
        area_acres: 2.5,
        co2_saved_kg: 2125,
        credits_earned: 2.125,
        credit_value_inr: 1062.5,
        farmer_name: 'Farmer Murugan',
        status: 'pending'
      }
    };

    const carbonSyncRes = await adapter.syncAction(carbonAction);
    console.log('[Test 3.1: Carbon Activity Sync]', carbonSyncRes.success);
    if (!carbonSyncRes.success) throw new Error('Carbon activity sync failed');

    const carbonDbRes = await query('SELECT * FROM carbon_activities WHERE id = $1', [testActivityId]);
    console.log('[Test 3.2: PostgreSQL Carbon Activity Verification]', carbonDbRes.rows.length, carbonDbRes.rows[0]?.activity_type);
    if (carbonDbRes.rows.length === 0 || carbonDbRes.rows[0].co2_saved_kg !== '2125.00') {
      throw new Error('Carbon activity not verified in PostgreSQL');
    }

    // Anti-Self-Sponsorship Test: Farmer tries to sponsor own activity
    const selfSponsorRes = await fetch(`${BASE_URL}/carbon/activities/${testActivityId}/offers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sponsorId: testFarmerId, offered_price_inr: 1200 })
    });
    console.log('[Test 3.3: Anti-Self-Sponsorship Blocked]', selfSponsorRes.status);
    if (selfSponsorRes.status !== 400) {
      throw new Error('Expected 400 Bad Request for self-sponsorship attempt');
    }

    // Valid Buyer Sponsorship Offer
    const validOfferRes = await fetch(`${BASE_URL}/carbon/activities/${testActivityId}/offers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offer_id: testOfferId,
        sponsorId: testBuyerId,
        sponsor_name: 'EcoEnergy Corp',
        offered_price_inr: 1250
      })
    });
    const offerData = await validOfferRes.json();
    console.log('[Test 3.4: Valid Buyer Sponsorship Offer]', validOfferRes.status, offerData.data?.offered_price_inr);
    if (validOfferRes.status !== 201) {
      throw new Error('Valid carbon offer failed');
    }

    // Unauthorized Offer Acceptance Attempt (Non-owner tries to accept offer)
    const unauthAcceptRes = await fetch(`${BASE_URL}/carbon/activities/${testActivityId}/offers/${testOfferId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept', userId: testBuyerId })
    });
    console.log('[Test 3.5: Non-Owner Offer Acceptance Blocked]', unauthAcceptRes.status);
    if (unauthAcceptRes.status !== 403) {
      throw new Error('Expected 403 Forbidden when non-owner accepts offer');
    }

    // Owner Farmer Accepts Buyer Offer
    const ownerAcceptRes = await fetch(`${BASE_URL}/carbon/activities/${testActivityId}/offers/${testOfferId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept', userId: testFarmerId })
    });
    const acceptData = await ownerAcceptRes.json();
    console.log('[Test 3.6: Owner Farmer Accepts Offer]', ownerAcceptRes.status, acceptData.data?.status);
    if (acceptData.data?.status !== 'accepted') {
      throw new Error('Owner offer acceptance failed');
    }

    // -------------------------------------------------------------------------
    // TEST 4: Claim Rocket Evidence Dossier Sync
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Claim Dossier Sync -> PostgreSQL ---');
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
        farmer_name: 'Farmer Murugan',
        mobile_number: '9876543299',
        policy_number: 'POL-AGR-9988',
        crop_type: 'Paddy',
        damage_type: 'flood',
        damage_percentage: 65,
        area_acres: 4.0,
        estimated_loss_inr: 45000,
        claim_amount_inr: 45000,
        status: 'ready',
        location: 'Vellore Basin, Tamil Nadu',
        evidenceReview: {
          image_quality: 'adequate',
          peril_consistency: 'Reported peril: Flood / Waterlogging.',
          assessment_source: 'Local Evidence Review Engine'
        }
      }
    };

    const claimSyncRes = await adapter.syncAction(claimAction);
    console.log('[Test 4.1: Claim Dossier Sync]', claimSyncRes.success);
    if (!claimSyncRes.success) throw new Error('Claim dossier sync failed');

    const claimDbRes = await query('SELECT * FROM claim_dossiers WHERE id = $1', [testClaimId]);
    console.log('[Test 4.2: PostgreSQL Claim Dossier Verification]', claimDbRes.rows.length, claimDbRes.rows[0]?.crop_type);
    if (claimDbRes.rows.length === 0 || claimDbRes.rows[0].damage_type !== 'flood') {
      throw new Error('Claim dossier not verified in PostgreSQL');
    }

    // -------------------------------------------------------------------------
    // TEST 5: AgroConnect Community Post Sync
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing AgroConnect Community Post Sync -> PostgreSQL ---');
    const agroAction = {
      actionType: 'CREATE_AGROCONNECT_POST',
      entityType: 'agroConnectActivity',
      entityId: testAgroPostId,
      userId: testFarmerId,
      idempotencyKey: `idemp_ap_${testAgroPostId}`,
      createdAt: new Date().toISOString(),
      payload: {
        id: testAgroPostId,
        creatorId: testFarmerId,
        creatorRole: 'farmer',
        title: 'Fresh Sugarcane Bagasse & Tops Available for Cattle Fodder',
        crop_type: 'Sugarcane',
        quantity_kg: 1200,
        condition: 'fresh',
        location: 'Vellore Sugar Mill Zone',
        post_type: 'offering_waste',
        farmer_name: 'Farmer Murugan',
        contact_phone: '9876543299',
        status: 'available'
      }
    };

    const agroSyncRes = await adapter.syncAction(agroAction);
    console.log('[Test 5.1: AgroConnect Post Sync]', agroSyncRes.success);
    if (!agroSyncRes.success) throw new Error('AgroConnect post sync failed');

    const agroDbRes = await query('SELECT * FROM agroconnect_posts WHERE id = $1', [testAgroPostId]);
    console.log('[Test 5.2: PostgreSQL AgroConnect Verification]', agroDbRes.rows.length, agroDbRes.rows[0]?.title);
    if (agroDbRes.rows.length === 0 || agroDbRes.rows[0].quantity_kg !== '1200.00') {
      throw new Error('AgroConnect post not verified in PostgreSQL');
    }

    // -------------------------------------------------------------------------
    // TEST 6: Notifications Creation & Mark Read
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Notifications Sync & Read Status -> PostgreSQL ---');
    const notifAction = {
      actionType: 'SAVE_NOTIFICATION',
      entityType: 'notifications',
      entityId: testNotifId,
      userId: testFarmerId,
      idempotencyKey: `idemp_notif_${testNotifId}`,
      createdAt: new Date().toISOString(),
      payload: {
        id: testNotifId,
        userId: testFarmerId,
        title: 'New Sponsorship Offer Received',
        message: 'EcoEnergy Corp offered ₹1250 for your composting activity.',
        type: 'carbon_offer',
        is_read: false,
        action_url: '/carbon-cash'
      }
    };

    const notifSyncRes = await adapter.syncAction(notifAction);
    console.log('[Test 6.1: Notification Sync]', notifSyncRes.success);
    if (!notifSyncRes.success) throw new Error('Notification sync failed');

    const notifDbRes = await query('SELECT * FROM notifications WHERE id = $1', [testNotifId]);
    console.log('[Test 6.2: PostgreSQL Notification Verification]', notifDbRes.rows.length, notifDbRes.rows[0]?.title);
    if (notifDbRes.rows.length === 0 || notifDbRes.rows[0].is_read !== false) {
      throw new Error('Notification not verified in PostgreSQL');
    }

    // Mark as read via REST
    const readRes = await fetch(`${BASE_URL}/notifications/${testNotifId}/read`, { method: 'PATCH' });
    const readData = await readRes.json();
    console.log('[Test 6.3: Notification Mark Read]', readRes.status, readData.data?.is_read);
    if (readData.data?.is_read !== true) {
      throw new Error('Notification mark read failed');
    }

    // -------------------------------------------------------------------------
    // TEST 7: Idempotency & Duplicate Replay Protection
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Phase 5 Idempotency & Duplicate Prevention ---');
    const duplicateAgroRes = await adapter.syncAction(agroAction);
    console.log('[Test 7.1: Replaying AgroConnect Action with Same Idempotency Key]', duplicateAgroRes.serverData?.replayed);
    if (!duplicateAgroRes.serverData?.replayed) {
      throw new Error('Idempotency replay was not detected for AgroConnect post');
    }

    const agroCountRes = await query('SELECT COUNT(*) FROM agroconnect_posts WHERE id = $1', [testAgroPostId]);
    console.log('[Test 7.2: Verified No Duplicate Row in agroconnect_posts]', agroCountRes.rows[0].count);
    if (parseInt(agroCountRes.rows[0].count, 10) !== 1) {
      throw new Error('Duplicate row was created in database!');
    }

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Cleanup Test Fixtures ---');
    await query('DELETE FROM notifications WHERE id = $1', [testNotifId]);
    await query('DELETE FROM agroconnect_posts WHERE id = $1', [testAgroPostId]);
    await query('DELETE FROM claim_dossiers WHERE id = $1', [testClaimId]);
    await query('DELETE FROM carbon_offers WHERE id = $1', [testOfferId]);
    await query('DELETE FROM carbon_activities WHERE id = $1', [testActivityId]);
    await query('DELETE FROM silage_bookings WHERE id = $1', [testBookingId]);
    await query('DELETE FROM silage_centers WHERE id = $1', [testCenterId]);
    await query('DELETE FROM sync_events WHERE user_id IN ($1, $2)', [testFarmerId, testBuyerId]);
    await query('DELETE FROM users WHERE user_id IN ($1, $2)', [testFarmerId, testBuyerId]);
    console.log('[Test 8.1: Phase 5 Test Records Cleaned Up from Live DB]');

    console.log('\n===========================================================');
    console.log('>>> ALL PHASE 5 DOMAIN MODULE INTEGRATION TESTS PASSED! <<<');
    console.log('===========================================================\n');
  } catch (err) {
    console.error('\n[PHASE 5 TEST ERROR]:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    await closePool();
  }
}

runPhase5Tests();
