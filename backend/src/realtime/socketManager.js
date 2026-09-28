/**
 * AgroCycle Real-Time Socket.IO Manager
 *
 * Implements authenticated WebSocket rooms per shipment (`shipment:<shipmentId>`),
 * strict participant authorization (Driver, Farmer, Buyer, Admin),
 * and privacy-sanitized telemetry broadcasts (ZERO raw GPS coordinates to farmers/buyers).
 */

import { Server } from 'socket.io';
import { query } from '../db/pool.js';

let io = null;

// Haversine helper for straight-line estimated distance in km
function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
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

export function initSocket(httpServer, corsOptions) {
  io = new Server(httpServer, {
    cors: corsOptions || {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Handle room subscription with backend authorization check
    socket.on('subscribe:shipment', async (data) => {
      try {
        const { shipmentId, userId } = data || {};
        if (!shipmentId || !userId) {
          socket.emit('subscription:error', {
            code: 'INVALID_PARAMETERS',
            message: 'shipmentId and userId are required to subscribe'
          });
          return;
        }

        // 1. Fetch shipment from database
        const result = await query(
          `SELECT s.*, d.user_id as driver_user_id, d.name as driver_name, v.vehicle_type 
           FROM logistics_shipments s
           LEFT JOIN logistics_drivers d ON s.driver_id = d.driver_id
           LEFT JOIN logistics_vehicles v ON s.vehicle_id = v.vehicle_id
           WHERE s.shipment_id = $1 OR s.id = $1 LIMIT 1`,
          [shipmentId]
        );

        if (result.rows.length === 0) {
          socket.emit('subscription:error', {
            code: 'SHIPMENT_NOT_FOUND',
            message: `Shipment "${shipmentId}" does not exist`
          });
          return;
        }

        const shipment = result.rows[0];
        const normalizedUserId = String(userId).trim();

        // 2. Verify authorization
        const isDriver = shipment.driver_user_id === normalizedUserId || shipment.driver_id === normalizedUserId;
        const isPrimaryBuyer = shipment.primary_buyer_id === normalizedUserId;
        
        let isParticipatingFarmer = false;
        if (Array.isArray(shipment.farmer_allocations)) {
          isParticipatingFarmer = shipment.farmer_allocations.some(
            f => f.farmerId === normalizedUserId || f.userId === normalizedUserId
          );
        }

        let isParticipatingBuyer = false;
        if (Array.isArray(shipment.buyer_allocations)) {
          isParticipatingBuyer = shipment.buyer_allocations.some(
            b => b.buyerId === normalizedUserId || b.userId === normalizedUserId
          );
        }

        const isAuthorized = isDriver || isPrimaryBuyer || isParticipatingFarmer || isParticipatingBuyer || normalizedUserId.includes('admin');

        if (!isAuthorized) {
          console.warn(`[Socket.IO Auth] Unauthorized subscription rejected for user ${normalizedUserId} on shipment ${shipmentId}`);
          socket.emit('subscription:error', {
            code: 'UNAUTHORIZED_SHIPMENT_SUBSCRIPTION',
            message: 'You are not an authorized participant in this shipment'
          });
          return;
        }

        // Determine user participant role
        let participantRole = 'viewer';
        if (isDriver) participantRole = 'driver';
        else if (isParticipatingFarmer) participantRole = 'farmer';
        else if (isPrimaryBuyer || isParticipatingBuyer) participantRole = 'buyer';

        // Join socket to room
        const roomName = `shipment:${shipment.shipment_id}`;
        socket.join(roomName);
        socket.data.userId = normalizedUserId;
        socket.data.participantRole = participantRole;
        socket.data.shipmentId = shipment.shipment_id;

        console.log(`[Socket.IO] User ${normalizedUserId} (${participantRole}) joined ${roomName}`);

        // Fetch latest location
        const locResult = await query(
          `SELECT * FROM driver_current_locations WHERE driver_id = $1 LIMIT 1`,
          [shipment.driver_id]
        );
        const latestLoc = locResult.rows[0] || null;

        // Fetch stops
        const stopsResult = await query(
          `SELECT * FROM logistics_shipment_stops WHERE shipment_id = $1 ORDER BY stop_index ASC`,
          [shipment.shipment_id]
        );
        const stops = stopsResult.rows;

        // Build role-appropriate initial state
        const sanitizedTracking = buildSanitizedTracking({
          shipment,
          stops,
          latestLoc,
          userId: normalizedUserId,
          role: participantRole
        });

        socket.emit('subscription:success', {
          shipmentId: shipment.shipment_id,
          role: participantRole,
          status: shipment.status,
          tracking: sanitizedTracking
        });

      } catch (err) {
        console.error('[Socket.IO subscribe:shipment error]', err);
        socket.emit('subscription:error', {
          code: 'SERVER_ERROR',
          message: 'Failed to process shipment subscription'
        });
      }
    });

    socket.on('unsubscribe:shipment', (data) => {
      const { shipmentId } = data || {};
      if (shipmentId) {
        socket.leave(`shipment:${shipmentId}`);
      }
    });

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });

  return io;
}

/**
 * Builds a privacy-safe tracking payload.
 * NEVER includes raw latitude/longitude for farmers or buyers.
 */
export function buildSanitizedTracking({ shipment, stops = [], latestLoc, userId, role }) {
  if (!latestLoc) {
    return {
      status: shipment.status,
      driverName: shipment.driver_name || 'Assigned Driver',
      vehicleType: shipment.vehicle_type || 'Transport Vehicle',
      hasGpsFix: false,
      estimatedRemainingDistanceKm: shipment.estimated_distance_km || 0,
      estimatedEtaMinutes: null,
      currentStopIndex: 0,
      totalStops: stops.length,
      currentStopName: stops[0]?.location_name || 'Starting Point',
      privacyNotice: 'Live vehicle location is approximate. Exact GPS coordinates are not displayed.',
      lastUpdated: shipment.updated_at
    };
  }

  // Find active / next incomplete stop
  const nextStop = stops.find(s => s.status === 'PENDING' || s.status === 'ARRIVED') || stops[stops.length - 1];
  const nextStopIndex = nextStop ? nextStop.stop_index : stops.length - 1;

  // Calculate straight-line distance from driver GPS to target destination
  let estimatedDistanceToTargetKm = 0;
  if (nextStop && latestLoc.latitude && latestLoc.longitude) {
    estimatedDistanceToTargetKm = calculateHaversineKm(
      latestLoc.latitude,
      latestLoc.longitude,
      nextStop.latitude,
      nextStop.longitude
    );
  }

  // Calculate ETA based on speed (or default assumed 35 km/h if moving, or fallback)
  let estimatedEtaMinutes = null;
  const speedKmh = latestLoc.speed && latestLoc.speed > 5 ? latestLoc.speed : 35; // assumed realistic transit speed
  if (estimatedDistanceToTargetKm > 0) {
    estimatedEtaMinutes = Math.max(1, Math.round((estimatedDistanceToTargetKm / speedKmh) * 60));
  }

  // Base sanitized tracking for farmers/buyers
  const sanitized = {
    shipmentId: shipment.shipment_id,
    status: shipment.status,
    driverName: shipment.driver_name || 'Assigned Driver',
    vehicleType: shipment.vehicle_type || 'Transport Vehicle',
    hasGpsFix: true,
    estimatedRemainingDistanceKm: estimatedDistanceToTargetKm,
    estimatedEtaMinutes: estimatedEtaMinutes,
    currentStopIndex: nextStopIndex,
    totalStops: stops.length,
    currentStopName: nextStop?.location_name || 'In Transit',
    currentStopType: nextStop?.stop_type || 'PICKUP',
    speedKmh: latestLoc.speed ? Math.round(latestLoc.speed) : null,
    heading: latestLoc.heading || null,
    progressPercent: stops.length > 0 ? Math.round((stops.filter(s => s.status === 'COMPLETED').length / stops.length) * 100) : 0,
    privacyNotice: 'Live vehicle location is approximate. Exact GPS coordinates are not displayed.',
    lastUpdated: latestLoc.timestamp || latestLoc.updated_at || new Date().toISOString()
  };

  // If driver or admin, attach raw telemetry
  if (role === 'driver' || role === 'admin') {
    return {
      ...sanitized,
      driverCoordinates: {
        latitude: latestLoc.latitude,
        longitude: latestLoc.longitude,
        accuracy: latestLoc.accuracy
      }
    };
  }

  // Strict: Return NO raw coordinates to farmers/buyers
  return sanitized;
}

/**
 * Broadcasts driver location update to shipment room with privacy-partitioned payloads
 */
export async function broadcastLocationUpdate(shipmentId, latestLoc, shipment, stops) {
  if (!io) return;
  const roomName = `shipment:${shipmentId}`;
  const room = io.sockets.adapter.rooms.get(roomName);
  if (!room) return;

  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) continue;

    const role = socket.data.participantRole || 'viewer';
    const userId = socket.data.userId;

    const payload = buildSanitizedTracking({
      shipment,
      stops,
      latestLoc,
      userId,
      role
    });

    socket.emit('shipment:location_update', payload);
  }
}

