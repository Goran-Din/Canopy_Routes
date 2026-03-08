// api/src/middleware/auth.middleware.ts
// JWT RS256 authentication and role-based authorization middleware
// Last modified: 2026-03-04

import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload, AuthenticatedRequest } from '../types/auth.types';
import { pool } from '../db/pool';

const publicKey = (process.env.JWT_PUBLIC_KEY || '').replace(/\\n/g, '\n');

export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ success: false, error: 'Unauthorized', code: 'INVALID_TOKEN' });
    return;
  }

  try {
    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as JwtPayload;

    // Reject super_admin tokens on tenant endpoints
    if ((decoded as any).role === 'super_admin') {
      res.status(403).json({ success: false, error: 'Use tenant credentials for this endpoint' });
      return;
    }

    req.user = decoded;

    // Check tenant is not suspended
    pool.query('SELECT status FROM tenants WHERE id = $1', [decoded.tenantId])
      .then(result => {
        if (result.rows[0]?.status === 'suspended') {
          res.status(403).json({ success: false, error: 'Account suspended. Contact support.' });
          return;
        }
        next();
      })
      .catch(() => {
        next();
      });
  } catch {
    res.status(401).json({ success: false, error: 'Unauthorized', code: 'INVALID_TOKEN' });
  }
}

// 403 is correct for wrong role; 401 is for missing/invalid token
export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'Forbidden', code: 'INSUFFICIENT_ROLE' });
      return;
    }
    next();
  };
}

export function requireSuperAdmin() {
  return (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }
    const token = authHeader.slice(7);
    try {
      const key = (process.env.JWT_PUBLIC_KEY || '').replace(/\\n/g, '\n');
      if (!key) return res.status(500).json({ success: false, error: 'JWT not configured' });
      const payload = jwt.verify(token, key, { algorithms: ['RS256'] }) as any;
      if (payload.role !== 'super_admin') {
        return res.status(403).json({ success: false, error: 'Super-admin access required' });
      }
      req.adminId = payload.adminId;
      req.adminEmail = payload.email;
      next();
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
  };
}
