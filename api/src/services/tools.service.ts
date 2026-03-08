import * as toolsRepo from '../repositories/tools.repo';
import * as routesRepo from '../repositories/routes.repo';
import { geocodeAddress } from './geocoding.service';
import {
  suggestZone,
  calcBearing,
  calcDistanceMiles,
  getZoneDay,
  ZoneBoundary,
} from './zone.service';
import {
  calcMowTime,
  calcTrimTime,
  calcProductiveTime,
  calcDriveTime,
  getCapacityStatus,
} from './formulas.service';
import { addStopToRoute, optimizeRouteOrder } from './routes.service';
import { pool } from '../db/pool';
const DEFAULT_MOW_RATE = 2.50;
const PRODUCTIVE_MULTIPLIER = 1.40;
const DEPOT_LAT = 41.7606;
const DEPOT_LNG = -88.1381;

// ── Zone Fit ────────────────────────────────────────────────────

export interface ZoneFitResult {
  geocoded_address: string;
  zone: string;
  day: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  bearing_from_depot: number;
  distance_from_depot_mi: number;
  suggested_route: {
    id: string;
    route_label: string;
    day_of_week: string;
    current_workday_hrs: number;
    projected_workday_hrs: number;
    capacity_status: string;
    crew_code: string | null;
  };
  productive_time_addition_mins: number;
  drive_time_addition_mins: number;
  alternatives: Array<{
    zone: string;
    day: string;
    route_label: string;
    current_workday_hrs: number;
    projected_workday_hrs: number;
    capacity_status: string;
  }>;
  annual_revenue: number | null;
}

export async function zoneFit(
  tenantId: string,
  address: string,
  acres: number | undefined,
  seasonId: string,
  clientType: 'residential' | 'commercial',
  userRole: string
): Promise<ZoneFitResult> {
  const geo = await geocodeAddress(address);
  if (geo.geocodeStatus !== 'success' || geo.lat == null || geo.lng == null) {
    throw new GeocodingError('Address could not be geocoded. Please check the address and try again.');
  }

  const boundaries: ZoneBoundary[] = await toolsRepo.getZoneBoundaries(tenantId);
  const routesWithStops = await toolsRepo.getRoutesWithStopsForSeason(tenantId, seasonId);

  const depotLat = routesWithStops[0]?.route.depot_lat
    ? Number(routesWithStops[0].route.depot_lat)
    : 41.748937;
  const depotLng = routesWithStops[0]?.route.depot_lng
    ? Number(routesWithStops[0].route.depot_lng)
    : -88.267373;

  const suggestion = suggestZone(geo.lat, geo.lng, clientType, depotLat, depotLng, boundaries);

  const effectiveAcres = acres ?? 0.5;
  const mowHrs = calcMowTime(effectiveAcres, DEFAULT_MOW_RATE);
  const trimHrs = calcTrimTime(mowHrs);
  const productiveAdditionHrs = calcProductiveTime(mowHrs, trimHrs) * PRODUCTIVE_MULTIPLIER;
  const productiveAdditionMins = productiveAdditionHrs * 60;

  const matchingRoutes = routesWithStops.filter(
    (r) => r.route.zone_label === suggestion.zone && r.route.day_of_week != null
  );

  let bestRoute = matchingRoutes[0] ?? routesWithStops[0];
  let bestCurrentHrs = 0;
  let bestProjectedHrs = 0;
  let bestDriveAdditionMins = 0;
  let bestCapacity = 'orange';
  let bestCrewCode: string | null = null;

  if (bestRoute) {
    const summary = computeSummaryFromRoute(bestRoute);
    bestCurrentHrs = summary.total_workday_hrs;

    const centroid = computeCentroid(bestRoute.stops.map((s) => s.client));
    bestDriveAdditionMins = centroid
      ? calcDriveTime(centroid.lat, centroid.lng, geo.lat, geo.lng)
      : calcDriveTime(depotLat, depotLng, geo.lat, geo.lng);

    bestProjectedHrs = bestCurrentHrs + productiveAdditionHrs + bestDriveAdditionMins / 60;
    bestCapacity = getCapacityStatus(bestProjectedHrs);

    if (bestRoute.route.crew_id) {
      const crew = await routesRepo.getCrewById(tenantId, bestRoute.route.crew_id);
      bestCrewCode = crew?.crew_code ?? null;
    }
  }

  const alternatives = await buildAlternatives(
    suggestion.alternatives,
    routesWithStops,
    productiveAdditionHrs,
    geo.lat,
    geo.lng,
    depotLat,
    depotLng
  );

  const estimatedRevenue = userRole === 'salesperson' ? null : estimateRevenue(effectiveAcres);

  return {
    geocoded_address: geo.formattedAddress ?? address,
    zone: suggestion.zone,
    day: suggestion.day,
    confidence: suggestion.confidence,
    bearing_from_depot: calcBearing(geo.lat, geo.lng, depotLat, depotLng),
    distance_from_depot_mi: calcDistanceMiles(geo.lat, geo.lng, depotLat, depotLng),
    suggested_route: {
      id: bestRoute?.route.id ?? '',
      route_label: bestRoute?.route.route_label ?? '',
      day_of_week: bestRoute?.route.day_of_week ?? '',
      current_workday_hrs: Math.round(bestCurrentHrs * 100) / 100,
      projected_workday_hrs: Math.round(bestProjectedHrs * 100) / 100,
      capacity_status: bestCapacity,
      crew_code: bestCrewCode,
    },
    productive_time_addition_mins: Math.round(productiveAdditionMins * 10) / 10,
    drive_time_addition_mins: Math.round(bestDriveAdditionMins * 10) / 10,
    alternatives,
    annual_revenue: estimatedRevenue,
  };
}

