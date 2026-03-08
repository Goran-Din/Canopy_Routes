import { pool } from '../db/pool';

export interface RouteSlotSummary {
  id: string;
  route_label: string;
  zone_label: string;
  day_of_week: string;
  crew_code: string | null;
  stops: number;
  workday_hrs: number;
  capacity_status: 'green' | 'yellow' | 'red';
  max_stops: number;
}

export interface NeedsAttentionItem {
  type: 'geocode_failed' | 'unconfirmed_acres' | 'over_capacity' | 'unassigned_clients' | 'no_crew';
  severity: 'high' | 'medium' | 'low';
  label: string;
  detail: string;
  action: string;
}

export interface DashboardSummary {
  season: {
    id: string; label: string; status: string; tab: string; created_at: string;
    submitted_at: string | null; published_at: string | null; request_changes_note: string | null;
  };
  clients: {
    total: number;
    confirmed: number;
    pending: number;
    at_risk: number;
    assigned: number;
    unassigned: number;
    unconfirmed_acres: number;
    geocode_failed: number;
  };
  revenue: {
    annual_total: number;
    monthly_avg: number;
  };
  routes: {
    total: number;
    green: number;
    yellow: number;
    red: number;
    over_capacity: Array<{ id: string; route_label: string; workday_hrs: number }>;
  };
  route_slots: RouteSlotSummary[];
  needs_attention: NeedsAttentionItem[];
}

function capacityStatus(hrs: number): 'green' | 'yellow' | 'red' {
  if (hrs > 9.0) return 'red';
  if (hrs > 8.5) return 'yellow';
  return 'green';
}

