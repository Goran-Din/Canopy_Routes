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

let ownerToken: string;
let coordinatorToken: string;
let salespersonToken: string;
let maintenanceSeasonId: string;
let testStopId: string;
let testClientId: string;

before(async () => {
  ownerToken = await login('erick@sunsetservices.us');
  coordinatorToken = await login('coordinator_test@sunsetservices.us');
  salespersonToken = await login('salesperson_test@sunsetservices.us');

  const seasonRes = await testPool.query(
    `SELECT id FROM rpw_seasons WHERE tab = 'maintenance' LIMIT 1`
  );
  maintenanceSeasonId = seasonRes.rows[0].id;

  // Find a stop for removal impact testing
  const stopRes = await testPool.query(
    `SELECT rs.id AS stop_id, rs.client_id
     FROM rpw_route_stops rs
     JOIN rpw_routes r ON r.id = rs.route_id
     WHERE r.season_id = $1 AND rs.deleted_at IS NULL
     LIMIT 1`,
    [maintenanceSeasonId]
  );
  if (stopRes.rows.length > 0) {
    testStopId = stopRes.rows[0].stop_id;
    testClientId = stopRes.rows[0].client_id;
  }
});

after(async () => {
  await testPool.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL');
  await testPool.end();
});

// ── POST /v1/tools/zone-fit ─────────────────────────────────────

describe('POST /v1/tools/zone-fit', () => {
  it('TOOL-1: No auth → 401', async () => {
    const res = await fetch(`${BASE}/v1/tools/zone-fit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: '123 Main St', season_id: maintenanceSeasonId }),
    });
    assert.equal(res.status, 401);
  });

  it('TOOL-2: Missing address → 400', async () => {
    const res = await fetch(`${BASE}/v1/tools/zone-fit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${coordinatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ season_id: maintenanceSeasonId }),
    });
    assert.equal(res.status, 400);
  });

  it('TOOL-3: Missing season_id → 400', async () => {
    const res = await fetch(`${BASE}/v1/tools/zone-fit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${coordinatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address: '123 Main St' }),
    });
    assert.equal(res.status, 400);
  });

  it('TOOL-4: Valid address returns zone suggestion', async () => {
    const res = await fetch(`${BASE}/v1/tools/zone-fit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${coordinatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: '1245 Sandpiper Lane, Naperville IL 60540',
        season_id: maintenanceSeasonId,
      }),
    });
    const data = (await res.json()) as any;
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.ok(data.data.zone, 'Should return a zone');
    assert.ok(data.data.day, 'Should return a day');
    assert.ok(['HIGH', 'MEDIUM', 'LOW'].includes(data.data.confidence));
    assert.ok(data.data.suggested_route, 'Should have suggested_route');
    assert.equal(typeof data.data.suggested_route.current_workday_hrs, 'number');
    assert.equal(typeof data.data.suggested_route.projected_workday_hrs, 'number');
    assert.equal(typeof data.data.productive_time_addition_mins, 'number');
    assert.equal(typeof data.data.drive_time_addition_mins, 'number');
    assert.ok(data.data.geocoded_address, 'Should have geocoded_address');
  });

  it('TOOL-5: Valid address with acres returns correct estimate', async () => {
    const res = await fetch(`${BASE}/v1/tools/zone-fit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${coordinatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: '1245 Sandpiper Lane, Naperville IL 60540',
        acres: 1.5,
        season_id: maintenanceSeasonId,
      }),
    });
    const data = (await res.json()) as any;
    assert.equal(res.status, 200);
    assert.ok(data.data.productive_time_addition_mins > 0, 'Should have productive time');
  });

  it('TOOL-6: Salesperson can access zone-fit', async () => {
    const res = await fetch(`${BASE}/v1/tools/zone-fit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${salespersonToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: '1245 Sandpiper Lane, Naperville IL 60540',
        season_id: maintenanceSeasonId,
      }),
    });
    const data = (await res.json()) as any;
    assert.equal(res.status, 200);
    assert.equal(data.data.annual_revenue, null, 'Revenue should be hidden from salesperson');
  });

  it('TOOL-7: Coordinator sees annual_revenue', async () => {
    const res = await fetch(`${BASE}/v1/tools/zone-fit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${coordinatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: '1245 Sandpiper Lane, Naperville IL 60540',
        acres: 1.0,
        season_id: maintenanceSeasonId,
      }),
    });
    const data = (await res.json()) as any;
    assert.equal(res.status, 200);
    assert.equal(typeof data.data.annual_revenue, 'number', 'Revenue should be visible to coordinator');
    assert.ok(data.data.annual_revenue > 0);
  });

  it('TOOL-8: Returns alternatives array', async () => {
    const res = await fetch(`${BASE}/v1/tools/zone-fit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${coordinatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: '1245 Sandpiper Lane, Naperville IL 60540',
        season_id: maintenanceSeasonId,
      }),
    });
    const data = (await res.json()) as any;
    assert.ok(Array.isArray(data.data.alternatives), 'Should have alternatives array');
  });
});

