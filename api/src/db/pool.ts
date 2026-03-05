// api/src/db/pool.ts
// Shared PostgreSQL connection pool for the Canopy Routes API
// Last modified: 2026-03-04

import { Pool } from 'pg';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

logger.info('Database pool created');
