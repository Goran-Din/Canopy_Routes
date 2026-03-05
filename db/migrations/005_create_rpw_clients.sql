-- 005_create_rpw_clients.sql
-- Creates the rpw_clients table for client/property management
-- Last modified: 2026-03-04

CREATE TABLE rpw_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    external_id VARCHAR(100) NULL,
    client_name VARCHAR(255) NOT NULL,
    service_address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL DEFAULT 'IL',
    zip VARCHAR(10) NOT NULL,
    client_type rpw_client_type NOT NULL DEFAULT 'residential',
    acres DECIMAL(8,4) NOT NULL DEFAULT 0.0000,
    acreage_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    service_frequency rpw_service_freq NOT NULL DEFAULT 'weekly',
    client_status rpw_client_status NOT NULL DEFAULT 'new',
    address_lat DECIMAL(10,7) NULL,
    address_lng DECIMAL(10,7) NULL,
    geocode_status rpw_geocode_status NOT NULL DEFAULT 'pending',
    billing_accounts INTEGER NOT NULL DEFAULT 1,
    annual_revenue DECIMAL(10,2) NULL,
    snow_service BOOLEAN NOT NULL DEFAULT FALSE,
    snow_contract_type rpw_snow_contract NOT NULL DEFAULT 'none',
    time_constraints TEXT NULL,
    access_notes TEXT NULL,
    property_notes TEXT NULL,
    prior_route VARCHAR(50) NULL,
    prior_crew VARCHAR(50) NULL,
    crm_property_id UUID NULL,
    crm_customer_id UUID NULL,
    deleted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_rpw_clients_updated_at
    BEFORE UPDATE ON rpw_clients
    FOR EACH ROW EXECUTE FUNCTION rpw_set_updated_at();

CREATE INDEX idx_rpw_clients_tenant ON rpw_clients(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_rpw_clients_city ON rpw_clients(tenant_id, city) WHERE deleted_at IS NULL;
CREATE INDEX idx_rpw_clients_status ON rpw_clients(tenant_id, client_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_rpw_clients_geocode ON rpw_clients(tenant_id, geocode_status);
CREATE INDEX idx_rpw_clients_geo ON rpw_clients(address_lat, address_lng);
