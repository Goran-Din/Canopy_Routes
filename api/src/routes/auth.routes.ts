// api/src/routes/auth.routes.ts
// Authentication route definitions with rate limiting
// Last modified: 2026-03-05

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loginHandler, refreshHandler, logoutHandler, meHandler } from '../controllers/auth.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Rate limit: 5 attempts per 15 minutes per IP on login endpoint (RPW-A-3 §5.3)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Try again in 15 minutes.', code: 'RATE_LIMITED' },
  skip: () => process.env.NODE_ENV !== 'production',
});

// Rate limit: 60 requests per 15 minutes per IP on refresh endpoint
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/v1/auth/login', loginLimiter, loginHandler);
router.post('/v1/auth/refresh', refreshLimiter, refreshHandler);
router.post('/v1/auth/logout', logoutHandler);
router.get('/v1/auth/me', authenticateToken, meHandler);

// Test scaffold — will be removed in Sprint 13 security hardening
router.get('/v1/auth/test-owner-only', authenticateToken, requireRole('owner'), (_req, res) => {
  res.json({ success: true, message: 'owner only' });
});

export { router as authRouter };
