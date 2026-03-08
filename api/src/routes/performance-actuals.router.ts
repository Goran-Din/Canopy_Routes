// api/src/routes/performance-actuals.router.ts
// Track actual hours vs estimated for routes

import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { AuthenticatedRequest } from '../types/auth.types';
import { pool } from '../db/pool';

const router = Router();

const actualsSchema = z.object({
  routeId: z.string().uuid(),
  seasonId: z.string().uuid(),
  weekOf: z.string(), // date string YYYY-MM-DD
  actualHrs: z.number().min(0).max(24),
});

// ── POST /v1/performance-actuals ──

router.post('/v1/performance-actuals', authenticateToken, requireRole('owner', 'coordinator'), (async (req: AuthenticatedRequest, res: Response) => {
  const parsed = actualsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  const { routeId, seasonId, weekOf, actualHrs } = parsed.data;
  const tenantId = req.user!.tenantId;

  // Get estimated hours from route stops
  const routeResult = await pool.query(
    `SELECT
       COALESCE(SUM(rs.productive_time_hrs), 0) + COALESCE(SUM(rs.drive_time_from_prev_mins) / 60.0, 0) AS estimated_hrs
     FROM rpw_route_stops rs
     WHERE rs.route_id = $1 AND rs.deleted_at IS NULL`,
    [routeId]
  );
  const estimatedHrs = parseFloat(routeResult.rows[0]?.estimated_hrs) || 0;

  const result = await pool.query(
    `INSERT INTO rpw_performance_actuals
       (tenant_id, route_id, season_id, week_of, estimated_hrs, actual_hrs)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (route_id, week_of) DO UPDATE
       SET actual_hrs = EXCLUDED.actual_hrs, estimated_hrs = EXCLUDED.estimated_hrs
     RETURNING *`,
    [tenantId, routeId, seasonId, weekOf, estimatedHrs, actualHrs]
  );

  const r = result.rows[0];
  res.status(201).json({
    success: true,
    data: {
      id: r.id,
      routeId: r.route_id,
      weekOf: r.week_of,
      estimatedHrs: parseFloat(r.estimated_hrs),
      actualHrs: parseFloat(r.actual_hrs),
      varianceHrs: parseFloat(r.variance_hrs),
    },
  });
}) as any);

// ── GET /v1/performance-actuals?route_id=&season_id= ──

router.get('/v1/performance-actuals', authenticateToken, requireRole('owner', 'coordinator'), (async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const routeId = req.query.route_id as string | undefined;
  const seasonId = req.query.season_id as string | undefined;

  let query = 'SELECT * FROM rpw_performance_actuals WHERE tenant_id = $1';
  const params: any[] = [tenantId];

  if (routeId) {
    params.push(routeId);
    query += ` AND route_id = $${params.length}`;
  }
  if (seasonId) {
    params.push(seasonId);
    query += ` AND season_id = $${params.length}`;
  }
  query += ' ORDER BY week_of DESC';

  const result = await pool.query(query, params);
  res.json({
    success: true,
    data: result.rows.map((r) => ({
      id: r.id,
      routeId: r.route_id,
      seasonId: r.season_id,
      weekOf: r.week_of,
      estimatedHrs: parseFloat(r.estimated_hrs),
      actualHrs: parseFloat(r.actual_hrs),
      varianceHrs: parseFloat(r.variance_hrs),
    })),
  });
}) as any);

export { router as performanceActualsRouter };
