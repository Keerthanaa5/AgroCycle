import { Router } from 'express';
import {
  getMarketplaceListings,
  getListingById,
  createListing,
  updateListing,
  deleteListing
} from '../controllers/marketplaceController.js';

const router = Router();

router.get('/marketplace/listings', getMarketplaceListings);
router.get('/marketplace/listings/:id', getListingById);
router.post('/marketplace/listings', createListing);
router.patch('/marketplace/listings/:id', updateListing);
router.delete('/marketplace/listings/:id', deleteListing);

export default router;
