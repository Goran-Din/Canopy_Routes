// api/src/controllers/upload.controller.ts
// HTTP handlers for CSV upload and job status polling
// Last modified: 2026-03-05

import { Response } from 'express';
import winston from 'winston';
import { AuthenticatedRequest } from '../types/auth.types';
import { ValidatedRow } from '../types/upload.types';
import { GeocodedResult } from '../services/geocoding.service';
import { parseCSVBuffer, validateHeaders, validateRows, deduplicateRows } from '../services/csv-parse.service';
import { geocodeBatch } from '../services/geocoding.service';
import { upsertClient } from '../repositories/client.repo';
import {
  createUploadJob,
  updateJobProgress,
  completeUploadJob,
  failUploadJob,
  getUploadJob,
} from '../repositories/upload-job.repo';
import { pool } from '../db/pool';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

export async function uploadCSV(req: AuthenticatedRequest, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ success: false, error: 'No file uploaded. Send a .csv file in the "file" field.' });
    return;
  }

  if (!file.originalname.toLowerCase().endsWith('.csv')) {
    res.status(400).json({ success: false, error: 'Only .csv files are accepted.' });
    return;
  }

  const seasonId = req.body?.season_id;
  if (!seasonId) {
    res.status(400).json({ success: false, error: 'season_id is required in the request body.' });
    return;
  }

  const tenantId = req.user!.tenantId;
  const userId = req.user!.userId;

  // Validate season belongs to this tenant
  const seasonCheck = await pool.query(
    'SELECT id FROM rpw_seasons WHERE id = $1 AND tenant_id = $2',
    [seasonId, tenantId]
  );
  if (seasonCheck.rows.length === 0) {
    res.status(404).json({ success: false, error: 'Season not found or does not belong to this tenant.' });
    return;
  }

  // Parse CSV
  const { headers, rows, parseErrors } = parseCSVBuffer(file.buffer);

  if (parseErrors.length > 0) {
    logger.warn({ message: 'CSV parse errors', errors: parseErrors });
  }

  // Validate headers
  const headerCheck = validateHeaders(headers);
  if (!headerCheck.valid) {
    res.status(400).json({
      success: false,
      error: 'Missing required CSV headers.',
      missingHeaders: headerCheck.missingHeaders,
    });
    return;
  }

  // Validate row count
  if (rows.length > 1000) {
    res.status(400).json({ success: false, error: `CSV has ${rows.length} rows. Maximum is 1000.` });
    return;
  }

  // Validate and deduplicate
  const validation = validateRows(rows);
  const validRows = deduplicateRows(validation.valid);

  // Create job record
  const jobId = await createUploadJob(tenantId, userId, seasonId, file.originalname, validRows.length);

  // Return immediately with 202
  res.status(202).json({
    success: true,
    data: {
      jobId,
      rowCount: validRows.length,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
    },
  });

  // Run geocoding async
  setImmediate(() => {
    runGeocodeJob(jobId, tenantId, seasonId, validRows, validation.errors, validation.warnings);
  });
}

async function runGeocodeJob(
  jobId: string,
  tenantId: string,
  _seasonId: string,
  rows: ValidatedRow[],
  errors: Array<{ rowNumber: number; clientName: string; serviceAddress: string; errorMessage: string }>,
  warnings: Array<{ rowNumber: number; field: string; warningMessage: string }>
): Promise<void> {
  try {
    // Mark as processing
    await pool.query(
      'UPDATE rpw_upload_jobs SET status = $1, started_at = NOW(), updated_at = NOW() WHERE id = $2',
      ['processing', jobId]
    );

    // Geocode all rows
    const geocodedRows = await geocodeBatch(rows);

    let imported = 0;
    let failed = 0;
    let processed = 0;

    for (const row of geocodedRows) {
      try {
        await upsertClient(tenantId, _seasonId, row);
        imported++;
      } catch (err) {
        failed++;
        errors.push({
          rowNumber: row.rowNumber,
          clientName: row.clientName,
          serviceAddress: row.serviceAddress,
          errorMessage: (err as Error).message,
        });
      }
      processed++;

      // Update progress every 50 rows
      if (processed % 50 === 0) {
        await updateJobProgress(jobId, processed, imported, failed);
      }
    }

    await completeUploadJob(jobId, imported, failed, errors, warnings);
    logger.info({ message: 'Upload job complete', jobId, imported, failed });
  } catch (err) {
    logger.error({ message: 'Upload job failed', jobId, error: (err as Error).message });
    await failUploadJob(jobId, (err as Error).message);
  }
}

export async function getUploadJobStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const jobId = req.params.jobId as string;

  const job = await getUploadJob(tenantId, jobId);
  if (!job) {
    res.status(404).json({ success: false, error: 'Upload job not found.' });
    return;
  }

  res.status(200).json({ success: true, data: job });
}
