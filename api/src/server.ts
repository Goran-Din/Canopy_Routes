// api/src/server.ts
// Express application entry point for Canopy Routes API
// Last modified: 2026-03-04

import dotenv from 'dotenv';
dotenv.config({ override: true });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import { healthRouter } from './routes/health.routes';
import { authRouter } from './routes/auth.routes';
import { uploadRouter } from './routes/upload.routes';
import { seasonsRouter } from './routes/seasons.routes';
import { routesRouter } from './routes/routes.router';
import { clientsRouter } from './routes/clients.router';
import { toolsRouter } from './routes/tools.router';
import { settingsRouter } from './routes/settings.router';
import { exportRouter } from './routes/export.router';
import { exportPdfRouter } from './routes/export-pdf.router';
import { dashboardRouter } from './routes/dashboard.router';
import { prospectPinsRouter } from './routes/prospect-pins.router';
import { hardscapePinsRouter } from './routes/hardscape-pins.router';
import { profitabilityRouter } from './routes/profitability.router';
import { aiRouter } from './routes/ai.router';
import { snapshotsRouter } from './routes/snapshots.router';
import { performanceActualsRouter } from './routes/performance-actuals.router';
import { aiActionsRouter } from './routes/ai-actions.router';
import { adminAuthRouter } from './routes/admin-auth.router';
import { adminTenantsRouter } from './routes/admin-tenants.router';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "maps.googleapis.com"],
      imgSrc: ["'self'", "maps.gstatic.com", "data:"],
    },
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

const allowedOrigins = [
  'https://routes.sunsetapp.us',
  'https://routes-staging.sunsetapp.us',
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3032'] : []),
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS: origin not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(cookieParser());

// Global rate limiter: 200 requests per minute per IP (skip /health)
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
}));

app.use(healthRouter);
app.use(authRouter);
app.use('/v1/clients', uploadRouter);
app.use(seasonsRouter);
app.use(routesRouter);
app.use(clientsRouter);
app.use(toolsRouter);
app.use(settingsRouter);
app.use(exportRouter);
app.use('/v1/export/pdf', exportPdfRouter);
app.use(dashboardRouter);
app.use(prospectPinsRouter);
app.use(hardscapePinsRouter);
app.use(profitabilityRouter);
app.use(aiRouter);
app.use(snapshotsRouter);
app.use(performanceActualsRouter);
app.use('/v1/ai-actions', aiActionsRouter);
app.use('/v1/auth/admin', adminAuthRouter);
app.use('/v1/admin/tenants', adminTenantsRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`Canopy Routes API started on port ${PORT}`);
});
