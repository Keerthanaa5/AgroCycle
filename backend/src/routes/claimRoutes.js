import express from 'express';
import {
  getClaimDossiers,
  getClaimDossierById,
  createClaimDossier,
  deleteClaimDossier
} from '../controllers/claimController.js';

const router = express.Router();

router.get('/claims', getClaimDossiers);
router.get('/claims/:id', getClaimDossierById);
router.post('/claims', createClaimDossier);
router.delete('/claims/:id', deleteClaimDossier);

export default router;
