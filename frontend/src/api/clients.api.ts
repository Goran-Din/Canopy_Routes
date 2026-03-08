import { http } from './http';
import type { Client, RouteWithSummary } from '../types/map.types';

export async function fetchClients(seasonId: string): Promise<Client[]> {
  const res = await http.get('/v1/clients', { params: { season_id: seasonId } });
  return res.data.data;
}

export async function assignClientToRoute(routeId: string, clientId: string): Promise<RouteWithSummary> {
  const res = await http.post(`/v1/route-stops/${routeId}`, { client_id: clientId });
  return res.data.data;
}

export interface CreateClientPayload {
  client_name: string;
  service_address: string;
  city: string;
  state: string;
  zip: string;
  acres: number;
  service_frequency: 'weekly' | 'biweekly' | 'monthly';
  annual_revenue?: number;
  snow_service?: boolean;
  access_notes?: string;
}

export async function createClient(payload: CreateClientPayload): Promise<Client> {
  const res = await http.post('/v1/clients', payload);
  return res.data.data;
}

export async function updateClientStatus(clientId: string, clientStatus: string): Promise<Client> {
  const res = await http.patch(`/v1/clients/${clientId}/status`, { client_status: clientStatus });
  return res.data.data;
}

export async function updateClient(clientId: string, fields: Partial<CreateClientPayload & { acreage_confirmed?: boolean; client_status?: string }>): Promise<Client> {
  const res = await http.patch(`/v1/clients/${clientId}`, fields);
  return res.data.data;
}

export async function updateClientCoordinates(clientId: string, lat: number, lng: number): Promise<Client> {
  const res = await http.patch(`/v1/clients/${clientId}/coordinates`, { lat, lng });
  return res.data.data;
}
