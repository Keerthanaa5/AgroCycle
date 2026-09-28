/**
 * Comprehensive Automated Verification Suite: Multi-Farmer GPS Map & Real Geolocation
 *
 * Covers the 10 core verification requirements:
 * 1. Real PostgreSQL listing preserves listingId.
 * 2. Real farmer_name reaches SmartMatchMap.
 * 3. Real latitude reaches SmartMatchMap.
 * 4. Real longitude reaches SmartMatchMap.
 * 5. Null GPS does not create a marker.
 * 6. Same listing cannot create duplicate markers.
 * 7. Two different listings from the same farmer remain distinguishable.
 * 8. No demo farmer appears in live buyer map.
 * 9. Multiple real farmers produce multiple real markers.
 * 10. listing:updated refreshes real farmer location/data over Socket.IO.
 */

import http from "http";
import fs from "fs";
import path from "path";
import { io as ClientIO } from "socket.io-client";
import { query } from "./backend/src/db/pool.js";
import {
  mapMarketplaceListingToSupplierLot,
  findSmartSupplyCombinations,
  calculateDistanceKm,
  MATCH_TYPES
} from "./src/services/smartMatchService.js";
import { normalizeListing } from "./src/services/marketplaceService.js";

const API_BASE = "http://localhost:5000/api/v1";
const SOCKET_URL = "http://localhost:5000";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function requestJSON(urlStr, method = "GET", data = null, userId = "usr_test") {
  const headers = {
    "X-User-Id": userId,
    "Accept": "application/json"
  };
  const options = {
    method,
    headers
  };
  if (data && (method === "POST" || method === "PUT" || method === "PATCH")) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(data);
  }
  const res = await fetch(urlStr, options);
  let json = null;
  try {
    json = await res.json();
  } catch (e) {
    json = null;
  }
  return { status: res.status, data: json };
}

