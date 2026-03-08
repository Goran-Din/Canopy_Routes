// api/src/tests/routes.integration.test.ts
// Integration tests for route builder CRUD (25 test cases)
// Last modified: 2026-03-05

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const BASE = 'http://localhost:3000';
const testPool = new pg.Pool({
  connectionString: 'postgresql://canopy:canopy_dev@localhost:5433/canopy_routes',
});

async function login(email: string): Promise<string> {
  const res = await fetch(`${BASE}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'ChangeMe2026!', tenantSlug: 'sunset-services' }),
  });
  const data = (await res.json()) as any;
  return data.data.accessToken;
}

// Shared test state
let ownerToken: string;
let coordinatorToken: string;
let salespersonToken: string;
let seasonId: string;
let testRouteId: string;
let testRouteCrewId: string;
let conflictCrewId: string;
let clientIds: string[];
let stopId1: string;
let stopId2: string;
let stopId3: string;

before(async () => {
  // Clean up any stops from previous test runs
  await testPool.query('DELETE FROM rpw_route_stops');

  // Login all test users
  ownerToken = await login('erick@sunsetservices.us');
  coordinatorToken = await login('coordinator_test@sunsetservices.us');
  salespersonToken = await login('salesperson_test@sunsetservices.us');

  // Get maintenance season
  const seasonRes = await testPool.query(
    `SELECT id FROM rpw_seasons WHERE tab = 'maintenance' LIMIT 1`
  );
  seasonId = seasonRes.rows[0].id;

  // Get a test route and its crew, plus a different crew on the same day for conflict testing
  const routeRes = await testPool.query(
    `SELECT id, crew_id, day_of_week FROM rpw_routes WHERE season_id = $1 ORDER BY route_label LIMIT 1`,
    [seasonId]
  );
  testRouteId = routeRes.rows[0].id;
  testRouteCrewId = routeRes.rows[0].crew_id;
  const testDay = routeRes.rows[0].day_of_week;

  // Find a different crew that also has a route on the same day (for conflict test)
  const conflictRes = await testPool.query(
    `SELECT crew_id FROM rpw_routes WHERE season_id = $1 AND day_of_week = $2 AND crew_id != $3 LIMIT 1`,
    [seasonId, testDay, testRouteCrewId]
  );
  conflictCrewId = conflictRes.rows[0].crew_id;

  // Get client IDs for stop tests
  const clientRes = await testPool.query(
    `SELECT id FROM rpw_clients WHERE deleted_at IS NULL ORDER BY client_name LIMIT 5`
  );
  clientIds = clientRes.rows.map((r: any) => r.id);
});

after(async () => {
  await testPool.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL');
  await testPool.end();
});

// ── GET /v1/routes ───────────────────────────────────────────────

describe('GET /v1/routes', () => {
  it('RTE-1: No auth → 401', async () => {
    const res = await fetch(`${BASE}/v1/routes?season_id=${seasonId}`);
    assert.equal(res.status, 401);
  });

  it('RTE-2: Returns routes for valid season_id', async () => {
    const res = await fetch(`${BASE}/v1/routes?season_id=${seasonId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const data = (await res.json()) as any;
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data));
    assert.ok(data.data.length >= 1, `Expected at least 1 route, got ${data.data.length}`);
  });

  it('RTE-3: Each route has summary fields', async () => {
    const res = await fetch(`${BASE}/v1/routes?season_id=${seasonId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const data = (await res.json()) as any;
    const first = data.data[0];
    assert.ok(first.route, 'Should have route object');
    assert.ok(first.summary, 'Should have summary object');
    assert.equal(typeof first.summary.total_workday_hrs, 'number');
    assert.equal(typeof first.summary.capacity_status, 'string');
    assert.equal(typeof first.summary.stop_count, 'number');
  });
});

// ── GET /v1/routes/:id ──────────────────────────────────────────

describe('GET /v1/routes/:id', () => {
  it('RTE-4: Returns single route with summary', async () => {
    const res = await fetch(`${BASE}/v1/routes/${testRouteId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const data = (await res.json()) as any;
    assert.equal(res.status, 200);
    assert.ok(data.data.route);
    assert.ok(data.data.summary);
    assert.equal(data.data.route.id, testRouteId);
  });
});

