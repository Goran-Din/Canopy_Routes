-- 001_sunset_services.sql
-- Seed data for Sunset Services US — first tenant and all initial config
-- Last modified: 2026-03-04

BEGIN;

-- ============================================================
-- SECTION 1 — Sunset Services Tenant
-- ============================================================
INSERT INTO tenants (id, name, slug, is_active)
VALUES (
    gen_random_uuid(),
    'Sunset Services US',
    'sunset-services',
    TRUE
);

DO $$
DECLARE
    SUNSET_TENANT_ID UUID;
    CREW_1_ID UUID;
    CREW_2_ID UUID;
    CREW_3_ID UUID;
    SEASON_2026_ID UUID;
    SNOW_SEASON_2026_ID UUID;
BEGIN

SELECT id INTO SUNSET_TENANT_ID FROM tenants WHERE slug = 'sunset-services';

-- ============================================================
-- SECTION 2 — First User (Erick, Owner)
-- CHANGE THIS PASSWORD ON FIRST LOGIN
-- Password: 'ChangeMe2026!' hashed with bcrypt 12 rounds
-- ============================================================
INSERT INTO users (tenant_id, email, password_hash, role, display_name, is_active)
VALUES (
    SUNSET_TENANT_ID,
    'erick@sunsetservices.us',
    '$2b$12$PLDL0jfvQMYP/FNiVaEpOeuB3juv3c2NlayvNXuqVMzG6wxAYpiDO',
    'owner',
    'Erick',
    TRUE
);

-- ============================================================
-- SECTION 3 — Three Maintenance Crews
-- ============================================================
INSERT INTO rpw_crews (id, tenant_id, crew_code, display_name, division, member_count, mow_rate_ac_hr, is_active)
VALUES
    (gen_random_uuid(), SUNSET_TENANT_ID, 'MAINT-1', 'Maintenance Crew 1', 'maintenance', 3, 2.50, TRUE),
    (gen_random_uuid(), SUNSET_TENANT_ID, 'MAINT-2', 'Maintenance Crew 2', 'maintenance', 3, 2.50, TRUE),
    (gen_random_uuid(), SUNSET_TENANT_ID, 'MAINT-3', 'Maintenance Crew 3', 'maintenance', 3, 2.50, TRUE);

SELECT id INTO CREW_1_ID FROM rpw_crews WHERE tenant_id = SUNSET_TENANT_ID AND crew_code = 'MAINT-1';
SELECT id INTO CREW_2_ID FROM rpw_crews WHERE tenant_id = SUNSET_TENANT_ID AND crew_code = 'MAINT-2';
SELECT id INTO CREW_3_ID FROM rpw_crews WHERE tenant_id = SUNSET_TENANT_ID AND crew_code = 'MAINT-3';

-- ============================================================
-- SECTION 4 — 2026 Maintenance Season
-- ============================================================
INSERT INTO rpw_seasons (id, tenant_id, year, season_label, tab, status, version)
VALUES (gen_random_uuid(), SUNSET_TENANT_ID, 2026, '2026 Maintenance Season', 'maintenance', 'draft', 1)
RETURNING id INTO SEASON_2026_ID;

-- ============================================================
-- SECTION 5 — 15 Maintenance Route Slots (3 crews × 5 days)
-- ============================================================

-- Zone A — Monday
INSERT INTO rpw_routes (tenant_id, season_id, tab, route_label, zone_label, day_of_week, crew_id, depot_lat, depot_lng, is_active) VALUES
    (SUNSET_TENANT_ID, SEASON_2026_ID, 'maintenance', 'Route A - Monday', 'A', 'monday', CREW_1_ID, 41.7489370, -88.2673730, TRUE),
    (SUNSET_TENANT_ID, SEASON_2026_ID, 'maintenance', 'Route A - Monday', 'A', 'monday', CREW_2_ID, 41.7489370, -88.2673730, TRUE),
    (SUNSET_TENANT_ID, SEASON_2026_ID, 'maintenance', 'Route A - Monday', 'A', 'monday', CREW_3_ID, 41.7489370, -88.2673730, TRUE);

