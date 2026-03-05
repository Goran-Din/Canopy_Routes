-- 010_create_rpw_zone_config.sql
-- Creates the rpw_zone_config table (RPW-S-1 revised version, no zip_codes column)
-- Last modified: 2026-03-04

CREATE TABLE rpw_zone_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    zone_label VARCHAR(1) NOT NULL,
    day_of_week VARCHAR(10) NOT NULL,
    zone_name VARCHAR(100) NOT NULL,
    crew_slots INTEGER NOT NULL DEFAULT 3,
    is_commercial_day BOOLEAN NOT NULL DEFAULT FALSE,
    display_colour VARCHAR(7) NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, zone_label)
);

CREATE TRIGGER trg_rpw_zone_config_updated_at
    BEFORE UPDATE ON rpw_zone_config
    FOR EACH ROW EXECUTE FUNCTION rpw_set_updated_at();
