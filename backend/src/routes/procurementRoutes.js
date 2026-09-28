import { Router } from 'express';
import {
  getProcurementOrders,
  getProcurementOrderById,
  createProcurementOrder,
  updateProcurementOrderStatus,
  simulateProcurementPayment,
  arrangeTransportDetails,
  updateLogisticsStatus,
  updateLogisticsGps
} from '../controllers/procurementController.js';

const router = Router();

router.get('/procurement/orders', getProcurementOrders);
router.get('/procurement/orders/:id', getProcurementOrderById);
router.post('/procurement/orders', createProcurementOrder);
router.patch('/procurement/orders/:id', updateProcurementOrderStatus);
router.post('/procurement/orders/:id/simulate-payment', simulateProcurementPayment);
router.patch('/procurement/orders/:id/payment', simulateProcurementPayment);

// Smart Logistics & Order Tracking
router.post('/procurement/orders/:id/logistics', arrangeTransportDetails);
router.patch('/procurement/orders/:id/logistics', arrangeTransportDetails);
router.patch('/procurement/orders/:id/logistics/status', updateLogisticsStatus);
router.patch('/procurement/orders/:id/logistics/gps', updateLogisticsGps);

export default router;

