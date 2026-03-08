import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { AuthenticatedRequest } from '../types/auth.types';
import { pool } from '../db/pool';

const router = Router();

// ── GET /v1/hardscape-pins ──────────────────────────────────
router.get('/v1/hardscape-pins', authenticateToken, requireRole('owner', 'coordinator'), (async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const seasonId = req.query.season_id as string | undefined;

  let query = `
    SELECT hp.id, hp.lat, hp.lng, hp.project_name AS label, hp.category, hp.notes,
           hp.season_id, hp.added_by AS created_by, u.display_name AS created_by_name,
           hp.created_at
    FROM rpw_hardscape_pins hp
    LEFT JOIN users u ON u.id = hp.added_by
    WHERE hp.tenant_id = $1 AND hp.deleted_at IS NULL`;
  const params: any[] = [tenantId];

  if (seasonId) {
    query += ` AND (hp.season_id = $2 OR hp.season_id IS NULL)`;
    params.push(seasonId);
  }

  query += ` ORDER BY hp.created_at DESC`;

  const result = await pool.query(query, params);
  res.json({ success: true, data: result.rows });
}) as any);

// ── POST /v1/hardscape-pins ─────────────────────────────────
const createSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().min(1).max(100),
  category: z.enum(['driveway', 'patio', 'retaining_wall', 'steps', 'other']),
  notes: z.string().max(500).optional(),
  season_id: z.string().uuid().optional(),
});

router.post('/v1/hardscape-pins', authenticateToken, requireRole('owner', 'coordinator'), (async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const userId = req.user!.userId;

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  const { lat, lng, label, category, notes, season_id } = parsed.data;

  const result = await pool.query(
    `INSERT INTO rpw_hardscape_pins (tenant_id, lat, lng, project_name, category, notes, season_id, added_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, lat, lng, project_name AS label, category, notes, season_id,
               added_by AS created_by, created_at`,
    [tenantId, lat, lng, label, category, notes ?? null, season_id ?? null, userId]
  );

  const pin = result.rows[0];
  pin.created_by_name = req.user!.role; // will be replaced by display_name below

  // Fetch display_name for response
  const userRes = await pool.query(`SELECT display_name FROM users WHERE id = $1`, [userId]);
  pin.created_by_name = userRes.rows[0]?.display_name ?? null;

  res.status(201).json({ success: true, data: pin });
}) as any);

// ── PATCH /v1/hardscape-pins/:id ────────────────────────────
const updateSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  category: z.enum(['driveway', 'patio', 'retaining_wall', 'steps', 'other']).optional(),
  notes: z.string().max(500).optional(),
});

router.patch('/v1/hardscape-pins/:id', authenticateToken, requireRole('owner', 'coordinator'), (async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const userId = req.user!.userId;
  const role = req.user!.role;
  const pinId = req.params.id;

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  // Check pin exists and ownership
  const existing = await pool.query(
    `SELECT id, added_by FROM rpw_hardscape_pins WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [pinId, tenantId]
  );
  if (existing.rows.length === 0) {
    res.status(404).json({ success: false, error: 'Pin not found.' });
    return;
  }

  // Coordinator can only edit own pins
  if (role === 'coordinator' && existing.rows[0].added_by !== userId) {
    res.status(403).json({ success: false, error: 'You can only edit your own pins.' });
    return;
  }

  const { label, category, notes } = parsed.data;
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (label !== undefined) { sets.push(`project_name = $${idx++}`); params.push(label); }
  if (category !== undefined) { sets.push(`category = $${idx++}`); params.push(category); }
  if (notes !== undefined) { sets.push(`notes = $${idx++}`); params.push(notes); }

  if (sets.length === 0) {
    res.status(400).json({ success: false, error: 'No fields to update.' });
    return;
  }

  params.push(pinId, tenantId);
  const result = await pool.query(
    `UPDATE rpw_hardscape_pins SET ${sets.join(', ')}
     WHERE id = $${idx++} AND tenant_id = $${idx}
     RETURNING id, lat, lng, project_name AS label, category, notes, season_id,
               added_by AS created_by, created_at`,
    params
  );

  res.json({ success: true, data: result.rows[0] });
}) as any);

// ── DELETE /v1/hardscape-pins/:id ───────────────────────────
router.delete('/v1/hardscape-pins/:id', authenticateToken, requireRole('owner', 'coordinator'), (async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const userId = req.user!.userId;
  const role = req.user!.role;
  const pinId = req.params.id;

  const existing = await pool.query(
    `SELECT id, added_by FROM rpw_hardscape_pins WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [pinId, tenantId]
  );
  if (existing.rows.length === 0) {
    res.status(404).json({ success: false, error: 'Pin not found.' });
    return;
  }

  if (role === 'coordinator' && existing.rows[0].added_by !== userId) {
    res.status(403).json({ success: false, error: 'You can only delete your own pins.' });
    return;
  }

  await pool.query(
    `UPDATE rpw_hardscape_pins SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2`,
    [pinId, tenantId]
  );

  res.status(204).send();
}) as any);

export { router as hardscapePinsRouter };
