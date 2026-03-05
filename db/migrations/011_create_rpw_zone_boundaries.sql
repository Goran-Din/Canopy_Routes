-- 011_create_rpw_zone_boundaries.sql
-- Creates the rpw_zone_boundaries table (RPW-S-1 algorithm rules for zone assignment)
-- Last modified: 2026-03-04

CREATE TABLE rpw_zone_boundaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    rule_number INTEGER NOT NULL,
    zone_label VARCHAR(1) NOT NULL,
    bearing_min DECIMAL(5,1) NULL,
    bearing_max DECIMAL(5,1) NULL,
    distance_min_mi DECIMAL(5,1) NULL,
    distance_max_mi DECIMAL(5,1) NULL,
    requires_commercial BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, rule_number)
);

CREATE TRIGGER trg_rpw_zone_boundaries_updated_at
    BEFORE UPDATE ON rpw_zone_boundaries
    FOR EACH ROW EXECUTE FUNCTION rpw_set_updated_at();
