-- Sprint 14: Season publish workflow fields
ALTER TABLE rpw_seasons ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE rpw_seasons ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id);
ALTER TABLE rpw_seasons ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE rpw_seasons ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES users(id);
ALTER TABLE rpw_seasons ADD COLUMN IF NOT EXISTS request_changes_note TEXT;
