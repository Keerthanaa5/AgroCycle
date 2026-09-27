import { Router } from 'express';
import {
  getDriversAndVehicles,
  createShipment,
  listShipments,
  getShipmentById,
  updateDriverLocation,
  getShipmentTracking,
  updateShipmentStatus,
  updateStopStatus
} from '../controllers/logisticsController.js';

const router = Router();

// Drivers & Vehicles Catalog
router.get('/logistics/drivers-vehicles', getDriversAndVehicles);

// Shipment CRUD & Multi-Participant Retrieval
router.post('/logistics/shipments', createShipment);
router.get('/logistics/shipments', listShipments);
router.get('/logistics/shipments/:shipmentId', getShipmentById);

// Driver Real GPS Ingestion & Broadcast
router.post('/shipments/:shipmentId/location', updateDriverLocation);
router.post('/logistics/shipments/:shipmentId/location', updateDriverLocation);

// Live Tracking (Privacy-Sanitized for Farmers & Buyers)
router.get('/shipments/:shipmentId/tracking', getShipmentTracking);
router.get('/logistics/shipments/:shipmentId/tracking', getShipmentTracking);

// Shipment Status Transitions
router.patch('/shipments/:shipmentId/status', updateShipmentStatus);
router.patch('/logistics/shipments/:shipmentId/status', updateShipmentStatus);

// Shipment Stops Progress
router.patch('/shipments/:shipmentId/stops/:stopIndex', updateStopStatus);
router.patch('/logistics/shipments/:shipmentId/stops/:stopIndex', updateStopStatus);

export default router;
