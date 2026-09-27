import { Router } from 'express';
import { getUserLocations, getUserLocationByFarmId, saveLocation } from '../controllers/locationController.js';

const router = Router();

router.get('/locations/:userId', getUserLocations);
router.get('/locations/:userId/:farmId', getUserLocationByFarmId);
router.post('/locations', saveLocation);

export default router;
