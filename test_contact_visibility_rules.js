/**
 * AgroCycle Contact-Information Visibility & Privacy Rules Regression Test Suite
 *
 * Verifies:
 * 1. Unconfirmed marketplace listing → phone numbers hidden (public browsing).
 * 2. Buyer browsing farmer supply → farmer phone hidden.
 * 3. Farmer browsing marketplace → buyer phone hidden.
 * 4. Confirmed procurement → farmer can see buyer phone.
 * 5. Confirmed procurement → buyer can see farmer phone.
 * 6. Transport arranged → farmer and buyer can see relevant transporter/driver contacts.
 * 7. Unrelated users cannot access these phone numbers.
 * 8. Existing procurement/payment/transport flow integrity maintained.
 */

import { query } from './backend/src/db/pool.js';

const API_BASE = 'http://localhost:5000/api/v1';

async function runContactVisibilityTests() {
  console.log('==================================================================');
  console.log('  AGROCYCLE: CONTACT-INFORMATION VISIBILITY & PRIVACY AUDIT       ');
  console.log('==================================================================');

  const timestamp = Date.now();
  const testListingId = `lst_contact_${timestamp}`;
  const testFarmerId = `usr_farmer_contact_${timestamp}`;
  const testBuyerId = `usr_buyer_contact_${timestamp}`;
  const testUnrelatedId = `usr_unrelated_${timestamp}`;
  const testOrderId = `PO-CONTACT-${timestamp}`;

  const FARMER_PHONE = '9876543210';
  const BUYER_PHONE = '9845012345';
  const TRANSPORTER_PHONE = '0452-2589000';
  const DRIVER_PHONE = '9842100099';

  try {
    // -------------------------------------------------------------
    // Step 0: Setup Farmer, Produce Listing, Buyer in PostgreSQL
    // -------------------------------------------------------------
    console.log('\n[Setup] Seeding test users and marketplace listing in PostgreSQL...');
    await query(
      `INSERT INTO users (user_id, display_name, phone, active_role, roles) 
       VALUES ($1, 'Selvam (Test Farmer)', $2, 'farmer', '{"farmer"}')
       ON CONFLICT (user_id) DO UPDATE SET phone = $2`,
      [testFarmerId, FARMER_PHONE]
    );

    await query(
      `INSERT INTO users (user_id, display_name, phone, active_role, roles) 
       VALUES ($1, 'Madurai Fresh Supermarkets Ltd', $2, 'buyer', '{"buyer"}')
       ON CONFLICT (user_id) DO UPDATE SET phone = $2`,
      [testBuyerId, BUYER_PHONE]
    );

    await query(
      `INSERT INTO users (user_id, display_name, phone, active_role, roles) 
       VALUES ($1, 'Unrelated Third Party', '9000000000', 'general', '{"general"}')
       ON CONFLICT (user_id) DO NOTHING`,
      [testUnrelatedId]
    );

    await query(
      `INSERT INTO marketplace_listings (
        id, creator_id, creator_role, farmer_name, crop_type,
        quantity_kg, condition, asking_price, location, latitude, longitude,
        contact_phone, status, created_at, updated_at
      ) VALUES ($1, $2, 'farmer', 'Selvam (Test Farmer)', 'Tomato', 500, 'fresh', 28, 'Vadipatti, Madurai', 10.0768, 77.9622, $3, 'listed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [testListingId, testFarmerId, FARMER_PHONE]
    );
    console.log('✓ Farmer produce lot created in PostgreSQL with contact_phone.');

    // -------------------------------------------------------------
    // Test 1: Unconfirmed Marketplace Listing -> Phone Numbers Hidden
    // -------------------------------------------------------------
    console.log('\n[Test 1] Public / Unauthenticated browsing of marketplace listings...');
    const publicListingsRes = await fetch(`${API_BASE}/marketplace/listings?id=${testListingId}`);
    const publicListingsJson = await publicListingsRes.json();
    const publicListing = (publicListingsJson.data || []).find(l => l.id === testListingId);

    if (publicListing && publicListing.contact_phone === null && publicListing.phone === null) {
      console.log('✓ Public listing discovery returns contact_phone: null (phone hidden).');
    } else {
      throw new Error(`Phone number leaked in public marketplace discovery: ${JSON.stringify(publicListing)}`);
    }

    // -------------------------------------------------------------
    // Test 2: Buyer browsing farmer supply -> Farmer phone hidden
    // -------------------------------------------------------------
    console.log('\n[Test 2] Buyer browsing farmer supply in Market Intelligence...');
    const buyerBrowseRes = await fetch(`${API_BASE}/marketplace/listings/${testListingId}`, {
      headers: { 'x-user-id': testBuyerId }
    });
    const buyerBrowseJson = await buyerBrowseRes.json();
    if (buyerBrowseJson.data?.contact_phone === null && buyerBrowseJson.data?.phone === null) {
      console.log('✓ Buyer cannot see farmer personal phone number before procurement confirmation.');
    } else {
      throw new Error(`Farmer phone leaked to browsing buyer: ${JSON.stringify(buyerBrowseJson.data)}`);
    }

    // -------------------------------------------------------------
    // Test 3: Farmer browsing marketplace -> Contact numbers hidden
    // -------------------------------------------------------------
    console.log('\n[Test 3] Farmer browsing marketplace listings...');
    const farmerBrowseOtherRes = await fetch(`${API_BASE}/marketplace/listings/${testListingId}`, {
      headers: { 'x-user-id': testUnrelatedId }
    });
    const farmerBrowseOtherJson = await farmerBrowseOtherRes.json();
    if (farmerBrowseOtherJson.data?.contact_phone === null) {
      console.log('✓ Browsing user cannot see other participants contact numbers.');
    } else {
      throw new Error(`Phone leaked in browsing: ${JSON.stringify(farmerBrowseOtherJson.data)}`);
    }

    // -------------------------------------------------------------
    // Test 4 & 5: Confirmed Procurement Order Created
    // -------------------------------------------------------------
    console.log('\n[Test 4 & 5] Buyer confirms procurement order (Tomato 300 kg @ ₹28/kg)...');
    const orderPayload = {
      order_id: testOrderId,
      buyer_id: testBuyerId,
      buyer_name: 'Madurai Fresh Supermarkets Ltd',
      buyer_phone: BUYER_PHONE,
      crop: 'Tomato',
      category: 'Vegetable',
      requested_quantity_kg: 300,
      quality_grade: 'Grade A',
      required_date: '2026-10-15',
      delivery_location: 'Madurai Central Processing Hub',
      farmer_allocations: [
        {
          listingId: testListingId,
          farmerId: testFarmerId,
          farmerName: 'Selvam (Test Farmer)',
          crop: 'Tomato',
          allocatedQuantityKg: 300,
          pricePerKg: 28,
          farmerSubtotal: 8400,
          location: { city: 'Vadipatti' }
        }
      ],
      procurement_summary: {
        totalProduceCost: 8400,
        requestedQuantityKg: 300,
        sourcedQuantityKg: 300,
        remainingQuantityKg: 0
      }
    };

    const createOrderRes = await fetch(`${API_BASE}/procurement/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': testBuyerId },
      body: JSON.stringify(orderPayload)
    });
    const createOrderJson = await createOrderRes.json();
    if (!createOrderRes.ok || createOrderJson.status !== 'success') {
      throw new Error(`Failed to create order: ${JSON.stringify(createOrderJson)}`);
    }
    console.log(`✓ Procurement order confirmed: ${testOrderId}`);

    // Verify Buyer sees Farmer Phone on confirmed allocation
    const buyerOrderRes = await fetch(`${API_BASE}/procurement/orders/${testOrderId}`, {
      headers: { 'x-user-id': testBuyerId }
    });
    const buyerOrderJson = await buyerOrderRes.json();
    const buyerSeenAlloc = (buyerOrderJson.data?.farmer_allocations || [])[0];
    if (buyerSeenAlloc?.farmerPhone === FARMER_PHONE || buyerSeenAlloc?.phone === FARMER_PHONE) {
      console.log(`✓ Buyer can see confirmed farmer phone: ${buyerSeenAlloc.farmerPhone}`);
    } else {
      throw new Error(`Buyer cannot see farmer phone after confirmation: ${JSON.stringify(buyerSeenAlloc)}`);
    }

    // Verify Farmer sees Buyer Phone on confirmed order
    const farmerOrderRes = await fetch(`${API_BASE}/procurement/orders/${testOrderId}`, {
      headers: { 'x-user-id': testFarmerId }
    });
    const farmerOrderJson = await farmerOrderRes.json();
    if (farmerOrderJson.data?.buyer_phone === BUYER_PHONE) {
      console.log(`✓ Farmer can see confirmed buyer phone: ${farmerOrderJson.data.buyer_phone}`);
    } else {
      throw new Error(`Farmer cannot see buyer phone after confirmation: ${JSON.stringify(farmerOrderJson.data)}`);
    }

    // -------------------------------------------------------------
    // Test 6: Transport Arranged -> Farmer & Buyer see Transporter and Driver Contacts
    // -------------------------------------------------------------
    console.log('\n[Test 6] Buyer arranges transport with Transporter and Driver phones...');
    const transportDetails = {
      transporterName: 'Cauvery Fast Logistics Pvt Ltd',
      transporterPhone: TRANSPORTER_PHONE,
      driverName: 'R. Veerappan',
      driverPhone: DRIVER_PHONE,
      vehicleNumber: 'TN-59-AC-4589',
      pickupDate: '2026-10-12',
      pickupTime: '08:30 AM',
      destination: 'Madurai Central Processing Hub',
      transportCost: 1200
    };

    const transportRes = await fetch(`${API_BASE}/procurement/orders/${testOrderId}/logistics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': testBuyerId },
      body: JSON.stringify(transportDetails)
    });
    const transportJson = await transportRes.json();
    if (!transportRes.ok || transportJson.status !== 'success') {
      throw new Error(`Transport arrangement failed: ${JSON.stringify(transportJson)}`);
    }
    console.log('✓ Transport arranged successfully.');

    // Farmer views transport contacts
    const fCheckRes = await fetch(`${API_BASE}/procurement/orders/${testOrderId}`, {
      headers: { 'x-user-id': testFarmerId }
    });
    const fCheckJson = await fCheckRes.json();
    const fLogistics = fCheckJson.data?.logistics || fCheckJson.data?.procurement_summary?.logistics;

    if (
      fLogistics?.transporterPhone === TRANSPORTER_PHONE &&
      fLogistics?.driverPhone === DRIVER_PHONE &&
      fLogistics?.transporterName === 'Cauvery Fast Logistics Pvt Ltd' &&
      fLogistics?.driverName === 'R. Veerappan'
    ) {
      console.log('✓ Farmer sees Transporter Phone (' + TRANSPORTER_PHONE + ') and Driver Phone (' + DRIVER_PHONE + ') for direct coordination.');
    } else {
      throw new Error(`Farmer cannot see transporter/driver contacts: ${JSON.stringify(fLogistics)}`);
    }

    // Buyer views transport contacts
    const bCheckRes = await fetch(`${API_BASE}/procurement/orders/${testOrderId}`, {
      headers: { 'x-user-id': testBuyerId }
    });
    const bCheckJson = await bCheckRes.json();
    const bLogistics = bCheckJson.data?.logistics || bCheckJson.data?.procurement_summary?.logistics;

    if (bLogistics?.transporterPhone === TRANSPORTER_PHONE && bLogistics?.driverPhone === DRIVER_PHONE) {
      console.log('✓ Buyer sees Transporter Phone (' + TRANSPORTER_PHONE + ') and Driver Phone (' + DRIVER_PHONE + ') for direct coordination.');
    } else {
      throw new Error(`Buyer cannot see transporter/driver contacts: ${JSON.stringify(bLogistics)}`);
    }

    // -------------------------------------------------------------
    // Test 7: Unrelated Users CANNOT Access These Phone Numbers
    // -------------------------------------------------------------
    console.log('\n[Test 7] Verifying unrelated third parties are blocked from accessing phone numbers...');
    const unrelatedOrderRes = await fetch(`${API_BASE}/procurement/orders/${testOrderId}`, {
      headers: { 'x-user-id': testUnrelatedId }
    });
    const unrelatedOrderJson = await unrelatedOrderRes.json();
    const uOrder = unrelatedOrderJson.data;
    const uAlloc = (uOrder?.farmer_allocations || [])[0];
    const uLogistics = uOrder?.logistics || uOrder?.procurement_summary?.logistics;

    if (
      (uOrder.buyer_phone === null || uOrder.buyer_phone === undefined) &&
      (uAlloc?.farmerPhone === null || uAlloc?.farmerPhone === undefined) &&
      (uLogistics?.driverPhone === null || uLogistics?.driverPhone === undefined) &&
      (uLogistics?.transporterPhone === null || uLogistics?.transporterPhone === undefined)
    ) {
      console.log('✓ Unrelated third party query strictly returns null for all personal contact phone numbers.');
    } else {
      throw new Error(`Privacy breach! Unrelated user accessed phone numbers: ${JSON.stringify(uOrder)}`);
    }

    // -------------------------------------------------------------
    // Test 8: Complete Payment & Verify Financial Isolation
    // -------------------------------------------------------------
    console.log('\n[Test 8] Executing payment simulation & verifying financial formula...');
    const payRes = await fetch(`${API_BASE}/procurement/orders/${testOrderId}/simulate-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': testBuyerId },
      body: JSON.stringify({ payment_method: 'UPI', rejection_risk: 400 })
    });
    const payJson = await payRes.json();
    if (!payRes.ok || payJson.status !== 'success') {
      throw new Error(`Payment failed: ${JSON.stringify(payJson)}`);
    }

    const paySummary = payJson.data?.procurement_summary;
    if (
      Number(paySummary?.cropValue) === 8400 &&
      Number(paySummary?.platformFee) === 240 &&
      Number(paySummary?.netProcurementValue) === 7760 &&
      Number(paySummary?.transportCost) === 1200
    ) {
      console.log('✓ Financial calculations & transport flow 100% verified.');
    } else {
      throw new Error(`Financial breakdown mismatch: ${JSON.stringify(paySummary)}`);
    }

    console.log('\n==================================================================');
    console.log('  ALL 8 CONTACT VISIBILITY REGRESSION TESTS PASSED (100%)         ');
    console.log('==================================================================\n');
  } catch (err) {
    console.error('\n❌ Contact Visibility Test Failed:', err);
    process.exit(1);
  } finally {
    console.log('[Cleanup] Cleaning up test records from PostgreSQL...');
    try {
      await query('DELETE FROM procurement_orders WHERE id = $1 OR order_id = $1', [testOrderId]);
      await query('DELETE FROM marketplace_listings WHERE id = $1', [testListingId]);
      await query('DELETE FROM users WHERE user_id IN ($1, $2, $3)', [testFarmerId, testBuyerId, testUnrelatedId]);
      console.log('✓ Test data cleaned up.');
    } catch (cleanErr) {
      console.warn('Cleanup warning:', cleanErr);
    }
  }
}

runContactVisibilityTests();
