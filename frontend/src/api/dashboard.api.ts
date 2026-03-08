import { http } from './http';

export interface RouteSlotSummary {
  id: string;
  route_label: string;
  zone_label: string;
  day_of_week: string;
  crew_code: string | null;
  stops: number;
  workday_hrs: number;
  capacity_status: 'green' | 'yellow' | 'red';
  max_stops: number;
}

export interface NeedsAttentionItem {
  type: 'geocode_failed' | 'unconfirmed_acres' | 'over_capacity' | 'unassigned_clients' | 'no_crew';
  severity: 'high' | 'medium' | 'low';
  label: string;
  detail: string;
  action: string;
}

export interface DashboardData {
  season: {
    id: string; label: string; status: string; tab: string; created_at: string;
    submitted_at: string | null; published_at: string | null; request_changes_note: string | null;
  };
  clients: {
    total: number;
    confirmed: number;
    pending: number;
    at_risk: number;
    assigned: number;
    unassigned: number;
    unconfirmed_acres: number;
    geocode_failed: number;
  };
  revenue: {
    annual_total: number;
    monthly_avg: number;
  };
  routes: {
    total: number;
    green: number;
    yellow: number;
    red: number;
    over_capacity: Array<{ id: string; route_label: string; workday_hrs: number }>;
  };
  route_slots: RouteSlotSummary[];
  needs_attention: NeedsAttentionItem[];
}

export async function getDashboard(seasonId: string): Promise<DashboardData> {
  const res = await http.get('/v1/dashboard', { params: { season_id: seasonId } });
  return res.data.data;
}

export interface ValidationCheck {
  id: string;
  label: string;
  passed: boolean;
}

export async function submitSeasonForReview(seasonId: string): Promise<any> {
  const res = await http.post(`/v1/seasons/${seasonId}/submit`);
  return res.data.data;
}

export async function requestSeasonChanges(seasonId: string, note: string): Promise<any> {
  const res = await http.post(`/v1/seasons/${seasonId}/request-changes`, { note });
  return res.data.data;
}

export async function publishSeason(seasonId: string): Promise<{ season: any; checks: ValidationCheck[] }> {
  const res = await http.post(`/v1/seasons/${seasonId}/publish`);
  return res.data.data;
}

export async function getSeasonValidation(seasonId: string): Promise<{ checks: ValidationCheck[] }> {
  const res = await http.get(`/v1/seasons/${seasonId}/validation`);
  return res.data.data;
}
