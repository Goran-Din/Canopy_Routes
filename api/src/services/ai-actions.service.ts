// api/src/services/ai-actions.service.ts
// Executes AI-proposed route changes with full audit logging

import { pool } from '../db/pool';

export interface ActionResult {
  success: boolean;
  summary: string;
  affected: number;
  details?: Record<string, unknown>;
}

export async function executeMoveClient(
  tenantId: string,
  userId: string,
  clientId: string,
  toRouteId: string
): Promise<ActionResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify destination route exists and season is draft
    const routeCheck = await client.query(
      `SELECT r.id, r.route_label, s.status as season_status
       FROM rpw_routes r JOIN rpw_seasons s ON s.id = r.season_id
       WHERE r.id = $1 AND r.tenant_id = $2`,
      [toRouteId, tenantId]
    );
    if (routeCheck.rows.length === 0) throw new Error('Destination route not found');
    if (routeCheck.rows[0].season_status !== 'draft') throw new Error('Season must be in draft status');

    // Find current stop
    const stopResult = await client.query(
      `SELECT rs.id, rs.route_id, r.route_label as from_label, c.client_name
       FROM rpw_route_stops rs
       JOIN rpw_routes r ON r.id = rs.route_id
       JOIN rpw_clients c ON c.id = rs.client_id
       WHERE rs.client_id = $1 AND r.tenant_id = $2 AND rs.deleted_at IS NULL`,
      [clientId, tenantId]
    );
    if (stopResult.rows.length === 0) throw new Error('Client stop not found');
    const stop = stopResult.rows[0];
    const fromLabel = stop.from_label;
    const toLabel = routeCheck.rows[0].route_label;

    // Soft-delete from current route
    await client.query(
      'UPDATE rpw_route_stops SET deleted_at = NOW() WHERE id = $1',
      [stop.id]
    );

    // Get next sequence order
    const seqResult = await client.query(
      `SELECT COALESCE(MAX(sequence_order), 0) + 1 as next_seq
       FROM rpw_route_stops WHERE route_id = $1 AND deleted_at IS NULL`,
      [toRouteId]
    );

    // Insert into destination route
    await client.query(
      `INSERT INTO rpw_route_stops (tenant_id, route_id, client_id, sequence_order)
       VALUES ($1, $2, $3, $4)`,
      [tenantId, toRouteId, clientId, seqResult.rows[0].next_seq]
    );

    // Audit log
    await client.query(
      `INSERT INTO rpw_ai_action_log (tenant_id, user_id, action_tool, action_input, action_result, status)
       VALUES ($1, $2, 'move_client', $3, $4, 'success')`,
      [tenantId, userId,
        JSON.stringify({ clientId, toRouteId }),
        JSON.stringify({ fromLabel, toLabel, clientName: stop.client_name })]
    );

    await client.query('COMMIT');
    return {
      success: true,
      summary: `Moved ${stop.client_name} from ${fromLabel} to ${toLabel}`,
      affected: 1,
      details: { clientName: stop.client_name, fromRoute: fromLabel, toRoute: toLabel },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function executeMoveClients(
  tenantId: string,
  userId: string,
  clientIds: string[],
  toRouteId: string
): Promise<ActionResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const routeCheck = await client.query(
      `SELECT r.id, r.route_label, s.status as season_status
       FROM rpw_routes r JOIN rpw_seasons s ON s.id = r.season_id
       WHERE r.id = $1 AND r.tenant_id = $2`,
      [toRouteId, tenantId]
    );
    if (routeCheck.rows.length === 0) throw new Error('Destination route not found');
    if (routeCheck.rows[0].season_status !== 'draft') throw new Error('Season must be in draft status');
    const toLabel = routeCheck.rows[0].route_label;

    let movedCount = 0;
    for (const clientId of clientIds) {
      const stopResult = await client.query(
        `SELECT rs.id FROM rpw_route_stops rs
         JOIN rpw_routes r ON r.id = rs.route_id
         WHERE rs.client_id = $1 AND r.tenant_id = $2 AND rs.deleted_at IS NULL`,
        [clientId, tenantId]
      );
      if (stopResult.rows.length === 0) continue;

      await client.query('UPDATE rpw_route_stops SET deleted_at = NOW() WHERE id = $1', [stopResult.rows[0].id]);

      const seqResult = await client.query(
        `SELECT COALESCE(MAX(sequence_order), 0) + 1 as next_seq
         FROM rpw_route_stops WHERE route_id = $1 AND deleted_at IS NULL`,
        [toRouteId]
      );
      await client.query(
        `INSERT INTO rpw_route_stops (tenant_id, route_id, client_id, sequence_order)
         VALUES ($1, $2, $3, $4)`,
        [tenantId, toRouteId, clientId, seqResult.rows[0].next_seq]
      );
      movedCount++;
    }

    await client.query(
      `INSERT INTO rpw_ai_action_log (tenant_id, user_id, action_tool, action_input, action_result, status)
       VALUES ($1, $2, 'move_multiple_clients', $3, $4, 'success')`,
      [tenantId, userId,
        JSON.stringify({ clientIds, toRouteId }),
        JSON.stringify({ movedCount, toRoute: toLabel })]
    );

    await client.query('COMMIT');
    return { success: true, summary: `Moved ${movedCount} clients to ${toLabel}`, affected: movedCount };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function executeReorderStops(
  tenantId: string,
  userId: string,
  routeId: string,
  orderedClientIds: string[]
): Promise<ActionResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentStops = await client.query(
      `SELECT client_id FROM rpw_route_stops WHERE route_id = $1 AND deleted_at IS NULL`,
      [routeId]
    );
    const currentIds = new Set(currentStops.rows.map((r: any) => r.client_id));
    if (orderedClientIds.length !== currentIds.size || !orderedClientIds.every((id) => currentIds.has(id))) {
      throw new Error('orderedClientIds must exactly match current route stops');
    }

    for (let i = 0; i < orderedClientIds.length; i++) {
      await client.query(
        `UPDATE rpw_route_stops SET sequence_order = $1
         WHERE route_id = $2 AND client_id = $3 AND deleted_at IS NULL`,
        [i + 1, routeId, orderedClientIds[i]]
      );
    }

    await client.query(
      `INSERT INTO rpw_ai_action_log (tenant_id, user_id, action_tool, action_input, action_result, status)
       VALUES ($1, $2, 'reorder_stops', $3, $4, 'success')`,
      [tenantId, userId,
        JSON.stringify({ routeId, orderedClientIds }),
        JSON.stringify({ reorderedCount: orderedClientIds.length })]
    );

    await client.query('COMMIT');
    return { success: true, summary: `Reordered ${orderedClientIds.length} stops`, affected: orderedClientIds.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function executeCreateRoute(
  tenantId: string,
  userId: string,
  name: string,
  seasonId: string
): Promise<ActionResult> {
  const seasonCheck = await pool.query(
    'SELECT status, tab FROM rpw_seasons WHERE id = $1 AND tenant_id = $2',
    [seasonId, tenantId]
  );
  if (seasonCheck.rows.length === 0) throw new Error('Season not found');
  if (seasonCheck.rows[0].status !== 'draft') throw new Error('Season must be in draft status');

  const result = await pool.query(
    `INSERT INTO rpw_routes (tenant_id, season_id, tab, route_label, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING id`,
    [tenantId, seasonId, seasonCheck.rows[0].tab, name]
  );

  await pool.query(
    `INSERT INTO rpw_ai_action_log (tenant_id, user_id, action_tool, action_input, action_result, status)
     VALUES ($1, $2, 'create_route', $3, $4, 'success')`,
    [tenantId, userId,
      JSON.stringify({ name, seasonId }),
      JSON.stringify({ routeId: result.rows[0].id })]
  );

  return { success: true, summary: `Created new route: ${name}`, affected: 1, details: { routeId: result.rows[0].id } };
}

export async function executeDeactivateRoute(
  tenantId: string,
  userId: string,
  routeId: string,
  redistributeToRouteId?: string
): Promise<ActionResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const stopCount = await client.query(
      'SELECT COUNT(*)::int as cnt FROM rpw_route_stops WHERE route_id = $1 AND deleted_at IS NULL',
      [routeId]
    );
    const count = stopCount.rows[0].cnt;

    if (count > 0 && !redistributeToRouteId) {
      throw new Error('Must provide redistributeToRouteId when route has assigned clients');
    }

    if (count > 0 && redistributeToRouteId) {
      const stops = await client.query(
        'SELECT client_id FROM rpw_route_stops WHERE route_id = $1 AND deleted_at IS NULL ORDER BY sequence_order',
        [routeId]
      );
      for (const stop of stops.rows) {
        const seqResult = await client.query(
          `SELECT COALESCE(MAX(sequence_order), 0) + 1 as next_seq
           FROM rpw_route_stops WHERE route_id = $1 AND deleted_at IS NULL`,
          [redistributeToRouteId]
        );
        await client.query(
          `UPDATE rpw_route_stops SET route_id = $1, sequence_order = $2
           WHERE route_id = $3 AND client_id = $4 AND deleted_at IS NULL`,
          [redistributeToRouteId, seqResult.rows[0].next_seq, routeId, stop.client_id]
        );
      }
    }

    await client.query('UPDATE rpw_routes SET is_active = false WHERE id = $1 AND tenant_id = $2', [routeId, tenantId]);

    await client.query(
      `INSERT INTO rpw_ai_action_log (tenant_id, user_id, action_tool, action_input, action_result, status)
       VALUES ($1, $2, 'deactivate_route', $3, $4, 'success')`,
      [tenantId, userId,
        JSON.stringify({ routeId, redistributeToRouteId }),
        JSON.stringify({ clientsRedistributed: count })]
    );

    await client.query('COMMIT');
    return { success: true, summary: `Deactivated route, redistributed ${count} clients`, affected: count + 1 };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function executeUpdateCostConfig(
  tenantId: string,
  userId: string,
  updates: {
    laborRate?: number;
    crewSize?: number;
    fuelCostPerMile?: number;
    equipmentCostPerHour?: number;
    overheadRatePercent?: number;
  }
): Promise<ActionResult> {
  const setClauses: string[] = [];
  const params: any[] = [tenantId];

  if (updates.laborRate !== undefined) { params.push(updates.laborRate); setClauses.push(`labor_rate = $${params.length}`); }
  if (updates.crewSize !== undefined) { params.push(updates.crewSize); setClauses.push(`crew_size = $${params.length}`); }
  if (updates.fuelCostPerMile !== undefined) { params.push(updates.fuelCostPerMile); setClauses.push(`fuel_cost_per_mile = $${params.length}`); }
  if (updates.equipmentCostPerHour !== undefined) { params.push(updates.equipmentCostPerHour); setClauses.push(`equipment_cost_per_hour = $${params.length}`); }
  if (updates.overheadRatePercent !== undefined) { params.push(updates.overheadRatePercent); setClauses.push(`overhead_rate_percent = $${params.length}`); }

  if (setClauses.length === 0) throw new Error('No fields to update');

  setClauses.push('updated_at = NOW()');
  await pool.query(
    `UPDATE rpw_cost_config SET ${setClauses.join(', ')} WHERE tenant_id = $1`,
    params
  );

  await pool.query(
    `INSERT INTO rpw_ai_action_log (tenant_id, user_id, action_tool, action_input, action_result, status)
     VALUES ($1, $2, 'update_cost_config', $3, $4, 'success')`,
    [tenantId, userId, JSON.stringify(updates), JSON.stringify({ updated: setClauses.length - 1 })]
  );

  return { success: true, summary: `Updated ${setClauses.length - 1} cost config values`, affected: 1 };
}
