-- 003_create_rpw_seasons.sql
-- Creates the rpw_seasons table for route planning seasons
-- Last modified: 2026-03-04

CREATE TABLE rpw_seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    year SMALLINT NOT NULL,
    season_label VARCHAR(100) NOT NULL,
    tab rpw_route_tab NOT NULL DEFAULT 'maintenance',
    status rpw_season_status NOT NULL DEFAULT 'draft',
    version SMALLINT NOT NULL DEFAULT 1,
    published_at TIMESTAMPTZ NULL,
    published_by UUID NULL REFERENCES users(id),
    archived_at TIMESTAMPTZ NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_rpw_seasons_updated_at
    BEFORE UPDATE ON rpw_seasons
    FOR EACH ROW EXECUTE FUNCTION rpw_set_updated_at();

CREATE INDEX idx_rpw_seasons_tenant_year ON rpw_seasons(tenant_id, year);
CREATE INDEX idx_rpw_seasons_status ON rpw_seasons(tenant_id, status);
