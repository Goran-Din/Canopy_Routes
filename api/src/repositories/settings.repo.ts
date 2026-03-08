import { pool } from '../db/pool';

export async function getCrews(tenantId: string) {
  const result = await pool.query(
    `SELECT id, crew_code, display_name, mow_rate_ac_hr, crew_type, is_active
     FROM rpw_crews
     WHERE tenant_id = $1 AND is_active = true
     ORDER BY crew_code`,
    [tenantId]
  );
  return result.rows;
}

export async function updateCrew(
  tenantId: string,
  crewId: string,
  data: { mow_rate_ac_hr?: number; crew_type?: string }
) {
  const updates: string[] = [];
  const values: any[] = [tenantId, crewId];
  let idx = 3;

  if (data.mow_rate_ac_hr !== undefined) {
    updates.push(`mow_rate_ac_hr = $${idx++}`);
    values.push(data.mow_rate_ac_hr);
  }
  if (data.crew_type !== undefined) {
    updates.push(`crew_type = $${idx++}`);
    values.push(data.crew_type);
  }

  if (updates.length === 0) return null;

  const result = await pool.query(
    `UPDATE rpw_crews SET ${updates.join(', ')} WHERE tenant_id = $1 AND id = $2 RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function getRouteSlots(tenantId: string, seasonId: string) {
  const result = await pool.query(
    `SELECT r.id, r.route_label, r.zone_label, r.day_of_week, r.max_stops, r.target_hours, r.crew_id,
            c.crew_code, c.display_name AS crew_name, c.mow_rate_ac_hr, c.crew_type
     FROM rpw_routes r
     LEFT JOIN rpw_crews c ON c.id = r.crew_id
     WHERE r.tenant_id = $1 AND r.season_id = $2 AND r.tab = 'maintenance' AND r.is_active = true
     ORDER BY r.day_of_week, r.route_label`,
    [tenantId, seasonId]
  );
  return result.rows;
}

export async function updateRouteSlot(
  tenantId: string,
  routeId: string,
  data: { max_stops?: number; target_hours?: number; route_label?: string }
) {
  const updates: string[] = [];
  const values: any[] = [tenantId, routeId];
  let idx = 3;

  if (data.max_stops !== undefined) {
    updates.push(`max_stops = $${idx++}`);
    values.push(data.max_stops);
  }
  if (data.target_hours !== undefined) {
    updates.push(`target_hours = $${idx++}`);
    values.push(data.target_hours);
  }
  if (data.route_label !== undefined) {
    updates.push(`route_label = $${idx++}`);
    values.push(data.route_label);
  }

  if (updates.length === 0) return null;

  const result = await pool.query(
    `UPDATE rpw_routes SET ${updates.join(', ')} WHERE tenant_id = $1 AND id = $2 RETURNING *`,
    values
  );
  return result.rows[0] || null;
}
