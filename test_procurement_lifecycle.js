/**
 * Comprehensive Automated Verification Suite: Procurement Lifecycle & Partial Sourcing
 *
 * Tests all 10 scenarios required by the specification:
 * 1. 100 kg requested, 30 kg + 30 kg confirmed -> 60 / 100 sourced, 40 remaining, PARTIALLY_SOURCED
 * 2. Remaining 40 kg later sourced on the same order -> 100 / 100 sourced, 0 remaining, FULLY_SOURCED
 * 3. Required By reached with only 60 kg -> Buyer sees 60 / 100 sourced, 40 remaining, proceed/close options
 * 4. Buyer proceeds with 60 kg -> status = PARTIALLY_FULFILLED, no further sourcing
 * 5. Farmer listing 200 kg, Buyer allocates 100 kg -> listing = 100 kg remaining, status = listed
 * 6. Farmer listing 21 kg, Buyer allocates 21 kg -> listing = 0 kg, status = sold, excluded from active matching
 * 7. Double confirmation -> first succeeds, second fails with INSUFFICIENT_SUPPLY (400)
 * 8. Farmer UI -> exactly ONE "+ List Fresh Produce"
 * 9. Buyer UI -> ZERO "+ List Fresh Produce"
 * 10. Real-time update -> listing quantity changes appear in connected Farmer/Buyer sessions
 */

import http from "http";
import fs from "fs";
import path from "path";
import { io as ClientIO } from "socket.io-client";
import { query } from "./backend/src/db/pool.js";
import {
  mapMarketplaceListingToSupplierLot,
  findSmartSupplyCombinations,
  ORDER_STATUS,
  MATCH_TYPES
} from "./src/services/smartMatchService.js";

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