-- Zone B — Tuesday
INSERT INTO rpw_routes (tenant_id, season_id, tab, route_label, zone_label, day_of_week, crew_id, depot_lat, depot_lng, is_active) VALUES
    (SUNSET_TENANT_ID, SEASON_2026_ID, 'maintenance', 'Route B - Tuesday', 'B', 'tuesday', CREW_1_ID, 41.7489370, -88.2673730, TRUE),
    (SUNSET_TENANT_ID, SEASON_2026_ID, 'maintenance', 'Route B - Tuesday', 'B', 'tuesday', CREW_2_ID, 41.7489370, -88.2673730, TRUE),
    (SUNSET_TENANT_ID, SEASON_2026_ID, 'maintenance', 'Route B - Tuesday', 'B', 'tuesday', CREW_3_ID, 41.7489370, -88.2673730, TRUE);

-- Zone C — Wednesday
INSERT INTO rpw_routes (tenant_id, season_id, tab, route_label, zone_label, day_of_week, crew_id, depot_lat, depot_lng, is_active) VALUES
    (SUNSET_TENANT_ID, SEASON_2026_ID, 'maintenance', 'Route C - Wednesday', 'C', 'wednesday', CREW_1_ID, 41.7489370, -88.2673730, TRUE),
    (SUNSET_TENANT_ID, SEASON_2026_ID, 'maintenance', 'Route C - Wednesday', 'C', 'wednesday', CREW_2_ID, 41.7489370, -88.2673730, TRUE),
    (SUNSET_TENANT_ID, SEASON_2026_ID, 'maintenance', 'Route C - Wednesday', 'C', 'wednesday', CREW_3_ID, 41.7489370, -88.2673730, TRUE);

-- Zone D — Thursday
INSERT INTO rpw_routes (tenant_id, season_id, tab, route_label, zone_label, day_of_week, crew_id, depot_lat, depot_lng, is_active) VALUES
    (SUNSET_TENANT_ID, SEASON_2026_ID, 'maintenance', 'Route D - Thursday', 'D', 'thursday', CREW_1_ID, 41.7489370, -88.2673730, TRUE),
    (SUNSET_TENANT_ID, SEASON_2026_ID, 'maintenance', 'Route D - Thursday', 'D', 'thursday', CREW_2_ID, 41.7489370, -88.2673730, TRUE),
    (SUNSET_TENANT_ID, SEASON_2026_ID, 'maintenance', 'Route D - Thursday', 'D', 'thursday', CREW_3_ID, 41.7489370, -88.2673730, TRUE);

-- Zone E — Friday
INSERT INTO rpw_routes (tenant_id, season_id, tab, route_label, zone_label, day_of_week, crew_id, depot_lat, depot_lng, is_active) VALUES
    (SUNSET_TENANT_ID, SEASON_2026_ID, 'maintenance', 'Route E - Friday', 'E', 'friday', CREW_1_ID, 41.7489370, -88.2673730, TRUE),
    (SUNSET_TENANT_ID, SEASON_2026_ID, 'maintenance', 'Route E - Friday', 'E', 'friday', CREW_2_ID, 41.7489370, -88.2673730, TRUE),
    (SUNSET_TENANT_ID, SEASON_2026_ID, 'maintenance', 'Route E - Friday', 'E', 'friday', CREW_3_ID, 41.7489370, -88.2673730, TRUE);

-- ============================================================
-- SECTION 6 — 2026 Snow Season + 3 Snow Routes
-- ============================================================
INSERT INTO rpw_seasons (id, tenant_id, year, season_label, tab, status, version)
VALUES (gen_random_uuid(), SUNSET_TENANT_ID, 2026, '2026 Snow Season', 'snow', 'draft', 1)
RETURNING id INTO SNOW_SEASON_2026_ID;

