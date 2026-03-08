-- Sprint 15: Add category and season_id to hardscape pins
ALTER TABLE rpw_hardscape_pins ADD COLUMN IF NOT EXISTS category VARCHAR(30) DEFAULT 'other';
ALTER TABLE rpw_hardscape_pins ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES rpw_seasons(id);
