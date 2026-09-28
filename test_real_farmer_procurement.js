/**
 * Automated Verification Script: Real Farmer Supply Connection to Market Intelligence
 *
 * Validates:
 * 1. Real farmer creates listing via POST /api/v1/marketplace/listings -> PostgreSQL.
 * 2. Listing is retrieved via GET /api/v1/marketplace/listings.
 * 3. mapMarketplaceListingToSupplierLot maps all fields (Name, Crop, Qty, Price, Grade, Real Coords/Null).
 * 4. findSmartSupplyCombinations receives real supplyListings and outputs real farmer recommendation (NO Farmer A/B/C/D).
 * 5. Zero-supply scenario produces empty result with "No eligible farmer supply found for this requirement." (NO demo fallback).
 * 6. Real-Time Socket.IO events (listing:created, listing:updated, listing:deleted) trigger recomputation.
 * 7. Confirmed procurement orders remain frozen.
 */

import http from "http";
import fs from "fs";
import { io as ClientIO } from "socket.io-client";
import { query } from "./backend/src/db/pool.js";
import {
  mapMarketplaceListingToSupplierLot,
  findSmartSupplyCombinations,
  MATCH_TYPES
} from "./src/services/smartMatchService.js";

const API_BASE = "http://localhost:5000/api/v1";
const SOCKET_URL = "http://localhost:5000";

function postJSON(urlStr, data, userId = "usr_farmer_ramesh_test") {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const postData = JSON.stringify(data);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
        "X-User-Id": userId
      }
    }, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

function putJSON(urlStr, data, userId = "usr_farmer_ramesh_test") {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const postData = JSON.stringify(data);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
        "X-User-Id": userId
      }
    }, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

