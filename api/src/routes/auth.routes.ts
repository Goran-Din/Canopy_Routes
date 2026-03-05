// api/src/routes/auth.routes.ts
// Authentication route definitions with rate limiting on login
// Last modified: 2026-03-04

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loginHandler, refreshHandler, logoutHandler } from '../controllers/auth.controller';

const router = Router();

// Rate limit: 10 requests per 15 minutes per IP on login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Try again later.', code: 'RATE_LIMITED' },
});

router.post('/v1/auth/login', loginLimiter, loginHandler);
router.post('/v1/auth/refresh', refreshHandler);
router.post('/v1/auth/logout', logoutHandler);

export { router as authRouter };
