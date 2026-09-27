import { Router } from 'express';
import { getUserById, upsertUser, updateUser } from '../controllers/userController.js';

const router = Router();

router.get('/users/:userId', getUserById);
router.post('/users', upsertUser);
router.patch('/users/:userId', updateUser);

export default router;
