/**
 * AgroCycle Complete System Integration Test Suite
 *
 * Automated end-to-end integration tests covering:
 * 1. Health & Database Connectivity
 * 2. User Accounts & Role Profiles
 * 3. Farms & GPS Coordinates
 * 4. Viability Assessments (Scanner Engine)
 * 5. Assessment Handoff -> Marketplace Listings with Foreign Keys
 * 6. Buyer Marketplace Discovery
 * 7. Security & Authorization Enforcement
 * 8. AgroConnect Community & Farmer-to-Farmer Connections
 * 9. Smart Logistics Load Consolidation & Multi-Stop Routing
 * 10. Real-time Driver GPS Telemetry & Privacy Partitioning
 * 11. Silage Bank Hubs & Bookings
 * 12. Carbon Cash Activities & Anti-Self-Sponsorship Offers
 * 13. Claim Rocket Dossier Creation & AI Burden Reports
 * 14. Real-Time Socket.IO Multi-Client Broadcasts
 * 15. Offline Sync Gateway & Idempotency Logs
 */

import { io } from 'socket.io-client';
import { query } from './backend/src/db/pool.js';

const API_BASE_URL = 'http://localhost:5000/api/v1';
const SOCKET_URL = 'http://localhost:5000';

const results = [];

function recordTest(suite, testName, status, details = '') {
  const result = { suite, testName, status, details, timestamp: new Date().toISOString() };
  results.push(result);
  const icon = status === 'PASS' ? '🟢 PASS' : (status === 'FAIL' ? '🔴 FAIL' : '⚪ NOT_IMPLEMENTED');
  console.log(`${icon} [${suite}] ${testName}${details ? ` -> ${details}` : ''}`);
}

async function request(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers || {})
  };

  const res = await fetch(fullUrl, {
    ...options,
    headers,
    body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined
  });

  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, ok: res.ok, data };
}

