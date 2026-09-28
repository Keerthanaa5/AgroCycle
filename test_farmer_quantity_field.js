/**
 * Regression Test: Farmer Produce Exact Quantity Field Flow
 *
 * Verifies end-to-end exact quantity preservation:
 * Farmer Quantity Input -> createListing payload -> POST /api/v1/marketplace/listings
 * -> PostgreSQL quantity_kg -> GET /api/v1/marketplace/listings
 * -> normalizeListing() -> mapMarketplaceListingToSupplierLot()
 * -> Smart Matching candidate pool -> Procurement Allocation.
 *
 * Tests exact values: 250 kg, 21 kg, 100 kg, 500 kg, 1000 kg.
 * Cleans up all created test listings in a finally block.
 */

import { query } from './backend/src/db/pool.js';
import { normalizeListing } from './src/services/marketplaceService.js';
import { 
  mapMarketplaceListingToSupplierLot, 
  findSmartSupplyCombinations, 
  MATCH_TYPES 
} from './src/services/smartMatchService.js';

const API_BASE = 'http://localhost:5000/api/v1';

async function runRegressionTest() {
  console.log('====================================================');
  console.log('🧪 RUNNING REGRESSION TEST: FARMER EXACT QUANTITY FLOW');
  console.log('====================================================\n');

  const createdListingIds = [];
  const testFarmerId = `usr_test_farmer_qty_${Date.now()}`;
  const testFarmerName = 'Farmer Ramesh Quantities';
  const testPhone = '9876543999';

  try {
    // 1. Ensure test user exists
    await query(
      `INSERT INTO users (user_id, display_name, phone) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (user_id) DO NOTHING`,
      [testFarmerId, testFarmerName, testPhone]
    );

    // Test Quantities array: [250, 21, 100, 500, 1000]
    const testQuantities = [250, 21, 100, 500, 1000];

    for (const exactQty of testQuantities) {
      console.log(`\n----------------------------------------------------`);
      console.log(`🔍 TESTING EXACT QUANTITY: ${exactQty} kg`);
      console.log(`----------------------------------------------------`);

      const listingId = `wp_test_qty_${exactQty}_${Date.now()}`;
      createdListingIds.push(listingId);

      // STEP 1: Simulate Farmer UI submitting listing
      const payload = {
        id: listingId,
        creator_id: testFarmerId,
        creator_role: 'farmer',
        farmer_name: testFarmerName,
        contact_phone: testPhone,
        crop_type: 'Tomato',
        quantity_kg: exactQty,
        condition: 'fresh',
        asking_price: 28,
        location: 'Melur Road, Madurai',
        latitude: 10.0289,
        longitude: 78.3340,
        status: 'listed',
        title: 'Tomato Fresh Produce'
      };

      console.log(`1. Verifying POST request payload contains exact quantity: ${payload.quantity_kg}`);
      if (payload.quantity_kg !== exactQty) {
        throw new Error(`Payload quantity mismatch: expected ${exactQty}, got ${payload.quantity_kg}`);
      }

      // STEP 2: POST /api/v1/marketplace/listings
      const postRes = await fetch(`${API_BASE}/marketplace/listings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': testFarmerId
        },
        body: JSON.stringify(payload)
      });

      if (!postRes.ok) {
        const errorText = await postRes.text();
        throw new Error(`POST /marketplace/listings failed (${postRes.status}): ${errorText}`);
      }

      const postData = await postRes.json();
      console.log(`2. POST response received. ID: ${postData.data?.id}, returned quantity_kg: ${postData.data?.quantity_kg}`);
      if (Number(postData.data?.quantity_kg) !== exactQty) {
        throw new Error(`POST response quantity mismatch: expected ${exactQty}, got ${postData.data?.quantity_kg}`);
      }

      // STEP 3: Verify PostgreSQL database directly
      const dbRes = await query('SELECT id, crop_type, quantity_kg, condition, asking_price FROM marketplace_listings WHERE id = $1', [listingId]);
      if (dbRes.rows.length === 0) {
        throw new Error(`Listing ${listingId} not found in PostgreSQL!`);
      }
      const dbRow = dbRes.rows[0];
      const dbQty = Number(dbRow.quantity_kg);
      console.log(`3. PostgreSQL verification: Row found. Stored quantity_kg = ${dbQty}`);
      if (dbQty !== exactQty) {
        throw new Error(`PostgreSQL quantity mismatch: expected ${exactQty}, got ${dbQty}`);
      }

      // STEP 4: GET /api/v1/marketplace/listings
      const getRes = await fetch(`${API_BASE}/marketplace/listings?creator_id=${testFarmerId}`);
      if (!getRes.ok) {
        throw new Error(`GET /marketplace/listings failed (${getRes.status})`);
      }
      const getData = await getRes.json();
      const foundInGet = (getData.data || []).find(item => item.id === listingId);
      if (!foundInGet) {
        throw new Error(`Listing ${listingId} not found in GET response`);
      }
      const getQty = Number(foundInGet.quantity_kg);
      console.log(`4. GET API verification: returned quantity_kg = ${getQty}`);
      if (getQty !== exactQty) {
        throw new Error(`GET API quantity mismatch: expected ${exactQty}, got ${getQty}`);
      }

      // STEP 5: normalizeListing() test
      const normalized = normalizeListing(foundInGet);
      console.log(`5. normalizeListing() output: quantity_kg = ${normalized.quantity_kg}`);
      if (normalized.quantity_kg !== exactQty) {
        throw new Error(`normalizeListing quantity mismatch: expected ${exactQty}, got ${normalized.quantity_kg}`);
      }

      // STEP 6: mapMarketplaceListingToSupplierLot() test
      const supplierLot = mapMarketplaceListingToSupplierLot(normalized);
      console.log(`6. mapMarketplaceListingToSupplierLot() output: availableQuantityKg = ${supplierLot.availableQuantityKg}`);
      if (supplierLot.availableQuantityKg !== exactQty) {
        throw new Error(`SupplierLot availableQuantityKg mismatch: expected ${exactQty}, got ${supplierLot.availableQuantityKg}`);
      }

      // STEP 7: Smart Matching & Combo Allocation test
      const matchResult = findSmartSupplyCombinations({
        demand: {
          crop: 'Tomato',
          quantityKg: exactQty,
          maxPricePerKg: 35,
          destinationLocation: { city: 'Madurai', latitude: 9.9252, longitude: 78.1198 }
        },
        matchType: MATCH_TYPES.MARKET,
        supplyListings: [supplierLot]
      });

      console.log(`7. Smart Matching candidate pool: ${matchResult.candidateSuppliers.length} supplier(s) found.`);
      const matchedCandidate = matchResult.candidateSuppliers.find(s => s.id === listingId);
      if (!matchedCandidate) {
        throw new Error(`Smart Matching candidate pool did not contain listing ${listingId}`);
      }
      console.log(`   Candidate availableQuantityKg = ${matchedCandidate.availableQuantityKg}`);
      if (matchedCandidate.availableQuantityKg !== exactQty) {
        throw new Error(`Candidate pool quantity mismatch: expected ${exactQty}, got ${matchedCandidate.availableQuantityKg}`);
      }

      const topCombo = matchResult.combinations[0];
      if (!topCombo) {
        throw new Error(`Smart Matching produced 0 combinations for demand of ${exactQty} kg`);
      }
      const farmerAlloc = topCombo.allocations.find(a => a.supplierId === listingId || a.listingId === listingId);
      if (!farmerAlloc) {
        throw new Error(`Top combo does not allocate to listing ${listingId}`);
      }

      console.log(`   Combo allocatedQuantityKg = ${farmerAlloc.allocatedQuantityKg}, total combo kg = ${topCombo.totalQuantityKg}`);
      if (farmerAlloc.allocatedQuantityKg !== exactQty) {
        throw new Error(`Allocation quantity altered: expected ${exactQty}, got ${farmerAlloc.allocatedQuantityKg}`);
      }
      if (topCombo.totalQuantityKg !== exactQty) {
        throw new Error(`Combo total quantity altered: expected ${exactQty}, got ${topCombo.totalQuantityKg}`);
      }

      console.log(`✅ [PASS] Quantity ${exactQty} kg preserved exactly across all 7 stages.`);
    }

    // Also test negative/zero validation rejection
    console.log(`\n----------------------------------------------------`);
    console.log(`🔍 TESTING VALIDATION: Rejecting 0 and negative quantities`);
    console.log(`----------------------------------------------------`);

    const zeroRes = await fetch(`${API_BASE}/marketplace/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': testFarmerId },
      body: JSON.stringify({
        id: `wp_test_invalid_zero_${Date.now()}`,
        creator_id: testFarmerId,
        crop_type: 'Tomato',
        quantity_kg: 0,
        condition: 'fresh',
        asking_price: 25
      })
    });
    console.log(`- 0 kg rejection status: ${zeroRes.status} (Expected: 400)`);
    if (zeroRes.status !== 400) {
      throw new Error(`Zero quantity was not rejected with status 400! Status: ${zeroRes.status}`);
    }

    const negRes = await fetch(`${API_BASE}/marketplace/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': testFarmerId },
      body: JSON.stringify({
        id: `wp_test_invalid_neg_${Date.now()}`,
        creator_id: testFarmerId,
        crop_type: 'Tomato',
        quantity_kg: -25,
        condition: 'fresh',
        asking_price: 25
      })
    });
    console.log(`- Negative (-25 kg) rejection status: ${negRes.status} (Expected: 400)`);
    if (negRes.status !== 400) {
      throw new Error(`Negative quantity was not rejected with status 400! Status: ${negRes.status}`);
    }
    console.log(`✅ [PASS] 0 and negative quantities properly rejected.`);

    console.log('\n====================================================');
    console.log('🎉 ALL FARMER QUANTITY REGRESSION TESTS PASSED (100%)');
    console.log('====================================================\n');

  } catch (err) {
    console.error('\n❌ REGRESSION TEST FAILED:', err.message);
    throw err;
  } finally {
    // Database Cleanup in finally block
    console.log('🧹 Cleaning up test listings and test farmer user from PostgreSQL...');
    try {
      if (createdListingIds.length > 0) {
        const delResult = await query(
          'DELETE FROM marketplace_listings WHERE id = ANY($1::varchar[])',
          [createdListingIds]
        );
        console.log(`   Deleted ${delResult.rowCount} test marketplace listing(s).`);
      }
      await query('DELETE FROM users WHERE user_id = $1', [testFarmerId]);
      console.log(`   Deleted test farmer user ${testFarmerId}.`);
      console.log('✅ PostgreSQL database is completely clean.\n');
    } catch (cleanErr) {
      console.error('⚠️ Cleanup error:', cleanErr.message);
    }
  }
}

runRegressionTest()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
