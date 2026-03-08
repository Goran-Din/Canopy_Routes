import { http } from './http';

export interface PdfJobStatus {
  status: 'pending' | 'running' | 'complete' | 'error';
  progress: number;
  total: number;
  completed: number;
  files: Array<{ routeLabel: string }>;
  error?: string;
}

export async function startPdfGeneration(params: {
  route_ids?: string[];
  season_id?: string;
  include_revenue?: boolean;
}): Promise<string> {
  const res = await http.post('/v1/export/pdf', params);
  return res.data.data.job_id;
}

export async function pollPdfJob(jobId: string): Promise<PdfJobStatus> {
  const res = await http.get(`/v1/export/pdf/${jobId}`);
  return res.data.data;
}

export async function downloadPdfZip(jobId: string): Promise<void> {
  const res = await http.get(`/v1/export/pdf/${jobId}/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sunset-routes-2026.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
