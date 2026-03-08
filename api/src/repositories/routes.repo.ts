// api/src/repositories/routes.repo.ts
// Database queries for rpw_routes and rpw_route_stops — parameterised SQL only
// Last modified: 2026-03-05

import { pool } from '../db/pool';

// ── Route queries ────────────────────────────────────────────────

export async function getRoutesBySeasonId(tenantId: string, seasonId: string) {
  const result = await pool.query(
    `SELECT * FROM rpw_routes WHERE tenant_id = $1 AND season_id = $2 ORDER BY day_of_week, route_label`,
    [tenantId, seasonId]
  );
  return result.rows;
}

export async function getRouteById(tenantId: string, routeId: string) {
  const result = await pool.query(
    `SELECT * FROM rpw_routes WHERE tenant_id = $1 AND id = $2`,
    [tenantId, routeId]
  );
  return result.rows[0] || null;
}

export async function updateRoute(
  tenantId: string,
  routeId: string,
  fields: { crew_id?: string; mow_rate_override?: number }
) {
  const updates: string[] = [];
  const values: any[] = [tenantId, routeId];
  let idx = 3;

  if (fields.crew_id !== undefined) {
    updates.push(`crew_id = $${idx++}`);
    values.push(fields.crew_id);
  }
  if (fields.mow_rate_override !== undefined) {
    updates.push(`mow_rate_override = $${idx++}`);
    values.push(fields.mow_rate_override);
  }

  if (updates.length === 0) return getRouteById(tenantId, routeId);

  const result = await pool.query(
    `UPDATE rpw_routes SET ${updates.join(', ')} WHERE tenant_id = $1 AND id = $2 RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function getRoutesByCrewAndDay(
  tenantId: string,
  seasonId: string,
  crewId: string,
  dayOfWeek: string,
  excludeRouteId?: string
) {
  const result = await pool.query(
    `SELECT * FROM rpw_routes
     WHERE tenant_id = $1 AND season_id = $2 AND crew_id = $3 AND day_of_week = $4
       AND ($5::uuid IS NULL OR id != $5)`,
    [tenantId, seasonId, crewId, dayOfWeek, excludeRouteId || null]
  );
  return result.rows;
}

// ── Stop queries ─────────────────────────────────────────────────

export async function getStopsByRouteId(tenantId: string, routeId: string) {
  const result = await pool.query(
    `SELECT rs.*, c.acres, c.address_lat, c.address_lng, c.service_frequency,
            c.client_name, c.client_status, c.acreage_confirmed, c.annual_revenue
     FROM rpw_route_stops rs
     JOIN rpw_clients c ON c.id = rs.client_id
     WHERE rs.tenant_id = $1 AND rs.route_id = $2 AND rs.deleted_at IS NULL
     ORDER BY rs.sequence_order ASC`,
    [tenantId, routeId]
  );
  return result.rows;
}

export async function getStopById(tenantId: string, stopId: string) {
  const result = await pool.query(
    `SELECT rs.*, c.acres, c.address_lat, c.address_lng, c.service_frequency, c.client_name
     FROM rpw_route_stops rs
     JOIN rpw_clients c ON c.id = rs.client_id
     WHERE rs.tenant_id = $1 AND rs.id = $2`,
    [tenantId, stopId]
  );
  return result.rows[0] || null;
}

export async function getMaxSequenceOrder(tenantId: string, routeId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COALESCE(MAX(sequence_order), 0) AS max_seq
     FROM rpw_route_stops
     WHERE tenant_id = $1 AND route_id = $2 AND deleted_at IS NULL`,
    [tenantId, routeId]
  );
  return parseInt(result.rows[0].max_seq, 10);
}

