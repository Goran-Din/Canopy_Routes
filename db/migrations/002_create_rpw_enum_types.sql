-- 002_create_rpw_enum_types.sql
-- Creates all rpw_ prefixed enum types used across the schema
-- Last modified: 2026-03-04

CREATE TYPE rpw_season_status AS ENUM ('draft', 'pending_approval', 'published', 'archived');
CREATE TYPE rpw_route_tab AS ENUM ('maintenance', 'snow');
CREATE TYPE rpw_day_of_week AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
CREATE TYPE rpw_crew_division AS ENUM ('maintenance', 'projects', 'hardscape', 'snow');
CREATE TYPE rpw_client_type AS ENUM ('residential', 'commercial');
CREATE TYPE rpw_client_status AS ENUM ('confirmed', 'pending', 'new', 'at_risk', 'inactive');
CREATE TYPE rpw_service_freq AS ENUM ('weekly', 'biweekly', 'monthly', 'as_needed');
CREATE TYPE rpw_geocode_status AS ENUM ('success', 'failed', 'manual', 'pending');
CREATE TYPE rpw_snow_contract AS ENUM ('monthly_fixed', 'per_run', 'none');
CREATE TYPE rpw_hardscape_status AS ENUM ('prospecting', 'design', 'contracted', 'in_progress', 'complete', 'on_hold');