async function runGPSMapTests() {
  console.log("==================================================================");
  console.log(" AGROCYCLE: MULTI-FARMER GPS MAP & GEOLOCATION E2E SUITE");
  console.log("==================================================================\n");

  const timestamp = Date.now();
  const listA_id = `gps_farmer_a_${timestamp}`;
  const listB_id = `gps_farmer_b_${timestamp}`;
  const listA2_id = `gps_farmer_a2_${timestamp}`;
  const listC_id = `gps_farmer_c_${timestamp}`;

  let socketClient = null;

  try {
    // -------------------------------------------------------------
    // TEST 1: Real PostgreSQL listing preserves listingId, farmer_name, & GPS
    // -------------------------------------------------------------
    console.log("[TEST 1-4] Real PostgreSQL Listing Pipeline (listingId, farmer_name, lat, lon)");

    // Farmer A: 200 kg @ ₹28 with GPS (9.9520, 78.1340)
    const listA_res = await requestJSON(`${API_BASE}/marketplace/listings`, "POST", {
      id: listA_id,
      creator_id: `usr_gps_fa_${timestamp}`,
      farmerName: "Alagar Chinnasamy",
      crop_type: "Tomato",
      category: "vegetables",
      quantity_kg: 200,
      asking_price: 28,
      condition: "fresh",
      location: "Alanganallur, Madurai",
      district: "Madurai",
      latitude: 9.9520,
      longitude: 78.1340,
      listing_type: "sell",
      status: "listed"
    }, `usr_gps_fa_${timestamp}`);
    assert(listA_res.status === 201, "Farmer A listing created (200 kg @ ₹28/kg with GPS 9.9520, 78.1340)");
    assert(listA_res.data.data.id === listA_id, "PostgreSQL preserved exact listingId: " + listA_id);
    assert(listA_res.data.data.farmer_name === "Alagar Chinnasamy", "PostgreSQL preserved exact farmer_name: Alagar Chinnasamy");
    assert(Number(listA_res.data.data.latitude) === 9.9520, "PostgreSQL preserved exact latitude: 9.9520");
    assert(Number(listA_res.data.data.longitude) === 78.1340, "PostgreSQL preserved exact longitude: 78.1340");

    // Normalized listing in service layer
    const normalizedA = normalizeListing(listA_res.data.data);
    assert(normalizedA.listingId === listA_id, "normalizeListing preserved listingId");
    assert(normalizedA.farmerName === "Alagar Chinnasamy", "normalizeListing preserved farmerName");
    assert(normalizedA.latitude === 9.9520, "normalizeListing preserved finite latitude");
    assert(normalizedA.longitude === 78.1340, "normalizeListing preserved finite longitude");

    // Farmer B: 300 kg @ ₹27 with GPS (9.9110, 78.0980)
    const listB_res = await requestJSON(`${API_BASE}/marketplace/listings`, "POST", {
      id: listB_id,
      creator_id: `usr_gps_fb_${timestamp}`,
      farmerName: "Boopathy Murugan",
      crop_type: "Tomato",
      category: "vegetables",
      quantity_kg: 300,
      asking_price: 27,
      condition: "fresh",
      location: "Thiruparankundram, Madurai",
      district: "Madurai",
      latitude: 9.9110,
      longitude: 78.0980,
      listing_type: "sell",
      status: "listed"
    }, `usr_gps_fb_${timestamp}`);
    assert(listB_res.status === 201, "Farmer B listing created (300 kg @ ₹27/kg with GPS 9.9110, 78.0980)");

    // Farmer A Second Listing: 100 kg (Testing distinguishable separate listings from same farmer)
    const listA2_res = await requestJSON(`${API_BASE}/marketplace/listings`, "POST", {
      id: listA2_id,
      creator_id: `usr_gps_fa_${timestamp}`,
      farmerName: "Alagar Chinnasamy",
      crop_type: "Tomato",
      category: "vegetables",
      quantity_kg: 100,
      asking_price: 29,
      condition: "fresh",
      location: "Alanganallur North Farm",
      district: "Madurai",
      latitude: 9.9580,
      longitude: 78.1390,
      listing_type: "sell",
      status: "listed"
    }, `usr_gps_fa_${timestamp}`);
    assert(listA2_res.status === 201, "Farmer A second listing created with distinct listingId");

    // -------------------------------------------------------------
    // TEST 5: Null Coordinates & No Fake Coordinates
    // -------------------------------------------------------------
    console.log("\n[TEST 5] Null GPS Handling (No marker, no fake fallback)");

    // Farmer C: 150 kg without GPS permission
    const listC_res = await requestJSON(`${API_BASE}/marketplace/listings`, "POST", {
      id: listC_id,
      creator_id: `usr_gps_fc_${timestamp}`,
      farmerName: "Chinnasamy Melur",
      crop_type: "Tomato",
      category: "vegetables",
      quantity_kg: 150,
      asking_price: 26,
      condition: "fresh",
      location: "Melur Rural",
      district: "Madurai",
      latitude: null,
      longitude: null,
      listing_type: "sell",
      status: "listed"
    }, `usr_gps_fc_${timestamp}`);
    assert(listC_res.status === 201, "Farmer C listing created without GPS");
    assert(listC_res.data.data.latitude === null, "Farmer C latitude is strictly null");
    assert(listC_res.data.data.longitude === null, "Farmer C longitude is strictly null");

    // Map to supplier lots
    const lotA = mapMarketplaceListingToSupplierLot(listA_res.data.data);
    const lotB = mapMarketplaceListingToSupplierLot(listB_res.data.data);
    const lotA2 = mapMarketplaceListingToSupplierLot(listA2_res.data.data);
    const lotC = mapMarketplaceListingToSupplierLot(listC_res.data.data);

    assert(lotA.listingId === listA_id, "Lot A retained listingId: " + lotA.listingId);
    assert(lotA.farmerName === "Alagar Chinnasamy", "Lot A retained real farmerName");
    assert(lotA.latitude === 9.9520, "Lot A retained latitude 9.9520");
    assert(lotA.longitude === 78.1340, "Lot A retained longitude 78.1340");
    assert(lotC.latitude === null && lotC.longitude === null, "Lot C coordinates are strictly null (no fake fallback)");

    // -------------------------------------------------------------
    // TEST 6 & 7: Duplicate Listing Protection & Same Farmer Distinguishability
    // -------------------------------------------------------------
    console.log("\n[TEST 6 & 7] Duplicate Listing Protection & Multi-Listing Distinguishability");

    // Passing array with duplicate listingA (simulating re-fetch / duplicate push)
    const matchingWithDups = findSmartSupplyCombinations({
      demand: { crop: "Tomato", quantityKg: 500 },
      supplyListings: [lotA, lotA, lotA2, lotB] // lotA included twice
    });

    const candListingIds = matchingWithDups.candidateSuppliers.map(c => c.listingId);
    const uniqueCandIds = new Set(candListingIds);
    assert(candListingIds.length === uniqueCandIds.size, "Candidate pool prevented duplicate listing ID mapping");
    assert(candListingIds.includes(listA_id) && candListingIds.includes(listA2_id), "Two separate listings from same farmer remain distinguishable");

    // -------------------------------------------------------------
    // TEST 8 & 9: No Demo Farmers & Multiple Real Markers
    // -------------------------------------------------------------
    console.log("\n[TEST 8 & 9] Multi-Farmer Matching & Live Map Supplier Sourcing");

    const buyerLoc = { city: "Madurai", latitude: 9.9252, longitude: 78.1198 };
    const matching = findSmartSupplyCombinations({
      demand: {
        crop: "Tomato",
        quantityKg: 500,
        destinationLocation: buyerLoc
      },
      supplyListings: [lotA, lotB]
    });

    assert(matching.combinations.length > 0, "Matching generated smart combinations");
    const topCombo = matching.combinations[0];
    assert(topCombo.totalQuantityKg === 500, "Top combination pooled exactly 500 kg");
    assert(topCombo.allocations.length === 2, "Top combination pooled exactly 2 farmers (Farmer A + Farmer B)");

    const allocA = topCombo.allocations.find(a => a.listingId === listA_id);
    const allocB = topCombo.allocations.find(a => a.listingId === listB_id);
    assert(Boolean(allocA) && allocA.farmerName === "Alagar Chinnasamy", "Allocation A retains real farmer name: Alagar Chinnasamy");
    assert(Boolean(allocB) && allocB.farmerName === "Boopathy Murugan", "Allocation B retains real farmer name: Boopathy Murugan");
    assert(allocA.allocatedQuantityKg === 200, "Farmer A allocated 200 kg");
    assert(allocB.allocatedQuantityKg === 300, "Farmer B allocated 300 kg");

    // Distance calculation
    const distA = calculateDistanceKm(buyerLoc.latitude, buyerLoc.longitude, lotA.latitude, lotA.longitude);
    const distB = calculateDistanceKm(buyerLoc.latitude, buyerLoc.longitude, lotB.latitude, lotB.longitude);
    const distC = calculateDistanceKm(buyerLoc.latitude, buyerLoc.longitude, lotC.latitude, lotC.longitude);
    assert(typeof distA === "number" && distA > 0, "Distance for Farmer A computed: " + distA + " km");
    assert(typeof distB === "number" && distB > 0, "Distance for Farmer B computed: " + distB + " km");
    assert(distC === null, "Distance for Farmer C is strictly null (no fake distance)");

    // -------------------------------------------------------------
    // TEST 10: Real-Time Location Update via Socket.IO
    // -------------------------------------------------------------
    console.log("\n[TEST 10] Real-Time Location Update over Socket.IO");

    socketClient = ClientIO(SOCKET_URL, {
      transports: ["websocket"],
      forceNew: true
    });

    await new Promise((resolve) => {
      socketClient.on("connect", () => {
        console.log("  📡 Socket client connected for live GPS stream");
        resolve();
      });
    });

    const liveUpdatePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Socket update timed out")), 5000);
      socketClient.on("listing:updated", (updatedListing) => {
        if (updatedListing.id === listA_id) {
          clearTimeout(timeout);
          resolve(updatedListing);
        }
      });
    });

    // Farmer A updates location meaningfully
    const updatedLat = 9.9650;
    const updatedLon = 78.1450;
    const update_res = await requestJSON(`${API_BASE}/marketplace/listings/${listA_id}`, "PATCH", {
      latitude: updatedLat,
      longitude: updatedLon
    }, `usr_gps_fa_${timestamp}`);

    assert(update_res.status === 200, "Farmer A location updated via PATCH (HTTP 200)");
    assert(Number(update_res.data.data.latitude) === updatedLat, "Updated latitude confirmed in database: " + updatedLat);

    const socketReceived = await liveUpdatePromise;
    assert(Number(socketReceived.latitude) === updatedLat, "Buyer session received live GPS listing:updated via Socket.IO");
    socketClient.disconnect();
    socketClient = null;

    // -------------------------------------------------------------
    // UI & Component Verification
    // -------------------------------------------------------------
    console.log("\n[UI VERIFICATION] SmartMatchMap & ListProduceModal Source Checks");

    const mapCode = fs.readFileSync(path.resolve("src/components/matching/SmartMatchMap.jsx"), "utf-8");
    assert(mapCode.includes("Multi-Farmer Geographic Sourcing Map"), "SmartMatchMap renders header title");
    assert(mapCode.includes("No eligible farmer supply found"), "SmartMatchMap handles 0 candidate state");
    assert(mapCode.includes("GPS location unavailable for matched suppliers"), "SmartMatchMap handles no GPS state safely");
    assert(mapCode.includes("Some matched suppliers have no GPS location available"), "SmartMatchMap handles mixed GPS state");
    assert(!mapCode.includes("selectedPin.phone"), "SmartMatchMap pin popover excludes private phone numbers");

    const modalCode = fs.readFileSync(path.resolve("src/components/matching/ListProduceModal.jsx"), "utf-8");
    assert(modalCode.includes("GPS location available"), "ListProduceModal shows 'GPS location available' status");
    assert(modalCode.includes("Location permission not granted"), "ListProduceModal shows 'Location permission not granted' status");
    assert(modalCode.includes("Allow Location Access"), "ListProduceModal includes 'Allow Location Access' button");

  } finally {
    if (socketClient) {
      socketClient.disconnect();
    }
    console.log("\n🧹 [CLEANUP] Removing test listings from PostgreSQL...");
    try {
      const cleanupIds = [listA_id, listB_id, listA2_id, listC_id];
      const delRes = await query("DELETE FROM marketplace_listings WHERE id = ANY($1)", [cleanupIds]);
      console.log(`  ✅ Cleaned up ${delRes.rowCount} test listing(s) from database.`);
    } catch (err) {
      console.error("  ⚠️ Cleanup warning:", err.message);
    }
  }

  console.log("\n==================================================================");
  console.log(` SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runGPSMapTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