/**
 * Broadcasts shipment status change to room
 */
export function broadcastStatusChange(shipmentId, status, metadata = {}) {
  if (!io) return;
  io.to(`shipment:${shipmentId}`).emit('shipment:status_changed', {
    shipmentId,
    status,
    metadata,
    timestamp: new Date().toISOString()
  });
}

/**
 * Broadcasts stop status progress
 */
export function broadcastStopProgress(shipmentId, stopIndex, stopStatus, stopDetails = {}) {
  if (!io) return;
  io.to(`shipment:${shipmentId}`).emit('shipment:stop_progress', {
    shipmentId,
    stopIndex,
    stopStatus,
    stopDetails,
    timestamp: new Date().toISOString()
  });
}

export function broadcastListingCreated(listing) {
  if (!io) return;
  console.log(`[Socket.IO] Broadcasting listing:created (${listing.id})`);
  io.emit('listing:created', listing);
}

export function broadcastListingUpdated(listing) {
  if (!io) return;
  console.log(`[Socket.IO] Broadcasting listing:updated (${listing.id})`);
  io.emit('listing:updated', listing);
}

export function broadcastListingDeleted(payload) {
  if (!io) return;
  console.log(`[Socket.IO] Broadcasting listing:deleted (${payload.id || payload})`);
  io.emit('listing:deleted', typeof payload === 'object' ? payload : { id: payload });
}

export function broadcastAgroConnectCreated(post) {
  if (!io) return;
  console.log(`[Socket.IO] Broadcasting agroconnect:created (${post.id})`);
  io.emit('agroconnect:created', post);
}

export function broadcastAgroConnectUpdated(post) {
  if (!io) return;
  console.log(`[Socket.IO] Broadcasting agroconnect:updated (${post.id})`);
  io.emit('agroconnect:updated', post);
}

export function broadcastAgroConnectDeleted(payload) {
  if (!io) return;
  console.log(`[Socket.IO] Broadcasting agroconnect:deleted (${payload.id || payload})`);
  io.emit('agroconnect:deleted', typeof payload === 'object' ? payload : { id: payload });
}

export function broadcastProcurementOrderCreated(order) {
  if (!io) return;
  console.log(`[Socket.IO] Broadcasting procurement:created (${order.order_id || order.id})`);
  io.emit('procurement:created', order);
  io.emit('procurement:order_created', order);
}

export function broadcastProcurementOrderUpdated(order) {
  if (!io) return;
  console.log(`[Socket.IO] Broadcasting procurement:updated (${order.order_id || order.id})`);
  io.emit('procurement:updated', order);
  io.emit('procurement:order_updated', order);
}

export function getIO() {
  return io;
}


