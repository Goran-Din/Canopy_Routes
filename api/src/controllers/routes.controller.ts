// api/src/controllers/routes.controller.ts
// HTTP handlers for route builder CRUD endpoints
// Last modified: 2026-03-05

import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/auth.types';
import * as routesService from '../services/routes.service';
import { ConflictError } from '../services/routes.service';

const assignCrewSchema = z.object({
  crew_id: z.string().uuid(),
});

const addStopSchema = z.object({
  client_id: z.string().uuid(),
});

const reorderSchema = z.object({
  stop_ids: z.array(z.string().uuid()).min(1),
});

export async function getRoutesBySeason(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const seasonId = req.query.season_id as string;

  if (!seasonId) {
    res.status(400).json({ success: false, error: 'season_id query parameter is required.' });
    return;
  }

  const routes = await routesService.getRoutesBySeasonWithSummary(tenantId, seasonId);
  res.json({ success: true, data: routes });
}

export async function getRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const routeId = req.params.id as string;

  const result = await routesService.getRouteWithSummary(tenantId, routeId);
  if (!result) {
    res.status(404).json({ success: false, error: 'Route not found.' });
    return;
  }

  res.json({ success: true, data: result });
}

export async function assignCrew(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const routeId = req.params.id as string;

  const parsed = assignCrewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  try {
    const result = await routesService.assignCrewToRoute(tenantId, routeId, parsed.data.crew_id);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof ConflictError) {
      res.status(409).json({ success: false, error: err.message });
      return;
    }
    throw err;
  }
}

export async function getStops(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const routeId = req.query.route_id as string;

  if (!routeId) {
    res.status(400).json({ success: false, error: 'route_id query parameter is required.' });
    return;
  }

  const result = await routesService.getRouteWithSummary(tenantId, routeId);
  if (!result) {
    res.status(404).json({ success: false, error: 'Route not found.' });
    return;
  }

  res.json({ success: true, data: result.stops });
}

export async function addStop(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const routeId = req.params.route_id as string;

  const parsed = addStopSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  try {
    const result = await routesService.addStopToRoute(tenantId, routeId, parsed.data.client_id);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err instanceof ConflictError) {
      res.status(409).json({ success: false, error: err.message });
      return;
    }
    throw err;
  }
}

export async function removeStop(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const stopId = req.params.id as string;

  try {
    const result = await routesService.removeStop(tenantId, stopId);
    res.json({ success: true, data: result });
  } catch (err) {
    if ((err as Error).message === 'Stop not found') {
      res.status(404).json({ success: false, error: 'Stop not found.' });
      return;
    }
    throw err;
  }
}

export async function reorderStopsHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const routeId = req.params.route_id as string;

  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  const result = await routesService.reorderStops(tenantId, routeId, parsed.data.stop_ids);
  res.json({ success: true, data: result });
}
