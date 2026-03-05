// api/src/routes/health.routes.ts
// Health check endpoint — no auth required (polled by Uptime Kuma)
// Last modified: 2026-03-04

import { Router, Request, Response } from 'express';
import winston from 'winston';
import { pool } from '../db/pool';

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  logger.debug('Health check called');

  try {
    await pool.query('SELECT 1 AS ok');
    res.status(200).json({
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      db: 'connected',
    });
  } catch {
    res.status(503).json({
      status: 'degraded',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      db: 'disconnected',
      error: 'Database unreachable',
    });
  }
});

export { router as healthRouter };
