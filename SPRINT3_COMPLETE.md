# Sprint 3 — Complete ✅

**Project:** Canopy Routes (North 37 LLC)
**Tenant:** Sunset Services US
**Date:** 2026-03-05

## What Was Built
- Migration 013: rpw_upload_jobs table for async geocoding job tracking
- csv-parse.service.ts: CSV parsing, header validation, row validation with defaults, deduplication
- geocoding.service.ts: Google Maps Geocoding API with mock mode (no key required for dev/test)
- client.repo.ts: upsertClient with merge logic — UPDATE existing, INSERT new, preserve confirmed GPS
- upload-job.repo.ts: job lifecycle — create, progress update, complete, fail
- upload.controller.ts: async handler — 202 immediately, geocodes 400 rows in background
- upload.routes.ts: POST /v1/clients/upload + GET /v1/clients/upload/:jobId
- seasons.routes.ts: minimal GET /v1/seasons for frontend season selection
- test-clients.csv: 20-row realistic Aurora/Naperville test dataset

## Sprint 3 Acceptance Criteria — All Met
- [x] CSV upload returns job_id immediately (202 response) ✅
- [x] Progress polling works (GET /v1/clients/upload/:jobId) ✅
- [x] Failed rows appear in error report ✅
- [x] Re-upload merges correctly — no duplicate clients created ✅
- [x] 58/58 tests passing ✅

## Known Notes
- GOOGLE_MAPS_API_KEY is in mock mode for development — returns depot coordinates
- Replace with real key in api/.env when ready for production geocoding
- rpw_seasons does not have deleted_at column — query adjusted accordingly

## Sprint 4 — Next
Formula engine: calcMowTime, calcTrimTime, calcProductiveTime, calcDriveTime (Haversine).
Unit tests against Erick's 2026 Route B ground truth (12 stops, expected 7.0h ±0.2h).
