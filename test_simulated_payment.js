/**
 * Comprehensive Automated Verification Suite: Simulated Payment Lifecycle & Locked Platform Fee Formula
 *
 * Validates:
 * 1. Exact locked formula:
 *    Crop Value = Confirmed Quantity × Agreed Farmer Price
 *    Platform Fee Base = Crop Value - Rejection Risk
 *    Platform Fee = 3% × Platform Fee Base
 *    Final Net Procurement Value = Crop Value - Rejection Risk - Platform Fee
 * 2. Exact Example Verification:
 *    Confirmed quantity = 1,000 kg @ ₹28/kg
 *    Crop Value = ₹28,000
 *    Rejection Risk = ₹500
 *    Platform Fee Base = ₹27,500
 *    Platform Fee = 3% = ₹825
 *    Net Procurement Value = ₹26,675
 * 3. Transport is NOT included in calculations.
 * 4. Shrinkage is NOT included in calculations.
 * 5. Platform fee rate is FIXED at 3% (not 2%, not flat ₹).
 * 6. Partial fulfillment (60 / 100 kg) charges strictly for confirmed produce.
 * 7. Multi-farmer allocations calculation & simulation.
 * 8. Double payment prevention.
 * 9. UI validation: No Smart Logistics UI in payment flow.
 * 10. Clean database teardown in finally block.
 */

import fs from "fs";
import path from "path";
import { query } from "./backend/src/db/pool.js";
import {
  calculateProcurementFinancials,
  PLATFORM_FEE_RATE,
  ORDER_STATUS
} from "./src/services/smartMatchService.js";

const API_BASE = "http://localhost:5000/api/v1";

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

