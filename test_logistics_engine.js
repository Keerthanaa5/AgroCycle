import assert from "node:assert";
import {
  calculateHaversineDistanceKm,
  distanceKm,
  filterCompatibleFarmers,
  clusterFarmersGeographically,
  matchDemandWithFarmers,
  selectOptimalVehicle,
  buildConsolidatedRoute,
  calculateTransportCost,
  calculateTransportCostPerKg,
  allocateTransportCostToFarmers,
  calculateFarmerNetExpectedValue,
  consolidateSmartShipment,
  transitionShipmentStatus,
  SHIPMENT_STATUS,
  DEMO_FARMERS,
  DEMO_BUYER,
  DEMO_DRIVERS_AND_VEHICLES
} from "./src/services/logisticsService.js";

console.log("==================================================");
console.log("AGROCYCLE SMART LOGISTICS DETERMINISTIC ENGINE TESTS");
console.log("==================================================");

// TEST 1: Haversine Distance Calculation
console.log("\n[1] Testing Haversine Distance (Estimated Distance)...");
const d1 = calculateHaversineDistanceKm(9.9252, 78.1198, 9.9391, 78.1217);
assert(typeof d1 === "number" && d1 > 1.0 && d1 < 2.5, `Expected ~1.5 km, got ${d1}`);
assert(distanceKm(9.9252, 78.1198, 9.9391, 78.1217) === d1, "Alias distanceKm should match calculateHaversineDistanceKm");
assert(calculateHaversineDistanceKm(null, null, 10, 10) === null, "Invalid coords should return null");
console.log(`[PASS] Distance between Madurai center and North is ~${d1} km.`);

// TEST 2: Farmer Filtering by Crop & Availability
console.log("\n[2] Testing Farmer Compatibility Filtering...");
const mixedFarmers = [
  ...DEMO_FARMERS,
  { id: "farmer_paddy", name: "Paddy Farmer", crop: "Paddy", quantityKg: 5000, location: { lat: 9.9, lng: 78.1 } },
  { id: "farmer_zero", name: "Empty Farmer", crop: "Tomato", quantityKg: 0, location: { lat: 9.9, lng: 78.1 } }
];
const filtered = filterCompatibleFarmers(mixedFarmers, { crop: "Tomato" });
assert.strictEqual(filtered.length, 5, `Expected 5 tomato farmers with qty > 0, got ${filtered.length}`);
console.log(`[PASS] Filtered ${filtered.length} valid tomato farmers.`);

// TEST 3: Geographic Clustering
console.log("\n[3] Testing Geographic Proximity Clustering...");
const clusters = clusterFarmersGeographically(DEMO_FARMERS, 25);
assert(clusters.length >= 1, "Should produce at least 1 cluster");
assert.strictEqual(clusters[0].farmers.length, 5, `Expected all 5 demo farmers to cluster within 25km, got ${clusters[0].farmers.length}`);
assert.strictEqual(clusters[0].totalAvailableKg, 10000, `Expected 10,000 kg total in cluster, got ${clusters[0].totalAvailableKg}`);
console.log(`[PASS] Clustered ${clusters[0].farmers.length} farmers totaling ${clusters[0].totalAvailableKg} kg.`);

// TEST 4: Demand Aggregation & Fulfillment (10,000 kg)
console.log("\n[4] Testing Quantity Aggregation (10,000 kg demand)...");
const fullFulfillment = matchDemandWithFarmers(DEMO_FARMERS, 10000);
assert.strictEqual(fullFulfillment.isFulfilled, true, "10,000 kg should be 100% fulfilled");
assert.strictEqual(fullFulfillment.totalAllocatedQuantityKg, 10000, "Allocated total should be exactly 10,000 kg");
assert.strictEqual(fullFulfillment.allocatedFarmers.length, 5, "All 5 farmers should be allocated");
console.log(`[PASS] Exactly fulfilled 10,000 kg across ${fullFulfillment.allocatedFarmers.length} farmers.`);

// TEST 5: Partial Farmer Allocation
console.log("\n[5] Testing Partial Farmer Allocation (7,000 kg demand)...");
const partialFulfillment = matchDemandWithFarmers(DEMO_FARMERS, 7000);
assert.strictEqual(partialFulfillment.isFulfilled, true, "7,000 kg should be fulfilled");
assert.strictEqual(partialFulfillment.totalAllocatedQuantityKg, 7000, "Allocated total should be 7,000 kg");
// Farmers: F1(1k), F2(1k), F3(2k), F4(3k) -> totals 7k. F5 not needed.
const lastAlloc = partialFulfillment.allocatedFarmers[partialFulfillment.allocatedFarmers.length - 1];
console.log(`[PASS] Partial demand (7,000 kg) satisfied with ${partialFulfillment.allocatedFarmers.length} farmers. Last allocated: ${lastAlloc.allocatedQuantityKg} kg.`);

