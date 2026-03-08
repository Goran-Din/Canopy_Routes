import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { getDashboardSummary } from '../repositories/dashboard.repo';

export async function getDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const role = req.user!.role;
  const seasonId = req.query.season_id as string;

  if (!seasonId) {
    res.status(400).json({ success: false, error: 'season_id query parameter is required.' });
    return;
  }

  try {
    const data = await getDashboardSummary(tenantId, seasonId);

    // Hide revenue from salesperson role
    if (role === 'salesperson') {
      data.revenue = { annual_total: 0, monthly_avg: 0 };
    }

    res.json({ success: true, data });
  } catch (err) {
    if ((err as Error).message === 'Season not found') {
      res.status(404).json({ success: false, error: 'Season not found.' });
      return;
    }
    throw err;
  }
}
