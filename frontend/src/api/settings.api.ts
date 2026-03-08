import { http } from './http';

export interface CrewSettings {
  id: string;
  crew_code: string;
  display_name: string;
  mow_rate_ac_hr: number;
  crew_type: string;
}

export interface RouteSlotSettings {
  id: string;
  route_label: string;
  zone_label: string;
  day_of_week: string;
  max_stops: number;
  target_hours: number;
  crew_id: string | null;
  crew_code: string | null;
  crew_name: string | null;
  mow_rate_ac_hr: number | null;
  crew_type: string | null;
}

export interface SettingsData {
  crews: CrewSettings[];
  routes: RouteSlotSettings[];
}

export async function getSettings(seasonId: string): Promise<SettingsData> {
  const res = await http.get('/v1/settings', { params: { season_id: seasonId } });
  return res.data.data;
}

export async function updateCrew(
  crewId: string,
  data: { mow_rate_ac_hr?: number; crew_type?: string }
): Promise<CrewSettings> {
  const res = await http.patch(`/v1/settings/crews/${crewId}`, data);
  return res.data.data;
}

export async function updateRoute(
  routeId: string,
  data: { max_stops?: number; target_hours?: number; route_label?: string }
): Promise<RouteSlotSettings> {
  const res = await http.patch(`/v1/settings/routes/${routeId}`, data);
  return res.data.data;
}
