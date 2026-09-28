/**
 * AgroCycle Smart Multi-Farmer Matching Engine Verification Suite (Phase 1)
 *
 * Tests:
 * 1. Market Intelligence Multi-Farmer Combinatorial Matching (200kg + 150kg + 300kg + 350kg = 1,000 kg)
 * 2. Silage Bank Feed Suitability & Strict Mold/Contamination Rejection
 * 3. Urban Waste Matcher Biomass & Residue Consolidation
 * 4. Dynamic Fulfillment Tracking (Deficit, Exact, Excess status)
 * 5. Manual Customization & Farmer Substitution
 * 6. Procurement Order Generation, Data Structure & Offline Persistence
 */

import {
  findSmartSupplyCombinations,
  calculateFulfillmentKg,
  calculateFulfillment,
  createProcurementOrder,
  getProcurementOrders,
  getProcurementOrderById,
  updateProcurementOrderStatus,
  MATCH_TYPES,
  ORDER_STATUS,
  FULFILLMENT_STATUS,
  DEMO_SUPPLY_MARKET,
  DEMO_SUPPLY_SILAGE,
  DEMO_SUPPLY_WASTE
} from "./src/services/smartMatchService.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log("==================================================================");
console.log("  AGROCYCLE PHASE 1 — SMART MULTI-FARMER MATCHING ENGINE TEST");
console.log("==================================================================\n");

// ------------------------------------------------------------------
// TEST SUITE 1: MARKET INTELLIGENCE MULTI-FARMER MATCHING
// ------------------------------------------------------------------
console.log("[1] Market Intelligence Multi-Farmer Combinatorial Matching");

const marketDemand = {
  crop: "Tomato",
  quantityKg: 1000,
  qualityGrade: "Grade A/B",
  requiredDate: "2026-10-05",
  destinationLocation: {
    address: "Madurai Central Food Hub, Tamil Nadu",
    city: "Madurai",
    state: "Tamil Nadu",
    latitude: 9.9252,
    longitude: 78.1198
  }
};

const marketResult = findSmartSupplyCombinations({
  demand: marketDemand,
  matchType: MATCH_TYPES.MARKET,
  supplyListings: DEMO_SUPPLY_MARKET
});

assert(marketResult.combinations.length >= 1, `Generated ${marketResult.combinations.length} smart combinations (expected 1–3)`);
assert(marketResult.candidateSuppliers.length > 0, `Filtered ${marketResult.candidateSuppliers.length} compatible candidate suppliers`);

const recCombo = marketResult.combinations[0];
assert(recCombo.archetypeId === "OPTIMAL_PROXIMITY", "Top recommendation is OPTIMAL_PROXIMITY");
assert(recCombo.totalQuantityKg === 1000, `Recommendation pooled exactly ${recCombo.totalQuantityKg} kg (Target: 1,000 kg)`);
assert(recCombo.fulfillmentStatus === FULFILLMENT_STATUS.EXACT, "Fulfillment status is EXACT");
assert(recCombo.allocations.length >= 2, `Pooled ${recCombo.allocations.length} smallholder farmers (Multi-farmer aggregation)`);
assert(typeof recCombo.score === "number" && recCombo.score > 0, `Deterministic transparent rule-based score computed: ${recCombo.score}/100`);
assert(Boolean(recCombo.scoreExplanation), `Score includes clear rationale: "${recCombo.scoreExplanation}"`);
assert(recCombo.totalProduceValue > 0, `Total produce cost calculated: ₹${recCombo.totalProduceValue}`);

// ------------------------------------------------------------------
// TEST SUITE 2: SILAGE BANK SAFETY FILTERING
// ------------------------------------------------------------------
console.log("\n[2] Silage Bank Safety & Quality Filtering");

const silageDemand = {
  crop: "Maize Stover",
  quantityTonnes: 12,
  destinationLocation: { city: "Dindigul", state: "Tamil Nadu", latitude: 10.3673, longitude: 77.9803 }
};

const silageResult = findSmartSupplyCombinations({
  demand: silageDemand,
  matchType: MATCH_TYPES.SILAGE,
  supplyListings: DEMO_SUPPLY_SILAGE
});

const moldyFoundInPool = silageResult.candidateSuppliers.some(s => s.condition === "moldy" || s.id === "sup_sil_f4_moldy");
assert(!moldyFoundInPool, "CRITICAL SAFETY: Moldy/contaminated feed lot was strictly rejected from candidate pool");

const moldyFoundInAllocations = silageResult.combinations.some(combo => 
  combo.allocations.some(a => a.condition === "moldy" || a.supplierId === "sup_sil_f4_moldy")
);
assert(!moldyFoundInAllocations, "CRITICAL SAFETY: Zero moldy items allocated into any Silage Bank recommendation");
assert(silageResult.candidateSuppliers.length >= 3, `Found ${silageResult.candidateSuppliers.length} safe feed-suitable fodder lots`);

// ------------------------------------------------------------------
// TEST SUITE 3: URBAN WASTE MATCHER BIOMASS CONSOLIDATION
// ------------------------------------------------------------------
console.log("\n[3] Urban Waste Matcher Biomass & Residue Consolidation");

const wasteDemand = {
  crop: "Agricultural Biomass & Residue",
  quantityTonnes: 20,
  destinationLocation: { city: "Tiruchirappalli", state: "Tamil Nadu", latitude: 10.7905, longitude: 78.7047 }
};

const wasteResult = findSmartSupplyCombinations({
  demand: wasteDemand,
  matchType: MATCH_TYPES.WASTE,
  supplyListings: DEMO_SUPPLY_WASTE
});

