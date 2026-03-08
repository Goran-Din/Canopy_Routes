import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { exportRoutesCsv, exportFailedClients } from '../controllers/export.controller';

const router = Router();

router.get('/v1/export/routes', authenticateToken, requireRole('owner', 'coordinator'), exportRoutesCsv as any);
router.get('/v1/export/failed-clients', authenticateToken, requireRole('owner', 'coordinator'), exportFailedClients as any);

export { router as exportRouter };
