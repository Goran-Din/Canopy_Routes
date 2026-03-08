// api/src/services/auth.service.ts
// Authentication business logic — login, refresh, logout
// Last modified: 2026-03-05

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {
  findUserByEmail,
  findActiveUserById,
  findTenantBySlug,
  updateFailedLoginAttempts,
  updateLastLogin,
  resetFailedAttempts,
} from '../repositories/auth.repo';
import {
  logLoginSuccess,
  logLoginFailed,
  logAccountLocked,
  logAccountLockedAttempt,
  logTokenRefreshed,
  logLogout,
} from '../utils/security-logger';

const privateKey = (process.env.JWT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const publicKey = (process.env.JWT_PUBLIC_KEY || '').replace(/\\n/g, '\n');

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '30d';

export async function login(email: string, password: string, tenantSlug: string, ip: string = '') {
  const tenant = await findTenantBySlug(tenantSlug);
  if (!tenant) {
    throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const user = await findUserByEmail(tenant.id, email);
  if (!user) {
    logLoginFailed(email, tenant.id, ip, 0);
    throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Check if account is locked
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    logAccountLockedAttempt(user.id, user.tenant_id, ip);
    throw new AuthError('Account is locked. Please try again later.', 'ACCOUNT_LOCKED');
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    const attempts = user.failed_login_attempts + 1;

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      await updateFailedLoginAttempts(user.id, attempts, lockedUntil);
      logAccountLocked(user.id, user.email, user.tenant_id, ip);
      throw new AuthError(
        'Account locked after too many failed attempts. Try again in 30 minutes.',
        'ACCOUNT_LOCKED'
      );
    }

    await updateFailedLoginAttempts(user.id, attempts, null);
    logLoginFailed(user.email, user.tenant_id, ip, attempts);
    throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Success — reset failed attempts and update last login
  await resetFailedAttempts(user.id);
  await updateLastLogin(user.id);
  logLoginSuccess(user.id, user.tenant_id, user.email, ip);

  const accessToken = jwt.sign(
    { userId: user.id, tenantId: user.tenant_id, role: user.role },
    privateKey,
    { algorithm: 'RS256', expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { userId: user.id, tenantId: user.tenant_id },
    privateKey,
    { algorithm: 'RS256', expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return {
    accessToken,
    refreshToken,
    mustChangePassword: (user as any).must_change_password === true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      tenantId: user.tenant_id,
    },
  };
}

export async function refreshToken(token: string, ip: string = '') {
  let decoded: { userId: string; tenantId: string };
  try {
    decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as {
      userId: string;
      tenantId: string;
    };
  } catch {
    throw new AuthError('Invalid refresh token');
  }

  // Look up user to confirm still active
  const user = await findActiveUserById(decoded.userId);
  if (!user) {
    throw new AuthError('Invalid refresh token');
  }

  logTokenRefreshed(user.id, user.tenant_id, ip);

  const accessToken = jwt.sign(
    { userId: user.id, tenantId: user.tenant_id, role: user.role },
    privateKey,
    { algorithm: 'RS256', expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const newRefreshToken = jwt.sign(
    { userId: user.id, tenantId: user.tenant_id },
    privateKey,
    { algorithm: 'RS256', expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken: newRefreshToken };
}

export function logout(userId: string = '', tenantId: string = '', ip: string = '') {
  if (userId) {
    logLogout(userId, tenantId, ip);
  }
  return { message: 'Clear rpw_refresh cookie' };
}

export class AuthError extends Error {
  public code: string;
  constructor(message: string, code: string = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}
