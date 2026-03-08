// api/src/routes/profitability.router.ts
// Cost configuration and route profitability endpoints

import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { AuthenticatedRequest } from '../types/auth.types';
import { pool } from '../db/pool';
import { calcRouteCost, getMarginStatus, kmToMiles, CostConfig } from '../services/profitability.service';

const router = Router();

// ── Helper: parse cost config row ──

function parseCostRow(row: any): CostConfig & { id: string } {
  return {
    id: row.id,
    laborRate: parseFloat(row.labor_rate),
    crewSize: row.crew_size,
    fuelCostPerMile: parseFloat(row.fuel_cost_per_mile),
    equipmentCostPerHour: parseFloat(row.equipment_cost_per_hour),
    overheadRatePercent: parseFloat(row.overhead_rate_percent),
  };
}

// ── GET /v1/cost-config ──

router.get('/v1/cost-config', authenticateToken, requireRole('owner', 'coordinator'), (async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const result = await pool.query(
    'SELECT * FROM rpw_cost_config WHERE tenant_id = $1',
    [tenantId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ success: false, error: 'Cost config not found.' });
    return;
  }
  res.json({ success: true, data: parseCostRow(result.rows[0]) });
}) as any);

// ── PUT /v1/cost-config ──

const costConfigSchema = z.object({
  laborRate: z.number().positive(),
  crewSize: z.number().int().min(1).max(10),
  fuelCostPerMile: z.number().min(0),
  equipmentCostPerHour: z.number().min(0),
  overheadRatePercent: z.number().min(0).max(100),
});

router.put('/v1/cost-config', authenticateToken, requireRole('owner'), (async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const parsed = costConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }
  const d = parsed.data;
  const result = await pool.query(
    `UPDATE rpw_cost_config
     SET labor_rate = $1, crew_size = $2, fuel_cost_per_mile = $3,
         equipment_cost_per_hour = $4, overhead_rate_percent = $5, updated_at = NOW()
     WHERE tenant_id = $6
     RETURNING *`,
    [d.laborRate, d.crewSize, d.fuelCostPerMile, d.equipmentCostPerHour, d.overheadRatePercent, tenantId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ success: false, error: 'Cost config not found.' });
    return;
  }
  res.json({ success: true, data: parseCostRow(result.rows[0]) });
}) as any);

// ── GET /v1/profitability/routes?season_id= ──

router.get('/v1/profitability/routes', authenticateToken, requireRole('owner', 'coordinator'), (async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const seasonId = req.query.season_id as string;

  if (!seasonId) {
    res.status(400).json({ success: false, error: 'season_id query parameter is required.' });
    return;
  }

  // Load cost config
  const cfgResult = await pool.query(
    'SELECT * FROM rpw_cost_config WHERE tenant_id = $1',
    [tenantId]
  );
  if (cfgResult.rows.length === 0) {
    res.status(404).json({ success: false, error: 'Cost config not found. Set up cost configuration first.' });
    return;
  }
  const config = parseCostRow(cfgResult.rows[0]);

  // Query routes with aggregated stop data
  const routesResult = await pool.query(
    `SELECT
       r.id,
       r.route_label,
       r.day_of_week,
       r.depot_lat,
       r.depot_lng,
       COUNT(rs.id)::int AS stop_count,
       COALESCE(SUM(c.annual_revenue), 0) AS annual_revenue,
       COALESCE(SUM(rs.productive_time_hrs), 0) AS total_productive_hrs,
       COALESCE(SUM(rs.drive_time_from_prev_mins) / 60.0, 0) AS total_drive_hrs
     FROM rpw_routes r
     LEFT JOIN rpw_route_stops rs ON rs.route_id = r.id AND rs.deleted_at IS NULL
     LEFT JOIN rpw_clients c ON c.id = rs.client_id AND c.deleted_at IS NULL
     WHERE r.tenant_id = $1 AND r.season_id = $2 AND r.is_active = true
     GROUP BY r.id, r.route_label, r.day_of_week, r.depot_lat, r.depot_lng
     ORDER BY r.route_label`,
    [tenantId, seasonId]
  );

  const routes = routesResult.rows.map((row) => {
    const weeklyHours = parseFloat(row.total_productive_hrs) + parseFloat(row.total_drive_hrs);
    // Estimate weekly miles from drive hours: avg 40 km/h * road factor 1.35, convert to miles
    const driveHrs = parseFloat(row.total_drive_hrs);
    const estimatedKm = driveHrs * 40; // avg speed from formulas
    const weeklyMiles = kmToMiles(estimatedKm);

    const annualRevenue = parseFloat(row.annual_revenue);
    const annualCost = calcRouteCost(weeklyHours, weeklyMiles, config);
    const annualProfit = annualRevenue - annualCost;
    const marginPercent = annualRevenue > 0 ? (annualProfit / annualRevenue) * 100 : 0;

    return {
      routeId: row.id,
      routeName: row.route_label,
      dayOfWeek: row.day_of_week,
      stopCount: row.stop_count,
      annualRevenue: Math.round(annualRevenue),
      annualCost: Math.round(annualCost),
      annualProfit: Math.round(annualProfit),
      marginPercent: Math.round(marginPercent * 10) / 10,
      status: getMarginStatus(marginPercent),
      weeklyHours: Math.round(weeklyHours * 100) / 100,
      weeklyMiles: Math.round(weeklyMiles * 100) / 100,
    };
  });

  // Summary
  const totalRevenue = routes.reduce((s, r) => s + r.annualRevenue, 0);
  const totalCost = routes.reduce((s, r) => s + r.annualCost, 0);
  const totalProfit = totalRevenue - totalCost;
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const bestRoute = routes.length > 0
    ? routes.reduce((best, r) => r.marginPercent > best.marginPercent ? r : best, routes[0])
    : null;

  res.json({
    success: true,
    data: {
      routes,
      summary: {
        totalRevenue,
        totalCost,
        totalProfit,
        avgMarginPercent: Math.round(avgMargin * 10) / 10,
        bestRoute,
        routesNeedingReview: routes.filter((r) => r.status === 'POOR' || r.status === 'CRITICAL').length,
      },
    },
  });
}) as any);

export { router as profitabilityRouter };
