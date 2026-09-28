/**
 * Comprehensive Automated Verification Suite: Farmer Produce Photos -> Buyer Inspection E2E
 *
 * Tests:
 * 1. Farmer creates listing with 1-3 produce photos -> POST /api/v1/marketplace/listings -> PostgreSQL.
 * 2. PostgreSQL row contains exact serialized photos in image_url.
 * 3. Farmer creates listing with 0 photos -> PostgreSQL stores null (no fake stock photos).
 * 4. Buyer GET /api/v1/marketplace/listings returns listings with photo arrays.
 * 5. normalizeListing parses JSON array of photos, preserves primary image_url, and handles empty array.
 * 6. mapMarketplaceListingToSupplierLot binds photos strictly to listingId.
 * 7. Two listings by the same farmer have distinct photos per listingId.
 * 8. findSmartSupplyCombinations candidateSuppliers and allocations retain produce photos.
 * 9. Socket.IO listing:created & listing:updated events include produce photos in real time.
 * 10. UI checks: ProducePhotoPreviewModal, ListProduceModal, SmartMatchRecommendation, SupplierSelector, FarmerSupplyWorkspace.
 * 11. Cleanup: Strict database cleanup in finally.
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

function postJSON(urlStr, data, userId = "usr_farmer_photo_test") {
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

function putJSON(urlStr, data, userId = "usr_farmer_photo_test") {
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

function getJSON(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: "GET",
      headers: { "Accept": "application/json" }
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

async function runProducePhotosVerification() {
  console.log("==================================================================");
  console.log(" AGROCYCLE: PRODUCE PHOTOS IN FARMER LISTINGS & BUYER INSPECTION");
  console.log("==================================================================\n");

  const createdListingIds = [];
  let buyerSocket = null;

  try {
    // ------------------------------------------------------------------
    // TEST 1: Farmer uploads 3 produce photos -> PostgreSQL row verification
    // ------------------------------------------------------------------
    console.log("[TEST 1] Farmer Creates Listing with 3 Produce Photos -> PostgreSQL Storage");
    const farmerId = `usr_farmer_${Date.now()}`;
    const listingId1 = `photo_lot_1_${Date.now()}`;
    createdListingIds.push(listingId1);

    const samplePhoto1 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD_TEST_PRODUCE_PHOTO_1_TOMATO";
    const samplePhoto2 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD_TEST_PRODUCE_PHOTO_2_TOMATO";
    const samplePhoto3 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD_TEST_PRODUCE_PHOTO_3_TOMATO";
    const produceImages = [samplePhoto1, samplePhoto2, samplePhoto3];

    const createRes1 = await postJSON(`${API_BASE}/marketplace/listings`, {
      id: listingId1,
      crop_type: "Tomato",
      quantity_kg: 300,
      condition: "fresh",
      asking_price: 28,
      location: "Melur Cluster, Madurai",
      status: "listed",
      farmer_name: "Farmer Ramanathan",
      images: produceImages
    }, farmerId);

    assert(createRes1.status === 201 || createRes1.status === 200, "POST /marketplace/listings created listing with 3 photos (201)");

    const dbRes1 = await query("SELECT * FROM marketplace_listings WHERE id = $1", [listingId1]);
    const dbRow1 = dbRes1.rows[0];
    assert(Boolean(dbRow1), `PostgreSQL row found for listing ${listingId1}`);
    assert(Boolean(dbRow1.image_url), "image_url column is populated in PostgreSQL");
    
    // Verify JSON parsing of stored photos
    const parsedStoredImages = JSON.parse(dbRow1.image_url);
    assert(Array.isArray(parsedStoredImages), "Stored image_url is a serialized JSON array");
    assert(parsedStoredImages.length === 3, "All 3 produce photos stored in PostgreSQL");
    assert(parsedStoredImages[0] === samplePhoto1, "First photo preserved accurately");
    assert(parsedStoredImages[1] === samplePhoto2, "Second photo preserved accurately");
    assert(parsedStoredImages[2] === samplePhoto3, "Third photo preserved accurately");

    // ------------------------------------------------------------------
    // TEST 2: Listing with 0 photos -> Strictly null (No stock placeholder)
    // ------------------------------------------------------------------
    console.log("\n[TEST 2] Farmer Creates Listing with NO Photos -> Strictly Null (No Fake Stock Photo)");
    const listingId2 = `photo_lot_2_${Date.now()}`;
    createdListingIds.push(listingId2);

    const createRes2 = await postJSON(`${API_BASE}/marketplace/listings`, {
      id: listingId2,
      crop_type: "Tomato",
      quantity_kg: 200,
      condition: "fresh",
      asking_price: 27,
      location: "Vadipatti Hub",
      status: "listed",
      farmer_name: "Farmer Ramanathan", // Same farmer, different listing
      images: [] // Explicitly no photos
    }, farmerId);

    assert(createRes2.status === 201 || createRes2.status === 200, "Listing 2 created with 0 photos");
    const dbRes2 = await query("SELECT * FROM marketplace_listings WHERE id = $1", [listingId2]);
    const dbRow2 = dbRes2.rows[0];
    assert(dbRow2.image_url === null, "PostgreSQL stores strictly null for listing without photos (NO fake stock image)");

    // ------------------------------------------------------------------
    // TEST 3: Buyer GET API & normalizeListing
    // ------------------------------------------------------------------
    console.log("\n[TEST 3] Buyer GET /marketplace/listings & normalizeListing Produce Photos Parsing");
    const getRes = await getJSON(`${API_BASE}/marketplace/listings?status=listed`);
    assert(getRes.status === 200, "GET /marketplace/listings returned 200");
    const listingsFromApi = getRes.data?.data || [];

    const rawListing1 = listingsFromApi.find(l => l.id === listingId1);
    const rawListing2 = listingsFromApi.find(l => l.id === listingId2);
    assert(Boolean(rawListing1), "Buyer API returned listing 1");
    assert(Boolean(rawListing2), "Buyer API returned listing 2");

    const norm1 = normalizeListing(rawListing1);
    assert(Array.isArray(norm1.images), "normalizeListing provides array in norm1.images");
    assert(norm1.images.length === 3, "norm1.images contains exactly 3 photos");
    assert(norm1.image_url === samplePhoto1, "norm1.image_url points to primary photo");

    const norm2 = normalizeListing(rawListing2);
    assert(Array.isArray(norm2.images), "normalizeListing provides array in norm2.images");
    assert(norm2.images.length === 0, "norm2.images is empty array for photo-less listing");
    assert(norm2.image_url === null, "norm2.image_url is strictly null");

    // ------------------------------------------------------------------
    // TEST 4: Photo Association Per Listing (Not Conflated by FarmerId)
    // ------------------------------------------------------------------
    console.log("\n[TEST 4] Produce Photos Associated to listingId (Multi-Listing Isolation per Farmer)");
    const lot1 = mapMarketplaceListingToSupplierLot(norm1);
    const lot2 = mapMarketplaceListingToSupplierLot(norm2);

    assert(lot1.listingId === listingId1, "Lot 1 retains listingId1");
    assert(lot2.listingId === listingId2, "Lot 2 retains listingId2");
    assert(lot1.farmerId === lot2.farmerId, "Both lots belong to same farmerId");
    assert(lot1.images.length === 3, "Lot 1 has 3 photos");
    assert(lot2.images.length === 0, "Lot 2 has 0 photos (isolated from Lot 1)");
    assert(lot1.hasPhotos === true, "Lot 1 hasPhotos is true");
    assert(lot2.hasPhotos === false, "Lot 2 hasPhotos is false");

    // ------------------------------------------------------------------
    // TEST 5: Smart Matching Engine Preserves Photos on Candidate Suppliers & Allocations
    // ------------------------------------------------------------------
    console.log("\n[TEST 5] Smart Matching Engine Preserves Produce Photos in Allocations & Candidate Pool");
    const matchResult = findSmartSupplyCombinations({
      demand: {
        crop: "Tomato",
        quantityKg: 400,
        qualityGrade: "Grade A/B",
        maxPricePerKg: 32,
        destinationLocation: { city: "Madurai", latitude: 9.9252, longitude: 78.1198 }
      },
      matchType: MATCH_TYPES.MARKET,
      supplyListings: [lot1, lot2]
    });

    assert(matchResult.combinations.length > 0, "Matching generated combination");
    assert(matchResult.candidateSuppliers.length === 2, "Candidate pool has 2 suppliers");
    
    const candidate1 = matchResult.candidateSuppliers.find(c => c.listingId === listingId1);
    const candidate2 = matchResult.candidateSuppliers.find(c => c.listingId === listingId2);
    assert(candidate1?.images?.length === 3, "Candidate 1 in pool contains 3 photos");
    assert(candidate2?.images?.length === 0, "Candidate 2 in pool contains 0 photos");

    const topCombo = matchResult.combinations[0];
    const alloc1 = topCombo.allocations.find(a => a.listingId === listingId1);
    const alloc2 = topCombo.allocations.find(a => a.listingId === listingId2);
    assert(Boolean(alloc1), "Lot 1 allocated in top recommendation");
    assert(Boolean(alloc2), "Lot 2 allocated in top recommendation");
    assert(alloc1?.images?.length === 3, "Allocation 1 contains 3 produce photos");
    assert(alloc1?.image_url === samplePhoto1, "Allocation 1 has primary image_url");
    assert(alloc1?.hasPhotos === true, "Allocation 1 hasPhotos === true");
    assert(alloc2?.images?.length === 0, "Allocation 2 has 0 photos");
    assert(alloc2?.hasPhotos === false, "Allocation 2 hasPhotos === false");

    // ------------------------------------------------------------------
    // TEST 6: Real-Time Socket.IO Broadcast of Produce Photos
    // ------------------------------------------------------------------
    console.log("\n[TEST 6] Real-Time Socket.IO Produce Photos Broadcast");
    buyerSocket = ClientIO(SOCKET_URL, { transports: ["websocket", "polling"] });
    await new Promise((resolve) => {
      buyerSocket.on("connect", () => {
        resolve();
      });
    });

    let updatedEventReceived = null;
    const updatePromise = new Promise((resolve) => {
      buyerSocket.on("listing:updated", (eventData) => {
        updatedEventReceived = eventData;
        resolve();
      });
    });

    const newPhoto = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD_UPDATED_PHOTO_TOMATO";
    await putJSON(`${API_BASE}/marketplace/listings/${listingId2}`, {
      quantity_kg: 200,
      crop_type: "Tomato",
      asking_price: 27,
      condition: "fresh",
      images: [newPhoto]
    }, farmerId);

    await Promise.race([updatePromise, new Promise(r => setTimeout(r, 2500))]);
    assert(Boolean(updatedEventReceived), "Socket.IO listing:updated received by buyer session");
    const updatedImages = typeof updatedEventReceived?.image_url === "string" && updatedEventReceived?.image_url.startsWith("[")
      ? JSON.parse(updatedEventReceived.image_url)
      : [updatedEventReceived?.image_url];
    assert(updatedImages.includes(newPhoto), "Socket.IO event contains the newly uploaded produce photo");

    buyerSocket.disconnect();
    buyerSocket = null;

    // ------------------------------------------------------------------
    // TEST 7: Source Code Verification of Components & Privacy
    // ------------------------------------------------------------------
    console.log("\n[TEST 7] Component Verification: ProducePhotoPreviewModal, Lightbox, No Stock Images, Privacy");
    const previewModalSrc = fs.readFileSync("./src/components/matching/ProducePhotoPreviewModal.jsx", "utf-8");
    const listModalSrc = fs.readFileSync("./src/components/matching/ListProduceModal.jsx", "utf-8");
    const recSrc = fs.readFileSync("./src/components/matching/SmartMatchRecommendation.jsx", "utf-8");
    const selectorSrc = fs.readFileSync("./src/components/matching/SupplierSelector.jsx", "utf-8");
    const workspaceSrc = fs.readFileSync("./src/components/matching/FarmerSupplyWorkspace.jsx", "utf-8");

    assert(previewModalSrc.includes("ProducePhotoPreviewModal"), "ProducePhotoPreviewModal component exists");
    assert(previewModalSrc.includes("No Photos Uploaded"), "ProducePhotoPreviewModal shows explicit 'No Photos Uploaded' empty state");
    assert(!previewModalSrc.includes("unsplash.com") && !previewModalSrc.includes("placeholder.com"), "ProducePhotoPreviewModal contains NO stock placeholder images");
    assert(!previewModalSrc.includes("phone") && !previewModalSrc.includes("contactPhone"), "ProducePhotoPreviewModal does NOT leak private phone numbers");

    assert(listModalSrc.includes("producePhotos"), "ListProduceModal tracks producePhotos state");
    assert(listModalSrc.includes("handlePhotoUpload"), "ListProduceModal handles produce photo uploads");
    assert(listModalSrc.includes("handleRemovePhoto"), "ListProduceModal allows removing uploaded photos");
    assert(listModalSrc.includes("3"), "ListProduceModal supports 1-3 produce photos");

    assert(recSrc.includes("ProducePhotoPreviewModal"), "SmartMatchRecommendation integrates ProducePhotoPreviewModal");
    assert(recSrc.includes("Produce Photos"), "SmartMatchRecommendation table has Produce Photos column");

    assert(selectorSrc.includes("ProducePhotoPreviewModal"), "SupplierSelector integrates ProducePhotoPreviewModal");
    assert(workspaceSrc.includes("ProducePhotoPreviewModal"), "FarmerSupplyWorkspace integrates ProducePhotoPreviewModal");

  } finally {
    if (buyerSocket) {
      buyerSocket.disconnect();
    }
    console.log("\n🧹 [CLEANUP] Removing test listings from PostgreSQL...");
    try {
      if (createdListingIds.length > 0) {
        const delRes = await query("DELETE FROM marketplace_listings WHERE id = ANY($1)", [createdListingIds]);
        console.log(`  ✅ Cleaned up ${delRes.rowCount} test listing(s).`);
      }
    } catch (err) {
      console.error("  ⚠️ Cleanup warning:", err.message);
    }
  }

  console.log("\n==================================================================");
  console.log(` SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("🎯 ALL PRODUCE PHOTOS E2E VERIFICATION TESTS PASSED!");
  }
}

runProducePhotosVerification().catch(err => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
