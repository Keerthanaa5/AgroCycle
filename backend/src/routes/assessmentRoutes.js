import { Router } from 'express';
import { getAssessments, getAssessmentById, createAssessment } from '../controllers/assessmentController.js';

const router = Router();

router.get('/assessments', getAssessments);
router.get('/assessments/:id', getAssessmentById);
router.post('/assessments', createAssessment);

export default router;