assert(wasteResult.candidateSuppliers.length >= 3, `Discovered ${wasteResult.candidateSuppliers.length} biomass residue lots`);
assert(wasteResult.combinations.length > 0, "Generated multi-farmer residue consolidation options");
const topWasteCombo = wasteResult.combinations[0];
assert(topWasteCombo.totalQuantityTonnes === 20, `Consolidated ${topWasteCombo.totalQuantityTonnes} T agricultural residue for industrial off-take`);

// ------------------------------------------------------------------
// TEST SUITE 4: DYNAMIC FULFILLMENT TRACKER
// ------------------------------------------------------------------
console.log("\n[4] Dynamic Fulfillment Progress Calculation");

// Case A: Deficit (800 kg / 1,000 kg)
const deficitLot = [{ allocatedQuantityKg: 500 }, { allocatedQuantityKg: 300 }];
const deficitStatus = calculateFulfillmentKg(deficitLot, 1000);
assert(deficitStatus.status === FULFILLMENT_STATUS.DEFICIT, "800kg / 1,000kg detected as DEFICIT");
assert(deficitStatus.badgeText.includes("DEFICIT: 200 kg"), `Deficit message correct: "${deficitStatus.badgeText}"`);
assert(deficitStatus.percentFulfillment === 80, `Percent fulfillment: ${deficitStatus.percentFulfillment}%`);

// Case B: Exact (1,000 kg / 1,000 kg)
const exactLot = [{ allocatedQuantityKg: 300 }, { allocatedQuantityKg: 500 }, { allocatedQuantityKg: 200 }];
const exactStatus = calculateFulfillmentKg(exactLot, 1000);
assert(exactStatus.status === FULFILLMENT_STATUS.EXACT, "1,000kg / 1,000kg detected as EXACT");
assert(exactStatus.badgeText.includes("EXACT MATCH (100%)"), `Exact message correct: "${exactStatus.badgeText}"`);
assert(exactStatus.percentFulfillment === 100, "Percent fulfillment: 100%");

// Case C: Excess (1,200 kg / 1,000 kg)
const excessLot = [{ allocatedQuantityKg: 600 }, { allocatedQuantityKg: 600 }];
const excessStatus = calculateFulfillmentKg(excessLot, 1000);
assert(excessStatus.status === FULFILLMENT_STATUS.EXCESS, "1,200kg / 1,000kg detected");
assert(excessStatus.badgeText.includes("EXCESS: 200 kg"), `Excess message correct: "${excessStatus.badgeText}"`);

// ------------------------------------------------------------------
// TEST SUITE 5: MANUAL BUYER SELECTION & CUSTOMIZATION
// ------------------------------------------------------------------
console.log("\n[5] Manual Buyer Selection & Substitution");

// Simulate buyer swapping recommended farmer with custom farmer
const customSelection = [
  { ...DEMO_SUPPLY_MARKET[0], allocatedQuantityKg: 200 },
  { ...DEMO_SUPPLY_MARKET[1], allocatedQuantityKg: 150 },
  { ...DEMO_SUPPLY_MARKET[2], allocatedQuantityKg: 300 },
  { ...DEMO_SUPPLY_MARKET[3], allocatedQuantityKg: 350 }
];

const customFulfillment = calculateFulfillmentKg(customSelection, 1000);
assert(customFulfillment.status === FULFILLMENT_STATUS.EXACT, "Custom substitution fulfills 1,000 kg requirement");
assert(customSelection[3].farmerId === "f_farmer_d", "Farmer D is present in allocations");

// ------------------------------------------------------------------
// TEST SUITE 6: PROCUREMENT ORDER GENERATION & LIFECYCLE
// ------------------------------------------------------------------
console.log("\n[6] Procurement Order Creation, Data Model & Storage");

const testOrder = await createProcurementOrder({
  demand: marketDemand,
  allocations: recCombo.allocations,
  matchType: MATCH_TYPES.MARKET,
  orderType: "ACCEPTED_RECOMMENDATION",
  buyerInfo: {
    buyerId: "usr_buyer_koyambedu_fresh",
    businessName: "Koyambedu Fresh Foods Pvt Ltd",
    phone: "9876543000",
    location: marketDemand.destinationLocation
  }
});

assert(Boolean(testOrder.orderId) && testOrder.orderId.startsWith("PO-AC-"), `Order ID generated: ${testOrder.orderId}`);
assert(testOrder.status === ORDER_STATUS.CONFIRMED, `Order status is CONFIRMED`);
assert(testOrder.allocations.length === recCombo.allocations.length, `Allocations count: ${testOrder.allocations.length}`);
assert(testOrder.summary.totalQuantityKg === 1000, `Summary total quantity: ${testOrder.summary.totalQuantityKg} kg`);

// Order retrieval
const retrievedOrder = getProcurementOrderById(testOrder.orderId);
assert(retrievedOrder !== null && retrievedOrder.orderId === testOrder.orderId, "Retrieved order successfully from local storage");

// Order status transition
const transitioned = updateProcurementOrderStatus(testOrder.orderId, ORDER_STATUS.FULFILLMENT, "Logistics truck dispatched to pick up points.");
assert(transitioned.status === ORDER_STATUS.FULFILLMENT, "Order transitioned to FULFILLMENT status");

// ------------------------------------------------------------------
// SUMMARY REPORT
// ------------------------------------------------------------------
console.log("\n==================================================================");
console.log(`  VERIFICATION RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log("==================================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("🚀 All Phase 1 Smart Multi-Farmer Matching Engine tests passed successfully!");
}
