/**
 * AgroCycle Regression Test Suite: Farmer-Led Pricing & Buyer Price Transparency
 *
 * Verifies:
 * 1. Farmer creates listing: Tomato | 500 kg | ₹28/kg in PostgreSQL.
 * 2. Buyer queries and discovers listing:
 *    - Buyer sees exact Farmer Asking Price: ₹28/kg.
 *    - Matching engine maps asking_price = 28 into candidate lot.
 * 3. Buyer customizes allocation to 300 kg:
 *    - Price remains strictly ₹28/kg.
 *    - Subtotal = 300 * 28 = ₹8,400.
 * 4. Create procurement order with 300 kg allocation:
 *    - Procurement order stores exact farmer asking price: ₹28/kg.
 *    - Crop Value = 300 * ₹28 = ₹8,400.
 * 5. Complete simulated payment:
 *    - Crop Value = ₹8,400
 *    - Rejection Risk = ₹400
 *    - Platform Fee Base = ₹8,400 - ₹400 = ₹8,000
 *    - Platform Fee (3%) = ₹8,000 * 0.03 = ₹240
 *    - Net Procurement Value = ₹8,400 - ₹400 - ₹240 = ₹7,760
 * 6. Security Enforcement:
 *    - Malicious buyer attempts to submit discounted/tampered price (e.g. ₹15/kg).
 *    - Backend strictly enforces the database listing's asking_price (₹28/kg) and ignores tampered client price.
 * 7. Clean up all test data in finally block.
 */

import { query } from './backend/src/db/pool.js';
import {
  mapMarketplaceListingToSupplierLot,
  findSmartSupplyCombinations,
  calculateProcurementFinancials,
  MATCH_TYPES
} from './src/services/smartMatchService.js';

const API_BASE = 'http://localhost:5000/api/v1';

