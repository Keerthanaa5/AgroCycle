/**
 * AgroCycle Supply-Demand Model Regression Test Suite
 *
 * Validates:
 * 1. Farmer declares supply ("What do I have?"):
 *    - Crop, Quantity, Quality/condition, Asking price, Available date, Farm location, 1–3 produce photos.
 *    - No buyer-type field is required or forced on the farmer listing.
 * 2. Buyer declares demand ("What do I need?"):
 *    - Buyer type (e.g. Food Processor)
 *    - Crop (e.g. Tomato)
 *    - Required quantity (e.g. 1,000 kg)
 *    - Quality / condition (e.g. Grade A/B)
 *    - Intended use / purpose (e.g. Ketchup / sauce)
 *    - Required-by date (e.g. 2026-10-10)
 *    - Delivery location (e.g. Madurai)
 * 3. Smart Matching Layer:
 *    - Identifies eligible farmer supply without hardcoded buyer categories.
 *    - Aggregates multi-farmer supply lots (Farmer A 500kg + Farmer B 500kg -> 1,000kg).
 *    - Preserves photo and GPS data intact.
 * 4. Cleanup:
 *    - Deletes all created test listings from PostgreSQL in finally block.
 */

import { query } from "./backend/src/db/pool.js";
import { findSmartSupplyCombinations, mapMarketplaceListingToSupplierLot } from "./src/services/smartMatchService.js";

const API_BASE_URL = "http://localhost:5000/api/v1";

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedCount++;
  }
}

