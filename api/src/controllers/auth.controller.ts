// api/src/controllers/auth.controller.ts
// HTTP request handlers for authentication endpoints
// Last modified: 2026-03-04

import { Request, Response } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().min(1),
});

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Invalid request body', details: parsed.error.issues });
    return;
  }

  try {
    const { email, password, tenantSlug } = parsed.data;
    const result = await authService.login(email, password, tenantSlug);

    res.cookie('rpw_refresh', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: THIRTY_DAYS_MS,
      path: '/',
    });

    res.status(200).json({
      success: true,
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
  } catch (err) {
    const message = err instanceof authService.AuthError ? err.message : 'Authentication failed';
    res.status(401).json({ success: false, error: message });
  }
}

export async function refreshHandler(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.rpw_refresh;
  if (!token) {
    res.status(401).json({ success: false, error: 'No refresh token', code: 'MISSING_TOKEN' });
    return;
  }

  try {
    const result = await authService.refreshToken(token);

    res.cookie('rpw_refresh', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: THIRTY_DAYS_MS,
      path: '/',
    });

    res.status(200).json({
      success: true,
      data: { accessToken: result.accessToken },
    });
  } catch (err) {
    const message = err instanceof authService.AuthError ? err.message : 'Token refresh failed';
    res.status(401).json({ success: false, error: message });
  }
}

export async function logoutHandler(_req: Request, res: Response): Promise<void> {
  res.clearCookie('rpw_refresh', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });

  res.status(200).json({ success: true, message: 'Logged out' });
}