export async function isClientAlreadyOnRoute(
  tenantId: string,
  seasonId: string,
  clientId: string
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM rpw_route_stops rs
     JOIN rpw_routes r ON r.id = rs.route_id
     WHERE rs.tenant_id = $1 AND r.season_id = $2 AND rs.client_id = $3 AND rs.deleted_at IS NULL
     LIMIT 1`,
    [tenantId, seasonId, clientId]
  );
  return result.rows.length > 0;
}

export async function createStop(
  tenantId: string,
  data: {
    route_id: string;
    client_id: string;
    sequence_order: number;
    mow_time_hrs: number;
    trim_time_hrs: number;
    productive_time_hrs: number;
    drive_time_from_prev_mins: number;
    mow_rate_override: number;
  }
) {
  const result = await pool.query(
    `INSERT INTO rpw_route_stops (
       tenant_id, route_id, client_id, sequence_order,
       mow_time_hrs, trim_time_hrs, productive_time_hrs,
       drive_time_from_prev_mins, drive_time_from_prev_hrs,
       mow_rate_override
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      tenantId,
      data.route_id,
      data.client_id,
      data.sequence_order,
      data.mow_time_hrs,
      data.trim_time_hrs,
      data.productive_time_hrs,
      data.drive_time_from_prev_mins,
      data.drive_time_from_prev_mins / 60,
      data.mow_rate_override,
    ]
  );
  return result.rows[0];
}

export async function updateStop(
  tenantId: string,
  stopId: string,
  fields: {
    mow_time_hrs?: number;
    trim_time_hrs?: number;
    productive_time_hrs?: number;
    drive_time_from_prev_mins?: number;
    mow_rate_override?: number;
    sequence_notes?: string;
  }
) {
  const updates: string[] = [];
  const values: any[] = [tenantId, stopId];
  let idx = 3;

  if (fields.mow_time_hrs !== undefined) {
    updates.push(`mow_time_hrs = $${idx++}`);
    values.push(fields.mow_time_hrs);
  }
  if (fields.trim_time_hrs !== undefined) {
    updates.push(`trim_time_hrs = $${idx++}`);
    values.push(fields.trim_time_hrs);
  }
  if (fields.productive_time_hrs !== undefined) {
    updates.push(`productive_time_hrs = $${idx++}`);
    values.push(fields.productive_time_hrs);
  }
  if (fields.drive_time_from_prev_mins !== undefined) {
    updates.push(`drive_time_from_prev_mins = $${idx++}`);
    values.push(fields.drive_time_from_prev_mins);
    updates.push(`drive_time_from_prev_hrs = $${idx++}`);
    values.push(fields.drive_time_from_prev_mins / 60);
  }
  if (fields.mow_rate_override !== undefined) {
    updates.push(`mow_rate_override = $${idx++}`);
    values.push(fields.mow_rate_override);
  }
  if (fields.sequence_notes !== undefined) {
    updates.push(`sequence_notes = $${idx++}`);
    values.push(fields.sequence_notes);
  }

  if (updates.length === 0) return getStopById(tenantId, stopId);

  const result = await pool.query(
    `UPDATE rpw_route_stops SET ${updates.join(', ')} WHERE tenant_id = $1 AND id = $2 RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function softDeleteStop(tenantId: string, stopId: string): Promise<void> {
  await pool.query(
    `UPDATE rpw_route_stops SET deleted_at = NOW() WHERE tenant_id = $1 AND id = $2`,
    [tenantId, stopId]
  );
}

export async function reorderStops(
  tenantId: string,
  routeId: string,
  orderedStopIds: string[]
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < orderedStopIds.length; i++) {
      await client.query(
        `UPDATE rpw_route_stops SET sequence_order = $3
         WHERE tenant_id = $1 AND id = $2 AND route_id = $4 AND deleted_at IS NULL`,
        [tenantId, orderedStopIds[i], i + 1, routeId]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getClientById(tenantId: string, clientId: string) {
  const result = await pool.query(
    `SELECT id, client_name, acres, address_lat, address_lng, service_frequency
     FROM rpw_clients
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
    [tenantId, clientId]
  );
  return result.rows[0] || null;
}

export async function getStopByPosition(tenantId: string, routeId: string, sequenceOrder: number) {
  const result = await pool.query(
    `SELECT rs.*, c.address_lat, c.address_lng
     FROM rpw_route_stops rs
     JOIN rpw_clients c ON c.id = rs.client_id
     WHERE rs.tenant_id = $1 AND rs.route_id = $2 AND rs.sequence_order = $3 AND rs.deleted_at IS NULL`,
    [tenantId, routeId, sequenceOrder]
  );
  return result.rows[0] || null;
}

export async function getCrewById(tenantId: string, crewId: string) {
  const result = await pool.query(
    `SELECT id, crew_code, display_name, mow_rate_ac_hr FROM rpw_crews WHERE tenant_id = $1 AND id = $2`,
    [tenantId, crewId]
  );
  return result.rows[0] || null;
}
