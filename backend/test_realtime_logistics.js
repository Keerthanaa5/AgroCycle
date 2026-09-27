/**
 * AgroCycle Real-Time Logistics & Security Automated Test Suite
 *
 * Validates:
 * 1. Multi-farmer & Multi-buyer shipment creation
 * 2. Driver authorization and assignment
 * 3. Driver GPS coordinate ingestion & validation
 * 4. Security: Unauthorized driver location update rejection (403)
 * 5. Security: Unauthorized farmer/buyer tracking access rejection (403)
 * 6. Privacy: Strict zero-raw-coordinate guarantee for farmers and buyers
 * 7. Real-Time Socket.IO room authorization & rejection of unauthorized subscribers
 * 8. Real-Time live location broadcast over WebSocket
 * 9. Shipment state machine transitions & invalid transition rejection
 * 10. Multi-stop pickup and delivery progression
 */

import http from 'http';
import { io as ioClient } from 'socket.io-client';
import app from './src/app.js';
import { initSocket } from './src/realtime/socketManager.js';
import { closePool, query } from './src/db/pool.js';

const TEST_PORT = 5099;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

let server;
let socketServer;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(message);
  }
  console.log(`✅ [PASS] ${message}`);
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data: json?.data, json };
}

async function runTests() {
  console.log('===========================================================');
  console.log('AGROCYCLE REAL-TIME LOGISTICS & GPS SECURITY TEST SUITE');
  console.log('===========================================================');

  server = http.createServer(app);
  socketServer = initSocket(server, { origin: '*' });

  await new Promise((resolve) => {
    server.listen(TEST_PORT, () => {
      console.log(`[Test Server] Running on port ${TEST_PORT}`);
      resolve();
    });
  });

  const testId = Date.now();
  const testShipmentId = `shipment_test_${testId}`;
  const driverUserId = `usr_driver_test_${testId}`;
  const driverId = `drv_test_${testId}`;
  const farmer1UserId = `usr_farmer_1_${testId}`;
  const farmer2UserId = `usr_farmer_2_${testId}`;
  const buyer1UserId = `usr_buyer_a_${testId}`;
  const buyer2UserId = `usr_buyer_b_${testId}`;
  const unauthorizedUserId = `usr_unauthorized_99_${testId}`;

  try {
    // --- 0. Setup Test Drivers & Users in DB ---
    console.log('\n--- 1. Driver & Catalog Setup ---');
    await query(`
      INSERT INTO users (user_id, display_name, phone, roles, active_role)
      VALUES 
        ($1, 'Test Ravi Driver', '9876543210', '{"driver"}', 'driver'),
        ($2, 'Farmer Ramu', '9876543215', '{"farmer"}', 'farmer'),
        ($3, 'Farmer Murugan', '9876543216', '{"farmer"}', 'farmer'),
        ($4, 'Wholesale Buyer A', '9876543217', '{"buyer"}', 'buyer'),
        ($5, 'Wholesale Buyer B', '9876543218', '{"buyer"}', 'buyer')
      ON CONFLICT (user_id) DO NOTHING
    `, [driverUserId, farmer1UserId, farmer2UserId, buyer1UserId, buyer2UserId]);

    await query(`
      INSERT INTO logistics_drivers (driver_id, user_id, name, phone, status, current_latitude, current_longitude)
      VALUES ($1, $2, 'Test Ravi Driver', '9876543210', 'available', 9.9252, 78.1198)
    `, [driverId, driverUserId]);

    await query(`
      INSERT INTO logistics_vehicles (vehicle_id, driver_id, vehicle_type, registration_number, capacity_kg, base_rate_per_km, status)
      VALUES ($1, $2, '12-ton Heavy Truck', 'TN-58-TEST', 12000, 60.00, 'available')
    `, [`veh_test_${testId}`, driverId]);

    const catalogRes = await request('/logistics/drivers-vehicles');
    assert(catalogRes.status === 200, 'Drivers & vehicles catalog retrieved');
    assert(catalogRes.data.drivers.length > 0, 'Catalog contains active drivers');

    // --- 1. Create Multi-Farmer & Multi-Buyer Consolidated Shipment ---
    console.log('\n--- 2. Multi-Farmer & Multi-Buyer Shipment Creation ---');
    const shipmentPayload = {
      shipmentId: testShipmentId,
      driverId: driverId,
      vehicleId: `veh_test_${testId}`,
      crop: 'Tomato',
      totalQuantityKg: 10000,
      vehicleCapacityKg: 12000,
      vehicleUtilizationPercent: 83.33,
      estimatedDistanceKm: 48.5,
      estimatedTransportCost: 2910,
      transportCostPerKg: 0.291,
      status: 'DRIVER_ASSIGNED',
      buyerAllocations: [
        {
          buyerId: buyer1UserId,
          buyerName: 'Wholesale Buyer A',
          cropRequired: 'Tomato',
          quantityKg: 7000,
          targetPricePerKg: 30,
          deliveryLocation: 'Madurai Central Cold Hub',
          deliveryCoordinates: { lat: 9.939, lng: 78.138 }
        },
        {
          buyerId: buyer2UserId,
          buyerName: 'Wholesale Buyer B',
          cropRequired: 'Tomato',
          quantityKg: 3000,
          targetPricePerKg: 31,
          deliveryLocation: 'Dindigul Processing Plant',
          deliveryCoordinates: { lat: 10.367, lng: 77.980 }
        }
      ],
      farmerAllocations: [
        {
          farmerId: farmer1UserId,
          farmerName: 'Farmer Ramu',
          allocatedQuantityKg: 6000,
          agreedPricePerKg: 28,
          pickupLocation: 'Vadipatti Farm Cluster',
          pickupCoordinates: { lat: 10.052, lng: 77.925 },
          transportShareRupees: 1746,
          netExpectedValue: { grossCropRevenue: 168000, netExpectedValueRupees: 164000 }
        },
        {
          farmerId: farmer2UserId,
          farmerName: 'Farmer Murugan',
          allocatedQuantityKg: 4000,
          agreedPricePerKg: 28,
          pickupLocation: 'Alanganallur Plot',
          pickupCoordinates: { lat: 10.043, lng: 78.089 },
          transportShareRupees: 1164,
          netExpectedValue: { grossCropRevenue: 112000, netExpectedValueRupees: 109000 }
        }
      ],
      route: {
        totalStops: 5,
        stops: [
          { stopIndex: 0, type: 'DRIVER_START', location: 'Driver Depot', coordinates: { lat: 9.925, lng: 78.119 } },
          { stopIndex: 1, type: 'PICKUP', id: farmer1UserId, name: 'Farmer Ramu', coordinates: { lat: 10.052, lng: 77.925 }, quantityKg: 6000, cumulativeLoadKg: 6000 },
          { stopIndex: 2, type: 'PICKUP', id: farmer2UserId, name: 'Farmer Murugan', coordinates: { lat: 10.043, lng: 78.089 }, quantityKg: 4000, cumulativeLoadKg: 10000 },
          { stopIndex: 3, type: 'DELIVERY', id: buyer1UserId, name: 'Buyer A Depot', coordinates: { lat: 9.939, lng: 78.138 }, quantityKg: 7000, cumulativeLoadKg: 3000 },
          { stopIndex: 4, type: 'DELIVERY', id: buyer2UserId, name: 'Buyer B Depot', coordinates: { lat: 10.367, lng: 77.980 }, quantityKg: 3000, cumulativeLoadKg: 0 }
        ]
      }
    };

    const createRes = await request('/logistics/shipments', {
      method: 'POST',
      body: shipmentPayload
    });

    assert(createRes.status === 201, 'Consolidated multi-buyer shipment created with 201 status');
    assert(createRes.data.shipment_id === testShipmentId, 'Shipment ID matches created ID');
    assert(createRes.data.total_quantity_kg === '10000.00', 'Total shipment quantity is 10,000 kg');

    // --- 2. Driver Real GPS Location Ingestion ---
    console.log('\n--- 3. Driver Real GPS Ingestion & Validation ---');
    const validGps = {
      latitude: 9.9405,
      longitude: 78.1250,
      accuracy: 8.5,
      speed: 38.0,
      heading: 180,
      timestamp: new Date().toISOString()
    };

    const gpsRes = await request(`/shipments/${testShipmentId}/location`, {
      method: 'POST',
      headers: { 'x-user-id': driverUserId, 'x-user-role': 'driver' },
      body: validGps
    });

    assert(gpsRes.status === 200, 'Valid driver GPS update accepted with 200 OK');
    assert(gpsRes.json.data.broadcasted === true, 'Location marked as broadcasted');

    // Coordinate Bounds Validation Check
    const invalidGps = {
      latitude: 195.0, // Out of bounds (> 90)
      longitude: 78.1250
    };
    const invalidGpsRes = await request(`/shipments/${testShipmentId}/location`, {
      method: 'POST',
      headers: { 'x-user-id': driverUserId, 'x-user-role': 'driver' },
      body: invalidGps
    });
    assert(invalidGpsRes.status === 400, 'Invalid latitude (> 90) rejected with 400 Validation Error');

    // --- 3. Security Tests: Unauthorized Driver Location Update ---
    console.log('\n--- 4. Security Tests: Driver Authorization ---');
    const unauthorizedGpsRes = await request(`/shipments/${testShipmentId}/location`, {
      method: 'POST',
      headers: { 'x-user-id': unauthorizedUserId, 'x-user-role': 'driver' },
      body: validGps
    });
    assert(unauthorizedGpsRes.status === 403, 'Unauthorized driver GPS update rejected with 403 Forbidden');
    assert(unauthorizedGpsRes.json.code === 'FORBIDDEN_DRIVER_MISMATCH', 'Error code is FORBIDDEN_DRIVER_MISMATCH');

    // --- 4. Security & Privacy Tests: Tracking Access & Coordinate Sanitization ---
    console.log('\n--- 5. Security & Privacy: Zero Raw GPS Leakage ---');
    // A. Unauthorized User Access Rejection
    const unauthTrackRes = await request(`/shipments/${testShipmentId}/tracking`, {
      headers: { 'x-user-id': unauthorizedUserId, 'x-user-role': 'farmer' }
    });
    assert(unauthTrackRes.status === 403, 'Unauthorized user access to tracking rejected with 403 Forbidden');

    // B. Authorized Farmer Tracking Request (MUST NOT have raw coordinates)
    const farmerTrackRes = await request(`/shipments/${testShipmentId}/tracking`, {
      headers: { 'x-user-id': farmer1UserId, 'x-user-role': 'farmer' }
    });
    assert(farmerTrackRes.status === 200, 'Authorized farmer tracking retrieved with 200 OK');
    assert(farmerTrackRes.data.hasGpsFix === true, 'Farmer receives GPS fix status');
    assert(farmerTrackRes.data.driverCoordinates === undefined, 'Farmer payload contains NO raw driver coordinates');
    assert(farmerTrackRes.data.latitude === undefined, 'Farmer payload contains NO raw latitude property');
    assert(farmerTrackRes.data.longitude === undefined, 'Farmer payload contains NO raw longitude property');
    assert(typeof farmerTrackRes.data.estimatedRemainingDistanceKm === 'number', 'Farmer receives estimated remaining distance');
    assert(typeof farmerTrackRes.data.estimatedEtaMinutes === 'number', 'Farmer receives estimated ETA in minutes');

    // C. Authorized Buyer Tracking Request (MUST NOT have raw coordinates)
    const buyerTrackRes = await request(`/shipments/${testShipmentId}/tracking`, {
      headers: { 'x-user-id': buyer1UserId, 'x-user-role': 'buyer' }
    });
    assert(buyerTrackRes.status === 200, 'Authorized buyer tracking retrieved with 200 OK');
    assert(buyerTrackRes.data.driverCoordinates === undefined, 'Buyer payload contains NO raw driver coordinates');

    // D. Driver Tracking Request (DOES have driverCoordinates)
    const driverTrackRes = await request(`/shipments/${testShipmentId}/tracking`, {
      headers: { 'x-user-id': driverUserId, 'x-user-role': 'driver' }
    });
    assert(driverTrackRes.status === 200, 'Authorized driver tracking retrieved with 200 OK');
    assert(driverTrackRes.data.driverCoordinates !== undefined, 'Driver payload contains raw driver coordinates for dashboard view');
    assert(driverTrackRes.data.driverCoordinates.latitude === 9.9405, 'Driver latitude matches updated GPS position');

    // --- 5. Real-Time Socket.IO Room Authorization & Broadcast ---
    console.log('\n--- 6. WebSocket / Socket.IO Live Room Authorization ---');
    const socketUrl = `http://localhost:${TEST_PORT}`;

    // A. Unauthorized Client Subscription Rejection
    const unauthSocket = ioClient(socketUrl, { autoConnect: true });
    await new Promise((resolve) => {
      unauthSocket.on('connect', () => {
        unauthSocket.emit('subscribe:shipment', {
          shipmentId: testShipmentId,
          userId: unauthorizedUserId
        });
      });
      unauthSocket.on('subscription:error', (err) => {
        assert(err.code === 'UNAUTHORIZED_SHIPMENT_SUBSCRIPTION', 'Socket server rejected unauthorized subscriber over WebSocket');
        unauthSocket.disconnect();
        resolve();
      });
    });

    // B. Authorized Farmer Subscription & Live Broadcast Ingestion
    const farmerSocket = ioClient(socketUrl, { autoConnect: true });
    let receivedLiveBroadcast = false;

    await new Promise((resolve) => {
      farmerSocket.on('connect', () => {
        farmerSocket.emit('subscribe:shipment', {
          shipmentId: testShipmentId,
          userId: farmer1UserId
        });
      });

      farmerSocket.on('subscription:success', async (subData) => {
        assert(subData.role === 'farmer', 'Farmer successfully subscribed to WebSocket shipment room');
        
        // Driver sends another GPS movement
        await request(`/shipments/${testShipmentId}/location`, {
          method: 'POST',
          headers: { 'x-user-id': driverUserId, 'x-user-role': 'driver' },
          body: {
            latitude: 9.9510,
            longitude: 78.1320,
            accuracy: 6.0,
            speed: 42.0,
            heading: 190,
            timestamp: new Date().toISOString()
          }
        });
      });

      farmerSocket.on('shipment:location_update', (liveData) => {
        assert(liveData.shipmentId === testShipmentId, 'Farmer received live location update broadcast over WebSocket');
        assert(liveData.driverCoordinates === undefined, 'Live broadcast contains NO raw coordinates for farmer');
        assert(liveData.speedKmh === 42, 'Live broadcast contains sanitized speed metric');
        receivedLiveBroadcast = true;
        farmerSocket.disconnect();
        resolve();
      });
    });

    assert(receivedLiveBroadcast, 'Real-time WebSocket location broadcast pipeline verified');

    // --- 6. State Machine Transitions ---
    console.log('\n--- 7. State Machine Status Transitions ---');
    // Valid transition: DRIVER_ASSIGNED -> IN_TRANSIT
    const statusRes1 = await request(`/shipments/${testShipmentId}/status`, {
      method: 'PATCH',
      headers: { 'x-user-id': driverUserId, 'x-user-role': 'driver' },
      body: { status: 'IN_TRANSIT' }
    });
    assert(statusRes1.status === 200, 'Shipment transitioned to IN_TRANSIT');
    assert(statusRes1.data.status === 'IN_TRANSIT', 'DB status updated to IN_TRANSIT');

    // Invalid transition: IN_TRANSIT -> MATCHED (cannot go backward)
    const invalidStatusRes = await request(`/shipments/${testShipmentId}/status`, {
      method: 'PATCH',
      headers: { 'x-user-id': driverUserId, 'x-user-role': 'driver' },
      body: { status: 'MATCHED' }
    });
    assert(invalidStatusRes.status === 400, 'Illegal state transition rejected with 400 Bad Request');
    assert(invalidStatusRes.json.code === 'INVALID_STATE_TRANSITION', 'Error code is INVALID_STATE_TRANSITION');

    // --- 7. Stop Progress Progression ---
    console.log('\n--- 8. Multi-Stop Pickup & Delivery Progression ---');
    // Stop 1: Pickup 1 Arrived & Completed
    const stopRes1 = await request(`/shipments/${testShipmentId}/stops/1`, {
      method: 'PATCH',
      headers: { 'x-user-id': driverUserId, 'x-user-role': 'driver' },
      body: { status: 'ARRIVED' }
    });
    assert(stopRes1.status === 200, 'Stop 1 status updated to ARRIVED');
    assert(stopRes1.data.status === 'ARRIVED', 'Stop 1 reflects ARRIVED');

    const stopRes2 = await request(`/shipments/${testShipmentId}/stops/1`, {
      method: 'PATCH',
      headers: { 'x-user-id': driverUserId, 'x-user-role': 'driver' },
      body: { status: 'COMPLETED' }
    });
    assert(stopRes2.status === 200, 'Stop 1 status updated to COMPLETED');
    assert(stopRes2.data.completion_time !== null, 'Stop 1 records completion_time');

    // Complete shipment: IN_TRANSIT -> DELIVERED
    const deliveredRes = await request(`/shipments/${testShipmentId}/status`, {
      method: 'PATCH',
      headers: { 'x-user-id': driverUserId, 'x-user-role': 'driver' },
      body: { status: 'DELIVERED' }
    });
    assert(deliveredRes.status === 200, 'Shipment successfully completed with status DELIVERED');

    // Clean up test records
    await query('DELETE FROM logistics_shipments WHERE shipment_id = $1', [testShipmentId]);
    await query('DELETE FROM logistics_drivers WHERE driver_id = $1', [driverId]);
    await query('DELETE FROM logistics_vehicles WHERE vehicle_id = $1', [`veh_test_${testId}`]);

    console.log('\n===========================================================');
    console.log('>>> ALL 18 REAL-TIME LOGISTICS & SECURITY TESTS PASSED! <<<');
    console.log('===========================================================');

  } catch (err) {
    console.error('Test run error:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    await closePool();
  }
}

runTests();