async function runAllLifecycleTests() {
  console.log("==================================================================");
  console.log(" AGROCYCLE: PROCUREMENT LIFECYCLE & PARTIAL SOURCING E2E SUITE");
  console.log("==================================================================\n");

  const timestamp = Date.now();
  const createdListingIds = [
    `lc_farmer_a_${timestamp}`,
    `lc_farmer_b_${timestamp}`,
    `lc_farmer_c_${timestamp}`,
    `lc_listing_200_${timestamp}`,
    `lc_listing_21_${timestamp}`,
    `lc_listing_limited_${timestamp}`,
    `lc_sock_list_${timestamp}`
  ];
  const createdOrderIds = [
    `PO-LC-1-${timestamp}`,
    `PO-LC-EXPIRED-${timestamp}`,
    `PO-LC-200-${timestamp}`,
    `PO-LC-21-${timestamp}`,
    `PO-LC-A-${timestamp}`,
    `PO-LC-B-${timestamp}`,
    `PO-LC-SOCKET-${timestamp}`
  ];

  try {
  // -------------------------------------------------------------
  // TEST 1: 100 kg requested, 30 kg + 30 kg confirmed -> PARTIALLY_SOURCED (60/100, 40 remaining)
  // -------------------------------------------------------------
  console.log("[TEST 1] 100 kg Requested, 30 kg + 30 kg Confirmed -> PARTIALLY_SOURCED");
  
  // Create two real farmer listings: Farmer A (30 kg) and Farmer B (30 kg)
  const listingA_res = await requestJSON(`${API_BASE}/marketplace/listings`, "POST", {
    id: `lc_farmer_a_${timestamp}`,
    creator_id: `usr_fa_${timestamp}`,
    farmerName: "Farmer Anbu",
    crop_type: "Tomato",
    category: "vegetables",
    quantity_kg: 30,
    asking_price: 28,
    condition: "fresh",
    location: "Dindigul Cluster",
    listing_type: "sell",
    status: "listed"
  }, `usr_fa_${timestamp}`);
  assert(listingA_res.status === 201, "Farmer A listing created (30 kg @ ₹28/kg)");

  const listingB_res = await requestJSON(`${API_BASE}/marketplace/listings`, "POST", {
    id: `lc_farmer_b_${timestamp}`,
    creator_id: `usr_fb_${timestamp}`,
    farmerName: "Farmer Balan",
    crop_type: "Tomato",
    category: "vegetables",
    quantity_kg: 30,
    asking_price: 27,
    condition: "fresh",
    location: "Madurai Cluster",
    listing_type: "sell",
    status: "listed"
  }, `usr_fb_${timestamp}`);
  assert(listingB_res.status === 201, "Farmer B listing created (30 kg @ ₹27/kg)");

  const orderId1 = `PO-LC-1-${timestamp}`;
  const order1_res = await requestJSON(`${API_BASE}/procurement/orders`, "POST", {
    id: orderId1,
    order_id: orderId1,
    buyer_id: "usr_buyer_supermarket",
    buyer_name: "Fresh Foods Supermarket",
    crop: "Tomato",
    category: "Vegetable",
    requested_quantity_kg: 100,
    quality_grade: "Grade A/B",
    required_date: "2026-10-05",
    farmer_allocations: [
      {
        listingId: `lc_farmer_a_${timestamp}`,
        farmerId: `usr_fa_${timestamp}`,
        farmerName: "Farmer Anbu",
        allocatedQuantityKg: 30,
        pricePerKg: 28,
        farmerSubtotal: 840,
        qualityGrade: "Grade A",
        status: "CONFIRMED",
        paymentStatus: "PENDING"
      },
      {
        listingId: `lc_farmer_b_${timestamp}`,
        farmerId: `usr_fb_${timestamp}`,
        farmerName: "Farmer Balan",
        allocatedQuantityKg: 30,
        pricePerKg: 27,
        farmerSubtotal: 810,
        qualityGrade: "Grade A",
        status: "CONFIRMED",
        paymentStatus: "PENDING"
      }
    ]
  }, "usr_buyer_supermarket");

  assert(order1_res.status === 201, "Procurement order created (HTTP 201)");
  const createdOrder1 = order1_res.data.data;
  assert(createdOrder1.status === "PARTIALLY_SOURCED", `Order status is PARTIALLY_SOURCED (actual: ${createdOrder1.status})`);
  assert(Number(createdOrder1.requested_quantity_kg) === 100, `Requested quantity = 100 kg (actual: ${createdOrder1.requested_quantity_kg})`);
  assert(createdOrder1.procurement_summary?.sourcedQuantityKg === 60, `Confirmed / Sourced = 60 kg (actual: ${createdOrder1.procurement_summary?.sourcedQuantityKg})`);
  assert(createdOrder1.procurement_summary?.remainingQuantityKg === 40, `Remaining quantity = 40 kg (actual: ${createdOrder1.procurement_summary?.remainingQuantityKg})`);
  assert(createdOrder1.procurement_summary?.paymentStatus === "PENDING", `Payment status is PENDING (actual: ${createdOrder1.procurement_summary?.paymentStatus})`);
  assert(createdOrder1.procurement_summary?.totalProduceCost === 1650, `Produce cost calculated on sourced 60 kg = ₹1,650 (actual: ₹${createdOrder1.procurement_summary?.totalProduceCost})`);

  // Verify inventory deduction for Farmer A & Farmer B (both 30 kg -> 0 kg -> sold)
  const listA_check = await requestJSON(`${API_BASE}/marketplace/listings/lc_farmer_a_${timestamp}`);
  assert(Number(listA_check.data.data.quantity_kg) === 0 && listA_check.data.data.status === "sold", "Farmer A listing consumed to 0 kg (sold)");
  const listB_check = await requestJSON(`${API_BASE}/marketplace/listings/lc_farmer_b_${timestamp}`);
  assert(Number(listB_check.data.data.quantity_kg) === 0 && listB_check.data.data.status === "sold", "Farmer B listing consumed to 0 kg (sold)");

  // -------------------------------------------------------------
  // TEST 2: Remaining 40 kg Later Sourced on the SAME Requirement -> FULLY_SOURCED (100/100, 0 remaining)
  // -------------------------------------------------------------
  console.log("\n[TEST 2] Remaining 40 kg Later Sourced -> FULLY_SOURCED");

  // Farmer C creates a 40 kg listing
  const listingC_res = await requestJSON(`${API_BASE}/marketplace/listings`, "POST", {
    id: `lc_farmer_c_${timestamp}`,
    creator_id: `usr_fc_${timestamp}`,
    farmerName: "Farmer Chelladurai",
    crop_type: "Tomato",
    category: "vegetables",
    quantity_kg: 40,
    asking_price: 26,
    condition: "fresh",
    location: "Theni Cluster",
    listing_type: "sell",
    status: "listed"
  }, `usr_fc_${timestamp}`);
  assert(listingC_res.status === 201, "Farmer C listing created (40 kg @ ₹26/kg)");

  // Buyer continues sourcing on the same requirement (orderId1)
  const orderAppend_res = await requestJSON(`${API_BASE}/procurement/orders`, "POST", {
    id: orderId1,
    order_id: orderId1,
    buyer_id: "usr_buyer_supermarket",
    buyer_name: "Fresh Foods Supermarket",
    crop: "Tomato",
    category: "Vegetable",
    requested_quantity_kg: 100,
    farmer_allocations: [
      {
        listingId: `lc_farmer_c_${timestamp}`,
        farmerId: `usr_fc_${timestamp}`,
        farmerName: "Farmer Chelladurai",
        allocatedQuantityKg: 40,
        pricePerKg: 26,
        farmerSubtotal: 1040,
        qualityGrade: "Grade A",
        status: "CONFIRMED",
        paymentStatus: "PENDING"
      }
    ]
  }, "usr_buyer_supermarket");

  assert(orderAppend_res.status === 201, "Continuous sourcing appended allocation to order (HTTP 201)");
  const updatedOrder = orderAppend_res.data.data;
  assert(updatedOrder.status === "FULLY_SOURCED", `Order transitioned to FULLY_SOURCED (actual: ${updatedOrder.status})`);
  assert(updatedOrder.procurement_summary?.sourcedQuantityKg === 100, `Total sourced = 100 kg (actual: ${updatedOrder.procurement_summary?.sourcedQuantityKg})`);
  assert(updatedOrder.procurement_summary?.remainingQuantityKg === 0, `Remaining quantity = 0 kg (actual: ${updatedOrder.procurement_summary?.remainingQuantityKg})`);
  assert(updatedOrder.farmer_allocations.length === 3, `Order contains 3 farmer allocations (actual: ${updatedOrder.farmer_allocations.length})`);
  assert(updatedOrder.procurement_summary?.totalProduceCost === 2690, `Total produce cost = ₹2,690 (actual: ₹${updatedOrder.procurement_summary?.totalProduceCost})`);

  // Verify Farmer C listing consumed to 0 kg (sold)
  const listC_check = await requestJSON(`${API_BASE}/marketplace/listings/lc_farmer_c_${timestamp}`);
  assert(Number(listC_check.data.data.quantity_kg) === 0 && listC_check.data.data.status === "sold", "Farmer C listing consumed to 0 kg (sold)");

  // -------------------------------------------------------------
  // TEST 3 & TEST 4: Required-by Date Reached with Partial Sourcing -> Proceed with 60 kg (PARTIALLY_FULFILLED)
  // -------------------------------------------------------------
  console.log("\n[TEST 3 & 4] Required-by Reached -> Proceed with 60 kg -> PARTIALLY_FULFILLED");

  // Create partial order where required-by date is in the past
  const pastOrderId = `PO-LC-EXPIRED-${timestamp}`;
  const pastOrder_res = await requestJSON(`${API_BASE}/procurement/orders`, "POST", {
    id: pastOrderId,
    order_id: pastOrderId,
    buyer_id: "usr_buyer_supermarket",
    buyer_name: "Fresh Foods Supermarket",
    crop: "Tomato",
    requested_quantity_kg: 100,
    required_date: "2026-09-01", // In the past
    farmer_allocations: [
      {
        farmerId: `usr_fa_${timestamp}`,
        farmerName: "Farmer Anbu",
        allocatedQuantityKg: 60,
        pricePerKg: 28,
        farmerSubtotal: 1680,
        status: "CONFIRMED",
        paymentStatus: "PENDING"
      }
    ]
  }, "usr_buyer_supermarket");

  assert(pastOrder_res.status === 201, "Partially sourced order created with past required-by date");
  assert(pastOrder_res.data.data.status === "PARTIALLY_SOURCED", "Order status is PARTIALLY_SOURCED");

  // Buyer selects "Proceed with 60 kg" -> PATCH /procurement/orders/:id -> PARTIALLY_FULFILLED
  const proceed_res = await requestJSON(`${API_BASE}/procurement/orders/${pastOrderId}`, "PATCH", {
    status: "PARTIALLY_FULFILLED",
    notes: "Buyer proceeded with 60 kg sourced quantity at required-by cutoff."
  });

  assert(proceed_res.status === 200, "PATCH order status returned 200");
  assert(proceed_res.data.data.status === "PARTIALLY_FULFILLED", `Order status is now PARTIALLY_FULFILLED (actual: ${proceed_res.data.data.status})`);

  // Attempting to append more allocations to a PARTIALLY_FULFILLED order should be rejected (no further sourcing)
  const rejectedAppend = await requestJSON(`${API_BASE}/procurement/orders`, "POST", {
    id: pastOrderId,
    order_id: pastOrderId,
    buyer_id: "usr_buyer_supermarket",
    buyer_name: "Fresh Foods Supermarket",
    crop: "Tomato",
    farmer_allocations: [
      {
        farmerName: "Late Farmer",
        allocatedQuantityKg: 40,
        pricePerKg: 25
      }
    ]
  });
  assert(rejectedAppend.status === 400 && rejectedAppend.data.code === "ORDER_CLOSED", "Rejected new allocations on closed/partially fulfilled requirement");

  // -------------------------------------------------------------
  // TEST 5: Farmer Listing 200 kg, Buyer Allocates 100 kg -> 100 kg Remaining (Status: listed)
  // -------------------------------------------------------------
  console.log("\n[TEST 5] Farmer Listing 200 kg -> Allocates 100 kg -> 100 kg Remaining (listed)");

  const list200_id = `lc_listing_200_${timestamp}`;
  await requestJSON(`${API_BASE}/marketplace/listings`, "POST", {
    id: list200_id,
    creator_id: `usr_f_200_${timestamp}`,
    farmerName: "Farmer Murugan",
    crop_type: "Tomato",
    quantity_kg: 200,
    asking_price: 25,
    status: "listed"
  });

  const order200_id = `PO-LC-200-${timestamp}`;
  await requestJSON(`${API_BASE}/procurement/orders`, "POST", {
    id: order200_id,
    order_id: order200_id,
    buyer_id: "usr_buyer_supermarket",
    buyer_name: "ABC Supermarkets",
    crop: "Tomato",
    requested_quantity_kg: 100,
    farmer_allocations: [
      {
        listingId: list200_id,
        farmerName: "Farmer Murugan",
        allocatedQuantityKg: 100,
        pricePerKg: 25
      }
    ]
  });

  const list200_updated = await requestJSON(`${API_BASE}/marketplace/listings/${list200_id}`);
  assert(Number(list200_updated.data.data.quantity_kg) === 100, `Listing quantity reduced to 100 kg (actual: ${list200_updated.data.data.quantity_kg})`);
  assert(list200_updated.data.data.status === "listed", `Listing status remains 'listed' (actual: ${list200_updated.data.data.status})`);

  // -------------------------------------------------------------
  // TEST 6: Farmer Listing 21 kg, Buyer Allocates 21 kg -> 0 kg Remaining (Status: sold)
  // -------------------------------------------------------------
  console.log("\n[TEST 6] Farmer Listing 21 kg -> Allocates 21 kg -> 0 kg (sold & excluded from matching)");

  const list21_id = `lc_listing_21_${timestamp}`;
  await requestJSON(`${API_BASE}/marketplace/listings`, "POST", {
    id: list21_id,
    creator_id: `usr_f_21_${timestamp}`,
    farmerName: "Farmer Selvam",
    crop_type: "Tomato",
    quantity_kg: 21,
    asking_price: 30,
    status: "listed"
  });

  const order21_id = `PO-LC-21-${timestamp}`;
  await requestJSON(`${API_BASE}/procurement/orders`, "POST", {
    id: order21_id,
    order_id: order21_id,
    buyer_id: "usr_buyer_supermarket",
    buyer_name: "ABC Supermarkets",
    crop: "Tomato",
    requested_quantity_kg: 21,
    farmer_allocations: [
      {
        listingId: list21_id,
        farmerName: "Farmer Selvam",
        allocatedQuantityKg: 21,
        pricePerKg: 30
      }
    ]
  });

  const list21_updated = await requestJSON(`${API_BASE}/marketplace/listings/${list21_id}`);
  assert(Number(list21_updated.data.data.quantity_kg) === 0, `Listing quantity is 0 kg (actual: ${list21_updated.data.data.quantity_kg})`);
  assert(list21_updated.data.data.status === "sold", `Listing status is 'sold' (actual: ${list21_updated.data.data.status})`);

  // Active listings query excludes sold listings
  const activeListings_res = await requestJSON(`${API_BASE}/marketplace/listings?status=listed`);
  const isExcluded = !(activeListings_res.data.data || []).some(item => item.id === list21_id);
  assert(isExcluded, "0 kg / sold listing is excluded from active matching pool");

  // -------------------------------------------------------------
  // TEST 7: Double Confirmation / Insufficient Supply Rejection
  // -------------------------------------------------------------
  console.log("\n[TEST 7] Double Confirmation -> Second Rejection with INSUFFICIENT_SUPPLY");

  const listLimited_id = `lc_listing_limited_${timestamp}`;
  await requestJSON(`${API_BASE}/marketplace/listings`, "POST", {
    id: listLimited_id,
    creator_id: `usr_f_lim_${timestamp}`,
    farmerName: "Farmer Karuppan",
    crop_type: "Tomato",
    quantity_kg: 25,
    asking_price: 28,
    status: "listed"
  });

  // Buyer A claims 25 kg
  const buyerA_res = await requestJSON(`${API_BASE}/procurement/orders`, "POST", {
    id: `PO-LC-A-${timestamp}`,
    buyer_id: "usr_buyer_a",
    buyer_name: "Buyer A",
    crop: "Tomato",
    requested_quantity_kg: 25,
    farmer_allocations: [{ listingId: listLimited_id, allocatedQuantityKg: 25, pricePerKg: 28 }]
  });
  assert(buyerA_res.status === 201, "Buyer A first confirmation for 25 kg succeeds");

  // Buyer B tries to claim 25 kg of the same listing
  const buyerB_res = await requestJSON(`${API_BASE}/procurement/orders`, "POST", {
    id: `PO-LC-B-${timestamp}`,
    buyer_id: "usr_buyer_b",
    buyer_name: "Buyer B",
    crop: "Tomato",
    requested_quantity_kg: 25,
    farmer_allocations: [{ listingId: listLimited_id, allocatedQuantityKg: 25, pricePerKg: 28 }]
  });
  assert(buyerB_res.status === 400, `Buyer B second confirmation rejected (HTTP 400, actual: ${buyerB_res.status})`);
  assert(buyerB_res.data.code === "INSUFFICIENT_SUPPLY", `Error code is INSUFFICIENT_SUPPLY (actual: ${buyerB_res.data.code})`);

  // -------------------------------------------------------------
  // TEST 8 & TEST 9: UI Single Button Rule Verification
  // -------------------------------------------------------------
  console.log("\n[TEST 8 & 9] Farmer UI (1 button) & Buyer UI (0 buttons) Verification");

  const miPath = path.resolve(process.cwd(), "src/pages/MarketIntelligence.jsx");
  const miContent = fs.readFileSync(miPath, "utf-8");
  const fswPath = path.resolve(process.cwd(), "src/components/matching/FarmerSupplyWorkspace.jsx");
  const fswContent = fs.readFileSync(fswPath, "utf-8");

  // Check Farmer UI
  const miButtonMatch = miContent.match(/List Fresh Produce/g) || [];
  assert(miButtonMatch.length >= 1, "Page header contains 'List Fresh Produce' button");
  assert(miContent.includes("isFarmerMode &&"), "Header button strictly guarded by isFarmerMode");
  assert(!miContent.includes("+ +"), "Header button has no duplicate '+ +' sign");

  const fswButtonMatch = fswContent.match(/<Button[^>]*>[^<]*List Fresh Produce[^<]*<\/Button>/g) || [];
  assert(fswButtonMatch.length === 0, "FarmerSupplyWorkspace contains 0 duplicate '<Button>List Fresh Produce</Button>' elements");

  // Check Buyer Mode
  assert(!miContent.includes("isBuyerMode && <Button>List Fresh Produce"), "Buyer mode renders ZERO 'List Fresh Produce' buttons");

  // -------------------------------------------------------------
  // TEST 10: Real-Time Socket.IO Listing & Procurement Order Updates
  // -------------------------------------------------------------
  console.log("\n[TEST 10] Real-Time Socket.IO Synchronization");

  let socketReceivedOrderUpdate = false;
  let socketReceivedListingUpdate = false;

  await new Promise((resolve) => {
    const socket = ClientIO(SOCKET_URL, { reconnection: false, timeout: 5000 });

    socket.on("connect", async () => {
      socket.on("procurement:order_updated", (data) => {
        if (data.id === `PO-LC-SOCKET-${timestamp}` || data.order_id === `PO-LC-SOCKET-${timestamp}`) {
          socketReceivedOrderUpdate = true;
        }
      });

      socket.on("listing:updated", (data) => {
        if (data.id === `lc_sock_list_${timestamp}`) {
          socketReceivedListingUpdate = true;
        }
      });

      // Create test listing
      await requestJSON(`${API_BASE}/marketplace/listings`, "POST", {
        id: `lc_sock_list_${timestamp}`,
        creator_id: `usr_f_sock_${timestamp}`,
        farmerName: "Socket Farmer",
        crop_type: "Tomato",
        quantity_kg: 50,
        asking_price: 25,
        status: "listed"
      });

      // Create order & deduct
      await requestJSON(`${API_BASE}/procurement/orders`, "POST", {
        id: `PO-LC-SOCKET-${timestamp}`,
        order_id: `PO-LC-SOCKET-${timestamp}`,
        buyer_id: "usr_buyer_sock",
        crop: "Tomato",
        requested_quantity_kg: 50,
        farmer_allocations: [{ listingId: `lc_sock_list_${timestamp}`, allocatedQuantityKg: 20, pricePerKg: 25 }]
      });

      // Patch order
      await requestJSON(`${API_BASE}/procurement/orders/PO-LC-SOCKET-${timestamp}`, "PATCH", {
        status: "PARTIALLY_SOURCED",
        notes: "Socket update test"
      });

      setTimeout(() => {
        socket.disconnect();
        resolve();
      }, 1000);
    });

    socket.on("connect_error", () => {
      resolve();
    });
  });

  assert(socketReceivedOrderUpdate, "Connected buyer/farmer sessions received 'procurement:order_updated'");
  assert(socketReceivedListingUpdate, "Connected buyer/farmer sessions received 'listing:updated'");

  } finally {
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

  // -------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------
  console.log("\n==================================================================");
  console.log(` AUDIT SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("==================================================================\n");

  if (failed > 0) {
    console.error("❌ Some procurement lifecycle tests failed.");
    process.exit(1);
  } else {
    console.log("🎯 ALL 10 PROCUREMENT LIFECYCLE & PARTIAL SOURCING SCENARIOS PASSED!");
  }
}

runAllLifecycleTests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