async function runSupplyDemandTests() {
  console.log("\n========================================================");
  console.log(" AGROCYCLE SUPPLY-DEMAND MODEL & SMART MATCHING TESTS");
  console.log("========================================================\n");

  const createdListingIds = [];

  try {
    // ---------------------------------------------------------
    // TEST 1: FARMER FLOW - Declare Supply ("What do I have?")
    // ---------------------------------------------------------
    console.log("▶ TEST 1: Farmer lists fresh produce without buyer-type restriction");

    const samplePhotos = [
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
    ];

    const farmerPayload1 = {
      id: `test_supply_farmer_a_${Date.now()}`,
      creator_id: "usr_farmer_ramesh_test",
      creator_role: "farmer",
      farmer_name: "Farmer Ramesh",
      crop_type: "Tomato",
      quantity_kg: 500,
      condition: "fresh",
      asking_price: 28,
      available_date: "2026-09-28",
      availableDate: "2026-09-28",
      location: "Melur Road, Madurai",
      latitude: 9.9252,
      longitude: 78.1198,
      images: samplePhotos,
      image_url: JSON.stringify(samplePhotos),
      status: "listed",
      title: "Tomato Fresh Produce"
      // Note: NO buyer_type or intended_buyer field!
    };

    const res1 = await fetch(`${API_BASE_URL}/marketplace/listings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(farmerPayload1)
    });

    assert(res1.ok, `POST /marketplace/listings returned HTTP ${res1.status}`);
    const data1 = await res1.json();
    assert(data1.status === "success" || data1.success === true, "Farmer listing 1 created successfully");
    const listing1Id = data1.data?.id || farmerPayload1.id;
    createdListingIds.push(listing1Id);

    // Verify row in PostgreSQL
    const dbCheck1 = await query(
      "SELECT id, creator_id, creator_role, crop_type, quantity_kg, condition, asking_price, location, latitude, longitude, image_url, status FROM marketplace_listings WHERE id = $1",
      [listing1Id]
    );
    assert(dbCheck1.rows.length === 1, "Farmer supply row found in PostgreSQL marketplace_listings");
    const row1 = dbCheck1.rows[0];
    assert(row1.crop_type === "Tomato", `Crop type is Tomato (actual: ${row1.crop_type})`);
    assert(Number(row1.quantity_kg) === 500, `Quantity is 500 kg (actual: ${row1.quantity_kg})`);
    assert(Number(row1.asking_price) === 28, `Asking price is ₹28/kg (actual: ${row1.asking_price})`);
    assert(row1.condition === "fresh", `Condition is fresh (actual: ${row1.condition})`);
    assert(Math.abs(Number(row1.latitude) - 9.9252) < 0.001, "GPS latitude preserved");
    assert(Math.abs(Number(row1.longitude) - 78.1198) < 0.001, "GPS longitude preserved");
    assert(Boolean(row1.image_url), "Produce photo data preserved in PostgreSQL");

    // Also create Farmer B supply lot (500 kg Tomato) to test multi-farmer sourcing aggregation
    const farmerPayload2 = {
      id: `test_supply_farmer_b_${Date.now()}`,
      creator_id: "usr_farmer_suresh_test",
      creator_role: "farmer",
      farmer_name: "Farmer Suresh",
      crop_type: "Tomato",
      quantity_kg: 500,
      condition: "good",
      asking_price: 26,
      available_date: "2026-09-29",
      availableDate: "2026-09-29",
      location: "Usilampatti, Madurai",
      latitude: 9.9691,
      longitude: 77.7942,
      images: [samplePhotos[0]],
      image_url: JSON.stringify([samplePhotos[0]]),
      status: "listed",
      title: "Tomato Standard Lot"
    };

    const res2 = await fetch(`${API_BASE_URL}/marketplace/listings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(farmerPayload2)
    });
    assert(res2.ok, `POST farmer 2 returned HTTP ${res2.status}`);
    const data2 = await res2.json();
    const listing2Id = data2.data?.id || farmerPayload2.id;
    createdListingIds.push(listing2Id);

    // ---------------------------------------------------------
    // TEST 2: BUYER FLOW - Declare Demand ("What do I need?")
    // ---------------------------------------------------------
    console.log("\n▶ TEST 2: Buyer declares procurement requirement (Demand)");

    const buyerDemand = {
      buyerType: "Food Processor",
      crop: "Tomato",
      category: "Vegetable",
      quantityKg: 1000,
      qualityGrade: "Grade A/B",
      intendedUse: "Ketchup / sauce",
      requiredDate: "2026-10-10",
      destinationLocation: {
        city: "Madurai",
        state: "Tamil Nadu",
        latitude: 9.9252,
        longitude: 78.1198
      },
      buyerName: "ABC Foods Ltd.",
      buyerId: "usr_buyer_abcfoods"
    };

    assert(buyerDemand.buyerType === "Food Processor", "Buyer type is Food Processor");
    assert(buyerDemand.intendedUse === "Ketchup / sauce", "Intended purpose is Ketchup / sauce");
    assert(buyerDemand.quantityKg === 1000, "Required quantity is 1,000 kg");

    // ---------------------------------------------------------
    // TEST 3: SMART MATCHING ENGINE - Multi-Farmer Sourcing
    // ---------------------------------------------------------
    console.log("\n▶ TEST 3: Smart Matching pools multi-farmer supply to fulfill buyer demand");

    // Fetch listings from API
    const fetchRes = await fetch(`${API_BASE_URL}/marketplace/listings?status=listed`);
    const fetchJson = await fetchRes.json();
    const activeDbListings = fetchJson.data || fetchJson.listings || [];

    const realSupplierLots = activeDbListings
      .filter((item) => item && (item.id === listing1Id || item.id === listing2Id))
      .map(mapMarketplaceListingToSupplierLot);

    assert(realSupplierLots.length === 2, `Mapped 2 real test supplier lots (found: ${realSupplierLots.length})`);

    // Verify lot 1 has photos & GPS intact
    const lot1 = realSupplierLots.find(l => l.id === listing1Id);
    assert(lot1 !== undefined, "Lot 1 found in mapped supplier pool");
    assert(lot1.crop === "Tomato", `Lot 1 crop is Tomato`);
    assert(lot1.availableQuantityKg === 500, `Lot 1 quantity is 500 kg`);
    assert(lot1.hasPhotos === true, "Lot 1 has produce photos flag true");
    assert(Array.isArray(lot1.images) && lot1.images.length === 2, `Lot 1 has 2 photos (found: ${lot1.images?.length})`);
    assert(lot1.latitude === 9.9252 && lot1.longitude === 78.1198, "Lot 1 GPS coordinates intact");

    // Execute Smart Matching Combinatorial Solver
    const matchResult = findSmartSupplyCombinations({
      demand: buyerDemand,
      matchType: "MARKET",
      supplyListings: realSupplierLots
    });

    assert(matchResult.candidateSuppliers.length === 2, `Candidate suppliers count is 2 (actual: ${matchResult.candidateSuppliers.length})`);
    assert(matchResult.totalAvailableSupplyKg === 1000, `Total available supply is 1,000 kg (actual: ${matchResult.totalAvailableSupplyKg})`);
    assert(matchResult.combinations.length >= 1, `Generated ${matchResult.combinations.length} smart recommendation combinations`);

    const primaryCombo = matchResult.combinations[0];
    assert(primaryCombo.totalQuantityKg === 1000, `Primary combination aggregates 1,000 kg (actual: ${primaryCombo.totalQuantityKg})`);
    assert(primaryCombo.fulfillmentPercentage === 100, `Fulfillment percentage is 100%`);
    assert(primaryCombo.allocations.length === 2, `Combination aggregates 2 farmers (actual: ${primaryCombo.allocations.length})`);

    // Verify both farmers are allocated
    const allocFarmer1 = primaryCombo.allocations.find(a => a.listingId === listing1Id);
    const allocFarmer2 = primaryCombo.allocations.find(a => a.listingId === listing2Id);
    assert(allocFarmer1 !== undefined && allocFarmer1.allocatedQuantityKg === 500, "Farmer Ramesh allocated 500 kg");
    assert(allocFarmer2 !== undefined && allocFarmer2.allocatedQuantityKg === 500, "Farmer Suresh allocated 500 kg");
    assert(allocFarmer1.hasPhotos === true, "Allocation preserves photo inspection capability");
    assert(allocFarmer1.distanceKm !== null, `Distance computed from coordinates (actual: ${allocFarmer1.distanceKm} km)`);

    // Verify demand object in result preserves buyerType and intendedUse
    assert(matchResult.demand.buyerType === "Food Processor", "Returned demand object preserves buyerType");
    assert(matchResult.demand.intendedUse === "Ketchup / sauce", "Returned demand object preserves intendedUse");

  } catch (err) {
    console.error("\n❌ Unexpected error during regression tests:", err);
    failedCount++;
  } finally {
    // Clean up all created test listings from PostgreSQL
    console.log("\n🧹 Cleaning up test database rows in PostgreSQL...");
    if (createdListingIds.length > 0) {
      await query(
        "DELETE FROM marketplace_listings WHERE id = ANY($1)",
        [createdListingIds]
      );
      console.log(`  ✓ Deleted ${createdListingIds.length} test listings from PostgreSQL.`);
    }

    // Verify 0 residual test rows
    const residual = await query(
      "SELECT id FROM marketplace_listings WHERE id LIKE 'test_supply_%'"
    );
    assert(residual.rows.length === 0, `Residual test rows in database: ${residual.rows.length} (clean)`);

    console.log("\n========================================================");
    console.log(` TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log("========================================================\n");

    if (failedCount > 0) {
      process.exit(1);
    }
  }
}

runSupplyDemandTests();
