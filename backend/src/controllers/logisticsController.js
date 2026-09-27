/**
 * AgroCycle Logistics & Live GPS Controller
 *
 * Implements deterministic shipment consolidation, secure driver GPS endpoints,
 * shipment-level access authorization, and multi-buyer stop progression.
 */

import { query } from '../db/pool.js';
import { validateLocationPayload, validateCoordinates } from '../validators/logisticsValidators.js';
import { 
  broadcastLocationUpdate, 
  broadcastStatusChange, 
  broadcastStopProgress, 
  buildSanitizedTracking 
} from '../realtime/socketManager.js';

// Haversine straight-line distance helper
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

// Extract authenticated user from headers
function getAuthUser(req) {
  const userId = req.headers['x-user-id'] || 
                 (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : null);
  const role = (req.headers['x-user-role'] || 'farmer').toLowerCase();
  return { userId: userId ? String(userId).trim() : null, role };
}

/**
 * 1. Seed / List Drivers & Vehicles
 */
export async function getDriversAndVehicles(req, res, next) {
  try {
    const driversRes = await query('SELECT * FROM logistics_drivers ORDER BY created_at ASC');
    const vehiclesRes = await query('SELECT * FROM logistics_vehicles ORDER BY capacity_kg ASC');

    let drivers = driversRes.rows;
    let vehicles = vehiclesRes.rows;

    // Auto-seed demo driver/vehicle if database is currently empty
    if (drivers.length === 0) {
      const d = await query(`
        INSERT INTO logistics_drivers (driver_id, user_id, name, phone, status, current_latitude, current_longitude)
        VALUES ('drv_ravi_01', 'usr_driver_ravi_04', 'Ravi Transport', '9876543213', 'available', 9.9252, 78.1198)
        RETURNING *
      `);
      drivers = d.rows;
    }

    if (vehicles.length === 0 && drivers.length > 0) {
      const v = await query(`
        INSERT INTO logistics_vehicles (vehicle_id, driver_id, vehicle_type, registration_number, capacity_kg, base_rate_per_km, status)
        VALUES 
          ('veh_truck_12t_01', 'drv_ravi_01', '12-ton Heavy Truck', 'TN-58-AG-1234', 12000, 60.00, 'available'),
          ('veh_mini_truck_3t_02', 'drv_ravi_01', '3-ton Mini Truck', 'TN-58-AG-5678', 3000, 35.00, 'available')
        RETURNING *
      `);
      vehicles = v.rows;
    }

    res.status(200).json({
      status: 'success',
      data: { drivers, vehicles }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 2. Create Consolidated Multi-Farmer & Multi-Buyer Shipment
 */
export async function createShipment(req, res, next) {
  try {
    const body = req.body;
    const shipmentId = body.shipmentId || body.id || `shipment_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Support single or multi-buyer demand
    const buyerAllocations = Array.isArray(body.buyerAllocations) && body.buyerAllocations.length > 0
      ? body.buyerAllocations
      : body.buyer 
        ? [{
            buyerId: body.buyer.buyerId || body.buyer.id,
            buyerName: body.buyer.buyerName || body.buyer.name || 'Wholesale Buyer',
            cropRequired: body.buyer.cropRequired || body.crop,
            quantityKg: body.buyer.quantityRequiredKg || body.totalQuantityKg,
            targetPricePerKg: body.buyer.targetPricePerKg || 30,
            deliveryLocation: body.buyer.deliveryLocation || 'Buyer Facility',
            deliveryCoordinates: body.buyer.deliveryCoordinates || { lat: 9.935, lng: 78.135 }
          }]
        : [];

    const primaryBuyerId = buyerAllocations[0]?.buyerId || body.buyerId || null;
    const crop = body.crop || buyerAllocations[0]?.cropRequired || 'Tomato';
    const totalQuantityKg = parseFloat(body.totalQuantityKg || 0);
    const vehicleCapacityKg = parseFloat(body.vehicleCapacityKg || body.vehicle?.capacityKg || 12000);
    const vehicleUtilizationPercent = parseFloat(body.vehicleUtilizationPercent || ((totalQuantityKg / vehicleCapacityKg) * 100).toFixed(2));
    const estimatedDistanceKm = parseFloat(body.estimatedDistanceKm || 50);
    const estimatedTransportCost = parseFloat(body.estimatedTransportCost || 3000);
    const transportCostPerKg = parseFloat(body.transportCostPerKg || (estimatedTransportCost / (totalQuantityKg || 1)).toFixed(4));
    
    const driverId = body.driverId || body.driver?.id || 'drv_ravi_01';
    const vehicleId = body.vehicleId || body.vehicle?.id || 'veh_truck_12t_01';
    const farmerAllocations = body.farmerAllocations || body.matchedFarmers || [];
    const route = body.route || {};
    const status = body.status || 'MATCHED';

    // 1. Insert into logistics_shipments
    const result = await query(
      `INSERT INTO logistics_shipments (
        id, shipment_id, primary_buyer_id, driver_id, vehicle_id, crop,
        total_quantity_kg, vehicle_capacity_kg, vehicle_utilization_percent,
        estimated_distance_km, estimated_transport_cost, transport_cost_per_kg,
        status, buyer_allocations, farmer_allocations, route
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (shipment_id) DO UPDATE SET
        driver_id = EXCLUDED.driver_id,
        vehicle_id = EXCLUDED.vehicle_id,
        status = EXCLUDED.status,
        farmer_allocations = EXCLUDED.farmer_allocations,
        buyer_allocations = EXCLUDED.buyer_allocations,
        route = EXCLUDED.route,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        shipmentId, shipmentId, primaryBuyerId, driverId, vehicleId, crop,
        totalQuantityKg, vehicleCapacityKg, vehicleUtilizationPercent,
        estimatedDistanceKm, estimatedTransportCost, transportCostPerKg,
        status, JSON.stringify(buyerAllocations), JSON.stringify(farmerAllocations), JSON.stringify(route)
      ]
    );

    // 2. Insert Stops if provided in route
    if (Array.isArray(route.stops) && route.stops.length > 0) {
      await query('DELETE FROM logistics_shipment_stops WHERE shipment_id = $1', [shipmentId]);
      for (const stop of route.stops) {
        const stopId = `stop_${shipmentId}_${stop.stopIndex}`;
        await query(
          `INSERT INTO logistics_shipment_stops (
            id, shipment_id, stop_index, stop_type, farmer_id, buyer_id,
            location_name, latitude, longitude, quantity_kg, cumulative_load_kg,
            distance_from_prev_km, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            stopId, shipmentId, stop.stopIndex, stop.type || 'PICKUP',
            stop.type === 'PICKUP' ? stop.id : null,
            stop.type === 'DELIVERY' ? stop.id : null,
            stop.name || stop.location || 'Stop',
            stop.coordinates?.lat || 0,
            stop.coordinates?.lng || 0,
            stop.pickupQuantityKg || stop.quantityKg || 0,
            stop.cumulativeLoadKg || 0,
            stop.distanceFromPrevKm || 0,
            'PENDING'
          ]
        );
      }
    }

    // Update driver status
    if (driverId) {
      await query(
        `UPDATE logistics_drivers SET status = 'assigned', current_shipment_id = $1 WHERE driver_id = $2`,
        [shipmentId, driverId]
      );
    }

    res.status(201).json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 3. List Shipments for Authenticated User
 */
export async function listShipments(req, res, next) {
  try {
    const { userId, role } = getAuthUser(req);
    let sql = `
      SELECT s.*, d.name as driver_name, d.phone as driver_phone, v.vehicle_type, v.registration_number
      FROM logistics_shipments s
      LEFT JOIN logistics_drivers d ON s.driver_id = d.driver_id
      LEFT JOIN logistics_vehicles v ON s.vehicle_id = v.vehicle_id
      ORDER BY s.created_at DESC
    `;
    const result = await query(sql);

    // If userId provided, filter shipments by relevance unless admin
    let shipments = result.rows;
    if (userId && !userId.includes('admin') && role !== 'admin') {
      shipments = shipments.filter(s => {
        const isDriver = s.driver_id === userId || (s.driver_id && s.driver_id.includes(userId));
        const isBuyer = s.primary_buyer_id === userId || (Array.isArray(s.buyer_allocations) && s.buyer_allocations.some(b => b.buyerId === userId));
        const isFarmer = Array.isArray(s.farmer_allocations) && s.farmer_allocations.some(f => f.farmerId === userId || f.userId === userId);
        return isDriver || isBuyer || isFarmer;
      });
    }

    res.status(200).json({
      status: 'success',
      data: shipments
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 4. Get Shipment Details with Participant-Specific View
 */
export async function getShipmentById(req, res, next) {
  try {
    const { shipmentId } = req.params;
    const { userId, role } = getAuthUser(req);

    const result = await query(
      `SELECT s.*, d.name as driver_name, d.phone as driver_phone, d.user_id as driver_user_id,
              v.vehicle_type, v.registration_number
       FROM logistics_shipments s
       LEFT JOIN logistics_drivers d ON s.driver_id = d.driver_id
       LEFT JOIN logistics_vehicles v ON s.vehicle_id = v.vehicle_id
       WHERE s.shipment_id = $1 OR s.id = $1 LIMIT 1`,
      [shipmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Shipment "${shipmentId}" not found`
      });
    }

    const shipment = result.rows[0];

    // Verify Authorization
    if (userId) {
      const isDriver = shipment.driver_user_id === userId || shipment.driver_id === userId;
      const isBuyer = shipment.primary_buyer_id === userId || (Array.isArray(shipment.buyer_allocations) && shipment.buyer_allocations.some(b => b.buyerId === userId));
      const isFarmer = Array.isArray(shipment.farmer_allocations) && shipment.farmer_allocations.some(f => f.farmerId === userId || f.userId === userId);
      const isAdmin = role === 'admin' || userId.includes('admin');

      if (!isDriver && !isBuyer && !isFarmer && !isAdmin) {
        return res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN',
          message: 'You are not authorized to view this shipment.'
        });
      }
    }

    // Get stops
    const stopsRes = await query(
      `SELECT * FROM logistics_shipment_stops WHERE shipment_id = $1 ORDER BY stop_index ASC`,
      [shipment.shipment_id]
    );
    shipment.stops = stopsRes.rows;

    // Get latest location
    const locRes = await query(
      `SELECT * FROM driver_current_locations WHERE driver_id = $1 LIMIT 1`,
      [shipment.driver_id]
    );
    const latestLoc = locRes.rows[0] || null;

    // If requester is a Farmer or Buyer, return privacy-sanitized stops (remove raw coordinates if strict)
    const isDriverOrAdmin = role === 'driver' || role === 'admin' || shipment.driver_user_id === userId;
    
    if (!isDriverOrAdmin) {
      // Sanitize raw coordinate exposure for farmers and buyers
      shipment.stops = shipment.stops.map(s => ({
        id: s.id,
        stopIndex: s.stop_index,
        stopType: s.stop_type,
        locationName: s.location_name,
        quantityKg: s.quantity_kg,
        cumulativeLoadKg: s.cumulative_load_kg,
        distanceFromPrevKm: s.distance_from_prev_km,
        status: s.status,
        arrivalTime: s.arrival_time,
        completionTime: s.completion_time
      }));
    }

    res.status(200).json({
      status: 'success',
      data: shipment
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 5. Secure Driver Real GPS Update Endpoint
 * POST /api/v1/shipments/:shipmentId/location
 */
export async function updateDriverLocation(req, res, next) {
  try {
    const { shipmentId } = req.params;
    const { userId, role } = getAuthUser(req);

    // 1. Validate Payload
    const validation = validateLocationPayload(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: validation.message
      });
    }

    const { latitude, longitude, accuracy, speed, heading, timestamp } = validation.data;

    // 2. Fetch Shipment & Driver Info
    const shipRes = await query(
      `SELECT s.*, d.driver_id as assigned_driver_id, d.user_id as driver_user_id, d.name as driver_name,
              v.vehicle_type
       FROM logistics_shipments s
       LEFT JOIN logistics_drivers d ON s.driver_id = d.driver_id
       LEFT JOIN logistics_vehicles v ON s.vehicle_id = v.vehicle_id
       WHERE s.shipment_id = $1 OR s.id = $1 LIMIT 1`,
      [shipmentId]
    );

    if (shipRes.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Shipment "${shipmentId}" not found`
      });
    }

    const shipment = shipRes.rows[0];

    // 3. Authenticate & Authorize Driver
    if (userId) {
      const isAssignedDriver = shipment.driver_user_id === userId || shipment.assigned_driver_id === userId;
      if (!isAssignedDriver && role !== 'admin') {
        console.warn(`[Security Alert] Unauthorized GPS update attempt for shipment ${shipmentId} by user ${userId}`);
        return res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN_DRIVER_MISMATCH',
          message: 'You are not the assigned driver for this shipment'
        });
      }
    }

    // 4. Check Shipment Status (Must be active for GPS streaming)
    const activeStatuses = ['DRIVER_ASSIGNED', 'READY_FOR_PICKUP', 'IN_TRANSIT'];
    if (!activeStatuses.includes(shipment.status)) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_SHIPMENT_STATUS',
        message: `Cannot update location for shipment in status "${shipment.status}"`
      });
    }

    const driverId = shipment.assigned_driver_id || shipment.driver_id;

    // 5. Update driver_current_locations table
    await query(
      `INSERT INTO driver_current_locations (
        driver_id, shipment_id, latitude, longitude, accuracy, speed, heading, timestamp, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT (driver_id) DO UPDATE SET
        shipment_id = EXCLUDED.shipment_id,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        accuracy = EXCLUDED.accuracy,
        speed = EXCLUDED.speed,
        heading = EXCLUDED.heading,
        timestamp = EXCLUDED.timestamp,
        updated_at = CURRENT_TIMESTAMP`,
      [driverId, shipment.shipment_id, latitude, longitude, accuracy, speed, heading, timestamp]
    );

    // 6. Update logistics_drivers table
    await query(
      `UPDATE logistics_drivers SET
        current_latitude = $1,
        current_longitude = $2,
        last_location_update = $3,
        updated_at = CURRENT_TIMESTAMP
       WHERE driver_id = $4`,
      [latitude, longitude, timestamp, driverId]
    );

    // 7. Insert Audit Trail History (Bounded retention: max 100 points per shipment)
    const historyId = `lh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await query(
      `INSERT INTO shipment_location_history (
        id, shipment_id, driver_id, latitude, longitude, accuracy, speed, heading, recorded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [historyId, shipment.shipment_id, driverId, latitude, longitude, accuracy, speed, heading, timestamp]
    );

    // Bound history retention
    await query(
      `DELETE FROM shipment_location_history 
       WHERE shipment_id = $1 AND id NOT IN (
         SELECT id FROM shipment_location_history 
         WHERE shipment_id = $1 
         ORDER BY recorded_at DESC 
         LIMIT 100
       )`,
      [shipment.shipment_id]
    );

    // 8. Fetch Stops for ETA & Distance Calculation
    const stopsRes = await query(
      `SELECT * FROM logistics_shipment_stops WHERE shipment_id = $1 ORDER BY stop_index ASC`,
      [shipment.shipment_id]
    );
    const stops = stopsRes.rows;

    const latestLoc = {
      driver_id: driverId,
      shipment_id: shipment.shipment_id,
      latitude,
      longitude,
      accuracy,
      speed,
      heading,
      timestamp
    };

    // 9. Real-Time Broadcast to Room
    await broadcastLocationUpdate(shipment.shipment_id, latestLoc, shipment, stops);

    res.status(200).json({
      status: 'success',
      message: 'Driver location received and broadcasted',
      data: {
        shipmentId: shipment.shipment_id,
        timestamp,
        broadcasted: true
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 6. Live Tracking Endpoint (GET /api/v1/shipments/:shipmentId/tracking)
 * Returns privacy-sanitized metrics for Farmers & Buyers.
 */
export async function getShipmentTracking(req, res, next) {
  try {
    const { shipmentId } = req.params;
    const { userId, role } = getAuthUser(req);

    const shipRes = await query(
      `SELECT s.*, d.driver_id as assigned_driver_id, d.user_id as driver_user_id, d.name as driver_name,
              v.vehicle_type
       FROM logistics_shipments s
       LEFT JOIN logistics_drivers d ON s.driver_id = d.driver_id
       LEFT JOIN logistics_vehicles v ON s.vehicle_id = v.vehicle_id
       WHERE s.shipment_id = $1 OR s.id = $1 LIMIT 1`,
      [shipmentId]
    );

    if (shipRes.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Shipment "${shipmentId}" not found`
      });
    }

    const shipment = shipRes.rows[0];

    // Authorization Check
    let participantRole = role;
    if (userId) {
      const isDriver = shipment.driver_user_id === userId || shipment.assigned_driver_id === userId;
      const isBuyer = shipment.primary_buyer_id === userId || (Array.isArray(shipment.buyer_allocations) && shipment.buyer_allocations.some(b => b.buyerId === userId));
      const isFarmer = Array.isArray(shipment.farmer_allocations) && shipment.farmer_allocations.some(f => f.farmerId === userId || f.userId === userId);
      const isAdmin = role === 'admin' || userId.includes('admin');

      if (!isDriver && !isBuyer && !isFarmer && !isAdmin) {
        return res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN',
          message: 'You are not authorized to track this shipment.'
        });
      }

      if (isDriver) participantRole = 'driver';
      else if (isFarmer) participantRole = 'farmer';
      else if (isBuyer) participantRole = 'buyer';
    }

    // Fetch stops & latest location
    const stopsRes = await query(
      `SELECT * FROM logistics_shipment_stops WHERE shipment_id = $1 ORDER BY stop_index ASC`,
      [shipment.shipment_id]
    );
    const stops = stopsRes.rows;

    const locRes = await query(
      `SELECT * FROM driver_current_locations WHERE driver_id = $1 LIMIT 1`,
      [shipment.driver_id]
    );
    const latestLoc = locRes.rows[0] || null;

    const trackingData = buildSanitizedTracking({
      shipment,
      stops,
      latestLoc,
      userId,
      role: participantRole
    });

    res.status(200).json({
      status: 'success',
      data: trackingData
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 7. State Machine Status Transition Endpoint
 * PATCH /api/v1/shipments/:shipmentId/status
 */
export async function updateShipmentStatus(req, res, next) {
  try {
    const { shipmentId } = req.params;
    const { status } = req.body;
    const { userId, role } = getAuthUser(req);

    if (!status) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Status parameter is required'
      });
    }

    const shipRes = await query(
      `SELECT * FROM logistics_shipments WHERE shipment_id = $1 OR id = $1 LIMIT 1`,
      [shipmentId]
    );

    if (shipRes.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Shipment "${shipmentId}" not found`
      });
    }

    const shipment = shipRes.rows[0];
    const currentStatus = shipment.status;

    // Validate Valid State Transitions
    const allowedTransitions = {
      MATCHED: ['DRIVER_ASSIGNED', 'CANCELLED'],
      DRIVER_ASSIGNED: ['READY_FOR_PICKUP', 'IN_TRANSIT', 'CANCELLED'],
      READY_FOR_PICKUP: ['IN_TRANSIT', 'CANCELLED'],
      IN_TRANSIT: ['DELIVERED', 'CANCELLED'],
      DELIVERED: [],
      CANCELLED: []
    };

    if (currentStatus !== status && !allowedTransitions[currentStatus]?.includes(status)) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_STATE_TRANSITION',
        message: `Invalid state transition from "${currentStatus}" to "${status}"`
      });
    }

    // Update status in DB
    const updated = await query(
      `UPDATE logistics_shipments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE shipment_id = $2 RETURNING *`,
      [status, shipment.shipment_id]
    );

    // Update driver & vehicle statuses accordingly
    if (status === 'IN_TRANSIT') {
      await query(`UPDATE logistics_drivers SET status = 'in_transit' WHERE driver_id = $1`, [shipment.driver_id]);
      await query(`UPDATE logistics_vehicles SET status = 'in_transit' WHERE vehicle_id = $1`, [shipment.vehicle_id]);
    } else if (status === 'DELIVERED' || status === 'CANCELLED') {
      await query(`UPDATE logistics_drivers SET status = 'available', current_shipment_id = NULL WHERE driver_id = $1`, [shipment.driver_id]);
      await query(`UPDATE logistics_vehicles SET status = 'available' WHERE vehicle_id = $1`, [shipment.vehicle_id]);
    }

    // Broadcast status change
    broadcastStatusChange(shipment.shipment_id, status, { previousStatus: currentStatus });

    res.status(200).json({
      status: 'success',
      data: updated.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 8. Stop Progress & Arrival/Completion Endpoint
 * PATCH /api/v1/shipments/:shipmentId/stops/:stopIndex
 */
export async function updateStopStatus(req, res, next) {
  try {
    const { shipmentId, stopIndex } = req.params;
    const { status } = req.body; // PENDING, ARRIVED, COMPLETED, SKIPPED

    const stopIdx = parseInt(stopIndex, 10);
    if (isNaN(stopIdx)) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Invalid stopIndex'
      });
    }

    let timeUpdateSql = '';
    if (status === 'ARRIVED') {
      timeUpdateSql = ', arrival_time = CURRENT_TIMESTAMP';
    } else if (status === 'COMPLETED') {
      timeUpdateSql = ', completion_time = CURRENT_TIMESTAMP';
    }

    const updated = await query(
      `UPDATE logistics_shipment_stops 
       SET status = $1, updated_at = CURRENT_TIMESTAMP ${timeUpdateSql}
       WHERE shipment_id = $2 AND stop_index = $3
       RETURNING *`,
      [status, shipmentId, stopIdx]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: `Stop #${stopIdx} for shipment "${shipmentId}" not found`
      });
    }

    broadcastStopProgress(shipmentId, stopIdx, status, updated.rows[0]);

    res.status(200).json({
      status: 'success',
      data: updated.rows[0]
    });
  } catch (err) {
    next(err);
  }
}