async function runAllTests() {
  console.log('================================================================');
  console.log('🚀 AGROCYCLE END-TO-END SYSTEM INTEGRATION TEST SUITE');
  console.log(`Target Backend: ${API_BASE_URL}`);
  console.log(`Target Socket Server: ${SOCKET_URL}`);
  console.log('================================================================\n');

  const testTimestamp = Date.now();
  const farmerAId = `usr_farmer_ramesh_${testTimestamp}`;
  const farmerBId = `usr_farmer_suresh_${testTimestamp}`;
  const buyerAId = `usr_buyer_vaigai_${testTimestamp}`;
  const driverAId = `drv_ravi_${testTimestamp}`;

  // ============================================================================
  // SUITE 1: System Health & Database
  // ============================================================================
  console.log('\n--- 1. SYSTEM HEALTH & POSTGRESQL CONNECTIVITY ---');
  try {
    const health = await request('http://localhost:5000/api/health');
    if (health.ok && health.data.status === 'ok') {
      recordTest('Health', 'Backend API Health Check', 'PASS', `Status: ${health.data.status}`);
    } else {
      recordTest('Health', 'Backend API Health Check', 'FAIL', `HTTP ${health.status}`);
    }

    const dbHealth = await request('http://localhost:5000/api/health/db');
    if (dbHealth.ok && dbHealth.data.database === 'connected') {
      recordTest('Health', 'PostgreSQL Database Connectivity', 'PASS', `Database: ${dbHealth.data.database}`);
    } else {
      recordTest('Health', 'PostgreSQL Database Connectivity', 'FAIL', `HTTP ${dbHealth.status}`);
    }
  } catch (err) {
    recordTest('Health', 'Backend Connectivity', 'FAIL', err.message);
  }

  // ============================================================================
  // SUITE 2: User Accounts & Profiles
  // ============================================================================
  console.log('\n--- 2. USERS & ROLES ---');
  try {
    const farmerRes = await request('/users', {
      method: 'POST',
      body: {
        userId: farmerAId,
        display_name: 'Ramesh Kumar',
        phone: '9876543201',
        roles: ['farmer'],
        active_role: 'farmer',
        verification_status: 'verified',
        language: 'tamil'
      }
    });

    if (farmerRes.ok && farmerRes.data.data.user_id === farmerAId) {
      recordTest('Users', 'Create/Upsert Farmer User', 'PASS', `Created user_id: ${farmerAId}`);
    } else {
      recordTest('Users', 'Create/Upsert Farmer User', 'FAIL', JSON.stringify(farmerRes.data));
    }

    const buyerRes = await request('/users', {
      method: 'POST',
      body: {
        userId: buyerAId,
        display_name: 'Vaigai Food Processors',
        phone: '9876543202',
        roles: ['buyer'],
        active_role: 'buyer',
        verification_status: 'verified',
        language: 'english'
      }
    });

    if (buyerRes.ok && buyerRes.data.data.user_id === buyerAId) {
      recordTest('Users', 'Create/Upsert Buyer User', 'PASS', `Created user_id: ${buyerAId}`);
    } else {
      recordTest('Users', 'Create/Upsert Buyer User', 'FAIL', JSON.stringify(buyerRes.data));
    }
  } catch (err) {
    recordTest('Users', 'User Creation', 'FAIL', err.message);
  }

  // ============================================================================
  // SUITE 3: Farms & Location
  // ============================================================================
  console.log('\n--- 3. FARMS & LOCATIONS ---');
  try {
    const locRes = await request('/locations', {
      method: 'POST',
      body: {
        userId: farmerAId,
        farmId: 'farm_east_01',
        farmName: 'Madurai East Organic Plot',
        latitude: 9.9412,
        longitude: 78.1385,
        accuracy: 5.0,
        city: 'Madurai',
        district: 'Madurai',
        state: 'Tamil Nadu',
        isDefault: true
      }
    });

    if (locRes.ok && locRes.data.data.farm_name === 'Madurai East Organic Plot') {
      recordTest('Location', 'Save Farm Location', 'PASS', 'Saved with GPS 9.9412, 78.1385');
    } else {
      recordTest('Location', 'Save Farm Location', 'FAIL', JSON.stringify(locRes.data));
    }

    const getLoc = await request(`/locations/${farmerAId}`);
    if (getLoc.ok && getLoc.data.data.length > 0) {
      recordTest('Location', 'Fetch User Locations', 'PASS', `Found ${getLoc.data.data.length} location(s)`);
    } else {
      recordTest('Location', 'Fetch User Locations', 'FAIL', JSON.stringify(getLoc.data));
    }
  } catch (err) {
    recordTest('Location', 'Location Operations', 'FAIL', err.message);
  }

  // ============================================================================
  // SUITE 4: Viability Scanner & Field Assessments
  // ============================================================================
  console.log('\n--- 4. FIELD ASSESSMENTS ---');
  const assessmentId = `vs_test_${testTimestamp}`;
  try {
    const assessRes = await request('/assessments', {
      method: 'POST',
      body: {
        id: assessmentId,
        userId: farmerAId,
        cropName: 'Tomato',
        cultivatedAcres: 2.5,
        condition: 'damaged',
        primaryDisease: 'Early Blight',
        severityScore: 42.5,
        confidence: 0.88,
        visualCoverage: 35.0,
        visualDiseaseBurden: 42.5,
        samples: [
          { zone: 'centre', primaryDisease: 'Early Blight', confidence: 0.91, image: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' },
          { zone: 'north', primaryDisease: 'Early Blight', confidence: 0.85, image: null }
        ],
        recommendation: {
          feature: 'Urban Waste Matcher',
          action: 'Sell to food processing units or pulp factories',
          reason: 'Severe leaf blight detected but tomato pulp remains viable for processing.'
        },
        commercialContext: {
          availableQuantity: 1200,
          expectedPrice: 18,
          village: 'Madurai East'
        },
        location: {
          latitude: 9.9412,
          longitude: 78.1385,
          district: 'Madurai',
          state: 'Tamil Nadu'
        }
      }
    });

    if (assessRes.ok && assessRes.data.data.id === assessmentId) {
      recordTest('ViabilityScanner', 'Persist Field Assessment', 'PASS', `Saved assessment ${assessmentId}`);
    } else {
      recordTest('ViabilityScanner', 'Persist Field Assessment', 'FAIL', JSON.stringify(assessRes.data));
    }

    const getAssess = await request(`/assessments/${assessmentId}`);
    if (getAssess.ok && getAssess.data.data.crop_name === 'Tomato') {
      recordTest('ViabilityScanner', 'Retrieve Field Assessment by ID', 'PASS', `Crop: ${getAssess.data.data.crop_name}, Burden: ${getAssess.data.data.visual_disease_burden}%`);
    } else {
      recordTest('ViabilityScanner', 'Retrieve Field Assessment by ID', 'FAIL', JSON.stringify(getAssess.data));
    }
  } catch (err) {
    recordTest('ViabilityScanner', 'Assessment Operations', 'FAIL', err.message);
  }

  // ============================================================================
  // SUITE 5: Assessment Handoff -> Marketplace Listing with Foreign Key
  // ============================================================================
  console.log('\n--- 5. ASSESSMENT HANDOFF & MARKETPLACE LISTING ---');
  const listingId = `wp_test_${testTimestamp}`;
  try {
    const listRes = await request('/marketplace/listings', {
      method: 'POST',
      headers: { 'x-user-id': farmerAId },
      body: {
        id: listingId,
        creator_id: farmerAId,
        creator_role: 'farmer',
        source_assessment_id: assessmentId,
        crop_type: 'Tomato',
        quantity_kg: 1200,
        condition: 'damaged',
        asking_price: 18,
        status: 'listed',
        location: 'Madurai East, Tamil Nadu',
        latitude: 9.9412,
        longitude: 78.1385,
        district: 'Madurai',
        state: 'Tamil Nadu',
        farmer_name: 'Ramesh Kumar',
        contact_phone: '9876543201',
        title: '1200kg Processing Grade Tomato (From Assessment)'
      }
    });

    if (listRes.ok && listRes.data.data.id === listingId && listRes.data.data.source_assessment_id === assessmentId) {
      recordTest('Marketplace', 'Create Listing Linked to Assessment (FK Validated)', 'PASS', `Listing ${listingId} linked to ${assessmentId}`);
    } else {
      recordTest('Marketplace', 'Create Listing Linked to Assessment (FK Validated)', 'FAIL', JSON.stringify(listRes.data));
    }

    const fetchAll = await request('/marketplace/listings?crop_type=Tomato');
    if (fetchAll.ok && fetchAll.data.data.some(l => l.id === listingId)) {
      recordTest('Marketplace', 'Buyer Discovery Query (Filter by Crop)', 'PASS', `Found listing in active listings`);
    } else {
      recordTest('Marketplace', 'Buyer Discovery Query (Filter by Crop)', 'FAIL', JSON.stringify(fetchAll.data));
    }
  } catch (err) {
    recordTest('Marketplace', 'Marketplace Creation', 'FAIL', err.message);
  }

  // ============================================================================
  // SUITE 6: Authorization & Security Enforcement
  // ============================================================================
  console.log('\n--- 6. SECURITY & AUTHORIZATION GUARDS ---');
  try {
    // Attempt by Farmer B to modify Farmer A's listing
    const unauthorizedEdit = await request(`/marketplace/listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'x-user-id': farmerBId },
      body: { asking_price: 5, userId: farmerBId }
    });

    if (unauthorizedEdit.status === 403) {
      recordTest('Security', 'Block Unauthorized Listing Modification (403 Forbidden)', 'PASS', 'Farmer B prevented from modifying Farmer A listing');
    } else {
      recordTest('Security', 'Block Unauthorized Listing Modification (403 Forbidden)', 'FAIL', `Expected 403, got ${unauthorizedEdit.status}`);
    }

    // Authorized update by Farmer A
    const authorizedEdit = await request(`/marketplace/listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'x-user-id': farmerAId },
      body: { asking_price: 17, userId: farmerAId }
    });

    if (authorizedEdit.ok && Number(authorizedEdit.data.data.asking_price) === 17) {
      recordTest('Security', 'Allow Authorized Listing Owner Update', 'PASS', 'Price updated to 17');
    } else {
      recordTest('Security', 'Allow Authorized Listing Owner Update', 'FAIL', JSON.stringify(authorizedEdit.data));
    }
  } catch (err) {
    recordTest('Security', 'Authorization Tests', 'FAIL', err.message);
  }

  // ============================================================================
  // SUITE 7: AgroConnect Community Exchange
  // ============================================================================
  console.log('\n--- 7. AGROCONNECT COMMUNITY EXCHANGE ---');
  const postId = `ap_test_${testTimestamp}`;
  try {
    const postRes = await request('/agroconnect/posts', {
      method: 'POST',
      body: {
        id: postId,
        creator_id: farmerAId,
        creator_role: 'farmer',
        post_type: 'offering_waste',
        crop_type: 'Tomato',
        quantity_kg: 500,
        condition: 'fresh',
        location: 'Madurai East',
        title: '500kg Organic Tomato Residue Available for Composting',
        description: 'Harvest residue suitable for bio-fertilizer.'
      }
    });

    if (postRes.ok && postRes.data.data.id === postId) {
      recordTest('AgroConnect', 'Create Crop Community Post', 'PASS', `Created post ${postId}`);
    } else {
      recordTest('AgroConnect', 'Create Crop Community Post', 'FAIL', JSON.stringify(postRes.data));
    }

    // Farmer B interacts with Farmer A post
    const interactRes = await request(`/agroconnect/posts/${postId}/interact`, {
      method: 'POST',
      body: {
        farmer_id: farmerBId,
        farmer_name: 'Suresh Kumar',
        interaction_type: 'offer_help',
        message: 'I can collect 200kg for my composting unit tomorrow.',
        phone: '9876543203'
      }
    });

    if (interactRes.ok && interactRes.data.data.interaction.farmer_id === farmerBId) {
      recordTest('AgroConnect', 'Farmer-to-Farmer Interaction & Auto-Notification', 'PASS', 'Interaction recorded and notification dispatched');
    } else {
      recordTest('AgroConnect', 'Farmer-to-Farmer Interaction & Auto-Notification', 'FAIL', JSON.stringify(interactRes.data));
    }

    // Check Farmer A notifications
    const notifs = await request(`/notifications/${farmerAId}`);
    if (notifs.ok && notifs.data.data.some(n => n.message.includes('Suresh Kumar'))) {
      recordTest('AgroConnect', 'Post Creator Notification Delivery', 'PASS', 'Notification delivered to Farmer A');
    } else {
      recordTest('AgroConnect', 'Post Creator Notification Delivery', 'FAIL', JSON.stringify(notifs.data));
    }

    // Farmer A accepts connection
    const connRes = await request(`/agroconnect/posts/${postId}/connect`, {
      method: 'PATCH',
      body: {
        userId: farmerAId,
        requestingFarmerId: farmerBId,
        requestingFarmerName: 'Suresh Kumar',
        action: 'accept'
      }
    });

    if (connRes.ok && connRes.data.data.connections.some(c => c.farmer_id === farmerBId && c.status === 'connected')) {
      recordTest('AgroConnect', 'Farmer-to-Farmer Direct Connection Accepted', 'PASS', 'Connection established in PostgreSQL');
    } else {
      recordTest('AgroConnect', 'Farmer-to-Farmer Direct Connection Accepted', 'FAIL', JSON.stringify(connRes.data));
    }
  } catch (err) {
    recordTest('AgroConnect', 'AgroConnect Operations', 'FAIL', err.message);
  }

  // ============================================================================
  // SUITE 8: Smart Logistics & Live Driver GPS Tracking
  // ============================================================================
  console.log('\n--- 8. SMART LOGISTICS & LIVE GPS ---');
  const shipmentId = `shipment_test_${testTimestamp}`;
  try {
    // Seed driver and vehicle
    await request('/logistics/drivers-vehicles');

    const shipRes = await request('/logistics/shipments', {
      method: 'POST',
      headers: { 'x-user-id': buyerAId, 'x-user-role': 'buyer' },
      body: {
        shipmentId,
        crop: 'Tomato',
        totalQuantityKg: 10000,
        vehicleCapacityKg: 12000,
        vehicleUtilizationPercent: 83.33,
        estimatedDistanceKm: 48.5,
        estimatedTransportCost: 2910,
        transportCostPerKg: 0.2910,
        driverId: 'drv_ravi_01',
        vehicleId: 'veh_truck_12t_01',
        status: 'DRIVER_ASSIGNED',
        buyerAllocations: [
          { buyerId: buyerAId, buyerName: 'Vaigai Food Processors', quantityKg: 10000, deliveryLocation: 'Madurai Central' }
        ],
        farmerAllocations: [
          { farmerId: farmerAId, farmerName: 'Ramesh Kumar', allocatedQuantityKg: 5000, transportShare: 1455 },
          { farmerId: farmerBId, farmerName: 'Suresh Kumar', allocatedQuantityKg: 5000, transportShare: 1455 }
        ],
        route: {
          stops: [
            { stopIndex: 0, type: 'PICKUP', id: farmerAId, name: 'Pickup: Ramesh Farm', coordinates: { lat: 9.9412, lng: 78.1385 }, quantityKg: 5000 },
            { stopIndex: 1, type: 'PICKUP', id: farmerBId, name: 'Pickup: Suresh Farm', coordinates: { lat: 9.9550, lng: 78.1620 }, quantityKg: 5000 },
            { stopIndex: 2, type: 'DELIVERY', id: buyerAId, name: 'Delivery: Vaigai Facility', coordinates: { lat: 9.9195, lng: 78.1217 }, quantityKg: 10000 }
          ]
        }
      }
    });

    if (shipRes.ok && shipRes.data.data.shipment_id === shipmentId) {
      recordTest('Logistics', 'Create Consolidated Multi-Farmer Shipment', 'PASS', `Consolidated 10 Tons with 83.33% utilization`);
    } else {
      recordTest('Logistics', 'Create Consolidated Multi-Farmer Shipment', 'FAIL', JSON.stringify(shipRes.data));
    }

    // Driver streams real GPS location
    const gpsRes = await request(`/shipments/${shipmentId}/location`, {
      method: 'POST',
      headers: { 'x-user-id': 'usr_driver_ravi_04', 'x-user-role': 'driver' },
      body: {
        latitude: 9.9320,
        longitude: 78.1280,
        accuracy: 4.5,
        speed: 38.0,
        heading: 45.0,
        timestamp: new Date().toISOString()
      }
    });

    if (gpsRes.ok && gpsRes.data.data.broadcasted === true) {
      recordTest('Logistics', 'Driver Ingests Real GPS Telemetry', 'PASS', 'Throttled GPS coordinate updated');
    } else {
      recordTest('Logistics', 'Driver Ingests Real GPS Telemetry', 'FAIL', JSON.stringify(gpsRes.data));
    }

    // Farmer queries privacy-sanitized tracking (Ensure NO raw lat/lng returned)
    const trackRes = await request(`/shipments/${shipmentId}/tracking`, {
      headers: { 'x-user-id': farmerAId, 'x-user-role': 'farmer' }
    });

    if (trackRes.ok && trackRes.data.data.hasGpsFix === true && trackRes.data.data.driverCoordinates === undefined) {
      recordTest('Logistics', 'Privacy-Protected Tracking for Farmers/Buyers (Zero Raw GPS Leak)', 'PASS', `ETA: ${trackRes.data.data.estimatedEtaMinutes} mins, Remaining: ${trackRes.data.data.estimatedRemainingDistanceKm} km`);
    } else {
      recordTest('Logistics', 'Privacy-Protected Tracking for Farmers/Buyers (Zero Raw GPS Leak)', 'FAIL', `Leaked raw coordinates or missing tracking`);
    }

    // Advance Shipment Status
    const statusRes = await request(`/shipments/${shipmentId}/status`, {
      method: 'PATCH',
      headers: { 'x-user-id': 'usr_driver_ravi_04', 'x-user-role': 'driver' },
      body: { status: 'IN_TRANSIT' }
    });

    if (statusRes.ok && statusRes.data.data.status === 'IN_TRANSIT') {
      recordTest('Logistics', 'Shipment State Machine Transition (IN_TRANSIT)', 'PASS', 'Status transitioned to IN_TRANSIT');
    } else {
      recordTest('Logistics', 'Shipment State Machine Transition (IN_TRANSIT)', 'FAIL', JSON.stringify(statusRes.data));
    }
  } catch (err) {
    recordTest('Logistics', 'Logistics Operations', 'FAIL', err.message);
  }

  // ============================================================================
  // SUITE 9: Silage Bank Network
  // ============================================================================
  console.log('\n--- 9. SILAGE BANK NETWORK ---');
  const centerId = `cnt_test_${testTimestamp}`;
  const bookingId = `sbk_test_${testTimestamp}`;
  try {
    const centerRes = await request('/silage/centers', {
      method: 'POST',
      body: {
        id: centerId,
        creator_id: buyerAId,
        name: 'Vaigai Silage Processing Hub',
        location: 'Madurai Ring Road Industrial Estate',
        district: 'Madurai',
        state: 'Tamil Nadu',
        capacity_kg: 25000,
        price_per_kg: 2.75,
        phone: '9876543210'
      }
    });

    if (centerRes.ok && centerRes.data.data.id === centerId) {
      recordTest('SilageBank', 'Register Silage Center Facility', 'PASS', `Center ${centerId} created at ₹2.75/kg`);
    } else {
      recordTest('SilageBank', 'Register Silage Center Facility', 'FAIL', JSON.stringify(centerRes.data));
    }

    const bookRes = await request('/silage/bookings', {
      method: 'POST',
      body: {
        id: bookingId,
        creator_id: farmerAId,
        center_id: centerId,
        crop_type: 'Maize Stalks',
        quantity_kg: 3000,
        price_per_kg: 2.75,
        farmer_name: 'Ramesh Kumar',
        location: 'Madurai East Farm'
      }
    });

    if (bookRes.ok && bookRes.data.data.id === bookingId) {
      recordTest('SilageBank', 'Create Silage Booking', 'PASS', `Booked 3000kg for total ₹${bookRes.data.data.total_price}`);
    } else {
      recordTest('SilageBank', 'Create Silage Booking', 'FAIL', JSON.stringify(bookRes.data));
    }
  } catch (err) {
    recordTest('SilageBank', 'Silage Bank Operations', 'FAIL', err.message);
  }

  // ============================================================================
  // SUITE 10: Carbon Cash & Anti-Self-Sponsorship
  // ============================================================================
  console.log('\n--- 10. CARBON CASH MARKETPLACE ---');
  const activityId = `ca_test_${testTimestamp}`;
  const offerId = `co_test_${testTimestamp}`;
  try {
    const actRes = await request('/carbon/activities', {
      method: 'POST',
      body: {
        id: activityId,
        creator_id: farmerAId,
        activity_type: 'composting',
        area_acres: 3.0,
        description: 'Converted 3 acres of crop stalks into aerobic compost heap',
        farmer_name: 'Ramesh Kumar'
      }
    });

    if (actRes.ok && actRes.data.data.id === activityId) {
      recordTest('CarbonCash', 'Log Carbon Activity & Calculate CO2 Credits', 'PASS', `Credits: ${actRes.data.data.credits_earned}, Value: ₹${actRes.data.data.credit_value_inr}`);
    } else {
      recordTest('CarbonCash', 'Log Carbon Activity & Calculate CO2 Credits', 'FAIL', JSON.stringify(actRes.data));
    }

    // Security Test: Farmer A attempts to sponsor their own activity (Anti-Self-Sponsorship)
    const selfSponsor = await request(`/carbon/activities/${activityId}/offers`, {
      method: 'POST',
      body: {
        sponsor_id: farmerAId,
        offered_price_inr: 1500
      }
    });

    if (selfSponsor.status === 400 && selfSponsor.data.code === 'SELF_SPONSORSHIP_FORBIDDEN') {
      recordTest('CarbonCash', 'Anti-Self-Sponsorship Security Guard (Blocked Self-Offer)', 'PASS', 'Self sponsorship rejected');
    } else {
      recordTest('CarbonCash', 'Anti-Self-Sponsorship Security Guard (Blocked Self-Offer)', 'FAIL', `Expected 400 SELF_SPONSORSHIP_FORBIDDEN, got ${selfSponsor.status}`);
    }

    // Legitimate Buyer Sponsorship Offer
    const buyerOffer = await request(`/carbon/activities/${activityId}/offers`, {
      method: 'POST',
      body: {
        id: offerId,
        sponsor_id: buyerAId,
        sponsor_name: 'Vaigai Food Processors',
        offered_price_inr: 1500
      }
    });

    if (buyerOffer.ok && buyerOffer.data.data.id === offerId) {
      recordTest('CarbonCash', 'Buyer Submits Carbon Sponsorship Offer', 'PASS', `Offer of ₹1500 submitted`);
    } else {
      recordTest('CarbonCash', 'Buyer Submits Carbon Sponsorship Offer', 'FAIL', JSON.stringify(buyerOffer.data));
    }

    // Farmer Accepts Offer
    const acceptRes = await request(`/carbon/activities/${activityId}/offers/${offerId}`, {
      method: 'PATCH',
      body: {
        userId: farmerAId,
        action: 'accept'
      }
    });

    if (acceptRes.ok && acceptRes.data.data.status === 'accepted') {
      recordTest('CarbonCash', 'Farmer Accepts Carbon Sponsorship Offer', 'PASS', 'Activity status updated to accepted');
    } else {
      recordTest('CarbonCash', 'Farmer Accepts Carbon Sponsorship Offer', 'FAIL', JSON.stringify(acceptRes.data));
    }
  } catch (err) {
    recordTest('CarbonCash', 'Carbon Cash Operations', 'FAIL', err.message);
  }

  // ============================================================================
  // SUITE 11: Claim Rocket Insurance Dossiers
  // ============================================================================
  console.log('\n--- 11. CLAIM ROCKET DOSSIERS ---');
  const claimId = `ic_test_${testTimestamp}`;
  try {
    const claimRes = await request('/claims', {
      method: 'POST',
      body: {
        id: claimId,
        creator_id: farmerAId,
        farmer_id: farmerAId,
        source_assessment_id: assessmentId,
        farmer_name: 'Ramesh Kumar',
        mobile_number: '9876543201',
        aadhar_number: '1234-5678-9012',
        date_of_birth: '1985-06-15',
        crop_type: 'Tomato',
        damage_type: 'unseasonal_rain_and_blight',
        damage_percentage: 42.5,
        area_acres: 2.5,
        estimated_loss_inr: 45000,
        claim_amount_inr: 45000,
        status: 'dossier_ready',
        location: 'Madurai East',
        ai_report: {
          visualDiseaseBurden: 42.5,
          primaryDisease: 'Early Blight',
          confidence: 0.88,
          timestamp: new Date().toISOString()
        }
      }
    });

    if (claimRes.ok && claimRes.data.data.id === claimId && claimRes.data.data.source_assessment_id === assessmentId) {
      recordTest('ClaimRocket', 'Generate & Persist Insurance Claim Dossier with AI Evidence', 'PASS', `Saved claim dossier ${claimId} with assessment link`);
    } else {
      recordTest('ClaimRocket', 'Generate & Persist Insurance Claim Dossier with AI Evidence', 'FAIL', JSON.stringify(claimRes.data));
    }
  } catch (err) {
    recordTest('ClaimRocket', 'Claim Operations', 'FAIL', err.message);
  }

  // ============================================================================
  // SUITE 12: Real-Time Socket.IO Multi-Client Verification
  // ============================================================================
  console.log('\n--- 12. REAL-TIME SOCKET.IO MULTI-CLIENT CHANNELS ---');
  try {
    const socketA = io(SOCKET_URL, { transports: ['websocket'] });
    const socketB = io(SOCKET_URL, { transports: ['websocket'] });

    await new Promise((resolve) => {
      let connectedCount = 0;
      const check = () => {
        connectedCount++;
        if (connectedCount === 2) resolve();
      };
      socketA.on('connect', check);
      socketB.on('connect', check);
    });

    recordTest('RealtimeSocket', 'Dual Client Socket Connection Established', 'PASS', `Clients ${socketA.id} & ${socketB.id} connected`);

    // Test Listing Broadcast
    const listingBroadcastPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket listing:created event timeout')), 4000);
      socketB.on('listing:created', (data) => {
        if (data.id === `wp_socket_${testTimestamp}`) {
          clearTimeout(timer);
          resolve(data);
        }
      });
    });

    // Create listing to trigger broadcast
    await request('/marketplace/listings', {
      method: 'POST',
      body: {
        id: `wp_socket_${testTimestamp}`,
        creator_id: farmerAId,
        crop_type: 'Onion',
        quantity_kg: 800,
        condition: 'slightly_damaged',
        asking_price: 22
      }
    });

    const receivedListing = await listingBroadcastPromise;
    recordTest('RealtimeSocket', 'Real-Time Multi-User Marketplace Broadcast (listing:created)', 'PASS', `Client B received listing ${receivedListing.id} without page refresh`);

    // Test Shipment Room Authorization & Subscription
    const roomSubscribePromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket subscription timeout')), 4000);
      socketA.on('subscription:success', (data) => {
        clearTimeout(timer);
        resolve(data);
      });
      socketA.on('subscription:error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    socketA.emit('subscribe:shipment', {
      shipmentId,
      userId: farmerAId
    });

    const subSuccess = await roomSubscribePromise;
    recordTest('RealtimeSocket', 'Authenticated Shipment Room Subscription (shipment:<id>)', 'PASS', `Farmer A authorized into shipment room as role: ${subSuccess.role}`);

    socketA.disconnect();
    socketB.disconnect();
  } catch (err) {
    recordTest('RealtimeSocket', 'Socket.IO Real-Time Operations', 'FAIL', err.message);
  }

  // ============================================================================
  // SUITE 13: Offline Sync Gateway & Idempotency
  // ============================================================================
  console.log('\n--- 13. OFFLINE SYNC GATEWAY & IDEMPOTENCY ---');
  const syncEntityId = `wp_sync_${testTimestamp}`;
  const idempotencyKey = `idemp_${testTimestamp}`;
  try {
    const firstSync = await request('/sync/marketplacelisting', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': idempotencyKey },
      body: {
        actionType: 'CREATE_MARKETPLACE_LISTING',
        entityId: syncEntityId,
        userId: farmerAId,
        payload: {
          crop_type: 'Paddy Straw',
          quantity_kg: 2000,
          condition: 'fresh',
          asking_price: 3.5,
          location: 'Madurai East'
        }
      }
    });

    if (firstSync.ok && firstSync.data.synced === true && firstSync.data.replayed !== true) {
      recordTest('SyncGateway', 'First-Time Remote Sync Action Processed & Persisted', 'PASS', `Synced entity ${syncEntityId} into PostgreSQL`);
    } else {
      recordTest('SyncGateway', 'First-Time Remote Sync Action Processed & Persisted', 'FAIL', JSON.stringify(firstSync.data));
    }

    // Replay with identical idempotency key
    const replaySync = await request('/sync/marketplacelisting', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': idempotencyKey },
      body: {
        actionType: 'CREATE_MARKETPLACE_LISTING',
        entityId: syncEntityId,
        userId: farmerAId,
        payload: { crop_type: 'Paddy Straw' }
      }
    });

    if (replaySync.ok && replaySync.data.replayed === true) {
      recordTest('SyncGateway', 'Idempotency Protection (Replayed Duplicate Acknowledged Safely)', 'PASS', 'Idempotent key prevented duplicate insert');
    } else {
      recordTest('SyncGateway', 'Idempotency Protection (Replayed Duplicate Acknowledged Safely)', 'FAIL', JSON.stringify(replaySync.data));
    }
  } finally {
    console.log('\n🧹 [CLEANUP] Removing test listings from PostgreSQL...');
    try {
      const delRes = await query("DELETE FROM marketplace_listings WHERE id = $1 OR id = $2", [`wp_test_${testTimestamp}`, `wp_sync_${testTimestamp}`]);
      console.log(`  ✅ Cleaned up ${delRes.rowCount} test listing(s).`);
    } catch (err) {
      console.error('  ⚠️ Cleanup warning:', err.message);
    }
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n================================================================');
  console.log('📊 INTEGRATION TEST SUITE SUMMARY');
  console.log('================================================================');

  const total = results.length;
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const notImpl = results.filter(r => r.status === 'NOT_IMPLEMENTED').length;

  console.log(`Total Automated Tests Executed: ${total}`);
  console.log(`Passed: ${passed} (🟢)`);
  console.log(`Failed: ${failed} (🔴)`);
  console.log(`Not Implemented: ${notImpl} (⚪)`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.error(`🚨 ${failed} test(s) failed! Check details above.`);
    process.exitCode = 1;
  } else {
    console.log('🎉 ALL INTEGRATION TESTS PASSED PERFECTLY!');
  }
}

runAllTests().catch(err => {
  console.error('[FATAL TEST SUITE ERROR]', err);
  process.exit(1);
});
