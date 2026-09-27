import express from 'express';
import {
  getUserNotifications,
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification
} from '../controllers/notificationController.js';

const router = express.Router();

router.get('/notifications/:userId', getUserNotifications);
router.post('/notifications', createNotification);
router.patch('/notifications/:id/read', markNotificationRead);
router.patch('/notifications/:userId/read-all', markAllNotificationsRead);
router.delete('/notifications/:id', deleteNotification);

export default router;
