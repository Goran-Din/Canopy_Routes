-- 004_create_rpw_crews.sql
-- Creates the rpw_crews table for crew management
-- Last modified: 2026-03-04

CREATE TABLE rpw_crews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    crew_code VARCHAR(20) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    division rpw_crew_division NOT NULL DEFAULT 'maintenance',
    member_count INTEGER NOT NULL DEFAULT 3,
    leader_name VARCHAR(100) NULL,
    mow_rate_ac_hr DECIMAL(4,2) NOT NULL DEFAULT 2.50,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, crew_code)
);

CREATE TRIGGER trg_rpw_crews_updated_at
    BEFORE UPDATE ON rpw_crews
    FOR EACH ROW EXECUTE FUNCTION rpw_set_updated_at();

CREATE INDEX idx_rpw_crews_tenant ON rpw_crews(tenant_id);
