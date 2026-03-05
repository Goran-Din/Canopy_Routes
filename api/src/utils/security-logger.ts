// api/src/utils/security-logger.ts
// Structured security event logger for audit trail (RPW-A-3 §7.2)
// NEVER log passwords, raw tokens, or full JWT strings

import winston from 'winston';

const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  defaultMeta: { service: 'security' },
  transports: [new winston.transports.Console()],
});

export function logLoginSuccess(userId: string, tenantId: string, email: string, ip: string): void {
  securityLogger.info({ event: 'LOGIN_SUCCESS', userId, tenantId, email, ip });
}

export function logLoginFailed(email: string, tenantId: string, ip: string, attemptCount: number): void {
  securityLogger.warn({ event: 'LOGIN_FAILED', email, tenantId, ip, attemptCount });
}

export function logAccountLocked(userId: string, email: string, tenantId: string, ip: string): void {
  securityLogger.warn({ event: 'ACCOUNT_LOCKED', userId, email, tenantId, ip });
}

export function logAccountLockedAttempt(userId: string, tenantId: string, ip: string): void {
  securityLogger.warn({ event: 'ACCOUNT_LOCKED_ATTEMPT', userId, tenantId, ip });
}

export function logTokenRefreshed(userId: string, tenantId: string, ip: string): void {
  securityLogger.info({ event: 'TOKEN_REFRESHED', userId, tenantId, ip });
}

export function logLogout(userId: string, tenantId: string, ip: string): void {
  securityLogger.info({ event: 'LOGOUT', userId, tenantId, ip });
}

export function logCrossTenantAttempt(userId: string, claimedTenantId: string, resourceTenantId: string, endpoint: string): void {
  securityLogger.warn({ event: 'CROSS_TENANT_ATTEMPT', userId, claimedTenantId, resourceTenantId, endpoint });
}
