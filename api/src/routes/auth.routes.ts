// api/src/routes/auth.routes.ts
// Authentication route definitions with rate limiting
// Last modified: 2026-03-05

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import { loginHandler, refreshHandler, logoutHandler, meHandler } from '../controllers/auth.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { AuthenticatedRequest } from '../types/auth.types';
import { pool } from '../db/pool';

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

// POST /v1/auth/change-password — force password change
router.post('/v1/auth/change-password', authenticateToken, (async (req: AuthenticatedRequest, res: any) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
  }
  try {
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2',
      [hash, req.user!.userId]
    );
    res.json({ success: true, data: { message: 'Password changed successfully' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}) as any);

export { router as authRouter };
