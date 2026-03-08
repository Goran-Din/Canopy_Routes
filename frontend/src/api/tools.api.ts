import { http } from './http';
import type { ZoneFitResult, RemovalImpactResult, RouteFStatus } from '../types/map.types';

export async function zoneFit(params: {
  address: string;
  acres?: number;
  season_id: string;
  client_type?: string;
}): Promise<ZoneFitResult> {
  const res = await http.post('/v1/tools/zone-fit', params);
  return res.data.data;
}

export async function removalImpact(params: {
  client_id: string;
  route_stop_id: string;
}): Promise<RemovalImpactResult> {
  const res = await http.post('/v1/tools/removal-impact', params);
  return res.data.data;
}

export async function getRouteFStatus(seasonId: string): Promise<RouteFStatus> {
  const res = await http.get('/v1/tools/route-f-status', { params: { season_id: seasonId } });
  return res.data.data;
}

export interface SuggestRoutesResult {
  total_clients: number;
  assigned: number;
  unassignable: number;
  suggestions: Array<{
    client_id: string;
    client_name: string;
    suggested_route_id: string;
    suggested_route_label: string;
    zone: string;
    day: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  route_summary: Array<{
    route_id: string;
    route_label: string;
    day_of_week: string;
    current_stops: number;
    suggested_additions: number;
    projected_stops: number;
    projected_hours: number;
    capacity_status: string;
    max_stops: number;
  }>;
  unassignable_clients: Array<{ id: string; client_name: string }>;
}

export async function getSuggestedRoutes(seasonId: string): Promise<SuggestRoutesResult> {
  const res = await http.get('/v1/tools/suggest-routes', { params: { season_id: seasonId } });
  return res.data.data;
}

export interface OptimizeRouteResult {
  improved: boolean;
  oldDistanceKm: number;
  newDistanceKm: number;
  reductionPercent: number;
  stopsReordered: number;
  newWorkdayHrs: number;
}

export async function optimizeRoute(routeId: string): Promise<OptimizeRouteResult> {
  const res = await http.post('/v1/tools/optimize-route', { route_id: routeId });
  return res.data.data;
}

export async function applySuggestions(
  seasonId: string,
  assignments: Array<{ client_id: string; route_id: string }>
): Promise<{ assigned: number; errors: number }> {
  const res = await http.post('/v1/tools/apply-suggestions', { season_id: seasonId, assignments });
  return res.data.data;
}
