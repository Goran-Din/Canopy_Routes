import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { getDashboard } from '../controllers/dashboard.controller';

const router = Router();

router.get('/v1/dashboard', authenticateToken, getDashboard as any);

export { router as dashboardRouter };