export async function getDashboardSummary(tenantId: string, seasonId: string): Promise<DashboardSummary> {
  // 1. Season
  const seasonRes = await pool.query(
    `SELECT id, season_label, status, tab, created_at,
            submitted_at, published_at, request_changes_note
     FROM rpw_seasons WHERE id = $1 AND tenant_id = $2`,
    [seasonId, tenantId]
  );
  const season = seasonRes.rows[0];
  if (!season) throw new Error('Season not found');

  // 2. Client stats — clients are tenant-wide, "assigned" means has active route_stop in this season
  const clientStatsRes = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE c.client_status = 'confirmed')::int AS confirmed,
       COUNT(*) FILTER (WHERE c.client_status = 'pending')::int AS pending,
       COUNT(*) FILTER (WHERE c.client_status = 'at_risk')::int AS at_risk,
       COUNT(*) FILTER (WHERE assigned.client_id IS NOT NULL)::int AS assigned,
       COUNT(*) FILTER (WHERE assigned.client_id IS NULL)::int AS unassigned,
       COUNT(*) FILTER (WHERE c.acreage_confirmed = false)::int AS unconfirmed_acres,
       COUNT(*) FILTER (WHERE c.address_lat IS NULL)::int AS geocode_failed
     FROM rpw_clients c
     LEFT JOIN (
       SELECT DISTINCT rs.client_id
       FROM rpw_route_stops rs
       JOIN rpw_routes r ON r.id = rs.route_id
       WHERE rs.tenant_id = $1 AND r.season_id = $2
         AND r.tab = 'maintenance' AND r.is_active = true
         AND rs.deleted_at IS NULL
     ) assigned ON assigned.client_id = c.id
     WHERE c.tenant_id = $1
       AND c.client_status != 'inactive'`,
    [tenantId, seasonId]
  );
  const cs = clientStatsRes.rows[0];

  // 3. Revenue — sum annual_revenue for assigned clients
  const revenueRes = await pool.query(
    `SELECT COALESCE(SUM(c.annual_revenue), 0)::numeric AS annual_total
     FROM rpw_clients c
     JOIN rpw_route_stops rs ON rs.client_id = c.id AND rs.deleted_at IS NULL
     JOIN rpw_routes r ON r.id = rs.route_id AND r.season_id = $2 AND r.tab = 'maintenance' AND r.is_active = true
     WHERE c.tenant_id = $1`,
    [tenantId, seasonId]
  );
  const annualTotal = Number(revenueRes.rows[0].annual_total);

  // 4. Routes with stop summaries
  const routesRes = await pool.query(
    `SELECT r.id, r.route_label, r.zone_label, r.day_of_week, r.crew_id, r.max_stops,
            cr.crew_code,
            COALESCE(s.stop_count, 0)::int AS stop_count,
            COALESCE(s.total_productive_hrs, 0)::numeric AS total_productive_hrs,
            COALESCE(s.total_drive_hrs, 0)::numeric AS total_drive_hrs
     FROM rpw_routes r
     LEFT JOIN rpw_crews cr ON cr.id = r.crew_id
     LEFT JOIN (
       SELECT rs.route_id,
              COUNT(*)::int AS stop_count,
              SUM(rs.productive_time_hrs)::numeric AS total_productive_hrs,
              SUM(rs.drive_time_from_prev_hrs)::numeric AS total_drive_hrs
       FROM rpw_route_stops rs
       WHERE rs.tenant_id = $1 AND rs.deleted_at IS NULL
       GROUP BY rs.route_id
     ) s ON s.route_id = r.id
     WHERE r.tenant_id = $1 AND r.season_id = $2
       AND r.tab = 'maintenance' AND r.is_active = true
     ORDER BY r.day_of_week, r.route_label`,
    [tenantId, seasonId]
  );

  const routeSlots: RouteSlotSummary[] = [];
  const overCapacity: Array<{ id: string; route_label: string; workday_hrs: number }> = [];
  let green = 0, yellow = 0, red = 0;

  for (const r of routesRes.rows) {
    const productiveHrs = Number(r.total_productive_hrs);
    const driveHrs = Number(r.total_drive_hrs);
    const thursdayReturn = r.day_of_week === 'thursday' ? 91 / 60 : 0;
    const workdayHrs = productiveHrs + driveHrs + thursdayReturn;
    const status = capacityStatus(workdayHrs);

    if (status === 'green') green++;
    else if (status === 'yellow') yellow++;
    else red++;

    if (status === 'red') {
      overCapacity.push({ id: r.id, route_label: r.route_label, workday_hrs: Math.round(workdayHrs * 10) / 10 });
    }

    routeSlots.push({
      id: r.id,
      route_label: r.route_label,
      zone_label: r.zone_label ?? '',
      day_of_week: r.day_of_week ?? 'unscheduled',
      crew_code: r.crew_code,
      stops: r.stop_count,
      workday_hrs: Math.round(workdayHrs * 10) / 10,
      capacity_status: status,
      max_stops: Number(r.max_stops),
    });
  }

  // 5. Needs Attention
  const needsAttention: NeedsAttentionItem[] = [];

  if (cs.geocode_failed > 0) {
    needsAttention.push({
      type: 'geocode_failed',
      severity: 'high',
      label: `${cs.geocode_failed} client${cs.geocode_failed > 1 ? 's' : ''} failed geocoding`,
      detail: 'Address could not be located on the map',
      action: 'view_clients',
    });
  }

  for (const oc of overCapacity) {
    needsAttention.push({
      type: 'over_capacity',
      severity: 'high',
      label: `${oc.route_label} over capacity`,
      detail: `${oc.workday_hrs}h workday exceeds 9.0h limit`,
      action: `open_route_${oc.id}`,
    });
  }

  const noCrew = routeSlots.filter((r) => !r.crew_code);
  for (const nc of noCrew) {
    needsAttention.push({
      type: 'no_crew',
      severity: 'medium',
      label: `${nc.route_label} has no crew`,
      detail: 'Assign a crew in Settings',
      action: 'open_settings',
    });
  }

  if (cs.unassigned > 0) {
    needsAttention.push({
      type: 'unassigned_clients',
      severity: 'medium',
      label: `${cs.unassigned} unassigned client${cs.unassigned > 1 ? 's' : ''}`,
      detail: 'Clients not on any route',
      action: 'view_unassigned',
    });
  }

  if (cs.unconfirmed_acres > 0) {
    needsAttention.push({
      type: 'unconfirmed_acres',
      severity: 'low',
      label: `${cs.unconfirmed_acres} client${cs.unconfirmed_acres > 1 ? 's' : ''} with estimated acreage`,
      detail: 'Mow times may be inaccurate',
      action: 'view_clients',
    });
  }

  return {
    season: {
      id: season.id,
      label: season.season_label,
      status: season.status,
      tab: season.tab,
      created_at: season.created_at,
      submitted_at: season.submitted_at ?? null,
      published_at: season.published_at ?? null,
      request_changes_note: season.request_changes_note ?? null,
    },
    clients: {
      total: cs.total,
      confirmed: cs.confirmed,
      pending: cs.pending,
      at_risk: cs.at_risk,
      assigned: cs.assigned,
      unassigned: cs.unassigned,
      unconfirmed_acres: cs.unconfirmed_acres,
      geocode_failed: cs.geocode_failed,
    },
    revenue: {
      annual_total: annualTotal,
      monthly_avg: Math.round((annualTotal / 12) * 100) / 100,
    },
    routes: {
      total: routeSlots.length,
      green,
      yellow,
      red,
      over_capacity: overCapacity,
    },
    route_slots: routeSlots,
    needs_attention: needsAttention,
  };
}
