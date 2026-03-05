-- 013_create_rpw_upload_jobs.sql
-- Upload job tracker for async CSV geocoding pipeline. One record per upload.
-- Frontend polls GET /v1/clients/upload/:jobId every 2 seconds.

CREATE TABLE rpw_upload_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    uploaded_by UUID NOT NULL REFERENCES users(id),
    season_id UUID NOT NULL REFERENCES rpw_seasons(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
    original_filename VARCHAR(255) NOT NULL,
    total_rows INTEGER NOT NULL DEFAULT 0,
    processed_rows INTEGER NOT NULL DEFAULT 0,
    imported_rows INTEGER NOT NULL DEFAULT 0,
    failed_rows INTEGER NOT NULL DEFAULT 0,
    error_rows JSONB NULL,
    warning_rows JSONB NULL,
    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rpw_upload_jobs_tenant ON rpw_upload_jobs(tenant_id);
CREATE INDEX idx_rpw_upload_jobs_season ON rpw_upload_jobs(tenant_id, season_id);
CREATE INDEX idx_rpw_upload_jobs_status ON rpw_upload_jobs(tenant_id, status);

CREATE TRIGGER trg_rpw_upload_jobs_updated_at
    BEFORE UPDATE ON rpw_upload_jobs
    FOR EACH ROW EXECUTE FUNCTION rpw_set_updated_at();
