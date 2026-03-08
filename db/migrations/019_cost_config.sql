-- 019_cost_config.sql
-- Cost configuration per tenant for profitability calculations

CREATE TABLE IF NOT EXISTS rpw_cost_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  labor_rate NUMERIC(8,2) NOT NULL DEFAULT 18.00,
  crew_size INTEGER NOT NULL DEFAULT 2,
  fuel_cost_per_mile NUMERIC(8,4) NOT NULL DEFAULT 0.21,
  equipment_cost_per_hour NUMERIC(8,2) NOT NULL DEFAULT 4.50,
  overhead_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 12.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- Insert default config for existing tenant
INSERT INTO rpw_cost_config (tenant_id, labor_rate, crew_size, fuel_cost_per_mile, equipment_cost_per_hour, overhead_rate_percent)
SELECT id, 18.00, 2, 0.21, 4.50, 12.00
FROM tenants
WHERE slug = 'sunset-services'
ON CONFLICT (tenant_id) DO NOTHING;
