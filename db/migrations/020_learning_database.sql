-- 020_learning_database.sql
-- Season snapshots, performance actuals, and client history tables

-- Season snapshots (captured on archive)
CREATE TABLE IF NOT EXISTS rpw_season_snapshots (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id),
  season_id          UUID NOT NULL REFERENCES rpw_seasons(id),
  snapshot_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  season_year        INTEGER NOT NULL,
  season_type        VARCHAR(20) NOT NULL DEFAULT 'maintenance',
  total_clients      INTEGER NOT NULL DEFAULT 0,
  total_revenue      NUMERIC(12,2) NOT NULL DEFAULT 0,
  avg_margin_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
  snapshot_data      JSONB NOT NULL DEFAULT '{}',
  notes              TEXT
);

-- Performance actuals (optional weekly hours tracking)
CREATE TABLE IF NOT EXISTS rpw_performance_actuals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id),
  route_id       UUID NOT NULL REFERENCES rpw_routes(id),
  season_id      UUID NOT NULL REFERENCES rpw_seasons(id),
  week_of        DATE NOT NULL,
  estimated_hrs  NUMERIC(5,2) NOT NULL,
  actual_hrs     NUMERIC(5,2) NOT NULL,
  variance_hrs   NUMERIC(5,2) GENERATED ALWAYS AS (actual_hrs - estimated_hrs) STORED,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(route_id, week_of)
);

-- Client history (one row per client per season, populated on archive)
CREATE TABLE IF NOT EXISTS rpw_client_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  client_id       UUID NOT NULL REFERENCES rpw_clients(id),
  season_id       UUID NOT NULL REFERENCES rpw_seasons(id),
  season_year     INTEGER NOT NULL,
  route_name      VARCHAR(120),
  annual_revenue  NUMERIC(10,2),
  was_retained    BOOLEAN,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, season_id)
);
