# Sprint 2 — Complete ✅

## What Was Built
- Migration 012: refresh_tokens table with SHA-256 hashed token storage
- Server-side refresh token store: logout actually revokes tokens in the database
- Token rotation: old refresh token revoked on every refresh call
- Account lockout: 5 failed attempts → 30 minute lock → revokeAllUserTokens called
- Security event logging: LOGIN_SUCCESS, LOGIN_FAILED, ACCOUNT_LOCKED, ACCOUNT_LOCKED_ATTEMPT, TOKEN_REFRESHED, LOGOUT, CROSS_TENANT_ATTEMPT — all logged via Winston
- Security headers: helmet configured with CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS
- CORS allowlist: only routes.sunsetapp.us, routes-staging.sunsetapp.us, localhost:5173 (dev only)
- Rate limits: login 5/15min, refresh 60/15min, global 200/min
- GET /v1/auth/me: validates token and returns user profile (no sensitive fields)
- .gitattributes: LF line endings normalized across the repo
- 17 auth integration tests — all passing

## Sprint 2 Acceptance Criteria — All Met
- [x] Login returns valid JWT ✅
- [x] Refresh rotates token (old one revoked in DB) ✅
- [x] 401 on bad credentials ✅
- [x] 403 on wrong role ✅
- [x] Account locks after 5 failures ✅
- [x] 35/35 tests passing (18 zone + 17 auth) ✅

## Sprint 3 — Next
CSV upload pipeline: multer + Papa Parse, column validation, batch geocoding (Google Geocoding API), rpw_clients INSERT/UPDATE
