-- 018_snow_fields.sql
-- Add snow-specific fields to rpw_clients for snow route planning
-- service_type distinguishes mow vs plow/salt clients
-- snow_priority sets plowing order (1=highest, 5=lowest)
-- lot_size_sqft is the plowable area in square feet

ALTER TABLE rpw_clients ADD COLUMN IF NOT EXISTS service_type VARCHAR(20) DEFAULT 'mow';
ALTER TABLE rpw_clients ADD COLUMN IF NOT EXISTS snow_priority INTEGER DEFAULT 3;
ALTER TABLE rpw_clients ADD COLUMN IF NOT EXISTS lot_size_sqft INTEGER;
