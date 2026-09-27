/**
 * AgroCycle Full End-to-End Real-Time Logistics & GPS Validation Suite
 *
 * Runs all deterministic engine verifications and multi-buyer routing tests.
 */

import {
  calculateHaversineDistanceKm,
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

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(message);
  }
  console.log(`✅ [PASS] ${message}`);
}

console.log("==================================================");
console.log("AGROCYCLE REAL-TIME SMART LOGISTICS E2E TEST SUITE");
console.log("==================================================");

// 1. Haversine Straight-line Distance
console.log("\n[1] Testing Haversine Estimated Distance...");
const dist = calculateHaversineDistanceKm(9.9252, 78.1198, 9.9390, 78.1380);
assert(dist > 2.0 && dist < 3.0, `Calculated estimated distance is ${dist} km`);

// 2. Proximity Clustering
console.log("\n[2] Testing Geographic Proximity Clustering (< 25 km)...");
const clusters = clusterFarmersGeographically(DEMO_FARMERS, 25);
assert(clusters.length >= 1, `Found ${clusters.length} geographic clusters`);
assert(clusters[0].totalAvailableKg === 10000, `Cluster total is 10,000 kg across 5 farmers`);

// 3. Multi-Buyer Delivery Stops Route Construction
console.log("\n[3] Testing Multi-Buyer Route Construction (Farmer 1..5 -> Buyer A & B)...");
const multiBuyers = [
  { buyerId: "b_a", buyerName: "Buyer A Depot", quantityKg: 7000, coordinates: { lat: 9.939, lng: 78.138 } },
  { buyerId: "b_b", buyerName: "Buyer B Depot", quantityKg: 3000, coordinates: { lat: 10.367, lng: 77.980 } }
];

const route = buildConsolidatedRoute(
  { lat: 9.9252, lng: 78.1198 },
  DEMO_FARMERS.map(f => ({ ...f, allocatedQuantityKg: f.quantityKg, farmerName: f.name, farmerId: f.id })),
  multiBuyers
);

assert(route.stops.length === 8, `Route contains 8 stops (1 start + 5 pickups + 2 delivery drops)`);
assert(route.stops[0].stopType === "DRIVER_START", "Stop 0 is DRIVER_START");
assert(route.stops[1].stopType === "PICKUP", "Stop 1 is PICKUP");
assert(route.stops[5].stopType === "PICKUP", "Stop 5 is PICKUP");
assert(route.stops[5].cumulativeLoadKg === 10000, "Cumulative cargo load after all pickups is 10,000 kg");
assert(route.stops[6].stopType === "DELIVERY", "Stop 6 is DELIVERY for Buyer A");
assert(route.stops[6].cumulativeLoadKg === 3000, "Cumulative cargo load after Buyer A delivery is 3,000 kg");
assert(route.stops[7].stopType === "DELIVERY", "Stop 7 is DELIVERY for Buyer B");
assert(route.stops[7].cumulativeLoadKg === 0, "Cumulative cargo load after Buyer B delivery is 0 kg");

// 4. Vehicle Capacity & Utilization
console.log("\n[4] Testing Vehicle Capacity & Utilization...");
const vehicle = selectOptimalVehicle(DEMO_DRIVERS_AND_VEHICLES.vehicles, 10000);
assert(vehicle.vehicleCapacityKg === 12000, "Selected 12-ton Heavy Truck");
assert(vehicle.vehicleUtilizationPercent === 83.33, "Vehicle utilization is 83.33%");

// 5. Proportional Transport Cost Allocation Invariance
console.log("\n[5] Testing Proportional Transport Cost Sum Invariant...");
const totalCost = 3000;
const allocatedFarmers = DEMO_FARMERS.map(f => ({ ...f, allocatedQuantityKg: f.quantityKg, farmerName: f.name, farmerId: f.id }));
const withShares = allocateTransportCostToFarmers(allocatedFarmers, totalCost, 10000);
const sumShares = withShares.reduce((s, f) => s + f.transportShare, 0);
assert(sumShares === totalCost, `Sum of farmer transport shares (${sumShares}) equals total transport cost (${totalCost})`);

// 6. Net Expected Value Realization
console.log("\n[6] Testing Farmer Net Expected Value Realization...");
const netVal = calculateFarmerNetExpectedValue(withShares[0], 28, withShares[0].transportShare);
assert(netVal.grossRevenue === 28000, "Gross revenue is ₹28,000");
assert(netVal.netExpectedValue < 28000, "Net Expected Value correctly factors transport and expected risk");
assert(netVal.netRealizedPerKg > 0, `Net realization is ₹${netVal.netRealizedPerKg}/kg`);

// 7. Negative Test: Over-capacity rejection
console.log("\n[7] Testing Over-capacity Rejection...");
const overCapacityFarmers = [
  ...DEMO_FARMERS,
  { id: "farmer_f", name: "Farmer F", crop: "Tomato", quantityKg: 5000, pricePerKg: 28, location: { lat: 9.9412, lng: 78.1385 } }
];

const negativeResult = consolidateSmartShipment({
  buyerDemand: { crop: "Tomato", quantityRequiredKg: 15000 },
  farmers: overCapacityFarmers,
  drivers: DEMO_DRIVERS_AND_VEHICLES.drivers,
  vehicles: DEMO_DRIVERS_AND_VEHICLES.vehicles
});
assert(negativeResult.success === false, "15,000 kg order rejected because max vehicle capacity is 12,000 kg");

console.log("\n==================================================");
console.log(">>> ALL E2E LOGISTICS TESTS PASSED! <<<");
console.log("==================================================");
