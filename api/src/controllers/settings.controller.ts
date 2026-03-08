import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/auth.types';
import * as settingsRepo from '../repositories/settings.repo';

const updateCrewSchema = z.object({
  mow_rate_ac_hr: z.number().positive().optional(),
  crew_type: z.enum(['mixed', 'commercial_only', 'residential_only']).optional(),
});

const updateRouteSchema = z.object({
  max_stops: z.number().int().min(1).max(100).optional(),
  target_hours: z.number().min(1).max(12).optional(),
  route_label: z.string().min(1).max(50).optional(),
});

export async function getSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const seasonId = req.query.season_id as string;

  if (!seasonId) {
    res.status(400).json({ success: false, error: 'season_id query parameter is required.' });
    return;
  }

  const [crews, routes] = await Promise.all([
    settingsRepo.getCrews(tenantId),
    settingsRepo.getRouteSlots(tenantId, seasonId),
  ]);

  res.json({ success: true, data: { crews, routes } });
}

export async function updateCrew(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const crewId = req.params.id as string;

  const parsed = updateCrewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  const result = await settingsRepo.updateCrew(tenantId, crewId, parsed.data);
  if (!result) {
    res.status(404).json({ success: false, error: 'Crew not found or no changes.' });
    return;
  }

  res.json({ success: true, data: result });
}

export async function updateRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const routeId = req.params.id as string;

  const parsed = updateRouteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  const result = await settingsRepo.updateRouteSlot(tenantId, routeId, parsed.data);
  if (!result) {
    res.status(404).json({ success: false, error: 'Route not found or no changes.' });
    return;
  }

  res.json({ success: true, data: result });
}
