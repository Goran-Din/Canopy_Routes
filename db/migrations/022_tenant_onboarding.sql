-- 022_tenant_onboarding.sql
-- Tenant onboarding & super-admin support

-- Extend tenants with company profile and status fields
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS logo_url       TEXT,
  ADD COLUMN IF NOT EXISTS contact_email  VARCHAR(200),
  ADD COLUMN IF NOT EXISTS contact_phone  VARCHAR(30),
  ADD COLUMN IF NOT EXISTS status         VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspended_at   TIMESTAMPTZ;

-- Force password change flag on users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Super-admin user table (separate from tenant users)
CREATE TABLE IF NOT EXISTS rpw_super_admins (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        VARCHAR(200) NOT NULL UNIQUE,
  name         VARCHAR(120) NOT NULL,
  password_hash TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log for all super-admin actions
CREATE TABLE IF NOT EXISTS rpw_admin_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID NOT NULL,
  action        VARCHAR(80) NOT NULL,
  target_id     UUID,
  payload       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