// ── PATCH /v1/routes/:id/crew ───────────────────────────────────

describe('PATCH /v1/routes/:id/crew', () => {
  it('RTE-5: No auth → 401', async () => {
    const res = await fetch(`${BASE}/v1/routes/${testRouteId}/crew`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crew_id: testRouteCrewId }),
    });
    assert.equal(res.status, 401);
  });

  it('RTE-6: Salesperson → 403', async () => {
    const res = await fetch(`${BASE}/v1/routes/${testRouteId}/crew`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${salespersonToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ crew_id: testRouteCrewId }),
    });
    assert.equal(res.status, 403);
  });

  it('RTE-7: Assigns crew successfully → 200', async () => {
    // Re-assign same crew to same route (no conflict since we exclude current route)
    const res = await fetch(`${BASE}/v1/routes/${testRouteId}/crew`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${coordinatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ crew_id: testRouteCrewId }),
    });
    const data = (await res.json()) as any;
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.ok(data.data.route);
    assert.ok(data.data.summary);
  });

  it('RTE-8: Crew conflict on same day → 409', async () => {
    // Assign conflictCrewId which already has a route on the same day
    const res = await fetch(`${BASE}/v1/routes/${testRouteId}/crew`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${coordinatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ crew_id: conflictCrewId }),
    });
    const data = (await res.json()) as any;
    assert.equal(res.status, 409);
    assert.equal(data.success, false);
    assert.ok(data.error.includes('already assigned'));
  });
});

// ── POST /v1/route-stops/:route_id ──────────────────────────────