async function runPaymentSimulationTests() {
  console.log("==================================================================");
  console.log(" AGROCYCLE: SIMULATED PAYMENT & LOCKED PLATFORM FEE E2E TEST SUITE");
  console.log("==================================================================\n");

  const timestamp = Date.now();
  const createdListingIds = [
    `pay_f_example_${timestamp}`,
    `pay_f_100_${timestamp}`,
    `pay_f_a_${timestamp}`,
    `pay_f_b_${timestamp}`
  ];
  const createdOrderIds = [
    `PO-PAY-EXACT-${timestamp}`,
    `PO-PAY-FULL-${timestamp}`,
    `PO-PAY-PARTIAL-${timestamp}`,
    `PO-PAY-CLOSE-${timestamp}`
  ];

  try {
    // -------------------------------------------------------------
    // TEST 1: Pure Formula Verification (Exact Example from Prompt)
    // -------------------------------------------------------------
    console.log("[TEST 1] Pure Platform-Fee Formula & Example Verification");
    assert(PLATFORM_FEE_RATE === 0.03, "Platform fee rate is strictly 3% (0.03)");

    const exampleFin = calculateProcurementFinancials({
      confirmedQuantityKg: 1000,
      pricePerKg: 28,
      rejectionRisk: 500
    });

    console.log(`  -> Crop Value = ₹${exampleFin.cropValue}`);
    console.log(`  -> Rejection Risk = ₹${exampleFin.rejectionRisk}`);
    console.log(`  -> Platform Fee Base = ₹${exampleFin.platformFeeBase}`);
    console.log(`  -> Platform Fee (3%) = ₹${exampleFin.platformFee}`);
    console.log(`  -> Net Procurement Value = ₹${exampleFin.netProcurementValue}`);

    assert(exampleFin.cropValue === 28000, "Crop Value = 1,000 kg × ₹28/kg = ₹28,000");
    assert(exampleFin.rejectionRisk === 500, "Rejection Risk = ₹500");
    assert(exampleFin.platformFeeBase === 27500, "Platform Fee Base = ₹28,000 - ₹500 = ₹27,500");
    assert(exampleFin.platformFee === 825, "AgroCycle Platform Fee = 3% of ₹27,500 = ₹825");
    assert(exampleFin.netProcurementValue === 26675, "Net Procurement Value = ₹28,000 - ₹500 - ₹825 = ₹26,675");
    assert(!('transportCost' in exampleFin) && !('transport' in exampleFin), "Transport is NOT in financial calculation");
    assert(!('shrinkage' in exampleFin) && !('shrinkagePercent' in exampleFin), "Shrinkage is NOT in financial calculation");

    // -------------------------------------------------------------
    // TEST 2: End-to-End Database Order & Simulated Payment with 3% Platform Fee
    // -------------------------------------------------------------
    console.log("\n[TEST 2] End-to-End Order Creation & Payment Simulation for Example (1,000 kg Tomato)");

    // 1. Create 1,000 kg farmer listing
    const listEx_res = await requestJSON(`${API_BASE}/marketplace/listings`, "POST", {
      id: `pay_f_example_${timestamp}`,
      creator_id: `usr_pay_fe_${timestamp}`,
      farmerName: "Farmer Ramasamy",
      crop_type: "Tomato",
      quantity_kg: 1000,
      asking_price: 28,
      condition: "fresh",
      location: "Melur Road, Madurai",
      listing_type: "sell",
      status: "listed"
    }, `usr_pay_fe_${timestamp}`);
    assert(listEx_res.status === 201, "Created 1,000 kg farmer listing @ ₹28/kg");

    // 2. Create procurement order with 1,000 kg Tomato
    const orderIdEx = `PO-PAY-EXACT-${timestamp}`;
    const orderEx_res = await requestJSON(`${API_BASE}/procurement/orders`, "POST", {
      id: orderIdEx,
      order_id: orderIdEx,
      buyer_id: "usr_buyer_supermarket",
      buyer_name: "FreshMart Supermarkets",
      crop: "Tomato",
      category: "Vegetable",
      requested_quantity_kg: 1000,
      quality_grade: "Grade A",
      required_date: "2026-10-15",
      summary: {
        rejectionRisk: 500
      },
      farmer_allocations: [
        {
          listingId: `pay_f_example_${timestamp}`,
          farmerId: `usr_pay_fe_${timestamp}`,
          farmerName: "Farmer Ramasamy",
          allocatedQuantityKg: 1000,
          pricePerKg: 28,
          farmerSubtotal: 28000,
          qualityGrade: "Grade A",
          status: "CONFIRMED",
          paymentStatus: "PENDING"
        }
      ]
    }, "usr_buyer_supermarket");
    assert(orderEx_res.status === 201, "Created 1,000 kg procurement order in PostgreSQL");

    // 3. Simulate payment with rejectionRisk = 500
    const payEx_res = await requestJSON(`${API_BASE}/procurement/orders/${orderIdEx}/simulate-payment`, "POST", {
      payment_method: "UPI",
      rejection_risk: 500
    });
    assert(payEx_res.status === 200, "Simulated payment endpoint returned HTTP 200");
    const payExData = payEx_res.data.data.procurement_summary;
    assert(payExData.paymentStatus === "PAID_SIMULATED", "Payment status is PAID_SIMULATED");
    assert(payExData.cropValue === 28000, "Summary records Crop Value = ₹28,000");
    assert(payExData.rejectionRisk === 500, "Summary records Rejection Risk = ₹500");
    assert(payExData.platformFeeBase === 27500, "Summary records Platform Fee Base = ₹27,500");
    assert(payExData.platformFee === 825, "Summary records Platform Fee (3%) = ₹825");
    assert(payExData.netProcurementValue === 26675, "Summary records Net Procurement Value = ₹26,675");
    assert(payExData.amountPaid === 26675, "Amount paid matches Net Procurement Value = ₹26,675");
    assert(payExData.paymentReference.startsWith("SIM-PAY-"), "Payment reference generated: " + payExData.paymentReference);

    // -------------------------------------------------------------
    // TEST 3: Multi-Farmer Partial Fulfilment Payment (60 / 100 kg)
    // -------------------------------------------------------------
    console.log("\n[TEST 3] Multi-Farmer Partial Fulfilment (60/100 kg) & 3% Fee Formula");

    const listA_res = await requestJSON(`${API_BASE}/marketplace/listings`, "POST", {
      id: `pay_f_a_${timestamp}`,
      creator_id: `usr_pay_fa_${timestamp}`,
      farmerName: "Farmer A",
      crop_type: "Tomato",
      quantity_kg: 30,
      asking_price: 28,
      condition: "fresh",
      status: "listed"
    }, `usr_pay_fa_${timestamp}`);
    assert(listA_res.status === 201, "Farmer A listing created (30 kg @ ₹28/kg = ₹840)");

    const listB_res = await requestJSON(`${API_BASE}/marketplace/listings`, "POST", {
      id: `pay_f_b_${timestamp}`,
      creator_id: `usr_pay_fb_${timestamp}`,
      farmerName: "Farmer B",
      crop_type: "Tomato",
      quantity_kg: 30,
      asking_price: 27,
      condition: "fresh",
      status: "listed"
    }, `usr_pay_fb_${timestamp}`);
    assert(listB_res.status === 201, "Farmer B listing created (30 kg @ ₹27/kg = ₹810)");

    const orderId2 = `PO-PAY-PARTIAL-${timestamp}`;
    const order2_res = await requestJSON(`${API_BASE}/procurement/orders`, "POST", {
      id: orderId2,
      order_id: orderId2,
      buyer_id: "usr_buyer_partial",
      buyer_name: "ABC Foods",
      crop: "Tomato",
      requested_quantity_kg: 100,
      farmer_allocations: [
        {
          listingId: `pay_f_a_${timestamp}`,
          farmerId: `usr_pay_fa_${timestamp}`,
          farmerName: "Farmer A",
          allocatedQuantityKg: 30,
          pricePerKg: 28,
          farmerSubtotal: 840,
          paymentStatus: "PENDING"
        },
        {
          listingId: `pay_f_b_${timestamp}`,
          farmerId: `usr_pay_fb_${timestamp}`,
          farmerName: "Farmer B",
          allocatedQuantityKg: 30,
          pricePerKg: 27,
          farmerSubtotal: 810,
          paymentStatus: "PENDING"
        }
      ]
    }, "usr_buyer_partial");
    assert(order2_res.status === 201, "Created partial order (60 kg confirmed)");

    // Total Crop Value = 840 + 810 = 1,650
    // Rejection Risk = 0
    // Platform Fee = 3% of 1,650 = 50 (rounded)
    // Net Value = 1,650 - 50 = 1,600
    const pay2_res = await requestJSON(`${API_BASE}/procurement/orders/${orderId2}/simulate-payment`, "POST", {
      payment_method: "CARD",
      rejection_risk: 0
    });
    assert(pay2_res.status === 200, "Simulated payment successful for multi-farmer order");
    const pay2Data = pay2_res.data.data.procurement_summary;
    assert(pay2Data.cropValue === 1650, "Crop Value is strictly ₹1,650 (never charging for missing 40 kg)");
    assert(pay2Data.platformFee === Math.round(1650 * 0.03), "Platform fee is 3% of ₹1,650 = ₹50");
    assert(pay2Data.netProcurementValue === 1650 - 50, "Net Procurement Value is ₹1,600");
    assert(pay2Data.amountPaid === 1600, "Amount paid is strictly ₹1,600");

    // -------------------------------------------------------------
    // TEST 4: Double Payment Prevention
    // -------------------------------------------------------------
    console.log("\n[TEST 4] Double Payment Prevention");
    const repeatPay_res = await requestJSON(`${API_BASE}/procurement/orders/${orderId2}/simulate-payment`, "POST", {
      payment_method: "UPI"
    });
    assert(repeatPay_res.status === 200, "Repeat payment call handled safely");
    assert(repeatPay_res.data.data.procurement_summary.amountPaid === 1600, "Amount paid remains ₹1,600 without double charge");

    // -------------------------------------------------------------
    // TEST 5: UI Inspection (Verify No Active Smart Logistics UI in Payment Flow)
    // -------------------------------------------------------------
    console.log("\n[TEST 5] UI Code Inspection & Logistics Separation");

    const paymentPageCode = fs.readFileSync(path.resolve("src/pages/Payment.jsx"), "utf-8");
    assert(paymentPageCode.includes("CROP VALUE"), "Payment page shows 'CROP VALUE'");
    assert(paymentPageCode.includes("REJECTION RISK"), "Payment page shows 'REJECTION RISK'");
    assert(paymentPageCode.includes("AGROCYCLE PLATFORM FEE (3%)"), "Payment page shows 'AGROCYCLE PLATFORM FEE (3%)'");
    assert(paymentPageCode.includes("NET PROCUREMENT VALUE"), "Payment page shows 'NET PROCUREMENT VALUE'");
    assert(!paymentPageCode.includes("shrinkage"), "Payment page does NOT contain shrinkage");
    assert(!paymentPageCode.includes("calculateHaversineDistanceKm"), "Payment page does NOT calculate transit routing");
    assert(!paymentPageCode.includes("assignedDriver"), "Payment page does NOT contain vehicle/driver assignment controls");

    const layoutCode = fs.readFileSync(path.resolve("src/components/Layout.jsx"), "utf-8");
    assert(!layoutCode.includes('path: "/smart-logistics"'), "Layout navigation excludes /smart-logistics");

    const appCode = fs.readFileSync(path.resolve("src/App.jsx"), "utf-8");
    assert(!appCode.includes('path="/smart-logistics"'), "App.jsx routes exclude /smart-logistics");

    const backendAppCode = fs.readFileSync(path.resolve("backend/src/app.js"), "utf-8");
    assert(!backendAppCode.includes('apiRouter.use(logisticsRoutes)'), "Backend app.js does not mount logisticsRoutes");

  } finally {
    console.log("\n🧹 [CLEANUP] Removing test listings and test procurement orders from PostgreSQL...");
    try {
      if (createdListingIds.length > 0) {
        const delList = await query("DELETE FROM marketplace_listings WHERE id = ANY($1)", [createdListingIds]);
        console.log(`  ✅ Cleaned up ${delList.rowCount} test listing(s).`);
      }
      if (createdOrderIds.length > 0) {
        const delOrders = await query("DELETE FROM procurement_orders WHERE id = ANY($1)", [createdOrderIds]);
        console.log(`  ✅ Cleaned up ${delOrders.rowCount} test procurement order(s).`);
      }
      console.log("  ✅ PostgreSQL database is completely clean.");
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

runPaymentSimulationTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
