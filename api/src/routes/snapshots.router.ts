// api/src/routes/snapshots.router.ts
// Season snapshot CRUD endpoints

import { Router, Response } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { AuthenticatedRequest } from '../types/auth.types';
import { pool } from '../db/pool';
import { createSeasonSnapshot } from '../services/snapshot.service';

const router = Router();

// ── POST /v1/season-snapshots ──

router.post('/v1/season-snapshots', authenticateToken, requireRole('owner'), (async (req: AuthenticatedRequest, res: Response) => {
  const { seasonId, notes } = req.body;
  if (!seasonId) {
    res.status(400).json({ success: false, error: 'seasonId required' });
    return;
  }
  try {
    const id = await createSeasonSnapshot(req.user!.tenantId, seasonId, notes);
    res.status(201).json({ success: true, data: { id } });
  } catch (err: any) {
    console.error('[Snapshot] Create error:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Failed to create snapshot' });
  }
}) as any);

// ── GET /v1/season-snapshots ──

router.get('/v1/season-snapshots', authenticateToken, requireRole('owner', 'coordinator'), (async (req: AuthenticatedRequest, res: Response) => {
  const result = await pool.query(
    `SELECT id, season_id, season_year, season_type, total_clients,
            total_revenue, avg_margin_percent, snapshot_at, notes
     FROM rpw_season_snapshots
     WHERE tenant_id = $1
     ORDER BY snapshot_at DESC`,
    [req.user!.tenantId]
  );
  res.json({
    success: true,
    data: result.rows.map((r) => ({
      id: r.id,
      seasonId: r.season_id,
      seasonYear: r.season_year,
      seasonType: r.season_type,
      totalClients: r.total_clients,
      totalRevenue: parseFloat(r.total_revenue),
      avgMarginPercent: parseFloat(r.avg_margin_percent),
      snapshotAt: r.snapshot_at,
      notes: r.notes,
    })),
  });
}) as any);

// ── GET /v1/season-snapshots/:id ──

router.get('/v1/season-snapshots/:id', authenticateToken, requireRole('owner', 'coordinator'), (async (req: AuthenticatedRequest, res: Response) => {
  const result = await pool.query(
    'SELECT * FROM rpw_season_snapshots WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.user!.tenantId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ success: false, error: 'Snapshot not found' });
    return;
  }
  const r = result.rows[0];
  res.json({
    success: true,
    data: {
      id: r.id,
      seasonId: r.season_id,
      seasonYear: r.season_year,
      seasonType: r.season_type,
      totalClients: r.total_clients,
      totalRevenue: parseFloat(r.total_revenue),
      avgMarginPercent: parseFloat(r.avg_margin_percent),
      snapshotAt: r.snapshot_at,
      notes: r.notes,
      snapshotData: r.snapshot_data,
    },
  });
}) as any);

export { router as snapshotsRouter };
