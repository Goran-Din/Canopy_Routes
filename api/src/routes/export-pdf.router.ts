import { Router, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import archiver from 'archiver';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { AuthenticatedRequest } from '../types/auth.types';
import { pool } from '../db/pool';
import { generateRoutePdf, RouteSheetData } from '../services/pdf.service';
import { createJob, getJob, updateJob } from '../services/pdfJobStore.service';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

const router = Router();

const generateSchema = z.object({
  route_ids: z.array(z.string().uuid()).optional(),
  season_id: z.string().uuid().optional(),
  paper: z.enum(['letter', 'a4']).optional().default('letter'),
  include_revenue: z.boolean().optional().default(true),
});

// POST /v1/export/pdf — start PDF generation job
router.post('/', authenticateToken, requireRole('owner', 'coordinator'), (async (req: AuthenticatedRequest, res: Response) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  const tenantId = req.user!.tenantId;
  const { route_ids, season_id, include_revenue } = parsed.data;

  // Resolve routes: either specific IDs or all active routes in a season
  let routeRows: any[];
  if (route_ids && route_ids.length > 0) {
    const result = await pool.query(
      `SELECT r.id, r.route_label, r.day_of_week, r.crew_id,
              cr.crew_code
       FROM rpw_routes r
       LEFT JOIN rpw_crews cr ON cr.id = r.crew_id
       WHERE r.tenant_id = $1 AND r.id = ANY($2)
         AND r.tab = 'maintenance' AND r.is_active = true
       ORDER BY r.day_of_week, r.route_label`,
      [tenantId, route_ids]
    );
    routeRows = result.rows;
  } else {
    // Find the active season
    let resolvedSeasonId = season_id;
    if (!resolvedSeasonId) {
      const seasonResult = await pool.query(
        `SELECT id FROM rpw_seasons WHERE tenant_id = $1 AND status = 'draft' AND tab = 'maintenance'
         ORDER BY created_at DESC LIMIT 1`,
        [tenantId]
      );
      if (seasonResult.rows.length === 0) {
        res.status(404).json({ success: false, error: 'No active season found.' });
        return;
      }
      resolvedSeasonId = seasonResult.rows[0].id;
    }

    const result = await pool.query(
      `SELECT r.id, r.route_label, r.day_of_week, r.crew_id,
              cr.crew_code
       FROM rpw_routes r
       LEFT JOIN rpw_crews cr ON cr.id = r.crew_id
       WHERE r.tenant_id = $1 AND r.season_id = $2
         AND r.tab = 'maintenance' AND r.is_active = true
       ORDER BY r.day_of_week, r.route_label`,
      [tenantId, resolvedSeasonId]
    );
    routeRows = result.rows;
  }

  if (routeRows.length === 0) {
    res.status(404).json({ success: false, error: 'No routes found.' });
    return;
  }

  const jobId = crypto.randomUUID();
  createJob(jobId, routeRows.length);

  // Start background generation (fire and forget)
  generatePdfsInBackground(jobId, tenantId, routeRows, include_revenue!).catch((err) => {
    logger.error({ message: 'PDF generation failed', jobId, error: (err as Error).message });
    updateJob(jobId, { status: 'error', error: (err as Error).message });
  });

  res.status(202).json({ success: true, data: { job_id: jobId } });
}) as any);

// GET /v1/export/pdf/:jobId — poll job status
router.get('/:jobId', authenticateToken, requireRole('owner', 'coordinator'), (async (req: AuthenticatedRequest, res: Response) => {
  const job = getJob(req.params.jobId as string);
  if (!job) {
    res.status(404).json({ success: false, error: 'Job not found.' });
    return;
  }

  res.json({
    success: true,
    data: {
      status: job.status,
      progress: job.progress,
      total: job.total,
      completed: job.completed,
      files: job.files.map((f) => ({ routeLabel: f.routeLabel })),
      error: job.error,
    },
  });
}) as any);

// GET /v1/export/pdf/:jobId/download — download all PDFs as ZIP
router.get('/:jobId/download', authenticateToken, requireRole('owner', 'coordinator'), (async (req: AuthenticatedRequest, res: Response) => {
  const job = getJob(req.params.jobId as string);
  if (!job) {
    res.status(404).json({ success: false, error: 'Job not found.' });
    return;
  }
  if (job.status !== 'complete') {
    res.status(400).json({ success: false, error: 'Job not yet complete.' });
    return;
  }
  if (job.files.length === 0) {
    res.status(404).json({ success: false, error: 'No PDFs generated.' });
    return;
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="sunset-routes-2026.zip"');

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', (err: Error) => {
    logger.error({ message: 'ZIP archive error', error: err.message });
    if (!res.headersSent) res.status(500).json({ success: false, error: 'ZIP creation failed.' });
  });

  archive.pipe(res);

  for (const file of job.files) {
    const safeName = file.routeLabel.replace(/[^a-zA-Z0-9_\- ]/g, '') + '.pdf';
    archive.file(file.filePath, { name: safeName });
  }

  await archive.finalize();
}) as any);

