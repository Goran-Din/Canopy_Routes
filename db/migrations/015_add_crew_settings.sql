ALTER TABLE rpw_crews ADD COLUMN IF NOT EXISTS crew_type VARCHAR(20) NOT NULL DEFAULT 'mixed';
-- crew_type values: 'mixed', 'commercial_only', 'residential_only'
