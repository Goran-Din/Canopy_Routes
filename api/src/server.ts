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
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5173'] : []),
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`Canopy Routes API started on port ${PORT}`);
});
