import { Router } from 'express';
import {
  getMarketplaceListings,
  getListingById,
  createListing,
  updateListing,
  deleteListing
} from '../controllers/marketplaceController.js';

const router = Router();

// Support both /marketplace/listings and /listings
router.get('/marketplace/listings', getMarketplaceListings);
router.get('/marketplace/listings/:id', getListingById);
router.post('/marketplace/listings', createListing);
router.patch('/marketplace/listings/:id', updateListing);
router.put('/marketplace/listings/:id', updateListing);
router.delete('/marketplace/listings/:id', deleteListing);

router.get('/listings', getMarketplaceListings);
router.get('/listings/:id', getListingById);
router.post('/listings', createListing);
router.patch('/listings/:id', updateListing);
router.put('/listings/:id', updateListing);
router.delete('/listings/:id', deleteListing);

export default router;