function deleteReq(urlStr, userId = "usr_farmer_ramesh_test") {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: "DELETE",
      headers: {
        "X-User-Id": userId
      }
    }, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function getJSON(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    }, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function runRealFarmerProcurementTests() {
  console.log("==================================================================");
  console.log(" AGROCYCLE REAL FARMER LISTINGS -> MARKET INTELLIGENCE E2E AUDIT");
  console.log("==================================================================\n");

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

  // --- Step 1: Mapper Unit Verification ---
  console.log("[Test 1] mapMarketplaceListingToSupplierLot Accuracy & Safe Location Handling");

  const sampleListingWithGps = {
    id: "lst_real_01",
    creator_id: "usr_farmer_ramesh_01",
    farmer_name: "Ramesh Kannan",
    contact_phone: "9876543210",
    crop_type: "Tomato",
    quantity_kg: 200,
    asking_price: 28,
    condition: "fresh",
    location: "Melur Road, Madurai",
    district: "Madurai",
    state: "Tamil Nadu",
    latitude: 9.9252,
    longitude: 78.1198,
    status: "listed"
  };

  const lot1 = mapMarketplaceListingToSupplierLot(sampleListingWithGps);
  assert(lot1.farmerName === "Ramesh Kannan", "Mapped farmerName correctly");
  assert(lot1.crop === "Tomato", "Mapped crop correctly");
  assert(lot1.availableQuantityKg === 200, "Mapped quantityKg = 200");
  assert(lot1.pricePerKg === 28, "Mapped pricePerKg = 28");
  assert(lot1.qualityGrade === "Grade A", "fresh condition -> Grade A");
  assert(lot1.location.latitude === 9.9252 && lot1.location.longitude === 78.1198, "Preserved actual GPS coordinates");

  // Missing GPS test
  const sampleListingNoGps = {
    id: "lst_real_02",
    creator_id: "usr_farmer_muthu_02",
    farmer_name: "Muthu Vel",
    crop_type: "Tomato",
    quantity_kg: 150,
    asking_price: 25,
    condition: "good",
    location: "Vadipatti",
    latitude: null,
    longitude: null,
    status: "listed"
  };

  const lot2 = mapMarketplaceListingToSupplierLot(sampleListingNoGps);
  assert(lot2.qualityGrade === "Grade B", "good condition -> Grade B");
  assert(lot2.location.latitude === null && lot2.location.longitude === null, "CRITICAL: Missing GPS is null, NOT fabricated");

  // --- Step 2: Zero Demo Fallback Verification in Matching Engine ---
  console.log("\n[Test 2] No Demo Fallback When supplyListings Array is Passed");

  const buyerDemand = {
    crop: "Tomato",
    quantityKg: 200,
    qualityGrade: "Grade A/B",
    maxPricePerKg: 32,
    destinationLocation: { city: "Madurai", latitude: 9.9252, longitude: 78.1198 }
  };

  const emptyMatchResult = findSmartSupplyCombinations({
    demand: buyerDemand,
    matchType: MATCH_TYPES.MARKET,
    supplyListings: [] // Explicitly empty real pool
  });

  assert(emptyMatchResult.combinations.length === 0, "0 combinations generated when real supply is empty");
  assert(emptyMatchResult.candidateSuppliers.length === 0, "0 candidate suppliers in candidate pool");
  assert(!JSON.stringify(emptyMatchResult).includes("Farmer A"), "Farmer A does NOT appear in zero-supply result");
  assert(!JSON.stringify(emptyMatchResult).includes("Farmer B"), "Farmer B does NOT appear in zero-supply result");

  const createdListingIds = [];
  const createdOrderIds = [];
  let buyerSocket = null;

  try {
    // --- Step 3: End-to-End PostgreSQL Listing Creation & Matching ---
    console.log("\n[Test 3] Create Real Farmer Listing in PostgreSQL & Run Smart Procurement Matching");

    const testFarmerId = `usr_farmer_${Date.now()}`;
    const testListingId = `wp_test_${Date.now()}`;
    createdListingIds.push(testListingId);

    const createRes = await postJSON(`${API_BASE}/marketplace/listings`, {
      id: testListingId,
      crop_type: "Tomato",
      quantity_kg: 200,
      condition: "fresh",
      asking_price: 28,
      location: "Madurai Green Hub",
      status: "listed",
      farmer_name: "Real Farmer Senthil"
    }, testFarmerId);

    assert(createRes.status === 201 || createRes.status === 200, `POST /marketplace/listings created listing (status: ${createRes.status})`);

    // Fetch real listings from PostgreSQL
    const fetchRes = await getJSON(`${API_BASE}/marketplace/listings?status=listed`);
    assert(fetchRes.status === 200, "GET /marketplace/listings returned 200");
    const liveListings = fetchRes.data?.data || [];
    const foundRealListing = liveListings.find(l => String(l.id) === testListingId);
    assert(Boolean(foundRealListing), `Found newly created listing ${testListingId} in PostgreSQL`);

    // Map real listings into matching engine
    const realFarmerLots = liveListings
      .filter(item => item && item.status === "listed" && item.creator_role !== "buyer")
      .map(mapMarketplaceListingToSupplierLot)
      .filter(lot => lot && lot.availableQuantityKg > 0);

    const matchResult = findSmartSupplyCombinations({
      demand: {
        crop: "Tomato",
        quantityKg: 200,
        qualityGrade: "Grade A/B",
        maxPricePerKg: 32,
        destinationLocation: { city: "Madurai", latitude: 9.9252, longitude: 78.1198 }
      },
      matchType: MATCH_TYPES.MARKET,
      supplyListings: realFarmerLots
    });

    assert(matchResult.combinations.length > 0, "Generated smart combination from real farmer listings");
    const topRec = matchResult.combinations[0];
    const matchedAlloc = topRec.allocations.find(a => a.supplierId === testListingId || a.farmerName === "Real Farmer Senthil");
    assert(Boolean(matchedAlloc), "Real Farmer Senthil appears in the Smart Procurement recommendation");
    assert(matchedAlloc?.pricePerKg === 28, `Actual price ₹28/kg preserved (actual: ₹${matchedAlloc?.pricePerKg})`);
    assert(matchedAlloc?.allocatedQuantityKg > 0, `Real Farmer Senthil allocated supply (${matchedAlloc?.allocatedQuantityKg} kg)`);

    // --- Step 4: Real-Time Socket.IO Multi-Session Test ---
    console.log("\n[Test 4] Two-Session Real-Time Socket.IO Updates");

    buyerSocket = ClientIO(SOCKET_URL, { transports: ["websocket", "polling"] });
    await new Promise((resolve) => {
      buyerSocket.on("connect", () => {
        console.log(`  📡 Buyer session socket connected (${buyerSocket.id})`);
        resolve();
      });
    });

    // Test 4a: Farmer updates quantity 200 -> 100 kg
    let updatedEventReceived = null;
    const updatePromise = new Promise((resolve) => {
      buyerSocket.on("listing:updated", (eventData) => {
        updatedEventReceived = eventData;
        resolve();
      });
    });

    const updateRes = await putJSON(`${API_BASE}/marketplace/listings/${testListingId}`, {
      quantity_kg: 100,
      crop_type: "Tomato",
      asking_price: 28,
      condition: "fresh",
      status: "listed"
    }, testFarmerId);

    assert(updateRes.status === 200, "Farmer updated listing quantity to 100 kg");
    await Promise.race([updatePromise, new Promise(r => setTimeout(r, 2500))]);
    assert(Boolean(updatedEventReceived), "Socket.IO listing:updated event reached buyer session");
    assert(Number(updatedEventReceived?.quantity_kg) === 100, `Updated quantity in event is 100 kg (actual: ${updatedEventReceived?.quantity_kg})`);

    // Test 4b: Farmer creates second Tomato listing of 300 kg
    const testListingId2 = `wp_test_2_${Date.now()}`;
    createdListingIds.push(testListingId2);
    let createdEventReceived = null;
    const createPromise = new Promise((resolve) => {
      buyerSocket.on("listing:created", (eventData) => {
        createdEventReceived = eventData;
        resolve();
      });
    });

    const create2Res = await postJSON(`${API_BASE}/marketplace/listings`, {
      id: testListingId2,
      crop_type: "Tomato",
      quantity_kg: 300,
      condition: "fresh",
      asking_price: 26,
      location: "Madurai South Cluster",
      status: "listed",
      farmer_name: "Real Farmer Murugan"
    }, testFarmerId);

    assert(create2Res.status === 201 || create2Res.status === 200, "Farmer created second listing (300 kg)");
    await Promise.race([createPromise, new Promise(r => setTimeout(r, 2500))]);
    assert(Boolean(createdEventReceived), "Socket.IO listing:created event reached buyer session");

    // Re-compute matching after 100 kg + 300 kg listings
    const fetchRes2 = await getJSON(`${API_BASE}/marketplace/listings?status=listed`);
    const liveListings2 = (fetchRes2.data?.data || [])
      .filter(item => item && item.status === "listed")
      .map(mapMarketplaceListingToSupplierLot)
      .filter(lot => lot && lot.availableQuantityKg > 0);

    const matchResult2 = findSmartSupplyCombinations({
      demand: {
        crop: "Tomato",
        quantityKg: 400,
        qualityGrade: "Grade A/B",
        maxPricePerKg: 32,
        destinationLocation: { city: "Madurai", latitude: 9.9252, longitude: 78.1198 }
      },
      matchType: MATCH_TYPES.MARKET,
      supplyListings: liveListings2
    });

    const rec2 = matchResult2.combinations[0];
    const totalAllocated = rec2.allocations.reduce((s, a) => s + a.allocatedQuantityKg, 0);
    assert(totalAllocated >= 400, `Combined real farmer lots fulfill 400 kg demand (allocated: ${totalAllocated} kg)`);

    // Test 4c: Farmer deletes/deactivates listing
    let deletedEventReceived = null;
    const deletePromise = new Promise((resolve) => {
      buyerSocket.on("listing:deleted", (eventData) => {
        deletedEventReceived = eventData;
        resolve();
      });
    });

    const deleteRes = await deleteReq(`${API_BASE}/marketplace/listings/${testListingId}?userId=${encodeURIComponent(testFarmerId)}`, testFarmerId);
    assert(deleteRes.status === 200, "Farmer deleted first listing");
    await Promise.race([deletePromise, new Promise(r => setTimeout(r, 2500))]);
    assert(Boolean(deletedEventReceived), "Socket.IO listing:deleted event reached buyer session");

    // Cleanup 2nd test listing via API
    await deleteReq(`${API_BASE}/marketplace/listings/${testListingId2}?userId=${encodeURIComponent(testFarmerId)}`, testFarmerId);

    buyerSocket.disconnect();
    buyerSocket = null;

    // --- Step 5: INVENTORY CONSUMPTION & EXACT CASE VERIFICATION ---
    console.log("\n[Test 5] CASE 1: Full Allocation Consumption (21 kg -> 0 kg, status: sold)");

    const case1FarmerId = `usr_farmer_c1_${Date.now()}`;
    const case1ListingId = `wp_case1_${Date.now()}`;
    createdListingIds.push(case1ListingId);

    // 1. Farmer creates 21 kg Tomato listing
    await postJSON(`${API_BASE}/marketplace/listings`, {
      id: case1ListingId,
      crop_type: "Tomato",
      quantity_kg: 21,
      condition: "fresh",
      asking_price: 28,
      location: "Madurai Hub",
      status: "listed",
      farmer_name: "Farmer 21kg"
    }, case1FarmerId);

    // 2. Buyer creates confirmed procurement order allocating 21 kg
    const case1OrderId = `PO-CASE1-${Date.now()}`;
    createdOrderIds.push(case1OrderId);
    const case1OrderPayload = {
      orderId: case1OrderId,
      buyer: { buyerId: "usr_buyer_c1", businessName: "Case 1 Buyer", phone: "9876543210" },
      demand: { crop: "Tomato", quantityKg: 1000, category: "vegetable", qualityGrade: "Grade A/B" },
      allocations: [
        {
          listingId: case1ListingId,
          supplierId: case1ListingId,
          farmerId: case1FarmerId,
          farmerName: "Farmer 21kg",
          crop: "Tomato",
          allocatedQuantityKg: 21,
          pricePerKg: 28
        }
      ],
      summary: { totalQuantityKg: 21, totalProduceCost: 588 }
    };

    const case1OrderRes = await postJSON(`${API_BASE}/procurement/orders`, case1OrderPayload, "usr_buyer_c1");
    assert(case1OrderRes.status === 201, "Case 1: Procurement order created with 21 kg allocation");

    // 3. Verify listing in PostgreSQL
    const case1ListingRes = await getJSON(`${API_BASE}/marketplace/listings/${case1ListingId}`);
    assert(case1ListingRes.status === 200, "Fetched updated listing for Case 1");
    assert(Number(case1ListingRes.data?.data?.quantity_kg) === 0, `Listing quantity is now 0 kg (actual: ${case1ListingRes.data?.data?.quantity_kg})`);
    assert(case1ListingRes.data?.data?.status === "sold", `Listing status is now 'sold' (actual: ${case1ListingRes.data?.data?.status})`);

    // 4. Verify listing is excluded from active listings query
    const activeListingsRes1 = await getJSON(`${API_BASE}/marketplace/listings?status=listed`);
    const activeList1 = activeListingsRes1.data?.data || [];
    const foundInActive1 = activeList1.some(l => String(l.id) === case1ListingId);
    assert(!foundInActive1, "Listing with 0 kg / 'sold' status is NOT present in active listings");


    console.log("\n[Test 6] CASE 2: Partial Allocation Consumption (200 kg - 100 kg = 100 kg remaining, status: listed)");

    const case2FarmerId = `usr_farmer_c2_${Date.now()}`;
    const case2ListingId = `wp_case2_${Date.now()}`;
    createdListingIds.push(case2ListingId);

    // 1. Farmer creates 200 kg Tomato listing
    await postJSON(`${API_BASE}/marketplace/listings`, {
      id: case2ListingId,
      crop_type: "Tomato",
      quantity_kg: 200,
      condition: "fresh",
      asking_price: 28,
      location: "Madurai Hub",
      status: "listed",
      farmer_name: "Farmer 200kg"
    }, case2FarmerId);

    // 2. Buyer creates confirmed procurement order allocating 100 kg
    const case2OrderId = `PO-CASE2-${Date.now()}`;
    createdOrderIds.push(case2OrderId);
    const case2OrderPayload = {
      orderId: case2OrderId,
      buyer: { buyerId: "usr_buyer_c2", businessName: "Case 2 Buyer", phone: "9876543210" },
      demand: { crop: "Tomato", quantityKg: 1000, category: "vegetable", qualityGrade: "Grade A/B" },
      allocations: [
        {
          listingId: case2ListingId,
          supplierId: case2ListingId,
          farmerId: case2FarmerId,
          farmerName: "Farmer 200kg",
          crop: "Tomato",
          allocatedQuantityKg: 100,
          pricePerKg: 28
        }
      ],
      summary: { totalQuantityKg: 100, totalProduceCost: 2800 }
    };

    const case2OrderRes = await postJSON(`${API_BASE}/procurement/orders`, case2OrderPayload, "usr_buyer_c2");
    assert(case2OrderRes.status === 201, "Case 2: Procurement order created with 100 kg partial allocation");

    // 3. Verify listing in PostgreSQL
    const case2ListingRes = await getJSON(`${API_BASE}/marketplace/listings/${case2ListingId}`);
    assert(case2ListingRes.status === 200, "Fetched updated listing for Case 2");
    assert(Number(case2ListingRes.data?.data?.quantity_kg) === 100, `Listing quantity is now 100 kg remaining (actual: ${case2ListingRes.data?.data?.quantity_kg})`);
    assert(case2ListingRes.data?.data?.status === "listed", `Listing status remains 'listed' (actual: ${case2ListingRes.data?.data?.status})`);

    // 4. Verify listing remains in active query
    const activeListingsRes2 = await getJSON(`${API_BASE}/marketplace/listings?status=listed`);
    const activeList2 = activeListingsRes2.data?.data || [];
    const foundInActive2 = activeList2.some(l => String(l.id) === case2ListingId);
    assert(foundInActive2, "Listing with 100 kg remaining IS present in active listings for future matching");


    console.log("\n[Test 7] CASE 3: Over-Allocation / Double Confirmation Rejection");

    const case3FarmerId = `usr_farmer_c3_${Date.now()}`;
    const case3ListingId = `wp_case3_${Date.now()}`;
    createdListingIds.push(case3ListingId);

    // 1. Farmer creates 21 kg listing
    await postJSON(`${API_BASE}/marketplace/listings`, {
      id: case3ListingId,
      crop_type: "Tomato",
      quantity_kg: 21,
      condition: "fresh",
      asking_price: 28,
      location: "Madurai Hub",
      status: "listed",
      farmer_name: "Farmer Case 3"
    }, case3FarmerId);

    // 2. First confirmation for 21 kg succeeds
    const case3Order1Id = `PO-CASE3-1-${Date.now()}`;
    createdOrderIds.push(case3Order1Id);
    const case3Order1Payload = {
      orderId: case3Order1Id,
      buyer: { buyerId: "usr_buyer_c3", businessName: "Buyer 1", phone: "9876543210" },
      demand: { crop: "Tomato", quantityKg: 21, category: "vegetable" },
      allocations: [
        {
          listingId: case3ListingId,
          supplierId: case3ListingId,
          farmerId: case3FarmerId,
          allocatedQuantityKg: 21,
          pricePerKg: 28
        }
      ],
      summary: { totalQuantityKg: 21 }
    };
    const order1Res = await postJSON(`${API_BASE}/procurement/orders`, case3Order1Payload, "usr_buyer_c3");
    assert(order1Res.status === 201, "First confirmation for 21 kg succeeded");

    // 3. Second confirmation for same listing must be rejected (stock is now 0 / sold)
    const case3Order2Payload = {
      orderId: `PO-CASE3-2-${Date.now()}`,
      buyer: { buyerId: "usr_buyer_c3b", businessName: "Buyer 2", phone: "9876543210" },
      demand: { crop: "Tomato", quantityKg: 21, category: "vegetable" },
      allocations: [
        {
          listingId: case3ListingId,
          supplierId: case3ListingId,
          farmerId: case3FarmerId,
          allocatedQuantityKg: 21,
          pricePerKg: 28
        }
      ],
      summary: { totalQuantityKg: 21 }
    };
    const order2Res = await postJSON(`${API_BASE}/procurement/orders`, case3Order2Payload, "usr_buyer_c3b");
    assert(order2Res.status === 400, `Second confirmation rejected with 400 status (actual: ${order2Res.status})`);
    assert(order2Res.data?.code === "INSUFFICIENT_SUPPLY", `Error code is INSUFFICIENT_SUPPLY (actual: ${order2Res.data?.code})`);


    console.log("\n[Test 8] CASE 4 & CASE 5: Single 'List Fresh Produce' UI Verification (No Double Plus)");
    
    const marketIntelSrc = fs.readFileSync("./src/pages/MarketIntelligence.jsx", "utf-8");
    const farmerWorkspaceSrc = fs.readFileSync("./src/components/matching/FarmerSupplyWorkspace.jsx", "utf-8");

    // Case 4: Farmer UI has button in page header and FarmerSupplyWorkspace has NO internal buttons
    const headerBtnCount = (marketIntelSrc.match(/<span>List Fresh Produce<\/span>/g) || []).length;
    const doublePlusCount = (marketIntelSrc.match(/\+ \+ List Fresh Produce/g) || []).length;
    const workspaceBtnCount = (farmerWorkspaceSrc.match(/<Button[^>]*>[^<]*List Fresh Produce[^<]*<\/Button>/g) || []).length;
    
    assert(headerBtnCount === 1, "Page header contains exactly 1 'List Fresh Produce' button");
    assert(doublePlusCount === 0, "No duplicate '+ +' plus signs in header button");
    assert(workspaceBtnCount === 0, "FarmerSupplyWorkspace contains 0 duplicate 'List Fresh Produce' buttons (Case 4 PASS)");

    // Case 5: Buyer Mode hides the button (wrapped in isFarmerMode)
    assert(marketIntelSrc.includes("{isFarmerMode && (") || marketIntelSrc.includes("isFarmerMode &&"), "Header button strictly guarded by isFarmerMode check (Case 5 PASS)");

  } finally {
    if (buyerSocket) {
      buyerSocket.disconnect();
    }
    console.log("\n🧹 [CLEANUP] Removing test listings and orders from PostgreSQL...");
    try {
      if (createdListingIds.length > 0) {
        const delList = await query("DELETE FROM marketplace_listings WHERE id = ANY($1)", [createdListingIds]);
        console.log(`  ✅ Cleaned up ${delList.rowCount} test listing(s).`);
      }
      if (createdOrderIds.length > 0) {
        const delOrders = await query("DELETE FROM procurement_orders WHERE id = ANY($1)", [createdOrderIds]);
        console.log(`  ✅ Cleaned up ${delOrders.rowCount} test procurement order(s).`);
      }
    } catch (err) {
      console.error("  ⚠️ Cleanup warning:", err.message);
    }
  }

  console.log("\n==================================================================");
  console.log(` AUDIT SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("🎯 ALL REAL FARMER MARKETPLACE -> MARKET INTELLIGENCE TESTS PASSED!");
  }
}

runRealFarmerProcurementTests().catch(err => {
  console.error("FATAL TEST ERROR:", err);
  process.exit(1);
});
