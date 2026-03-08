import { http } from './http';

export interface Snapshot {
  id: string;
  seasonId: string;
  seasonYear: number;
  seasonType: string;
  totalClients: number;
  totalRevenue: number;
  avgMarginPercent: number;
  snapshotAt: string;
  notes?: string;
}

export async function fetchSnapshots(): Promise<Snapshot[]> {
  const res = await http.get('/v1/season-snapshots');
  return res.data.data;
}

export async function createSnapshot(seasonId: string, notes?: string): Promise<{ id: string }> {
  const res = await http.post('/v1/season-snapshots', { seasonId, notes });
  return res.data.data;
}

export async function recordActuals(
  routeId: string,
  seasonId: string,
  weekOf: string,
  actualHrs: number
): Promise<any> {
  const res = await http.post('/v1/performance-actuals', { routeId, seasonId, weekOf, actualHrs });
  return res.data.data;
}
