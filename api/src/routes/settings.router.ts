import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { getSettings, updateCrew, updateRoute } from '../controllers/settings.controller';

const router = Router();

router.get('/v1/settings', authenticateToken, getSettings as any);
router.patch('/v1/settings/crews/:id', authenticateToken, requireRole('owner'), updateCrew as any);
router.patch('/v1/settings/routes/:id', authenticateToken, requireRole('owner'), updateRoute as any);

export { router as settingsRouter };
