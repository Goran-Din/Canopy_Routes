-- 007_create_rpw_route_stops.sql
-- Creates the rpw_route_stops table for ordered stops within routes
-- Last modified: 2026-03-04

CREATE TABLE rpw_route_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    route_id UUID NOT NULL REFERENCES rpw_routes(id),
    client_id UUID NOT NULL REFERENCES rpw_clients(id),
    sequence_order SMALLINT NOT NULL,
    mow_time_hrs DECIMAL(6,4) NOT NULL DEFAULT 0.0000,
    trim_time_hrs DECIMAL(6,4) NOT NULL DEFAULT 0.0000,
    productive_time_hrs DECIMAL(6,4) NOT NULL DEFAULT 0.0000,
    drive_time_from_prev_mins DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    drive_time_from_prev_hrs DECIMAL(6,4) NOT NULL DEFAULT 0.0000,
    cumulative_time_hrs DECIMAL(6,4) NOT NULL DEFAULT 0.0000,
    drive_time_to_depot_mins DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    is_last_stop BOOLEAN NOT NULL DEFAULT FALSE,
    acres_override DECIMAL(8,4) NULL,
    mow_rate_override DECIMAL(4,2) NULL,
    sequence_notes TEXT NULL,
    deleted_at TIMESTAMPTZ NULL,
    crm_stop_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_rpw_route_stops_updated_at
    BEFORE UPDATE ON rpw_route_stops
    FOR EACH ROW EXECUTE FUNCTION rpw_set_updated_at();

CREATE INDEX idx_rpw_stops_route ON rpw_route_stops(tenant_id, route_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_rpw_stops_client ON rpw_route_stops(tenant_id, client_id) WHERE deleted_at IS NULL;