// ── Removal Impact ──────────────────────────────────────────────

export interface RemovalImpactResult {
  before: {
    total_workday_hrs: number;
    capacity_status: string;
    stop_count: number;
    annual_revenue: number;
    total_drive_hrs: number;
  };
  after: {
    total_workday_hrs: number;
    capacity_status: string;
    stop_count: number;
    annual_revenue: number;
    total_drive_hrs: number;
  };
  revenue_delta: number;
  drive_time_saved_mins: number;
}

export async function removalImpact(
  tenantId: string,
  clientId: string,
  routeStopId: string
): Promise<RemovalImpactResult> {
  const stopData = await toolsRepo.getClientWithStop(tenantId, clientId, routeStopId);
  if (!stopData) throw new Error('Stop not found');

  const routeId = stopData.route_id;
  const allStops = await routesRepo.getStopsByRouteId(tenantId, routeId);
  const route = await routesRepo.getRouteById(tenantId, routeId);
  if (!route) throw new Error('Route not found');

  const depotLat = Number(route.depot_lat);
  const depotLng = Number(route.depot_lng);

  // BEFORE
  const beforeSummary = computeSummaryDirect(allStops, depotLat, depotLng);
  const beforeRevenue = allStops.reduce((sum, s) => sum + (Number(s.annual_revenue ?? 0) || 0), 0);

  // AFTER — exclude the removed stop, recalculate drive times
  const afterStops = allStops.filter((s) => s.id !== routeStopId);
  const afterSummary = computeSummaryDirect(afterStops, depotLat, depotLng);
  const afterRevenue = afterStops.reduce((sum, s) => sum + (Number(s.annual_revenue ?? 0) || 0), 0);

  return {
    before: {
      total_workday_hrs: round2(beforeSummary.totalWorkdayHrs),
      capacity_status: getCapacityStatus(beforeSummary.totalWorkdayHrs),
      stop_count: allStops.length,
      annual_revenue: round2(beforeRevenue),
      total_drive_hrs: round2(beforeSummary.totalDriveHrs),
    },
    after: {
      total_workday_hrs: round2(afterSummary.totalWorkdayHrs),
      capacity_status: getCapacityStatus(afterSummary.totalWorkdayHrs),
      stop_count: afterStops.length,
      annual_revenue: round2(afterRevenue),
      total_drive_hrs: round2(afterSummary.totalDriveHrs),
    },
    revenue_delta: round2(afterRevenue - beforeRevenue),
    drive_time_saved_mins: round2((beforeSummary.totalDriveHrs - afterSummary.totalDriveHrs) * 60),
  };
}

// ── Route F Status ──────────────────────────────────────────────

export interface RouteFStatusResult {
  stop_count: number;
  total_acres: number;
  status: 'safe' | 'approaching' | 'warning' | 'critical';
  threshold_stops: number;
  threshold_acres: number;
}

