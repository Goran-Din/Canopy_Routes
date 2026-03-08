// api/src/services/snapshot.service.ts
// Creates season snapshots with full route/client data for historical tracking

import { pool } from '../db/pool';
import { calcRouteCost, getMarginStatus, kmToMiles } from './profitability.service';

export async function createSeasonSnapshot(
  tenantId: string,
  seasonId: string,
  notes?: string
): Promise<string> {
  // Get season info
  const seasonResult = await pool.query(
    'SELECT * FROM rpw_seasons WHERE id = $1 AND tenant_id = $2',
    [seasonId, tenantId]
  );
  if (seasonResult.rows.length === 0) throw new Error('Season not found');
  const season = seasonResult.rows[0];

  // Get cost config
  const cfgResult = await pool.query(
    'SELECT * FROM rpw_cost_config WHERE tenant_id = $1', [tenantId]
  );
  const cfg = cfgResult.rows[0];
  const config = {
    laborRate: cfg ? parseFloat(cfg.labor_rate) : 18,
    crewSize: cfg ? cfg.crew_size : 2,
    fuelCostPerMile: cfg ? parseFloat(cfg.fuel_cost_per_mile) : 0.21,
    equipmentCostPerHour: cfg ? parseFloat(cfg.equipment_cost_per_hour) : 4.5,
    overheadRatePercent: cfg ? parseFloat(cfg.overhead_rate_percent) : 12,
  };

  // Get all routes with aggregated stop data
  const routesResult = await pool.query(
    `SELECT
       r.id, r.route_label, r.day_of_week, r.max_stops, r.target_hours,
       COUNT(rs.id)::int AS stop_count,
       COALESCE(SUM(c.annual_revenue), 0)::numeric AS annual_revenue,
       COALESCE(SUM(rs.productive_time_hrs), 0)::numeric AS productive_hrs,
       COALESCE(SUM(rs.drive_time_from_prev_mins) / 60.0, 0)::numeric AS drive_hrs,
       json_agg(json_build_object(
         'clientId', c.id,
         'clientName', c.client_name,
         'address', c.service_address,
         'annualRevenue', c.annual_revenue,
         'sequenceOrder', rs.sequence_order
       ) ORDER BY rs.sequence_order) FILTER (WHERE c.id IS NOT NULL) AS stops
     FROM rpw_routes r
     LEFT JOIN rpw_route_stops rs ON rs.route_id = r.id AND rs.deleted_at IS NULL
     LEFT JOIN rpw_clients c ON c.id = rs.client_id AND c.deleted_at IS NULL
     WHERE r.tenant_id = $1 AND r.season_id = $2 AND r.is_active = true
     GROUP BY r.id, r.route_label, r.day_of_week, r.max_stops, r.target_hours
     ORDER BY r.route_label`,
    [tenantId, seasonId]
  );

  const routes = routesResult.rows.map((row) => {
    const weeklyHours = parseFloat(row.productive_hrs) + parseFloat(row.drive_hrs);
    const driveHrs = parseFloat(row.drive_hrs);
    const weeklyMiles = kmToMiles(driveHrs * 40);
    const annualRevenue = parseFloat(row.annual_revenue);
    const annualCost = calcRouteCost(weeklyHours, weeklyMiles, config);
    const marginPercent = annualRevenue > 0 ? ((annualRevenue - annualCost) / annualRevenue) * 100 : 0;

    return {
      routeId: row.id,
      routeName: row.route_label,
      dayOfWeek: row.day_of_week,
      stopCount: row.stop_count,
      weeklyHours: Math.round(weeklyHours * 100) / 100,
      annualRevenue: Math.round(annualRevenue),
      annualCost: Math.round(annualCost),
      marginPercent: Math.round(marginPercent * 10) / 10,
      status: getMarginStatus(marginPercent),
      stops: row.stops || [],
    };
  });

  const totalRevenue = routes.reduce((s, r) => s + r.annualRevenue, 0);
  const totalCost = routes.reduce((s, r) => s + r.annualCost, 0);
  const avgMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;
  const totalClients = routes.reduce((s, r) => s + r.stopCount, 0);

  const snapshotData = {
    season: {
      id: season.id,
      label: season.season_label,
      year: season.year,
      type: season.tab,
      status: season.status,
    },
    costConfig: config,
    routes,
    summary: {
      totalClients,
      totalRevenue,
      totalCost,
      avgMarginPercent: Math.round(avgMargin * 10) / 10,
    },
  };

  // Insert snapshot
  const snapshotResult = await pool.query(
    `INSERT INTO rpw_season_snapshots
       (tenant_id, season_id, season_year, season_type, total_clients, total_revenue, avg_margin_percent, snapshot_data, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      tenantId, seasonId,
      season.year || new Date().getFullYear(),
      season.tab || 'maintenance',
      totalClients,
      totalRevenue,
      Math.round(avgMargin * 10) / 10,
      JSON.stringify(snapshotData),
      notes || null,
    ]
  );

  const snapshotId = snapshotResult.rows[0].id;

  // Populate client history
  for (const route of routes) {
    for (const stop of route.stops) {
      if (!stop.clientId) continue;
      await pool.query(
        `INSERT INTO rpw_client_history
           (tenant_id, client_id, season_id, season_year, route_name, annual_revenue, was_retained)
         VALUES ($1, $2, $3, $4, $5, $6, NULL)
         ON CONFLICT (client_id, season_id) DO NOTHING`,
        [
          tenantId, stop.clientId, seasonId,
          season.year || new Date().getFullYear(),
          route.routeName, stop.annualRevenue || 0,
        ]
      );
    }
  }

  return snapshotId;
}
