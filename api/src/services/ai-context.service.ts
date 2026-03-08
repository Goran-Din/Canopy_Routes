// api/src/services/ai-context.service.ts
// Builds context strings for the AI assistant from route/client data

import { pool } from '../db/pool';

export interface AiContext {
  systemPrompt: string;
  seasonSummary: string;
  routeDetails: string;
}

/**
 * Build a context snapshot for the AI assistant, scoped to a tenant + season.
 */
export async function buildAiContext(tenantId: string, seasonId: string): Promise<AiContext> {
  // 1. Season info
  const seasonRes = await pool.query(
    `SELECT id, season_label, tab, status, created_at
     FROM rpw_seasons WHERE id = $1 AND tenant_id = $2`,
    [seasonId, tenantId]
  );
  const season = seasonRes.rows[0];
  if (!season) {
    return {
      systemPrompt: buildSystemPrompt(),
      seasonSummary: 'No season found.',
      routeDetails: '',
    };
  }

  // 2. Route + stop aggregates
  const routesRes = await pool.query(
    `SELECT
       r.id,
       r.route_label,
       r.day_of_week,
       r.max_stops,
       COUNT(rs.id)::int AS stop_count,
       COALESCE(SUM(c.annual_revenue), 0)::numeric AS annual_revenue,
       COALESCE(SUM(c.lot_size_sqft), 0)::numeric AS total_sqft,
       COALESCE(SUM(rs.productive_time_hrs), 0)::numeric AS productive_hrs,
       COALESCE(SUM(rs.drive_time_from_prev_mins) / 60.0, 0)::numeric AS drive_hrs
     FROM rpw_routes r
     LEFT JOIN rpw_route_stops rs ON rs.route_id = r.id AND rs.deleted_at IS NULL
     LEFT JOIN rpw_clients c ON c.id = rs.client_id AND c.deleted_at IS NULL
     WHERE r.tenant_id = $1 AND r.season_id = $2 AND r.is_active = true
     GROUP BY r.id, r.route_label, r.day_of_week, r.max_stops
     ORDER BY r.route_label`,
    [tenantId, seasonId]
  );

  // 3. Client totals (assigned = has a stop in a route for this season)
  const clientRes = await pool.query(
    `SELECT
       COUNT(DISTINCT c.id)::int AS total,
       COUNT(DISTINCT c.id) FILTER (WHERE rs.id IS NOT NULL)::int AS assigned,
       COUNT(DISTINCT c.id) FILTER (WHERE rs.id IS NULL)::int AS unassigned,
       COALESCE(SUM(DISTINCT c.annual_revenue), 0)::numeric AS total_revenue
     FROM rpw_clients c
     LEFT JOIN rpw_route_stops rs ON rs.client_id = c.id AND rs.deleted_at IS NULL
       AND rs.route_id IN (SELECT id FROM rpw_routes WHERE season_id = $2 AND is_active = true)
     WHERE c.tenant_id = $1 AND c.deleted_at IS NULL`,
    [tenantId, seasonId]
  );
  const cl = clientRes.rows[0];

  // 4. Cost config (optional)
  const cfgRes = await pool.query(
    'SELECT labor_rate, crew_size, fuel_cost_per_mile, equipment_cost_per_hour, overhead_rate_percent FROM rpw_cost_config WHERE tenant_id = $1',
    [tenantId]
  );
  const cfg = cfgRes.rows[0];

  // Build season summary text
  const seasonSummary = [
    `Season: ${season.season_label} (${season.tab}, status: ${season.status})`,
    `Clients: ${cl.total} total, ${cl.assigned} assigned, ${cl.unassigned} unassigned`,
    `Total annual revenue: $${Math.round(parseFloat(cl.total_revenue)).toLocaleString()}`,
    `Routes: ${routesRes.rows.length}`,
    cfg ? `Cost config: $${cfg.labor_rate}/hr labor, crew size ${cfg.crew_size}, $${cfg.fuel_cost_per_mile}/mi fuel, $${cfg.equipment_cost_per_hour}/hr equipment, ${cfg.overhead_rate_percent}% overhead` : 'No cost config set.',
  ].join('\n');

  // Build per-route details
  const routeLines = routesRes.rows.map((r) => {
    const weeklyHrs = parseFloat(r.productive_hrs) + parseFloat(r.drive_hrs);
    const capPct = r.max_stops > 0 ? Math.round((r.stop_count / r.max_stops) * 100) : 0;
    return `- ${r.route_label} (${r.day_of_week}): ${r.stop_count}/${r.max_stops ?? '?'} stops (${capPct}% capacity), ${weeklyHrs.toFixed(1)}h/week, $${Math.round(parseFloat(r.annual_revenue)).toLocaleString()} revenue`;
  });
  const routeDetails = routeLines.join('\n');

  // 5. Historical data from prior season snapshots
  let historicalContext = '';
  try {
    const snapshotRes = await pool.query(
      `SELECT season_year, season_type, total_clients, total_revenue, avg_margin_percent
       FROM rpw_season_snapshots
       WHERE tenant_id = $1
       ORDER BY snapshot_at DESC
       LIMIT 3`,
      [tenantId]
    );
    if (snapshotRes.rows.length > 0) {
      const priorLines = snapshotRes.rows.map((s) =>
        `${s.season_year} ${s.season_type}: ${s.total_clients} clients, $${Math.round(parseFloat(s.total_revenue)).toLocaleString()} revenue, ${parseFloat(s.avg_margin_percent)}% avg margin`
      );
      const marginTrend = snapshotRes.rows.map((s) => `${s.season_year}: ${parseFloat(s.avg_margin_percent)}%`).join(', ');
      historicalContext = `\n\nHISTORICAL DATA (${snapshotRes.rows.length} prior season(s) on record):\n${priorLines.join('\n')}\nMargin trend: ${marginTrend}`;
    }
  } catch {
    // Historical tables may not exist yet — ignore
  }

  return {
    systemPrompt: buildSystemPrompt(),
    seasonSummary: seasonSummary + historicalContext,
    routeDetails,
  };
}

function buildSystemPrompt(): string {
  return `You are the Canopy Routes AI Assistant for Sunset Services, a landscaping company in Aurora/Naperville, IL.

Your role is to help owners and coordinators optimize their maintenance routes. You have access to real-time season data including routes, clients, revenue, costs, and capacity.

Guidelines:
- Be concise and actionable. Lead with the key insight.
- When analyzing routes, consider capacity (9-hour workday max), profitability margins, geographic clustering, and drive time efficiency.
- Use specific numbers from the data provided. Don't make up data.
- For profitability: EXCELLENT ≥45%, GOOD ≥35%, FAIR ≥25%, POOR ≥15%, CRITICAL <15%.
- A 30-week mowing season is standard for the Chicago suburbs.
- If asked about something outside your data, say so clearly.
- Keep responses under 300 words unless the user asks for detailed analysis.

When a new client address is mentioned, suggest which existing route they should join based on: (1) geographic proximity to existing stops on each route, (2) available capacity in hours (routes under 8.5h/week have room), and (3) profitability impact. Always name the specific route and explain why.

When asked about route restructuring, think about: consolidating underutilized routes, moving stops between routes to balance hours, and the financial impact of each change.

Always be specific: name exact routes, give exact numbers, and provide a clear recommended action. The owner (Erick) makes all final decisions — you advise, he acts.`;
}
