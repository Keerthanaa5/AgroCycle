import { Router } from 'express';
import {
  syncEntityAction,
  syncBatch,
  getUserSyncHistory
} from '../controllers/syncController.js';

const router = Router();

router.post('/sync', syncBatch);
router.post('/sync/:entityType', syncEntityAction);
router.get('/sync/:userId', getUserSyncHistory);

export default router;
