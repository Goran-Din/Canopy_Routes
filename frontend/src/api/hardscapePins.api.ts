import { http } from './http';

export interface HardscapePin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  category: 'driveway' | 'patio' | 'retaining_wall' | 'steps' | 'other';
  notes: string | null;
  season_id: string | null;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
}

export interface CreatePinPayload {
  lat: number;
  lng: number;
  label: string;
  category: HardscapePin['category'];
  notes?: string;
  season_id?: string;
}

export interface UpdatePinPayload {
  label?: string;
  category?: HardscapePin['category'];
  notes?: string;
}

export async function getHardscapePins(seasonId?: string): Promise<HardscapePin[]> {
  const params: Record<string, string> = {};
  if (seasonId) params.season_id = seasonId;
  const res = await http.get('/v1/hardscape-pins', { params });
  return res.data.data;
}

export async function createHardscapePin(data: CreatePinPayload): Promise<HardscapePin> {
  const res = await http.post('/v1/hardscape-pins', data);
  return res.data.data;
}

export async function updateHardscapePin(id: string, data: UpdatePinPayload): Promise<HardscapePin> {
  const res = await http.patch(`/v1/hardscape-pins/${id}`, data);
  return res.data.data;
}

export async function deleteHardscapePin(id: string): Promise<void> {
  await http.delete(`/v1/hardscape-pins/${id}`);
}
