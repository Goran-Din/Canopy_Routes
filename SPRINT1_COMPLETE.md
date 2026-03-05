# Sprint 1 — Complete

**Project:** Canopy Routes (North 37 LLC)
**Tenant:** Sunset Services US
**Date:** 2026-03-04

## Deliverables

### Infrastructure
- [x] Monorepo scaffold: `frontend/`, `api/`, `db/`
- [x] Docker Compose: 3 services (postgres:16, api, web) on `canopy-routes-net`
- [x] TypeScript 5.x strict mode in both frontend and api

### Database (PostgreSQL 16)
- [x] 11 migration files (001–011) with `rpw_` prefix convention
- [x] Tables: tenants, users, rpw_seasons, rpw_crews, rpw_clients, rpw_routes, rpw_route_stops, rpw_hardscape_pins, rpw_prospect_pins, rpw_zone_config, rpw_zone_boundaries
- [x] Enum types: rpw_season_status, rpw_division, rpw_client_type, rpw_service_tier, rpw_day_of_week, rpw_stop_status, rpw_pin_status
- [x] Seed data: 1 tenant, 1 user, 3 crews, 2 seasons, 18 routes, 5 zone configs, 9 boundary rules

### API (Express + TypeScript)
- [x] JWT RS256 authentication (login, refresh, logout)
- [x] Health check with real DB connectivity test
- [x] Zone suggestion algorithm — pure function, 9-rule engine
- [x] 18 unit tests passing (node:test)

### Frontend (React + Vite + Tailwind)
- [x] Scaffold with routing, state management, and API layer folders ready

## Verification

```
docker compose ps          → 3 containers running
curl localhost:3000/health → { "db": "connected" }
cd api && npm test         → 18 passing, 0 failing
cd api && npx tsc --noEmit → no errors
```
