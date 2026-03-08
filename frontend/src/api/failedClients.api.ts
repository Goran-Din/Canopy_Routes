import { http } from './http';

export interface FailedClient {
  id: string;
  client_name: string;
  service_address: string;
  city: string;
  state: string;
  zip: string;
  acres: number;
  annual_revenue: number | null;
  geocode_status: string;
  failure_reason: string | null;
  uploaded_at: string;
}

export interface FailedClientsData {
  total: number;
  clients: FailedClient[];
}

export async function getFailedClients(): Promise<FailedClientsData> {
  const res = await http.get('/v1/export/failed-clients');
  return res.data.data;
}

export async function downloadFailedClientsCsv(): Promise<void> {
  const res = await http.get('/v1/export/failed-clients', {
    params: { format: 'csv' },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'failed_clients_report.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function retryGeocode(clientId: string): Promise<void> {
  await http.post(`/v1/clients/${clientId}/retry-geocode`);
}