INSERT INTO rpw_routes (tenant_id, season_id, tab, route_label, zone_label, day_of_week, crew_id, depot_lat, depot_lng, is_active) VALUES
    (SUNSET_TENANT_ID, SNOW_SEASON_2026_ID, 'snow', 'SN-01', 'SN-01', NULL, CREW_1_ID, 41.7489370, -88.2673730, TRUE),
    (SUNSET_TENANT_ID, SNOW_SEASON_2026_ID, 'snow', 'SN-02', 'SN-02', NULL, CREW_2_ID, 41.7489370, -88.2673730, TRUE),
    (SUNSET_TENANT_ID, SNOW_SEASON_2026_ID, 'snow', 'SN-03', 'SN-03', NULL, CREW_3_ID, 41.7489370, -88.2673730, TRUE);

-- ============================================================
-- SECTION 7 — Zone Config (5 zones A–E, from RPW-S-1)
-- ============================================================
INSERT INTO rpw_zone_config (tenant_id, zone_label, day_of_week, zone_name, crew_slots, is_commercial_day, display_colour, sort_order) VALUES
    (SUNSET_TENANT_ID, 'A', 'Monday',    'Commercial Routes',          3, TRUE,  '#1E3A5F', 1),
    (SUNSET_TENANT_ID, 'B', 'Tuesday',   'Naperville Central/West',    3, FALSE, '#1A5276', 2),
    (SUNSET_TENANT_ID, 'C', 'Wednesday', 'Plainfield / Far Suburbs',   3, FALSE, '#145A32', 3),
    (SUNSET_TENANT_ID, 'D', 'Thursday',  'Naperville East / Lisle',    3, FALSE, '#6E2F0A', 4),
    (SUNSET_TENANT_ID, 'E', 'Friday',    'Naperville North/South-SE',  3, FALSE, '#4A235A', 5);

-- ============================================================
-- SECTION 8 — Zone Boundaries (9 algorithm rules, from RPW-S-1)
-- ============================================================
INSERT INTO rpw_zone_boundaries (tenant_id, rule_number, zone_label, bearing_min, bearing_max, distance_min_mi, distance_max_mi, requires_commercial, description) VALUES
    (SUNSET_TENANT_ID, 1, 'A', NULL,  NULL,  NULL, NULL, TRUE,  'Commercial override — any commercial client goes to Zone A (Monday) regardless of location'),
    (SUNSET_TENANT_ID, 2, 'C', 130.0, 220.0, NULL, 35.0, FALSE, 'SE/S/SW residential — Plainfield, Joliet corridor (130°–220°, ≤35mi)'),
    (SUNSET_TENANT_ID, 3, 'C', 20.0,  55.0,  9.0,  NULL, FALSE, 'Far NE residential — Lombard, Wheaton, Villa Park (20°–55°, ≥9mi)'),
    (SUNSET_TENANT_ID, 4, 'C', 45.0,  110.0, 12.0, NULL, FALSE, 'Far E residential — Downers Grove, Darien, far east suburbs (45°–110°, ≥12mi)'),
    (SUNSET_TENANT_ID, 5, 'E', 110.0, 145.0, NULL, 20.0, FALSE, 'ESE/SE residential near — Naperville SE/south (110°–145°, ≤20mi)'),
    (SUNSET_TENANT_ID, 6, 'E', 20.0,  65.0,  NULL, 9.0,  FALSE, 'NE residential close — Naperville north close range (20°–65°, ≤9mi)'),
    (SUNSET_TENANT_ID, 7, 'B', 50.0,  100.0, NULL, 9.0,  FALSE, 'ENE/E residential near — Naperville central/west (50°–100°, ≤9mi)'),
    (SUNSET_TENANT_ID, 8, 'D', 50.0,  130.0, 5.0,  25.0, FALSE, 'ENE to SE residential mid-range — Naperville east, Lisle, Bolingbrook (50°–130°, 5–25mi)'),
    (SUNSET_TENANT_ID, 9, 'A', NULL,  NULL,  NULL, NULL, FALSE, 'Catch-all fallback — unclassified/local Aurora area. Confidence: LOW. Coordinator decides.');

END $$;

COMMIT;