async function runFarmerLedPricingTests() {
  console.log('==================================================================');
  console.log('  AGROCYCLE: FARMER-LED PRICING & BUYER PRICE TRANSPARENCY AUDIT  ');
  console.log('==================================================================\n');

  const timestamp = Date.now();
  const testFarmerId = `usr_farmer_price_${timestamp}`;
  const testBuyerId = `usr_buyer_price_${timestamp}`;
  const testListingId = `lst_farmer_price_${timestamp}`;
  const testOrderId = `PO-PRICE-${timestamp}`;
  const tamperedOrderId = `PO-TAMPER-${timestamp}`;

  try {
    // ---------------------------------------------------------
    // Step 1: Farmer Sets the Asking Price (₹28/kg) in PostgreSQL
    // ---------------------------------------------------------
    console.log('[Step 1] Farmer sets asking price: Tomato | 500 kg | ₹28/kg...');
    await query(
      `INSERT INTO users (user_id, display_name, phone, active_role, roles) 
       VALUES ($1, 'Vetrivel Farmer', '9876543001', 'farmer', '{"farmer"}')
       ON CONFLICT (user_id) DO NOTHING`,
      [testFarmerId]
    );

    await query(
      `INSERT INTO marketplace_listings (
        id, creator_id, creator_role, farmer_name, crop_type,
        quantity_kg, condition, asking_price, location, latitude, longitude, status, created_at, updated_at
      ) VALUES ($1, $2, 'farmer', 'Vetrivel Farmer', 'Tomato', 500, 'fresh', 28, 'Alanganallur, Madurai', 10.0452, 78.0841, 'listed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [testListingId, testFarmerId]
    );
    console.log('  ✓ Farmer listing created in PostgreSQL: Tomato, 500 kg @ ₹28/kg');

    // ---------------------------------------------------------
    // Step 2: Buyer Discovers Supply & Sees Transparent Asking Price
    // ---------------------------------------------------------
    console.log('\n[Step 2] Buyer queries market intelligence & verifies price transparency...');
    const listRes = await fetch(`${API_BASE}/marketplace/listings?status=listed`);
    const listJson = await listRes.json();
    const foundListing = (listJson.data || []).find(l => String(l.id) === testListingId);

    if (!foundListing) {
      throw new Error(`Test listing ${testListingId} not found in GET /marketplace/listings`);
    }

    const mappedSupplier = mapMarketplaceListingToSupplierLot(foundListing);
    console.log(`  ✓ Buyer sees supplier: "${mappedSupplier.farmerName}"`);
    console.log(`  ✓ Farmer Asking Price: ₹${mappedSupplier.pricePerKg}/kg (from database: ₹${foundListing.asking_price})`);

    if (mappedSupplier.pricePerKg !== 28) {
      throw new Error(`Price mismatch: expected ₹28/kg, got ₹${mappedSupplier.pricePerKg}/kg`);
    }

    // Run matching engine
    const matchResult = findSmartSupplyCombinations({
      demand: {
        crop: 'Tomato',
        quantityKg: 300,
        qualityGrade: 'Grade A',
        maxPricePerKg: 35,
        destinationLocation: { city: 'Madurai', latitude: 9.9252, longitude: 78.1198 }
      },
      matchType: MATCH_TYPES.MARKET,
      supplyListings: [mappedSupplier]
    });

    if (matchResult.combinations.length === 0) {
      throw new Error('Smart matching did not generate combination from candidate supplier');
    }

    const topCombo = matchResult.combinations[0];
    const topAlloc = topCombo.allocations[0];
    console.log(`  ✓ Smart Matching allocates 300 kg at Farmer Asking Price: ₹${topAlloc.pricePerKg}/kg`);
    console.log(`  ✓ Farmer subtotal = 300 kg × ₹${topAlloc.pricePerKg} = ₹${topAlloc.farmerSubtotal}`);

    if (topAlloc.pricePerKg !== 28) throw new Error(`Allocation price mismatch: expected 28, got ${topAlloc.pricePerKg}`);
    if (topAlloc.farmerSubtotal !== 8400) throw new Error(`Subtotal mismatch: expected 8400, got ${topAlloc.farmerSubtotal}`);

    // ---------------------------------------------------------
    // Step 3: Create Procurement Order (300 kg @ ₹28/kg)
    // ---------------------------------------------------------
    console.log('\n[Step 3] Creating confirmed procurement order for 300 kg...');
    const orderPayload = {
      order_id: testOrderId,
      buyer_id: testBuyerId,
      buyer_name: 'Metro Hypermarket Madurai',
      crop: 'Tomato',
      category: 'Vegetable',
      requested_quantity_kg: 300,
      quality_grade: 'Grade A',
      required_date: '2026-10-15',
      delivery_location: 'Madurai Central Hub',
      farmer_allocations: [
        {
          listingId: testListingId,
          farmerId: testFarmerId,
          farmerName: 'Vetrivel Farmer',
          crop: 'Tomato',
          allocatedQuantityKg: 300,
          pricePerKg: 28, // Farmer's asking price
          farmerSubtotal: 8400
        }
      ]
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

    const createdOrder = createOrderJson.data;
    const storedAllocation = createdOrder.farmer_allocations[0];
    const storedSummary = createdOrder.procurement_summary;

    console.log(`  ✓ Order created: ${createdOrder.order_id || createdOrder.id}`);
    console.log(`  ✓ Stored Farmer Asking Price: ₹${storedAllocation.pricePerKg}/kg`);
    console.log(`  ✓ Stored Farmer Subtotal: ₹${storedAllocation.farmerSubtotal}`);
    console.log(`  ✓ Stored Total Produce Cost: ₹${storedSummary.totalProduceCost}`);

    if (storedAllocation.pricePerKg !== 28) throw new Error(`Stored price mismatch: expected 28, got ${storedAllocation.pricePerKg}`);
    if (storedAllocation.farmerSubtotal !== 8400) throw new Error(`Stored subtotal mismatch: expected 8400, got ${storedAllocation.farmerSubtotal}`);
    if (storedSummary.totalProduceCost !== 8400) throw new Error(`Stored total produce cost mismatch: expected 8400, got ${storedSummary.totalProduceCost}`);

    // Verify inventory deduction from 500 kg -> 200 kg
    const listingDbCheck = await query('SELECT quantity_kg, status FROM marketplace_listings WHERE id = $1', [testListingId]);
    const remQty = Number(listingDbCheck.rows[0].quantity_kg);
    console.log(`  ✓ Farmer listing inventory remaining in PostgreSQL: ${remQty} kg (500 - 300 = 200 kg)`);
    if (remQty !== 200) throw new Error(`Inventory deduction mismatch: expected 200, got ${remQty}`);

    // ---------------------------------------------------------
    // Step 3.5: Arrange Transport BEFORE Payment
    // ---------------------------------------------------------
    console.log('\n[Step 3.5] Arranging transport before payment...');
    const transportRes = await fetch(`${API_BASE}/procurement/orders/${testOrderId}/logistics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': testBuyerId },
      body: JSON.stringify({
        transporterName: 'Cauvery Fast Logistics',
        driverName: 'R. Veerappan',
        driverPhone: '9876543210',
        vehicleNumber: 'TN-59-AC-4589',
        pickupDate: '2026-10-12',
        pickupTime: '08:30 AM',
        destination: 'Madurai Central Processing Facility',
        transportCost: 1200
      })
    });
    const transportJson = await transportRes.json();
    if (!transportRes.ok || transportJson.status !== 'success') {
      throw new Error(`Transport arrangement failed: ${JSON.stringify(transportJson)}`);
    }
    console.log('  ✓ Transport arranged: TN-59-AC-4589, Cost: ₹1,200');

    // ---------------------------------------------------------
    // Step 4: Simulate Payment & Validate Financial Formulas
    // ---------------------------------------------------------
    console.log('\n[Step 4] Executing simulated payment & verifying financial formula...');
    const paymentRes = await fetch(`${API_BASE}/procurement/orders/${testOrderId}/simulate-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': testBuyerId },
      body: JSON.stringify({
        payment_method: 'UPI',
        rejection_risk: 400
      })
    });

    const paymentJson = await paymentRes.json();
    if (!paymentRes.ok || paymentJson.status !== 'success') {
      throw new Error(`Payment simulation failed: ${JSON.stringify(paymentJson)}`);
    }

    const paySummary = paymentJson.data.procurement_summary;
    console.log('  ✓ Payment Financial Breakdown:');
    console.log(`    - Crop Value (300 kg × ₹28/kg): ₹${paySummary.cropValue}`);
    console.log(`    - Rejection Risk: -₹${paySummary.rejectionRisk}`);
    console.log(`    - Platform Fee Base: ₹${paySummary.platformFeeBase}`);
    console.log(`    - AgroCycle Platform Fee (3%): -₹${paySummary.platformFee}`);
    console.log(`    - Net Procurement Value: ₹${paySummary.netProcurementValue}`);
    console.log(`    - Amount Paid: ₹${paySummary.amountPaid}`);

    // Crop Value = 300 * 28 = 8400
    // Platform Fee Base = 8400 - 400 = 8000
    // Platform Fee = 8000 * 0.03 = 240
    // Net Procurement Value = 8400 - 400 - 240 = 7760
    if (paySummary.cropValue !== 8400) throw new Error(`Crop value mismatch: expected 8400, got ${paySummary.cropValue}`);
    if (paySummary.rejectionRisk !== 400) throw new Error(`Rejection risk mismatch: expected 400, got ${paySummary.rejectionRisk}`);
    if (paySummary.platformFeeBase !== 8000) throw new Error(`Platform fee base mismatch: expected 8000, got ${paySummary.platformFeeBase}`);
    if (paySummary.platformFee !== 240) throw new Error(`Platform fee mismatch: expected 240, got ${paySummary.platformFee}`);
    if (paySummary.netProcurementValue !== 7760) throw new Error(`Net value mismatch: expected 7760, got ${paySummary.netProcurementValue}`);
    if (paySummary.amountPaid !== 7760) throw new Error(`Amount paid mismatch: expected 7760, got ${paySummary.amountPaid}`);

    // ---------------------------------------------------------
    // Step 5: Backend Price Tampering Prevention Test
    // ---------------------------------------------------------
    console.log('\n[Step 5] Testing backend protection against buyer price tampering...');
    console.log('  Simulating buyer sending payload with tampered pricePerKg = 15 (instead of farmer asking price ₹28/kg)...');

    const tamperedPayload = {
      order_id: tamperedOrderId,
      buyer_id: testBuyerId,
      buyer_name: 'Malicious Buyer Attempt',
      crop: 'Tomato',
      requested_quantity_kg: 100,
      farmer_allocations: [
        {
          listingId: testListingId, // Real listing with asking_price = 28
          farmerId: testFarmerId,
          farmerName: 'Vetrivel Farmer',
          allocatedQuantityKg: 100,
          pricePerKg: 15, // TAMPERED ATTEMPT
          farmerSubtotal: 1500 // TAMPERED ATTEMPT
        }
      ]
    };

    const tamperOrderRes = await fetch(`${API_BASE}/procurement/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': testBuyerId },
      body: JSON.stringify(tamperedPayload)
    });

    const tamperOrderJson = await tamperOrderRes.json();
    if (!tamperOrderRes.ok || tamperOrderJson.status !== 'success') {
      throw new Error(`Tamper test order creation failed: ${JSON.stringify(tamperOrderJson)}`);
    }

    const securedOrder = tamperOrderJson.data;
    const securedAlloc = securedOrder.farmer_allocations[0];
    const securedSummary = securedOrder.procurement_summary;

    console.log(`  ✓ Backend rejected client tampered rate ₹15/kg and enforced verified database rate: ₹${securedAlloc.pricePerKg}/kg`);
    console.log(`  ✓ Enforced Subtotal: ₹${securedAlloc.farmerSubtotal} (100 kg × ₹28 = ₹2,800, NOT ₹1,500)`);
    console.log(`  ✓ Enforced Total Produce Cost: ₹${securedSummary.totalProduceCost}`);

    if (securedAlloc.pricePerKg !== 28) {
      throw new Error(`SECURITY VULNERABILITY: Backend accepted tampered price ${securedAlloc.pricePerKg}`);
    }
    if (securedAlloc.farmerSubtotal !== 2800) {
      throw new Error(`SECURITY VULNERABILITY: Backend computed subtotal with tampered rate: ${securedAlloc.farmerSubtotal}`);
    }
    if (securedSummary.totalProduceCost !== 2800) {
      throw new Error(`SECURITY VULNERABILITY: Backend total produce cost tampered: ${securedSummary.totalProduceCost}`);
    }

    console.log('\n==================================================================');
    console.log('  ALL FARMER-LED PRICING REGRESSION TESTS PASSED (100%)            ');
    console.log('==================================================================');
  } catch (err) {
    console.error('\n❌ FARMER-LED PRICING TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    // Clean up test data
    console.log('\n[Cleanup] Cleaning up test data from PostgreSQL...');
    try {
      await query('DELETE FROM procurement_orders WHERE id IN ($1, $2) OR order_id IN ($1, $2)', [testOrderId, tamperedOrderId]);
      await query('DELETE FROM marketplace_listings WHERE id = $1', [testListingId]);
      await query('DELETE FROM users WHERE user_id IN ($1, $2)', [testFarmerId, testBuyerId]);
      console.log('✓ Test data cleaned up successfully.');
    } catch (cleanErr) {
      console.warn('Warning during cleanup:', cleanErr.message);
    }
  }
}

runFarmerLedPricingTests();
