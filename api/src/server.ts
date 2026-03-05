// api/src/server.ts
// Express application entry point for Canopy Routes API
// Last modified: 2026-03-04

import dotenv from 'dotenv';
dotenv.config({ override: true });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import winston from 'winston';
import { healthRouter } from './routes/health.routes';
import { authRouter } from './routes/auth.routes';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use(healthRouter);
app.use(authRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`Canopy Routes API started on port ${PORT}`);
});
