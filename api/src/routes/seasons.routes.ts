// api/src/routes/seasons.routes.ts
// Minimal read-only seasons endpoint (full CRUD in Sprint 5)
// Last modified: 2026-03-05

import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { AuthenticatedRequest } from '../types/auth.types';
import { pool } from '../db/pool';

const router = Router();

router.get('/v1/seasons', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const result = await pool.query(
    `SELECT id, year, season_label, tab, status
     FROM rpw_seasons WHERE tenant_id = $1
     ORDER BY year DESC`,
    [tenantId]
  );
  res.json({ success: true, data: result.rows });
});

export { router as seasonsRouter };
