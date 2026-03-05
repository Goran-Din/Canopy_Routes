// api/src/middleware/auth.middleware.ts
// JWT RS256 authentication and role-based authorization middleware
// Last modified: 2026-03-04

import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload, AuthenticatedRequest } from '../types/auth.types';

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
    req.user = decoded;
    next();
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
