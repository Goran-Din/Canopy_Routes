// api/src/routes/ai-actions.router.ts
// Endpoints for AI-proposed agentic actions (owner-only)

import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { AuthenticatedRequest } from '../types/auth.types';
import {
  executeMoveClient,
  executeMoveClients,
  executeReorderStops,
  executeCreateRoute,
  executeDeactivateRoute,
  executeUpdateCostConfig,
} from '../services/ai-actions.service';

const router = Router();

router.use(authenticateToken, requireRole('owner'));

// POST /v1/ai-actions/move-client
router.post('/move-client', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      clientId: z.string().uuid(),
      toRouteId: z.string().uuid(),
    });
    const parsed = schema.parse(req.body);
    const result = await executeMoveClient(
      req.user!.tenantId,
      req.user!.userId,
      parsed.clientId,
      parsed.toRouteId
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}) as any);

// POST /v1/ai-actions/move-multiple-clients
router.post('/move-multiple-clients', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      clientIds: z.array(z.string().uuid()).min(1).max(100),
      toRouteId: z.string().uuid(),
    });
    const parsed = schema.parse(req.body);
    const result = await executeMoveClients(
      req.user!.tenantId,
      req.user!.userId,
      parsed.clientIds,
      parsed.toRouteId
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}) as any);

// PATCH /v1/ai-actions/reorder-stops
router.patch('/reorder-stops', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      routeId: z.string().uuid(),
      orderedClientIds: z.array(z.string().uuid()).min(1),
    });
    const parsed = schema.parse(req.body);
    const result = await executeReorderStops(
      req.user!.tenantId,
      req.user!.userId,
      parsed.routeId,
      parsed.orderedClientIds
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}) as any);

// POST /v1/ai-actions/create-route
router.post('/create-route', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(100),
      seasonId: z.string().uuid(),
    });
    const parsed = schema.parse(req.body);
    const result = await executeCreateRoute(
      req.user!.tenantId,
      req.user!.userId,
      parsed.name,
      parsed.seasonId
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}) as any);

// POST /v1/ai-actions/deactivate-route
router.post('/deactivate-route', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      routeId: z.string().uuid(),
      redistributeToRouteId: z.string().uuid().optional(),
    });
    const parsed = schema.parse(req.body);
    const result = await executeDeactivateRoute(
      req.user!.tenantId,
      req.user!.userId,
      parsed.routeId,
      parsed.redistributeToRouteId
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}) as any);

// POST /v1/ai-actions/update-cost-config
router.post('/update-cost-config', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      laborRate: z.number().positive().optional(),
      crewSize: z.number().int().min(1).max(10).optional(),
      fuelCostPerMile: z.number().positive().optional(),
      equipmentCostPerHour: z.number().positive().optional(),
      overheadRatePercent: z.number().min(0).max(100).optional(),
    }).refine(data => Object.values(data).some(v => v !== undefined), {
      message: 'At least one field must be provided',
    });
    const parsed = schema.parse(req.body);
    const result = await executeUpdateCostConfig(
      req.user!.tenantId,
      req.user!.userId,
      parsed
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}) as any);

export { router as aiActionsRouter };
