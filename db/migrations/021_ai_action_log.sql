-- 021_ai_action_log.sql
-- Audit log for AI-initiated actions

CREATE TABLE IF NOT EXISTS rpw_ai_action_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  user_id       UUID NOT NULL,
  action_tool   VARCHAR(50) NOT NULL,
  action_input  JSONB NOT NULL,
  action_result JSONB,
  status        VARCHAR(20) NOT NULL DEFAULT 'success',
  executed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
