-- 009_create_rpw_prospect_pins.sql
-- Creates the rpw_prospect_pins table for salesperson-dropped map pins
-- Last modified: 2026-03-04

CREATE TABLE rpw_prospect_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    label VARCHAR(255) NULL,
    address TEXT NULL,
    lat DECIMAL(10,7) NOT NULL,
    lng DECIMAL(10,7) NOT NULL,
    notes TEXT NULL,
    dropped_by UUID NOT NULL REFERENCES users(id),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    deleted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_rpw_prospect_pins_updated_at
    BEFORE UPDATE ON rpw_prospect_pins
    FOR EACH ROW EXECUTE FUNCTION rpw_set_updated_at();

CREATE INDEX idx_rpw_prospect_tenant ON rpw_prospect_pins(tenant_id) WHERE deleted_at IS NULL;
