import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { pool } from '../db/pool';

function escapeCsv(val: unknown): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function round1(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

const CSV_HEADER = [
  'Route', 'Day', 'Crew', 'Stop#', 'Client Name', 'Service Address',
  'City', 'ZIP', 'Acres', 'Est Mow Time (min)', 'Drive From Prev (min)',
  'Cumulative Time (min)', 'Annual Revenue',
].join(',');

export async function exportRoutesCsv(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const seasonId = req.query.season_id as string;
  const routeId = req.query.route_id as string | undefined;

  if (!seasonId) {
    res.status(400).json({ success: false, error: 'season_id query parameter is required.' });
    return;
  }

  // Fetch routes
  let routeFilter = '';
  const params: any[] = [tenantId, seasonId];
  if (routeId) {
    routeFilter = ' AND r.id = $3';
    params.push(routeId);
  }

  const routesResult = await pool.query(
    `SELECT r.id, r.route_label, r.day_of_week, r.crew_id,
            cr.crew_code
     FROM rpw_routes r
     LEFT JOIN rpw_crews cr ON cr.id = r.crew_id
     WHERE r.tenant_id = $1 AND r.season_id = $2
       AND r.tab = 'maintenance' AND r.is_active = true
       ${routeFilter}
     ORDER BY r.day_of_week, r.route_label`,
    params
  );

  const routes = routesResult.rows;
  if (routes.length === 0) {
    res.status(404).json({ success: false, error: 'No routes found.' });
    return;
  }

  const lines: string[] = [CSV_HEADER];
  let isFirstRoute = true;

  for (const route of routes) {
    // Blank row between routes when exporting multiple
    if (!isFirstRoute && !routeId) {
      lines.push('');
    }
    isFirstRoute = false;

    const stopsResult = await pool.query(
      `SELECT rs.sequence_order, rs.mow_time_hrs, rs.trim_time_hrs,
              rs.drive_time_from_prev_mins, rs.productive_time_hrs,
              c.client_name, c.service_address, c.city, c.zip,
              c.acres, c.annual_revenue
       FROM rpw_route_stops rs
       JOIN rpw_clients c ON c.id = rs.client_id
       WHERE rs.tenant_id = $1 AND rs.route_id = $2 AND rs.deleted_at IS NULL
       ORDER BY rs.sequence_order ASC`,
      [tenantId, route.id]
    );

    let cumulativeMins = 0;

    for (const stop of stopsResult.rows) {
      const mowMins = (Number(stop.mow_time_hrs) + Number(stop.trim_time_hrs)) * 60;
      const driveMins = Number(stop.drive_time_from_prev_mins);
      cumulativeMins += mowMins + driveMins;

      const row = [
        escapeCsv(route.route_label),
        escapeCsv(route.day_of_week ?? ''),
        escapeCsv(route.crew_code ?? ''),
        String(stop.sequence_order),
        escapeCsv(stop.client_name),
        escapeCsv(stop.service_address),
        escapeCsv(stop.city),
        escapeCsv(stop.zip),
        round1(Number(stop.acres)),
        round1(mowMins),
        round1(driveMins),
        round1(cumulativeMins),
        stop.annual_revenue != null ? Number(stop.annual_revenue).toFixed(2) : '',
      ];
      lines.push(row.join(','));
    }
  }

  const csv = lines.join('\r\n') + '\r\n';

  const filename = routeId && routes.length === 1
    ? `${routes[0].route_label.replace(/[^a-zA-Z0-9·\- ]/g, '')}.csv`
    : 'sunset_routes_2026.csv';

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

export async function exportFailedClients(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const format = req.query.format as string | undefined;

  const result = await pool.query(
    `SELECT id, client_name, service_address, city, state, zip,
            acres, annual_revenue, geocode_status, created_at
     FROM rpw_clients
     WHERE tenant_id = $1
       AND (address_lat IS NULL OR geocode_status = 'failed')
       AND deleted_at IS NULL
     ORDER BY client_name ASC`,
    [tenantId]
  );

  const clients = result.rows.map((r) => ({
    id: r.id,
    client_name: r.client_name,
    service_address: r.service_address,
    city: r.city,
    state: r.state,
    zip: r.zip,
    acres: Number(r.acres),
    annual_revenue: r.annual_revenue != null ? Number(r.annual_revenue) : null,
    geocode_status: r.geocode_status,
    failure_reason: r.geocode_status === 'failed' ? 'Address could not be geocoded' : 'Geocode pending',
    uploaded_at: r.created_at,
  }));

  if (format === 'csv') {
    const header = 'Client Name,Service Address,City,State,ZIP,Acres,Annual Revenue,Geocode Status,Failure Reason,Uploaded At';
    const lines = [header];
    for (const c of clients) {
      lines.push([
        escapeCsv(c.client_name),
        escapeCsv(c.service_address),
        escapeCsv(c.city),
        escapeCsv(c.state),
        escapeCsv(c.zip),
        round1(c.acres),
        c.annual_revenue != null ? c.annual_revenue.toFixed(2) : '',
        c.geocode_status,
        escapeCsv(c.failure_reason),
        c.uploaded_at ? new Date(c.uploaded_at).toISOString().slice(0, 10) : '',
      ].join(','));
    }
    const csv = lines.join('\r\n') + '\r\n';
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="failed_clients_report.csv"');
    res.send(csv);
    return;
  }

  res.json({ success: true, data: { total: clients.length, clients } });
}
