// api/src/types/auth.types.ts
// Authentication type definitions for JWT RS256 auth system
// Last modified: 2026-03-04

import { Request } from 'express';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
  iat: number;
  exp: number;
}

export interface LoginRequest {
  email: string;
  password: string;
  tenantSlug: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    tenantId: string;
  };
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}
