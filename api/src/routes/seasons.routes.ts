// api/src/routes/seasons.routes.ts
// Seasons endpoints — read + publish workflow
// Last modified: 2026-03-07

import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { AuthenticatedRequest } from '../types/auth.types';
import { pool } from '../db/pool';

const router = Router();

router.get('/v1/seasons', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const result = await pool.query(
    `SELECT id, year, season_label, tab, status,
            submitted_at, submitted_by, published_at, published_by, request_changes_note
     FROM rpw_seasons WHERE tenant_id = $1
     ORDER BY year DESC`,
    [tenantId]
  );
  res.json({ success: true, data: result.rows });
});

// ── POST /v1/seasons/:id/submit — Coordinator submits for review ──

router.post('/v1/seasons/:id/submit', authenticateToken, requireRole('coordinator'), (async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const userId = req.user!.userId;
  const seasonId = req.params.id;

  const season = await pool.query(
    `SELECT id, status FROM rpw_seasons WHERE id = $1 AND tenant_id = $2`,
    [seasonId, tenantId]
  );
  if (season.rows.length === 0) {
    res.status(404).json({ success: false, error: 'Season not found.' });
    return;
  }
  if (season.rows[0].status !== 'draft') {
    res.status(409).json({ success: false, error: 'Season is not in draft status.' });
    return;
  }

  const result = await pool.query(
    `UPDATE rpw_seasons
     SET status = 'pending_approval', submitted_at = NOW(), submitted_by = $1, request_changes_note = NULL
     WHERE id = $2 AND tenant_id = $3
     RETURNING *`,
    [userId, seasonId, tenantId]
  );

  res.json({ success: true, data: result.rows[0] });
}) as any);

// ── POST /v1/seasons/:id/request-changes — Owner sends back to draft ──

const requestChangesSchema = z.object({
  note: z.string().min(1).max(500),
});

router.post('/v1/seasons/:id/request-changes', authenticateToken, requireRole('owner'), (async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const seasonId = req.params.id;

  const parsed = requestChangesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  const season = await pool.query(
    `SELECT id, status FROM rpw_seasons WHERE id = $1 AND tenant_id = $2`,
    [seasonId, tenantId]
  );
  if (season.rows.length === 0) {
    res.status(404).json({ success: false, error: 'Season not found.' });
    return;
  }
  if (season.rows[0].status !== 'pending_approval') {
    res.status(409).json({ success: false, error: 'Season is not pending approval.' });
    return;
  }

  const result = await pool.query(
    `UPDATE rpw_seasons
     SET status = 'draft', request_changes_note = $1
     WHERE id = $2 AND tenant_id = $3
     RETURNING *`,
    [parsed.data.note, seasonId, tenantId]
  );

  res.json({ success: true, data: result.rows[0] });
}) as any);

// ── Shared validation logic ──

interface ValidationCheck {
  id: string;
  label: string;
  passed: boolean;
}

async function runPrePublishValidation(tenantId: string, seasonId: string): Promise<ValidationCheck[]> {
  // CHECK 1 — No RED routes (workday > 9h)
  // We compute workday_hrs from stops since there's no stored column
  const redRoutesRes = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM (
       SELECT r.id,
              COALESCE(SUM(rs.productive_time_hrs), 0) +
              COALESCE(SUM(rs.drive_time_from_prev_mins) / 60.0, 0) AS workday_hrs
       FROM rpw_routes r
       LEFT JOIN rpw_route_stops rs ON rs.route_id = r.id AND rs.deleted_at IS NULL
       WHERE r.season_id = $1 AND r.tenant_id = $2 AND r.is_active = true
       GROUP BY r.id
       HAVING COALESCE(SUM(rs.productive_time_hrs), 0) +
              COALESCE(SUM(rs.drive_time_from_prev_mins) / 60.0, 0) > 9.0
     ) sub`,
    [seasonId, tenantId]
  );

  // CHECK 2 — All routes have crew assigned
  const noCrewRes = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM rpw_routes
     WHERE season_id = $1 AND tenant_id = $2 AND is_active = true AND crew_id IS NULL`,
    [seasonId, tenantId]
  );

  // CHECK 3 — No confirmed clients unassigned
  const unassignedConfirmedRes = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM rpw_clients c
     WHERE c.tenant_id = $1
       AND c.deleted_at IS NULL
       AND c.client_status = 'confirmed'
       AND NOT EXISTS (
         SELECT 1 FROM rpw_route_stops rs
         JOIN rpw_routes r ON r.id = rs.route_id
         WHERE rs.client_id = c.id
           AND rs.deleted_at IS NULL
           AND r.season_id = $2
           AND r.is_active = true
       )`,
    [tenantId, seasonId]
  );

  // CHECK 4 — Season has at least 1 route with stops
  const hasStopsRes = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM rpw_routes r
     JOIN rpw_route_stops rs ON rs.route_id = r.id AND rs.deleted_at IS NULL
     WHERE r.season_id = $1 AND r.tenant_id = $2 AND r.is_active = true`,
    [seasonId, tenantId]
  );

  return [
    { id: 'no_red_routes', label: 'No routes over 9h', passed: redRoutesRes.rows[0].cnt === 0 },
    { id: 'crews_assigned', label: 'All routes have crew', passed: noCrewRes.rows[0].cnt === 0 },
    { id: 'confirmed_clients_assigned', label: 'All confirmed clients assigned', passed: unassignedConfirmedRes.rows[0].cnt === 0 },
    { id: 'has_stops', label: 'Season has at least one stop', passed: hasStopsRes.rows[0].cnt > 0 },
  ];
}

// ── POST /v1/seasons/:id/publish — Owner publishes ──

router.post('/v1/seasons/:id/publish', authenticateToken, requireRole('owner'), (async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const userId = req.user!.userId;
  const seasonId = req.params.id as string;

  const season = await pool.query(
    `SELECT id, status FROM rpw_seasons WHERE id = $1 AND tenant_id = $2`,
    [seasonId, tenantId]
  );
  if (season.rows.length === 0) {
    res.status(404).json({ success: false, error: 'Season not found.' });
    return;
  }
  if (season.rows[0].status !== 'pending_approval') {
    res.status(409).json({ success: false, error: 'Season is not pending approval.' });
    return;
  }

  const checks = await runPrePublishValidation(tenantId, seasonId);
  const allPassed = checks.every((c) => c.passed);

  if (!allPassed) {
    res.status(422).json({ success: false, error: 'Pre-publish validation failed', checks });
    return;
  }

  const result = await pool.query(
    `UPDATE rpw_seasons
     SET status = 'published', published_at = NOW(), published_by = $1
     WHERE id = $2 AND tenant_id = $3
     RETURNING *`,
    [userId, seasonId, tenantId]
  );

  res.json({ success: true, data: { season: result.rows[0], checks } });
}) as any);

// ── GET /v1/seasons/:id/validation — Live check without status change ──

router.get('/v1/seasons/:id/validation', authenticateToken, requireRole('owner', 'coordinator'), (async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const seasonId = req.params.id as string;

  const season = await pool.query(
    `SELECT id FROM rpw_seasons WHERE id = $1 AND tenant_id = $2`,
    [seasonId, tenantId]
  );
  if (season.rows.length === 0) {
    res.status(404).json({ success: false, error: 'Season not found.' });
    return;
  }

  const checks = await runPrePublishValidation(tenantId, seasonId);
  res.json({ success: true, data: { checks } });
}) as any);

export { router as seasonsRouter };
