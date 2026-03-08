import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import {
  zoneFit,
  removalImpact,
  getRouteFStatus,
  suggestRoutes,
  applySuggestions,
  optimizeAllRoutes,
  optimizeRoute,
} from '../controllers/tools.controller';

const router = Router();

router.post('/v1/tools/zone-fit', authenticateToken, zoneFit as any);
router.post('/v1/tools/removal-impact', authenticateToken, requireRole('owner', 'coordinator'), removalImpact as any);
router.get('/v1/tools/route-f-status', authenticateToken, requireRole('owner', 'coordinator'), getRouteFStatus as any);
router.get('/v1/tools/suggest-routes', authenticateToken, requireRole('owner', 'coordinator'), suggestRoutes as any);
router.post('/v1/tools/apply-suggestions', authenticateToken, requireRole('owner', 'coordinator'), applySuggestions as any);
router.post('/v1/tools/optimize-routes', authenticateToken, requireRole('owner', 'coordinator'), optimizeAllRoutes as any);
router.post('/v1/tools/optimize-route', authenticateToken, requireRole('owner', 'coordinator'), optimizeRoute as any);

export { router as toolsRouter };
