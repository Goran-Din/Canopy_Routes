// api/src/routes/routes.router.ts
// Route builder CRUD endpoints
// Last modified: 2026-03-05

import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import {
  getRoutesBySeason,
  getRoute,
  assignCrew,
  getStops,
  addStop,
  removeStop,
  reorderStopsHandler,
} from '../controllers/routes.controller';

const router = Router();

router.get('/v1/routes', authenticateToken, getRoutesBySeason as any);
router.get('/v1/routes/:id', authenticateToken, getRoute as any);
router.patch('/v1/routes/:id/crew', authenticateToken, requireRole('owner', 'coordinator'), assignCrew as any);

router.get('/v1/route-stops', authenticateToken, getStops as any);
router.post('/v1/route-stops/:route_id', authenticateToken, requireRole('owner', 'coordinator'), addStop as any);
router.delete('/v1/route-stops/:id', authenticateToken, requireRole('owner', 'coordinator'), removeStop as any);
router.patch('/v1/route-stops/:route_id/reorder', authenticateToken, requireRole('owner', 'coordinator'), reorderStopsHandler as any);

export { router as routesRouter };