// ── POST /v1/tools/removal-impact ───────────────────────────────

describe('POST /v1/tools/removal-impact', () => {
  it('TOOL-9: No auth → 401', async () => {
    const res = await fetch(`${BASE}/v1/tools/removal-impact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: testClientId, route_stop_id: testStopId }),
    });
    assert.equal(res.status, 401);
  });

  it('TOOL-10: Salesperson → 403', async () => {
    const res = await fetch(`${BASE}/v1/tools/removal-impact`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${salespersonToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ client_id: testClientId, route_stop_id: testStopId }),
    });
    assert.equal(res.status, 403);
  });

  it('TOOL-11: Returns before/after with valid stop', async () => {
    if (!testStopId) return; // skip if no stops exist
    const res = await fetch(`${BASE}/v1/tools/removal-impact`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${coordinatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ client_id: testClientId, route_stop_id: testStopId }),
    });
    const data = (await res.json()) as any;
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.ok(data.data.before, 'Should have before');
    assert.ok(data.data.after, 'Should have after');
    assert.equal(typeof data.data.before.total_workday_hrs, 'number');
    assert.equal(typeof data.data.after.total_workday_hrs, 'number');
    assert.ok(data.data.after.stop_count < data.data.before.stop_count, 'After should have fewer stops');
    assert.equal(typeof data.data.revenue_delta, 'number');
    assert.equal(typeof data.data.drive_time_saved_mins, 'number');
  });

  it('TOOL-12: Invalid stop → 404', async () => {
    const res = await fetch(`${BASE}/v1/tools/removal-impact`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${coordinatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: '00000000-0000-0000-0000-000000000000',
        route_stop_id: '00000000-0000-0000-0000-000000000000',
      }),
    });
    assert.equal(res.status, 404);
  });
});

// ── GET /v1/tools/route-f-status ────────────────────────────────

describe('GET /v1/tools/route-f-status', () => {
  it('TOOL-13: No auth → 401', async () => {
    const res = await fetch(`${BASE}/v1/tools/route-f-status?season_id=${maintenanceSeasonId}`);
    assert.equal(res.status, 401);
  });

  it('TOOL-14: Salesperson → 403', async () => {
    const res = await fetch(`${BASE}/v1/tools/route-f-status?season_id=${maintenanceSeasonId}`, {
      headers: { Authorization: `Bearer ${salespersonToken}` },
    });
    assert.equal(res.status, 403);
  });

  it('TOOL-15: Returns status for valid season', async () => {
    const res = await fetch(`${BASE}/v1/tools/route-f-status?season_id=${maintenanceSeasonId}`, {
      headers: { Authorization: `Bearer ${coordinatorToken}` },
    });
    const data = (await res.json()) as any;
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(typeof data.data.stop_count, 'number');
    assert.equal(typeof data.data.total_acres, 'number');
    assert.ok(['safe', 'approaching', 'warning', 'critical'].includes(data.data.status));
    assert.equal(data.data.threshold_stops, 62);
    assert.equal(data.data.threshold_acres, 56);
  });
});