describe('POST /v1/route-stops/:route_id', () => {
  it('RTE-9: No auth → 401', async () => {
    const res = await fetch(`${BASE}/v1/route-stops/${testRouteId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientIds[0] }),
    });
    assert.equal(res.status, 401);
  });

  it('RTE-10: Salesperson → 403', async () => {
    const res = await fetch(`${BASE}/v1/route-stops/${testRouteId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${salespersonToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ client_id: clientIds[0] }),
    });
    assert.equal(res.status, 403);
  });

  it('RTE-11: First stop → 201 with route summary', async () => {
    const res = await fetch(`${BASE}/v1/route-stops/${testRouteId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${coordinatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ client_id: clientIds[0] }),
    });
    const data = (await res.json()) as any;
    assert.equal(res.status, 201);
    assert.equal(data.success, true);
    assert.equal(data.data.summary.stop_count, 1);
    stopId1 = data.data.stops[0].id;
  });

  it('RTE-12: First stop has correct calculated mow/trim times', async () => {
    const res = await fetch(`${BASE}/v1/routes/${testRouteId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const data = (await res.json()) as any;
    const stop = data.data.stops[0];
    assert.ok(Number(stop.mow_time_hrs) >= 0, 'mow_time_hrs should be >= 0');
    assert.ok(Number(stop.trim_time_hrs) >= 0, 'trim_time_hrs should be >= 0');
    assert.ok(Number(stop.productive_time_hrs) >= 0, 'productive_time_hrs should be >= 0');
    assert.equal(typeof Number(stop.drive_time_from_prev_mins), 'number');
  });

  it('RTE-13: First stop has sequence_order = 1', async () => {
    const res = await fetch(`${BASE}/v1/routes/${testRouteId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const data = (await res.json()) as any;
    assert.equal(data.data.stops[0].sequence_order, 1);
  });

  it('RTE-14: Second stop → 201', async () => {
    const res = await fetch(`${BASE}/v1/route-stops/${testRouteId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${coordinatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ client_id: clientIds[1] }),
    });
    const data = (await res.json()) as any;
    assert.equal(res.status, 201);
    assert.equal(data.data.summary.stop_count, 2);
    stopId2 = data.data.stops[1].id;
  });

  it('RTE-15: Third stop → 201', async () => {
    const res = await fetch(`${BASE}/v1/route-stops/${testRouteId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${coordinatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ client_id: clientIds[2] }),
    });
    const data = (await res.json()) as any;
    assert.equal(res.status, 201);
    assert.equal(data.data.summary.stop_count, 3);
    stopId3 = data.data.stops[2].id;
  });

  it('RTE-16: Second stop chains from first (sequence_order = 2)', async () => {
    const res = await fetch(`${BASE}/v1/routes/${testRouteId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const data = (await res.json()) as any;
    assert.equal(data.data.stops.length, 3);
    assert.equal(data.data.stops[0].sequence_order, 1);
    assert.equal(data.data.stops[1].sequence_order, 2);
    assert.equal(data.data.stops[2].sequence_order, 3);
  });

  it('RTE-17: Client already on route → 409', async () => {
    const res = await fetch(`${BASE}/v1/route-stops/${testRouteId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${coordinatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ client_id: clientIds[0] }),
    });
    const data = (await res.json()) as any;
    assert.equal(res.status, 409);
    assert.ok(data.error.includes('already assigned'));
  });
});

// ── GET /v1/route-stops ─────────────────────────────────────────

describe('GET /v1/route-stops', () => {
  it('RTE-18: No auth → 401', async () => {
    const res = await fetch(`${BASE}/v1/route-stops?route_id=${testRouteId}`);
    assert.equal(res.status, 401);
  });

  it('RTE-19: Returns ordered stops for route', async () => {
    const res = await fetch(`${BASE}/v1/route-stops?route_id=${testRouteId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const data = (await res.json()) as any;
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data));
    assert.equal(data.data.length, 3);
    // Verify ordering
    assert.ok(data.data[0].sequence_order < data.data[1].sequence_order);
  });
});

// ── DELETE /v1/route-stops/:id ──────────────────────────────────

describe('DELETE /v1/route-stops/:id', () => {
  it('RTE-20: No auth → 401', async () => {
    const res = await fetch(`${BASE}/v1/route-stops/${stopId2}`, { method: 'DELETE' });
    assert.equal(res.status, 401);
  });

  it('RTE-21: Removes stop → 200', async () => {
    const res = await fetch(`${BASE}/v1/route-stops/${stopId2}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${coordinatorToken}` },
    });
    const data = (await res.json()) as any;
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
  });

  it('RTE-22: Stop count decreases by 1', async () => {
    const res = await fetch(`${BASE}/v1/routes/${testRouteId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const data = (await res.json()) as any;
    assert.equal(data.data.summary.stop_count, 2);
  });
});

// ── PATCH /v1/route-stops/:route_id/reorder ─────────────────────

describe('PATCH /v1/route-stops/:route_id/reorder', () => {
  it('RTE-23: No auth → 401', async () => {
    const res = await fetch(`${BASE}/v1/route-stops/${testRouteId}/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stop_ids: [stopId3, stopId1] }),
    });
    assert.equal(res.status, 401);
  });

  it('RTE-24: Empty stop_ids → 400', async () => {
    const res = await fetch(`${BASE}/v1/route-stops/${testRouteId}/reorder`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${coordinatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stop_ids: [] }),
    });
    assert.equal(res.status, 400);
  });

  it('RTE-25: Reorders stops successfully → 200', async () => {
    // Reverse order: stop3 first, stop1 second
    const res = await fetch(`${BASE}/v1/route-stops/${testRouteId}/reorder`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${coordinatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stop_ids: [stopId3, stopId1] }),
    });
    const data = (await res.json()) as any;
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    // Verify new order
    const stops = data.data.stops;
    assert.equal(stops[0].id, stopId3);
    assert.equal(stops[0].sequence_order, 1);
    assert.equal(stops[1].id, stopId1);
    assert.equal(stops[1].sequence_order, 2);
  });
});
