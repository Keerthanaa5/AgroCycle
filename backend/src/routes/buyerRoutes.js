import { Router } from 'express';
import {
  getBuyerRequirements,
  getBuyerRequirementById,
  createBuyerRequirement,
  updateBuyerRequirement
} from '../controllers/buyerController.js';

const router = Router();

router.get('/buyers/requirements', getBuyerRequirements);
router.get('/buyers/requirements/:id', getBuyerRequirementById);
router.post('/buyers/requirements', createBuyerRequirement);
router.patch('/buyers/requirements/:id', updateBuyerRequirement);

export default router;
