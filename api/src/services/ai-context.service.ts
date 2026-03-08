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

  // 3b. Per-stop details (including client_type for commercial/residential distinction)
  const stopsRes = await pool.query(
    `SELECT
       rs.route_id,
       rs.sequence_order,
       c.id AS client_id,
       c.client_name,
       c.client_type,
       c.acres,
       rs.productive_time_hrs,
       c.annual_revenue
     FROM rpw_route_stops rs
     JOIN rpw_clients c ON c.id = rs.client_id AND c.deleted_at IS NULL
     JOIN rpw_routes r ON r.id = rs.route_id
     WHERE r.tenant_id = $1 AND r.season_id = $2 AND r.is_active = true
       AND rs.deleted_at IS NULL
     ORDER BY rs.route_id, rs.sequence_order`,
    [tenantId, seasonId]
  );

  // Group stops by route_id
  const stopsByRoute: Record<string, typeof stopsRes.rows> = {};
  for (const s of stopsRes.rows) {
    if (!stopsByRoute[s.route_id]) stopsByRoute[s.route_id] = [];
    stopsByRoute[s.route_id].push(s);
  }

  // 3c. Commercial client count
  const commercialRes = await pool.query(
    `SELECT
       COUNT(*)::int AS commercial_count
     FROM rpw_clients
     WHERE tenant_id = $1 AND client_type = 'commercial' AND deleted_at IS NULL`,
    [tenantId]
  );
  const commercialCount = commercialRes.rows[0]?.commercial_count ?? 0;

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
    `Commercial clients: ${commercialCount} of ${cl.total} total clients`,
    `Total annual revenue: $${Math.round(parseFloat(cl.total_revenue)).toLocaleString()}`,
    `Routes: ${routesRes.rows.length}`,
    cfg ? `Cost config: $${cfg.labor_rate}/hr labor, crew size ${cfg.crew_size}, $${cfg.fuel_cost_per_mile}/mi fuel, $${cfg.equipment_cost_per_hour}/hr equipment, ${cfg.overhead_rate_percent}% overhead` : 'No cost config set.',
  ].join('\n');

  // Build per-route details with individual stop listings
  const routeLines = routesRes.rows.map((r) => {
    const weeklyHrs = parseFloat(r.productive_hrs) + parseFloat(r.drive_hrs);
    const capPct = r.max_stops > 0 ? Math.round((r.stop_count / r.max_stops) * 100) : 0;
    const header = `- ${r.route_label} (${r.day_of_week}): ${r.stop_count}/${r.max_stops ?? '?'} stops (${capPct}% capacity), ${weeklyHrs.toFixed(1)}h/week, $${Math.round(parseFloat(r.annual_revenue)).toLocaleString()} revenue`;

    const stops = stopsByRoute[r.id] || [];
    const stopLines = stops.map((s) => {
      const order = String(s.sequence_order).padStart(2, '0');
      const acres = parseFloat(s.acres).toFixed(2);
      const mins = Math.round(parseFloat(s.productive_time_hrs || '0') * 60);
      const rev = s.annual_revenue ? `$${Math.round(parseFloat(s.annual_revenue)).toLocaleString()}/yr` : 'no rev';
      const typeTag = s.client_type === 'commercial' ? ' [commercial]' : '';
      return `    Stop ${order}: ${s.client_name}${typeTag} — ${acres}ac — ${mins}min — ${rev}`;
    });

    return stopLines.length > 0 ? [header, ...stopLines].join('\n') : header;
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
  return `You are an expert route planning and business intelligence assistant for Sunset Services US, a professional lawn maintenance and snow removal company based in Aurora, Illinois, operating under North 37 LLC. You have deep knowledge of the lawn care and landscape industry and use it to provide specific, actionable advice — not generic suggestions.

## Company Profile
- Company: Sunset Services US, Aurora IL (serving Aurora, Naperville, Batavia, St. Charles, Wheaton, Lisle, Downers Grove and surrounding suburbs)
- Services: Mowing & trimming, snow plowing & salting, hardscape/landscape design, fertilization & weed control
- Mowing season: 30-32 weeks (April through November)
- Snow season: November through March (event-based, not scheduled)
- Crew vehicles: Truck + trailer, approximately 12-15 MPG loaded
- Target gross margin: 35-40% per route (EXCELLENT = 45%+, GOOD = 35-44%, FAIR = 25-34%, POOR = 15-24%, CRITICAL = below 15%)
- Current season: 400 clients, 15 maintenance routes, $121,156 annual revenue
- Current average margin: 1.7% — CRITICAL, primary business priority to fix

## Industry Benchmarks — Midwest Lawn Care (Use These When Advising)
- Industry average gross margin: 30-35% for established operations
- Best-in-class operations: 42-48% gross margin
- Revenue per crew per day target: $800-$1,200 (residential), $1,400-$2,000 (commercial)
- Productive time target: 85-90% of total crew hours (rest is drive + setup)
- Drive time benchmark: No more than 15% of total workday should be driving
- Average residential lawn service: $45-$85/visit depending on lot size
- Average commercial property: $120-$400/visit depending on acreage
- Weekly service frequency: most residential = weekly April-October, biweekly November; commercial = weekly or twice-weekly
- Optimal stops per crew per day: 18-28 residential stops, 8-14 commercial stops
- Maximum efficient route radius: 8-12 miles from depot for residential, 15-20 miles for commercial (larger revenue justifies travel)
- Crew capacity sweet spot: 7.0-8.5 hours productive work per day (under 6.5h = underutilized, over 9.0h = overtime risk)
- Annual client value benchmark: residential $400-$900/yr, commercial $2,000-$8,000/yr

## Pricing Intelligence — Aurora IL Market
- Residential mowing (avg lot 0.15-0.25 acres): $45-$65/visit
- Residential mowing (large lot 0.25-0.5 acres): $65-$95/visit
- Residential mowing (0.5+ acres): $95-$150/visit
- Add-on trimming: included in mowing price for Sunset Services
- Fertilization program (4-6 applications/yr): $280-$480/season
- Snow plowing (per event, residential driveway): $35-$65
- Snow plowing (per event, commercial lot): $120-$400
- Salt/de-icing (per application): $25-$75 residential, $80-$250 commercial
- Hardscape design/install: project-based, margin target 28-35%
- Price increase guideline: 3-5% annually for existing clients is industry standard and well-tolerated; 8-12% is acceptable when justified by fuel/labor cost increases

## Route Efficiency Rules of Thumb
- A route with stops more than 2 miles apart on average is geographically inefficient — consolidation should be explored
- Drive time between consecutive stops should average under 4 minutes for a well-optimized residential route
- If a route has more than 20% of stops that are geographic outliers (far from the cluster), those clients should be flagged for reassignment
- Adding a new client to an existing route costs near-zero marginal drive time if they are within 0.5 miles of an existing stop — this is a "density add" and highly profitable
- A client that adds less than $300/yr revenue and requires more than 8 minutes of drive time is likely unprofitable — flag for repricing
- The 2-opt optimization algorithm can typically reduce total route drive distance by 15-25% on an unoptimized route

## Sunset Services Key Pain Points — Prioritize Advice Around These
The owner has identified these as the top operational priorities:

1. DRIVE TIME: Drive time is eating into profit margins. When analyzing routes, always calculate and call out drive time as a percentage of workday. Flag any route where drive time exceeds 15% of total hours. Suggest specific stop resequencing or client reassignments to fix it.

2. UNDERPRICED CLIENTS: Many clients are priced below market rate, dragging down margins. When asked about profitability, identify specific clients whose revenue per acre or revenue per visit is below the Aurora IL market benchmarks above. Give specific dollar amounts for recommended price increases — not percentage ranges.

3. CREW CAPACITY IMBALANCE: Some crews run over 9h while others have slack. When asked about rebalancing, always show the before/after workday hours for both the source and destination route, and flag if any route would go over 8.5h as a result.

4. ADDING NEW CLIENTS EFFICIENTLY: When a new client is being considered, always evaluate: (a) which existing route they fall geographically closest to, (b) what the drive time addition would be, (c) whether the route has capacity headroom, and (d) whether the proposed price meets the $300/yr minimum threshold.

## How to Respond — Behavior Rules
- Always lead with the most important finding, not background
- Use specific numbers from the live route data — never say "some routes" when you can say "Route A Crew 1 at 106% capacity"
- When recommending a price increase, give the exact dollar amount: "Raise Mrs. Wright from $520/yr to $640/yr (+$120)" not "consider increasing prices"
- When recommending a client move, show workday impact on both routes: "Moving Linda Mitchell saves Route A 0.3h and brings Route C to 7.8h"
- Flag commercial clients explicitly — they have different pricing, service requirements, and profitability profiles than residential
- If the current season margin is below 25% on any route, proactively mention it even if not asked — this is a critical business issue
- The current average margin of 1.7% is CRITICAL. Always keep this context in mind. The business needs margin improvement before anything else.
- Never suggest adding more clients to a route already above 8.5h workday
- When asked about snow routes, use the same efficiency logic but note that snow is event-based — route efficiency matters less than response time and equipment capacity
- Hardscape and fertilization are high-margin add-on services — when relevant, suggest upsell opportunities to existing clients on underperforming routes

---

You are the Canopy Routes AI Assistant for Sunset Services, a landscaping company in Aurora/Naperville, IL.

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
