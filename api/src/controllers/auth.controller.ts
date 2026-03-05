// api/src/controllers/auth.controller.ts
// HTTP request handlers for authentication endpoints
// Last modified: 2026-03-05

import { Request, Response } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service';
import { findUserById } from '../repositories/auth.repo';
import { AuthenticatedRequest } from '../types/auth.types';

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
    const result = await authService.login(email, password, tenantSlug, req.ip || '');

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
    if (err instanceof authService.AuthError) {
      res.status(401).json({ success: false, error: err.message, code: err.code });
    } else {
      res.status(401).json({ success: false, error: 'Authentication failed' });
    }
  }
}

export async function refreshHandler(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.rpw_refresh;
  if (!token) {
    res.status(401).json({ success: false, error: 'No refresh token', code: 'MISSING_TOKEN' });
    return;
  }

  try {
    const result = await authService.refreshToken(token, req.ip || '');

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

export async function meHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = await findUserById(req.user!.userId);

    if (!user || !user.is_active) {
      res.status(401).json({ success: false, error: 'Unauthorized', code: 'INVALID_TOKEN' });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        tenantId: user.tenant_id,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function logoutHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (req.user) {
    authService.logout(req.user.userId, req.user.tenantId, req.ip || '');
  }

  res.clearCookie('rpw_refresh', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });

  res.status(200).json({ success: true, message: 'Logged out' });
}
