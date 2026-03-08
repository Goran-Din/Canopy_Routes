import { Router, Response } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { AuthenticatedRequest } from '../types/auth.types';
import { pool } from '../db/pool';

const router = Router();

// DELETE /v1/prospect-pins/:id — Soft-delete a prospect pin
router.delete('/v1/prospect-pins/:id', authenticateToken, requireRole('owner', 'coordinator'), (async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const pinId = req.params.id;

  const result = await pool.query(
    `UPDATE rpw_prospect_pins SET deleted_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [pinId, tenantId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ success: false, error: 'Prospect pin not found.' });
    return;
  }

  res.json({ success: true, data: { id: result.rows[0].id } });
}) as any);

export { router as prospectPinsRouter };
