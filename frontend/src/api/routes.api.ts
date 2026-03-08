import { http } from './http';
import type { RouteWithSummary, RouteStop } from '../types/map.types';

export async function fetchRoutes(seasonId: string): Promise<RouteWithSummary[]> {
  const res = await http.get('/v1/routes', { params: { season_id: seasonId } });
  return res.data.data;
}

export async function fetchStops(routeId: string): Promise<RouteStop[]> {
  const res = await http.get('/v1/route-stops', { params: { route_id: routeId } });
  return res.data.data;
}

export async function removeStop(stopId: string): Promise<RouteWithSummary> {
  const res = await http.delete(`/v1/route-stops/${stopId}`);
  return res.data.data;
}

export async function reorderStops(routeId: string, stopIds: string[]): Promise<RouteWithSummary> {
  const res = await http.patch(`/v1/route-stops/${routeId}/reorder`, { stop_ids: stopIds });
  return res.data.data;
}

export async function exportRouteCsv(seasonId: string, routeId?: string): Promise<void> {
  const params: Record<string, string> = { season_id: seasonId };
  if (routeId) params.route_id = routeId;
  const res = await http.get('/v1/export/routes', { params, responseType: 'blob' });
  const disposition = res.headers['content-disposition'] ?? '';
  const match = disposition.match(/filename="(.+?)"/);
  const filename = match ? match[1] : 'routes_export.csv';
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
