import express from 'express';
import {
  getCarbonActivities,
  getCarbonActivityById,
  createCarbonActivity,
  submitCarbonOffer,
  respondToCarbonOffer
} from '../controllers/carbonController.js';

const router = express.Router();

router.get('/carbon/activities', getCarbonActivities);
router.get('/carbon/activities/:id', getCarbonActivityById);
router.post('/carbon/activities', createCarbonActivity);
router.post('/carbon/activities/:id/offers', submitCarbonOffer);
router.patch('/carbon/activities/:id/offers/:offerId', respondToCarbonOffer);

export default router;
