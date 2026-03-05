-- 006_create_rpw_routes.sql
-- Creates the rpw_routes table for route definitions
-- Last modified: 2026-03-04

CREATE TABLE rpw_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    season_id UUID NOT NULL REFERENCES rpw_seasons(id),
    tab rpw_route_tab NOT NULL DEFAULT 'maintenance',
    route_label VARCHAR(50) NOT NULL,
    zone_label VARCHAR(10) NULL,
    day_of_week rpw_day_of_week NULL,
    crew_id UUID NULL REFERENCES rpw_crews(id),
    mow_rate_override DECIMAL(4,2) NULL,
    depot_lat DECIMAL(10,7) NOT NULL DEFAULT 41.7489370,
    depot_lng DECIMAL(10,7) NOT NULL DEFAULT -88.2673730,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    crm_route_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_rpw_routes_updated_at
    BEFORE UPDATE ON rpw_routes
    FOR EACH ROW EXECUTE FUNCTION rpw_set_updated_at();

CREATE INDEX idx_rpw_routes_season ON rpw_routes(tenant_id, season_id);
CREATE INDEX idx_rpw_routes_crew ON rpw_routes(tenant_id, crew_id);
CREATE UNIQUE INDEX idx_rpw_routes_crew_day ON rpw_routes(tenant_id, season_id, crew_id, day_of_week) WHERE crew_id IS NOT NULL;