// TEST 6: Vehicle Capacity Validation & Selection
console.log("\n[6] Testing Vehicle Selection (Capacity >= 10,000 kg)...");
const optimalVeh = selectOptimalVehicle(DEMO_DRIVERS_AND_VEHICLES.vehicles, 10000);
assert(optimalVeh !== null, "Should find a feasible vehicle");
assert.strictEqual(optimalVeh.vehicleId, "veh_truck_12t_01", "Should select 12-ton truck for 10,000 kg load");
assert.strictEqual(optimalVeh.vehicleCapacityKg, 12000, "Selected vehicle capacity should be 12,000 kg");
console.log(`[PASS] Selected ${optimalVeh.vehicleType} (Capacity: ${optimalVeh.vehicleCapacityKg} kg).`);

// TEST 7: Vehicle Utilization Percentage
console.log("\n[7] Testing Vehicle Utilization Calculation...");
// 10,000 / 12,000 * 100 = 83.33%
assert.strictEqual(optimalVeh.vehicleUtilizationPercent, 83.33, `Expected 83.33%, got ${optimalVeh.vehicleUtilizationPercent}%`);
console.log(`[PASS] Vehicle utilization is ${optimalVeh.vehicleUtilizationPercent}%.`);

// TEST 8: Route Generation (Nearest-Neighbour)
console.log("\n[8] Testing Deterministic Route Generation...");
const route = buildConsolidatedRoute(
  DEMO_DRIVERS_AND_VEHICLES.drivers[0].location,
  fullFulfillment.allocatedFarmers,
  DEMO_BUYER.deliveryLocation
);
assert.strictEqual(route.stops.length, 7, "Route should have 7 stops: 1 Start + 5 Pickups + 1 Delivery");
assert.strictEqual(route.stops[0].stopType, "DRIVER_START");
assert(route.stops[route.stops.length - 1].stopType === "DELIVERY" || route.stops[route.stops.length - 1].stopType === "BUYER_DELIVERY", "Last stop must be delivery");
assert(route.totalEstimatedDistanceKm > 0, "Route distance should be positive");
console.log(`[PASS] Generated route with ${route.stops.length} stops. Total estimated distance: ${route.totalEstimatedDistanceKm} km.`);

// TEST 9 & 10: Transport Cost & Cost Per Kg
console.log("\n[9 & 10] Testing Transport Cost & Cost per kg...");
const ratePerKm = 60;
const totalCost = calculateTransportCost(route.totalEstimatedDistanceKm, ratePerKm);
const costPerKg = calculateTransportCostPerKg(totalCost, 10000);
assert(totalCost > 0, "Total cost should be positive");
assert(costPerKg > 0, "Cost per kg should be positive");
console.log(`[PASS] Total Transport Cost: ₹${totalCost} | Transport Cost / kg: ₹${costPerKg}/kg.`);

// TEST 11: Proportional Transport Share Allocation (Exact Sum Guarantee)
console.log("\n[11] Testing Proportional Transport Share Allocation to Farmers...");
const farmersWithShares = allocateTransportCostToFarmers(fullFulfillment.allocatedFarmers, totalCost, 10000);
const sumShares = Math.round(farmersWithShares.reduce((acc, f) => acc + f.transportShare, 0) * 100) / 100;
assert.strictEqual(sumShares, totalCost, `Sum of shares (₹${sumShares}) must exactly equal total cost (₹${totalCost})`);
for (const f of farmersWithShares) {
  assert(f.transportShare > 0, `Farmer ${f.farmerName} share should be positive`);
  const expectedProportion = f.allocatedQuantityKg / 10000;
  console.log(` - ${f.farmerName}: ${f.allocatedQuantityKg} kg (${(expectedProportion * 100).toFixed(0)}%) -> Share: ₹${f.transportShare}`);
}
console.log(`[PASS] Proportional transport cost distributed with exact sum match: ₹${sumShares} === ₹${totalCost}.`);

// TEST 12: Farmer Net Expected Value Integration
console.log("\n[12] Testing Farmer Net Expected Value Calculation...");
const netVal = calculateFarmerNetExpectedValue(farmersWithShares[0], 28, farmersWithShares[0].transportShare, {
  shrinkageRate: 0.015,
  rejectionProbability: 0.01
});
assert.strictEqual(netVal.grossRevenue, 28000, "1,000 kg @ ₹28 = ₹28,000");
assert(netVal.netExpectedValue < netVal.grossRevenue, "Net value must be less than gross revenue");
assert(netVal.netExpectedValue > 20000, "Net value should be realistic");
console.log(`[PASS] Farmer A: Gross = ₹${netVal.grossRevenue} | Transport = ₹${netVal.transportShare} | Losses = ₹${netVal.totalExpectedLosses} | Net = ₹${netVal.netExpectedValue}`);

