// api/src/repositories/auth.repo.ts
// Database queries for authentication — parameterised SQL only, no string interpolation
// Last modified: 2026-03-04

import { pool } from '../db/pool';

export interface UserRecord {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  role: string;
  display_name: string;
  is_active: boolean;
  failed_login_attempts: number;
  locked_until: Date | null;
  last_login_at: Date | null;
}

export async function findUserByEmail(
  tenantId: string,
  email: string
): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    `SELECT id, tenant_id, email, password_hash, role, display_name,
            is_active, failed_login_attempts, locked_until, last_login_at,
            must_change_password
     FROM users
     WHERE tenant_id = $1 AND email = $2 AND is_active = TRUE`,
    [tenantId, email]
  );
  return result.rows[0] || null;
}

export async function findTenantBySlug(
  slug: string
): Promise<{ id: string; name: string } | null> {
  const result = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM tenants WHERE slug = $1 AND is_active = TRUE`,
    [slug]
  );
  return result.rows[0] || null;
}

export async function findActiveUserById(
  userId: string
): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    `SELECT id, tenant_id, email, password_hash, role, display_name,
            is_active, failed_login_attempts, locked_until, last_login_at,
            must_change_password
     FROM users
     WHERE id = $1 AND is_active = TRUE`,
    [userId]
  );
  return result.rows[0] || null;
}

export interface SafeUserRecord {
  id: string;
  tenant_id: string;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
}

export async function findUserById(
  userId: string
): Promise<SafeUserRecord | null> {
  const result = await pool.query<SafeUserRecord>(
    `SELECT id, tenant_id, email, display_name, role, is_active
     FROM users
     WHERE id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

export async function updateFailedLoginAttempts(
  userId: string,
  attempts: number,
  lockedUntil: Date | null
): Promise<void> {
  await pool.query(
    `UPDATE users SET failed_login_attempts = $1, locked_until = $2, updated_at = NOW() WHERE id = $3`,
    [attempts, lockedUntil, userId]
  );
}

export async function updateLastLogin(userId: string): Promise<void> {
  await pool.query(
    `UPDATE users SET last_login_at = NOW() WHERE id = $1`,
    [userId]
  );
}

export async function resetFailedAttempts(userId: string): Promise<void> {
  await pool.query(
    `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $1`,
    [userId]
  );
}
