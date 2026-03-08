export interface PdfJob {
  jobId: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  progress: number;
  total: number;
  completed: number;
  files: Array<{ routeLabel: string; filePath: string }>;
  error?: string;
  createdAt: Date;
}

const jobs = new Map<string, PdfJob>();

export function createJob(jobId: string, total: number): PdfJob {
  const job: PdfJob = { jobId, status: 'pending', progress: 0, total, completed: 0, files: [], createdAt: new Date() };
  jobs.set(jobId, job);
  return job;
}

export function getJob(jobId: string): PdfJob | undefined {
  return jobs.get(jobId);
}

export function updateJob(jobId: string, update: Partial<PdfJob>): void {
  const job = jobs.get(jobId);
  if (job) jobs.set(jobId, { ...job, ...update });
}

// Clean up jobs older than 1 hour
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [id, job] of jobs.entries()) {
    if (job.createdAt < oneHourAgo) jobs.delete(id);
  }
}, 10 * 60 * 1000);