// TEST 13: End-to-End Master Consolidation Pipeline (Positive & Negative Cases)
console.log("\n[13] Testing End-to-End Consolidation Pipeline...");
// Positive Test
const positiveResult = consolidateSmartShipment({
  buyerDemand: DEMO_BUYER,
  farmers: DEMO_FARMERS,
  drivers: DEMO_DRIVERS_AND_VEHICLES.drivers,
  vehicles: DEMO_DRIVERS_AND_VEHICLES.vehicles
});
assert.strictEqual(positiveResult.success, true, "Standard 10,000 kg order should consolidate successfully");
assert.strictEqual(positiveResult.shipment.status, SHIPMENT_STATUS.MATCHED);
console.log("[PASS] Positive scenario successfully created shipment:", positiveResult.shipment.shipmentId);

// Negative Test 1: Demand exceeds maximum vehicle capacity (15,000 kg > 12,000 kg truck)
const oversizeDemand = { ...DEMO_BUYER, quantityRequiredKg: 15000 };
const oversizeFarmers = [
  ...DEMO_FARMERS,
  { id: "farmer_extra", name: "Extra Farmer", crop: "Tomato", quantityKg: 6000, pricePerKg: 28, location: { lat: 9.94, lng: 78.13 } }
];
const negativeResult = consolidateSmartShipment({
  buyerDemand: oversizeDemand,
  farmers: oversizeFarmers,
  drivers: DEMO_DRIVERS_AND_VEHICLES.drivers,
  vehicles: DEMO_DRIVERS_AND_VEHICLES.vehicles
});
assert.strictEqual(negativeResult.success, false, "15,000 kg demand should be rejected when max vehicle is 12,000 kg");
assert(negativeResult.errorReason.includes("No available vehicle has sufficient capacity"), "Should state capacity rejection reason");
console.log(`[PASS] Negative test 1 properly rejected: "${negativeResult.errorReason}"`);

// Negative Test 2: Incompatible crop
const incompatibleDemand = { ...DEMO_BUYER, crop: "Wheat" };
const incompResult = consolidateSmartShipment({
  buyerDemand: incompatibleDemand,
  farmers: DEMO_FARMERS,
  drivers: DEMO_DRIVERS_AND_VEHICLES.drivers,
  vehicles: DEMO_DRIVERS_AND_VEHICLES.vehicles
});
assert.strictEqual(incompResult.success, false, "Incompatible crop should be rejected");
console.log(`[PASS] Negative test 2 properly rejected: "${incompResult.errorReason}"`);

// TEST 14: Shipment State Transitions
console.log("\n[14] Testing Shipment State Transitions...");
let testShipment = positiveResult.shipment;
assert.strictEqual(testShipment.status, SHIPMENT_STATUS.MATCHED);

testShipment = transitionShipmentStatus(testShipment, SHIPMENT_STATUS.DRIVER_ASSIGNED);
assert.strictEqual(testShipment.status, SHIPMENT_STATUS.DRIVER_ASSIGNED);

testShipment = transitionShipmentStatus(testShipment, SHIPMENT_STATUS.READY_FOR_PICKUP);
assert.strictEqual(testShipment.status, SHIPMENT_STATUS.READY_FOR_PICKUP);

testShipment = transitionShipmentStatus(testShipment, SHIPMENT_STATUS.IN_TRANSIT);
assert.strictEqual(testShipment.status, SHIPMENT_STATUS.IN_TRANSIT);

testShipment = transitionShipmentStatus(testShipment, SHIPMENT_STATUS.DELIVERED);
assert.strictEqual(testShipment.status, SHIPMENT_STATUS.DELIVERED);

// Test illegal transition
assert.throws(() => {
  transitionShipmentStatus(testShipment, SHIPMENT_STATUS.MATCHED);
}, /Invalid shipment state transition/, "Delivered shipment cannot revert to MATCHED");
console.log("[PASS] Verified all valid transitions: MATCHED -> DRIVER_ASSIGNED -> READY_FOR_PICKUP -> IN_TRANSIT -> DELIVERED.");

console.log("\n==================================================");
console.log("ALL 14 SMART LOGISTICS TESTS PASSED PERFECTLY!");
console.log("==================================================");
