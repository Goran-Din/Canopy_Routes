-- 008_create_rpw_hardscape_pins.sql
-- Creates the rpw_hardscape_pins table for hardscape project map pins
-- Last modified: 2026-03-04

CREATE TABLE rpw_hardscape_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    project_name VARCHAR(255) NOT NULL,
    client_name VARCHAR(255) NULL,
    address TEXT NULL,
    lat DECIMAL(10,7) NOT NULL,
    lng DECIMAL(10,7) NOT NULL,
    project_status rpw_hardscape_status NOT NULL DEFAULT 'prospecting',
    estimated_value DECIMAL(10,2) NULL,
    notes TEXT NULL,
    added_by UUID NOT NULL REFERENCES users(id),
    deleted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_rpw_hardscape_pins_updated_at
    BEFORE UPDATE ON rpw_hardscape_pins
    FOR EACH ROW EXECUTE FUNCTION rpw_set_updated_at();

CREATE INDEX idx_rpw_hardscape_tenant ON rpw_hardscape_pins(tenant_id) WHERE deleted_at IS NULL;
