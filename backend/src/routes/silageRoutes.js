import express from 'express';
import {
  getSilageCenters,
  getSilageCenterById,
  createSilageCenter,
  deleteSilageCenter,
  getSilageBookings,
  createSilageBooking,
  updateSilageBookingStatus
} from '../controllers/silageController.js';

const router = express.Router();

router.get('/silage/centers', getSilageCenters);
router.get('/silage/centers/:id', getSilageCenterById);
router.post('/silage/centers', createSilageCenter);
router.delete('/silage/centers/:id', deleteSilageCenter);

router.get('/silage/bookings', getSilageBookings);
router.post('/silage/bookings', createSilageBooking);
router.patch('/silage/bookings/:id/status', updateSilageBookingStatus);

export default router;