async function generatePdfsInBackground(
  jobId: string,
  tenantId: string,
  routeRows: any[],
  includeRevenue: boolean
): Promise<void> {
  const tmpDir = path.join(os.tmpdir(), 'canopy-pdf-' + jobId);
  await fs.mkdir(tmpDir, { recursive: true });

  updateJob(jobId, { status: 'running' });

  for (let i = 0; i < routeRows.length; i++) {
    const route = routeRows[i];

    // Fetch stops with client data
    const stopsResult = await pool.query(
      `SELECT rs.sequence_order, rs.mow_time_hrs, rs.trim_time_hrs,
              rs.drive_time_from_prev_mins, rs.productive_time_hrs,
              c.client_name, c.service_address, c.city, c.acres,
              c.annual_revenue, c.time_constraints, c.access_notes
       FROM rpw_route_stops rs
       JOIN rpw_clients c ON c.id = rs.client_id
       WHERE rs.tenant_id = $1 AND rs.route_id = $2 AND rs.deleted_at IS NULL
       ORDER BY rs.sequence_order ASC`,
      [tenantId, route.id]
    );

    const stops = stopsResult.rows;
    let cumulativeMins = 0;
    let totalRevenue = 0;

    // Compute workday hours from stops (same logic as routes.service computeSummary)
    let totalProductiveHrs = 0;
    let totalDriveMins = 0;
    for (const stop of stops) {
      const weight = stop.service_frequency === 'biweekly' ? 0.5 : 1.0;
      totalProductiveHrs += Number(stop.productive_time_hrs) * weight;
      totalDriveMins += Number(stop.drive_time_from_prev_mins);
    }
    const totalDriveHrs = totalDriveMins / 60;
    const workdayHrs = totalProductiveHrs + totalDriveHrs;

    const sheetStops = stops.map((stop: any) => {
      const mowMins = Math.round((Number(stop.mow_time_hrs) + Number(stop.trim_time_hrs)) * 60);
      const driveMins = Math.round(Number(stop.drive_time_from_prev_mins));
      cumulativeMins += mowMins + driveMins;
      if (stop.annual_revenue) totalRevenue += Number(stop.annual_revenue);

      return {
        sequence: stop.sequence_order,
        clientName: stop.client_name,
        serviceAddress: stop.service_address,
        city: stop.city,
        acres: Number(stop.acres),
        mowTimeMinutes: mowMins,
        driveFromPrevMinutes: driveMins,
        cumulativeMinutes: cumulativeMins,
        timeConstraints: stop.time_constraints || undefined,
        accessNotes: stop.access_notes || undefined,
        annualRevenue: stop.annual_revenue ? Number(stop.annual_revenue) : undefined,
      };
    });

    const sheetData: RouteSheetData = {
      routeLabel: route.route_label,
      crewCode: route.crew_code || 'Unassigned',
      dayOfWeek: route.day_of_week || 'Unscheduled',
      totalStops: stops.length,
      workdayHours: workdayHrs,
      annualRevenue: totalRevenue > 0 ? totalRevenue : undefined,
      isThursday: (route.day_of_week || '').toLowerCase() === 'thursday',
      generatedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      stops: sheetStops,
    };

    const filePath = path.join(tmpDir, `${route.route_label.replace(/[^a-zA-Z0-9_\- ]/g, '')}.pdf`);
    await generateRoutePdf(sheetData, includeRevenue, filePath);

    const job = getJob(jobId);
    if (!job) return;

    const completed = i + 1;
    updateJob(jobId, {
      completed,
      progress: Math.round((completed / routeRows.length) * 100),
      files: [...job.files, { routeLabel: route.route_label, filePath }],
    });

    logger.info({ message: 'PDF generated', jobId, route: route.route_label, progress: `${completed}/${routeRows.length}` });
  }

  updateJob(jobId, { status: 'complete' });
  logger.info({ message: 'PDF generation complete', jobId });
}

export { router as exportPdfRouter };