export async function getRouteFStatus(
  tenantId: string,
  seasonId: string
): Promise<RouteFStatusResult> {
  const data = await toolsRepo.getRouteFStatus(tenantId, seasonId);
  const stopCount = data.stop_count;
  const totalAcres = Number(data.total_acres);

  let status: RouteFStatusResult['status'];
  if (stopCount >= 62) status = 'critical';
  else if (stopCount >= 58) status = 'warning';
  else if (stopCount >= 55 || totalAcres >= 52) status = 'approaching';
  else status = 'safe';

  return {
    stop_count: stopCount,
    total_acres: Math.round(totalAcres * 100) / 100,
    status,
    threshold_stops: 62,
    threshold_acres: 56,
  };
}

// ── Suggest All Routes ──────────────────────────────────────────

export interface SuggestAllRoutesResult {
  total_clients: number;
  assigned: number;
  unassignable: number;
  suggestions: Array<{
    client_id: string;
    client_name: string;
    suggested_route_id: string;
    suggested_route_label: string;
    zone: string;
    day: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  route_summary: Array<{
    route_id: string;
    route_label: string;
    day_of_week: string;
    current_stops: number;
    suggested_additions: number;
    projected_stops: number;
    projected_hours: number;
    capacity_status: string;
    max_stops: number;
  }>;
  unassignable_clients: Array<{ id: string; client_name: string }>;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;

function getDaysAtOffset(preferredDay: string, offset: number): string[] {
  const idx = DAYS.indexOf(preferredDay.toLowerCase() as any);
  if (idx === -1) return [];
  if (offset === 0) return [preferredDay.toLowerCase()];
  const results: string[] = [];
  if (idx - offset >= 0) results.push(DAYS[idx - offset]);
  if (idx + offset <= 4) results.push(DAYS[idx + offset]);
  return results;
}

export async function suggestAllRoutes(
  tenantId: string,
  seasonId: string
): Promise<SuggestAllRoutesResult> {
  const [unassigned, boundaries, routes] = await Promise.all([
    toolsRepo.getUnassignedClientsWithCoords(tenantId, seasonId),
    toolsRepo.getZoneBoundaries(tenantId),
    toolsRepo.getRoutesWithSettingsForSeason(tenantId, seasonId),
  ]);

  // Build route capacity tracker
  const routeLoad: Record<string, {
    stops: number;
    hours: number;
    max_stops: number;
    target_hours: number;
    route: any;
  }> = {};

  for (const r of routes) {
    routeLoad[r.id] = {
      stops: 0,
      hours: 1.517, // depot return baseline (91 min / 60)
      max_stops: Number(r.max_stops) || 35,
      target_hours: Number(r.target_hours) || 7.50,
      route: r,
    };
  }

  // For each client, calculate zone suggestion and mow time
  const clientsWithData: Array<{
    id: string;
    client_name: string;
    client_type: string;
    zone: string;
    day: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    mowTimeHrs: number;
    distanceMi: number;
  }> = [];

  for (const client of unassigned) {
    const lat = Number(client.address_lat);
    const lng = Number(client.address_lng);
    if (!lat || !lng) continue;

    const clientType = client.client_type === 'commercial' ? 'commercial' : 'residential';

    try {
      const suggestion = suggestZone(lat, lng, clientType as any, DEPOT_LAT, DEPOT_LNG, boundaries);
      const acres = Number(client.acres) || 0.20;
      const mowTimeHrs = (acres / DEFAULT_MOW_RATE) * PRODUCTIVE_MULTIPLIER;

      clientsWithData.push({
        id: client.id,
        client_name: client.client_name,
        client_type: clientType,
        zone: suggestion.zone,
        day: suggestion.day,
        confidence: suggestion.confidence,
        mowTimeHrs,
        distanceMi: calcDistanceMiles(lat, lng, DEPOT_LAT, DEPOT_LNG),
      });
    } catch {
      // Skip clients where zone suggestion fails
    }
  }

  // Sort by distance from depot (closer first for tighter packing)
  clientsWithData.sort((a, b) => a.distanceMi - b.distanceMi);

  // Assign each client using capacity-first logic
  const suggestions: SuggestAllRoutesResult['suggestions'] = [];
  const unassignableClients: Array<{ id: string; client_name: string }> = [];

  const zoneDayMap: Record<string, string> = {
    A: 'monday', B: 'tuesday', C: 'wednesday', D: 'thursday', E: 'friday',
  };

  for (const client of clientsWithData) {
    const preferredDay = zoneDayMap[client.zone] ?? 'monday';
    let assigned = false;

    for (let dayOffset = 0; dayOffset <= 4 && !assigned; dayOffset++) {
      const tryDays = getDaysAtOffset(preferredDay, dayOffset);

      for (const tryDay of tryDays) {
        // Get routes for this day, sorted by current load (least loaded first)
        const dayRoutes = routes
          .filter((r: any) => r.day_of_week?.toLowerCase() === tryDay)
          .sort((a: any, b: any) => routeLoad[a.id].stops - routeLoad[b.id].stops);

        for (const route of dayRoutes) {
          const load = routeLoad[route.id];

          // Check crew type compatibility
          const crewType = route.crew_type || 'mixed';
          if (crewType === 'commercial_only' && client.client_type !== 'commercial') continue;
          if (crewType === 'residential_only' && client.client_type !== 'residential') continue;

          // Check capacity: both stop count AND hours
          const projectedHours = load.hours + client.mowTimeHrs + 0.067; // +4 min avg drive
          const withinStopCap = load.stops < load.max_stops;
          const withinHourCap = projectedHours <= 9.0;

          if (withinStopCap && withinHourCap) {
            suggestions.push({
              client_id: client.id,
              client_name: client.client_name,
              suggested_route_id: route.id,
              suggested_route_label: route.route_label,
              zone: client.zone,
              day: tryDay,
              confidence: dayOffset === 0 ? client.confidence : 'MEDIUM',
            });
            load.stops++;
            load.hours = projectedHours;
            assigned = true;
            break;
          }
        }
        if (assigned) break;
      }
    }

    if (!assigned) {
      unassignableClients.push({ id: client.id, client_name: client.client_name });
    }
  }

  // Build route summary with projected hours
  const route_summary: SuggestAllRoutesResult['route_summary'] = [];
  for (const r of routes) {
    const load = routeLoad[r.id];
    const projHours = load.hours;
    const status = projHours > 9.0 ? 'red' : projHours > 8.5 ? 'yellow' : 'green';
    route_summary.push({
      route_id: r.id,
      route_label: r.route_label,
      day_of_week: r.day_of_week,
      current_stops: Number(r.current_stops) || 0,
      suggested_additions: load.stops,
      projected_stops: (Number(r.current_stops) || 0) + load.stops,
      projected_hours: Math.round(projHours * 10) / 10,
      capacity_status: status,
      max_stops: load.max_stops,
    });
  }

  return {
    total_clients: clientsWithData.length,
    assigned: suggestions.length,
    unassignable: unassignableClients.length,
    suggestions,
    route_summary,
    unassignable_clients: unassignableClients,
  };
}

// ── Apply Suggestions ───────────────────────────────────────────

export async function applySuggestions(
  tenantId: string,
  assignments: Array<{ client_id: string; route_id: string }>
): Promise<{ assigned: number; errors: number }> {
  let assigned = 0;
  let errors = 0;

  // Track which routes received new stops
  const affectedRouteIds = new Set<string>();

  for (const a of assignments) {
    try {
      await addStopToRoute(tenantId, a.route_id, a.client_id);
      affectedRouteIds.add(a.route_id);
      assigned++;
    } catch {
      errors++;
    }
  }

  // Optimize stop order for all affected routes (nearest-neighbor)
  for (const routeId of affectedRouteIds) {
    try {
      await optimizeRouteOrder(tenantId, routeId);
    } catch {
      // Non-fatal — stops are assigned, just not optimally ordered
    }
  }

  return { assigned, errors };
}

// ── Optimize All Routes ─────────────────────────────────────────

export async function optimizeAllRoutes(
  tenantId: string,
  seasonId: string
): Promise<{ optimized: number }> {
  const routes = await toolsRepo.getRoutesWithSettingsForSeason(tenantId, seasonId);
  let optimized = 0;

  for (const r of routes) {
    try {
      await optimizeRouteOrder(tenantId, r.id);
      optimized++;
    } catch {
      // skip routes that fail
    }
  }

  return { optimized };
}

// ── Helpers ─────────────────────────────────────────────────────

export class GeocodingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeocodingError';
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeCentroid(clients: Array<{ address_lat: any; address_lng: any }>): { lat: number; lng: number } | null {
  const geocoded = clients.filter((c) => c.address_lat != null && c.address_lng != null);
  if (geocoded.length === 0) return null;
  const lat = geocoded.reduce((sum, c) => sum + Number(c.address_lat), 0) / geocoded.length;
  const lng = geocoded.reduce((sum, c) => sum + Number(c.address_lng), 0) / geocoded.length;
  return { lat, lng };
}

function computeSummaryFromRoute(r: { route: any; stops: Array<{ stop: any; client: any }> }) {
  const depotLat = Number(r.route.depot_lat);
  const depotLng = Number(r.route.depot_lng);
  let totalProductiveHrs = 0;
  let totalDriveMins = 0;

  for (const { stop } of r.stops) {
    const weight = stop.service_frequency === 'biweekly' ? 0.5 : 1;
    totalProductiveHrs += Number(stop.productive_time_hrs) * weight;
    totalDriveMins += Number(stop.drive_time_from_prev_mins);
  }

  if (r.stops.length > 0) {
    const last = r.stops[r.stops.length - 1].client;
    totalDriveMins += calcDriveTime(Number(last.address_lat), Number(last.address_lng), depotLat, depotLng);
  }

  const totalDriveHrs = totalDriveMins / 60;
  return { total_workday_hrs: totalProductiveHrs + totalDriveHrs, totalDriveHrs };
}

function computeSummaryDirect(
  stops: any[],
  depotLat: number,
  depotLng: number
): { totalWorkdayHrs: number; totalDriveHrs: number } {
  if (stops.length === 0) return { totalWorkdayHrs: 0, totalDriveHrs: 0 };

  let totalProductiveHrs = 0;
  let totalDriveMins = 0;

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const weight = stop.service_frequency === 'biweekly' ? 0.5 : 1;
    totalProductiveHrs += Number(stop.productive_time_hrs) * weight;

    const prevLat = i === 0 ? depotLat : Number(stops[i - 1].address_lat);
    const prevLng = i === 0 ? depotLng : Number(stops[i - 1].address_lng);
    totalDriveMins += calcDriveTime(prevLat, prevLng, Number(stop.address_lat), Number(stop.address_lng));
  }

  const lastStop = stops[stops.length - 1];
  totalDriveMins += calcDriveTime(Number(lastStop.address_lat), Number(lastStop.address_lng), depotLat, depotLng);

  const totalDriveHrs = totalDriveMins / 60;
  return { totalWorkdayHrs: totalProductiveHrs + totalDriveHrs, totalDriveHrs };
}

function estimateRevenue(acres: number): number {
  return Math.round(acres * 50 * 21);
}

async function buildAlternatives(
  zoneAlts: Array<{ zone: string; day: string }>,
  routesWithStops: Array<{ route: any; stops: Array<{ stop: any; client: any }> }>,
  productiveAdditionHrs: number,
  clientLat: number,
  clientLng: number,
  depotLat: number,
  depotLng: number
) {
  const result: ZoneFitResult['alternatives'] = [];

  for (const alt of zoneAlts.slice(0, 2)) {
    const matchingRoute = routesWithStops.find(
      (r) => r.route.zone_label === alt.zone && r.route.day_of_week != null
    );
    if (!matchingRoute) {
      result.push({
        zone: alt.zone,
        day: alt.day,
        route_label: '',
        current_workday_hrs: 0,
        projected_workday_hrs: productiveAdditionHrs,
        capacity_status: getCapacityStatus(productiveAdditionHrs),
      });
      continue;
    }

    const summary = computeSummaryFromRoute(matchingRoute);
    const centroid = computeCentroid(matchingRoute.stops.map((s) => s.client));
    const driveMins = centroid
      ? calcDriveTime(centroid.lat, centroid.lng, clientLat, clientLng)
      : calcDriveTime(depotLat, depotLng, clientLat, clientLng);
    const projected = summary.total_workday_hrs + productiveAdditionHrs + driveMins / 60;

    result.push({
      zone: alt.zone,
      day: getZoneDay(alt.zone),
      route_label: matchingRoute.route.route_label,
      current_workday_hrs: round2(summary.total_workday_hrs),
      projected_workday_hrs: round2(projected),
      capacity_status: getCapacityStatus(projected),
    });
  }

  return result;
}
