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

// Route aliases for universal frontend compatibility
router.get('/agroconnect', getAgroConnectPosts);
router.get('/agroconnect/:id', getAgroConnectPostById);
router.post('/agroconnect', createAgroConnectPost);
router.patch('/agroconnect/:id', updateAgroConnectPost);
router.delete('/agroconnect/:id', deleteAgroConnectPost);

// Farmer-to-Farmer interaction & connection routes
router.post('/agroconnect/posts/:id/interact', interactWithPost);
router.patch('/agroconnect/posts/:id/connect', manageConnection);
router.post('/agroconnect/:id/interact', interactWithPost);
router.patch('/agroconnect/:id/connect', manageConnection);

export default router;
