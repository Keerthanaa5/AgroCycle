import express from 'express';
import {
  getAgroConnectPosts,
  getAgroConnectPostById,
  createAgroConnectPost,
  updateAgroConnectPost,
  deleteAgroConnectPost,
  interactWithPost,
  manageConnection
} from '../controllers/agroconnectController.js';

const router = express.Router();

router.get('/agroconnect/posts', getAgroConnectPosts);
router.get('/agroconnect/posts/:id', getAgroConnectPostById);
router.post('/agroconnect/posts', createAgroConnectPost);
router.patch('/agroconnect/posts/:id', updateAgroConnectPost);
router.delete('/agroconnect/posts/:id', deleteAgroConnectPost);

// Farmer-to-Farmer interaction & connection routes
router.post('/agroconnect/posts/:id/interact', interactWithPost);
router.patch('/agroconnect/posts/:id/connect', manageConnection);

export default router;
