-- 012_create_refresh_tokens.sql
-- Refresh tokens are stored as SHA-256 hashes. The raw token is sent to the
-- client via httpOnly cookie. We never store the raw token.

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ NULL,
    UNIQUE(token_hash)
);

-- Active tokens for a given user (for logout-all, session listing)
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id) WHERE revoked_at IS NULL;

-- Fast lookup by hash on token refresh
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- Cleanup job: find expired tokens that haven't been revoked yet
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at) WHERE revoked_at IS NULL;
