import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/auth.types';
import * as toolsService from '../services/tools.service';
import { GeocodingError } from '../services/tools.service';
import { optimizeSingleRoute } from '../services/routes.service';

const zoneFitSchema = z.object({
  address: z.string().min(1, 'address is required'),
  acres: z.number().positive().optional(),
  season_id: z.string().uuid('season_id must be a valid UUID'),
  client_type: z.enum(['residential', 'commercial']).default('residential'),
});

const applySuggestionsSchema = z.object({
  season_id: z.string().uuid('season_id must be a valid UUID'),
  assignments: z.array(z.object({
    client_id: z.string().uuid(),
    route_id: z.string().uuid(),
  })).min(1, 'assignments must not be empty'),
});

const removalImpactSchema = z.object({
  client_id: z.string().uuid('client_id must be a valid UUID'),
  route_stop_id: z.string().uuid('route_stop_id must be a valid UUID'),
});

export async function zoneFit(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const userRole = req.user!.role;

  const parsed = zoneFitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  try {
    const result = await toolsService.zoneFit(
      tenantId,
      parsed.data.address,
      parsed.data.acres,
      parsed.data.season_id,
      parsed.data.client_type,
      userRole
    );
    res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof GeocodingError) {
      res.status(422).json({ success: false, error: err.message });
      return;
    }
    throw err;
  }
}

export async function removalImpact(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;

  const parsed = removalImpactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  try {
    const result = await toolsService.removalImpact(
      tenantId,
      parsed.data.client_id,
      parsed.data.route_stop_id
    );
    res.json({ success: true, data: result });
  } catch (err) {
    if ((err as Error).message === 'Stop not found') {
      res.status(404).json({ success: false, error: 'Stop not found.' });
      return;
    }
    throw err;
  }
}

export async function suggestRoutes(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const seasonId = req.query.season_id as string;

  if (!seasonId) {
    res.status(400).json({ success: false, error: 'season_id query parameter is required.' });
    return;
  }

  const result = await toolsService.suggestAllRoutes(tenantId, seasonId);
  res.json({ success: true, data: result });
}

export async function applySuggestions(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;

  const parsed = applySuggestionsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  const result = await toolsService.applySuggestions(tenantId, parsed.data.assignments);
  res.json({ success: true, data: result });
}

export async function optimizeAllRoutes(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const seasonId = req.query.season_id as string;

  if (!seasonId) {
    res.status(400).json({ success: false, error: 'season_id query parameter is required.' });
    return;
  }

  const result = await toolsService.optimizeAllRoutes(tenantId, seasonId);
  res.json({ success: true, data: result });
}

const optimizeRouteSchema = z.object({
  route_id: z.string().uuid('route_id must be a valid UUID'),
});

export async function optimizeRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;

  const parsed = optimizeRouteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  try {
    const result = await optimizeSingleRoute(tenantId, parsed.data.route_id);
    res.json({ success: true, data: result });
  } catch (err) {
    if ((err as Error).message === 'Route not found') {
      res.status(404).json({ success: false, error: 'Route not found.' });
      return;
    }
    throw err;
  }
}

export async function getRouteFStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const seasonId = req.query.season_id as string;

  if (!seasonId) {
    res.status(400).json({ success: false, error: 'season_id query parameter is required.' });
    return;
  }

  const result = await toolsService.getRouteFStatus(tenantId, seasonId);
  res.json({ success: true, data: result });
}
