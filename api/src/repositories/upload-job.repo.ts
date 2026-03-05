// api/src/repositories/upload-job.repo.ts
// Database queries for rpw_upload_jobs — parameterised SQL only
// Last modified: 2026-03-05

import { pool } from '../db/pool';
import { UploadJobStatus } from '../types/upload.types';

export async function createUploadJob(
  tenantId: string,
  uploadedBy: string,
  seasonId: string,
  filename: string,
  totalRows: number
): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO rpw_upload_jobs (tenant_id, uploaded_by, season_id, original_filename, total_rows)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [tenantId, uploadedBy, seasonId, filename, totalRows]
  );
  return result.rows[0].id;
}

export async function updateJobProgress(
  jobId: string,
  processedRows: number,
  importedRows: number,
  failedRows: number
): Promise<void> {
  await pool.query(
    `UPDATE rpw_upload_jobs
     SET processed_rows = $2, imported_rows = $3, failed_rows = $4,
         status = 'processing', updated_at = NOW()
     WHERE id = $1`,
    [jobId, processedRows, importedRows, failedRows]
  );
}

export async function completeUploadJob(
  jobId: string,
  importedRows: number,
  failedRows: number,
  errorRows: object[],
  warningRows: object[]
): Promise<void> {
  await pool.query(
    `UPDATE rpw_upload_jobs
     SET status = 'complete', imported_rows = $2, failed_rows = $3,
         error_rows = $4::jsonb, warning_rows = $5::jsonb,
         completed_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [jobId, importedRows, failedRows, JSON.stringify(errorRows), JSON.stringify(warningRows)]
  );
}

export async function failUploadJob(jobId: string, errorMessage: string): Promise<void> {
  await pool.query(
    `UPDATE rpw_upload_jobs
     SET status = 'failed', error_rows = $2::jsonb,
         completed_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [jobId, JSON.stringify([{ error: errorMessage }])]
  );
}

export async function getUploadJob(tenantId: string, jobId: string): Promise<UploadJobStatus | null> {
  const result = await pool.query<{
    id: string;
    status: string;
    total_rows: number;
    processed_rows: number;
    imported_rows: number;
    failed_rows: number;
    error_rows: object[] | null;
    completed_at: string | null;
  }>(
    `SELECT id, status, total_rows, processed_rows, imported_rows, failed_rows, error_rows, completed_at
     FROM rpw_upload_jobs WHERE id = $1 AND tenant_id = $2`,
    [jobId, tenantId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    jobId: row.id,
    status: row.status as UploadJobStatus['status'],
    progress: row.total_rows > 0 ? Math.round((row.processed_rows / row.total_rows) * 100) : 0,
    total: row.total_rows,
    imported: row.imported_rows,
    failed: row.failed_rows,
    errorRows: (row.error_rows || []) as UploadJobStatus['errorRows'],
    completedAt: row.completed_at,
  };
}
