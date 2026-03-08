import { pool } from '../db/pool';

export async function getRoutesWithStopsForSeason(tenantId: string, seasonId: string) {
  const routes = await pool.query(
    `SELECT * FROM rpw_routes
     WHERE tenant_id = $1 AND season_id = $2 AND is_active = true
     ORDER BY day_of_week, route_label`,
    [tenantId, seasonId]
  );

  const result: Array<{ route: any; stops: Array<{ stop: any; client: any }> }> = [];

  for (const route of routes.rows) {
    const stops = await pool.query(
      `SELECT rs.*, c.client_name, c.acres, c.address_lat, c.address_lng,
              c.service_frequency, c.client_status, c.acreage_confirmed,
              c.annual_revenue, c.service_address, c.city
       FROM rpw_route_stops rs
       JOIN rpw_clients c ON c.id = rs.client_id
       WHERE rs.tenant_id = $1 AND rs.route_id = $2 AND rs.deleted_at IS NULL
       ORDER BY rs.sequence_order ASC`,
      [tenantId, route.id]
    );
    result.push({
      route,
      stops: stops.rows.map((s: any) => ({
        stop: s,
        client: {
          id: s.client_id,
          client_name: s.client_name,
          acres: s.acres,
          address_lat: s.address_lat,
          address_lng: s.address_lng,
          service_frequency: s.service_frequency,
          client_status: s.client_status,
          acreage_confirmed: s.acreage_confirmed,
          annual_revenue: s.annual_revenue,
          service_address: s.service_address,
          city: s.city,
        },
      })),
    });
  }

  return result;
}

export async function getRouteFStatus(tenantId: string, seasonId: string) {
  const result = await pool.query(
    `SELECT COUNT(rs.id)::int AS stop_count,
            COALESCE(SUM(c.acres), 0)::float AS total_acres
     FROM rpw_route_stops rs
     JOIN rpw_routes r ON r.id = rs.route_id
     JOIN rpw_clients c ON c.id = rs.client_id
     WHERE rs.tenant_id = $1
       AND r.season_id = $2
       AND r.tab = 'maintenance'
       AND r.is_active = true
       AND rs.deleted_at IS NULL`,
    [tenantId, seasonId]
  );
  return result.rows[0];
}

export async function getClientWithStop(tenantId: string, clientId: string, routeStopId: string) {
  const result = await pool.query(
    `SELECT rs.*, c.client_name, c.acres, c.address_lat, c.address_lng,
            c.service_frequency, c.annual_revenue, c.client_status,
            r.route_label, r.day_of_week, r.depot_lat, r.depot_lng,
            r.crew_id, r.mow_rate_override AS route_mow_rate_override,
            r.id AS route_id, r.season_id
     FROM rpw_route_stops rs
     JOIN rpw_clients c ON c.id = rs.client_id
     JOIN rpw_routes r ON r.id = rs.route_id
     WHERE rs.tenant_id = $1 AND rs.client_id = $2 AND rs.id = $3 AND rs.deleted_at IS NULL`,
    [tenantId, clientId, routeStopId]
  );
  return result.rows[0] || null;
}

export async function getUnassignedClientsWithCoords(tenantId: string, seasonId: string) {
  const result = await pool.query(
    `SELECT c.id, c.client_name, c.address_lat, c.address_lng, c.acres,
            c.service_frequency, c.annual_revenue, c.client_type
     FROM rpw_clients c
     LEFT JOIN rpw_route_stops rs ON rs.client_id = c.id AND rs.deleted_at IS NULL
     WHERE c.tenant_id = $1
       AND c.deleted_at IS NULL
       AND c.geocode_status = 'success'
       AND c.address_lat IS NOT NULL
       AND c.address_lng IS NOT NULL
       AND rs.id IS NULL`,
    [tenantId]
  );
  return result.rows;
}

export async function getRoutesWithSettingsForSeason(tenantId: string, seasonId: string) {
  const result = await pool.query(
    `SELECT r.id, r.route_label, r.zone_label, r.day_of_week, r.max_stops, r.target_hours,
            r.crew_id, r.depot_lat, r.depot_lng,
            c.mow_rate_ac_hr, c.crew_type,
            (SELECT COUNT(*)::int FROM rpw_route_stops rs WHERE rs.route_id = r.id AND rs.deleted_at IS NULL) AS current_stops
     FROM rpw_routes r
     LEFT JOIN rpw_crews c ON c.id = r.crew_id
     WHERE r.tenant_id = $1 AND r.season_id = $2 AND r.tab = 'maintenance' AND r.is_active = true
       AND r.day_of_week IS NOT NULL
     ORDER BY r.day_of_week, r.route_label`,
    [tenantId, seasonId]
  );
  return result.rows;
}

export async function getZoneBoundaries(tenantId: string) {
  const result = await pool.query(
    `SELECT rule_number, zone_label, bearing_min, bearing_max,
            distance_min_mi, distance_max_mi, requires_commercial, description
     FROM rpw_zone_boundaries
     WHERE tenant_id = $1
     ORDER BY rule_number`,
    [tenantId]
  );
  return result.rows;
}
