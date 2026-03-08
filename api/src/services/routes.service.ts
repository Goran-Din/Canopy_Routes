// api/src/services/routes.service.ts
// Business logic for route builder — calls repositories and formulas
// Last modified: 2026-03-05

import * as routesRepo from '../repositories/routes.repo';
import {
  calcMowTime,
  calcTrimTime,
  calcProductiveTime,
  calcDriveTime,
  calcRouteTotalDistance,
  getCapacityStatus,
  twoOptImprove,
  CapacityStatus,
} from './formulas.service';

export class ConflictError extends Error {
  public statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export interface StopTimes {
  mow_time_hrs: number;
  trim_time_hrs: number;
  productive_time_hrs: number;
  drive_time_from_prev_mins: number;
  biweekly_capacity_weight: number;
  effective_mow_rate: number;
  is_first_stop: boolean;
}

export interface RouteSummary {
  total_productive_hrs: number;
  total_drive_hrs: number;
  total_workday_hrs: number;
  capacity_status: CapacityStatus;
  stop_count: number;
  total_acres: number;
}

export interface RouteWithSummary {
  route: any;
  stops: any[];
  summary: RouteSummary;
}

export function calculateStopTimes(
  client: { acres: number | string; address_lat: number | string; address_lng: number | string; service_frequency: string },
  prevLat: number,
  prevLng: number,
  mowRate: number,
  isFirstStop: boolean
): StopTimes {
  const acres = Number(client.acres);
  const mowHrs = calcMowTime(acres, mowRate);
  const trimHrs = calcTrimTime(mowHrs);
  const productiveHrs = calcProductiveTime(mowHrs, trimHrs);
  const driveMins = calcDriveTime(prevLat, prevLng, Number(client.address_lat), Number(client.address_lng));

  return {
    mow_time_hrs: mowHrs,
    trim_time_hrs: trimHrs,
    productive_time_hrs: productiveHrs,
    drive_time_from_prev_mins: driveMins,
    biweekly_capacity_weight: client.service_frequency === 'biweekly' ? 0.50 : 1.00,
    effective_mow_rate: mowRate,
    is_first_stop: isFirstStop,
  };
}

function computeSummary(route: any, stops: any[]): RouteSummary {
  if (stops.length === 0) {
    return {
      total_productive_hrs: 0,
      total_drive_hrs: 0,
      total_workday_hrs: 0,
      capacity_status: 'orange',
      stop_count: 0,
      total_acres: 0,
    };
  }

  let totalProductiveHrs = 0;
  let totalDriveMins = 0;
  let totalAcres = 0;

  for (const stop of stops) {
    const weight = stop.service_frequency === 'biweekly' ? 0.50 : 1.00;
    totalProductiveHrs += Number(stop.productive_time_hrs) * weight;
    totalDriveMins += Number(stop.drive_time_from_prev_mins);
    totalAcres += Number(stop.acres);
  }

  const lastStop = stops[stops.length - 1];
  const depotReturnMins = calcDriveTime(
    Number(lastStop.address_lat),
    Number(lastStop.address_lng),
    Number(route.depot_lat),
    Number(route.depot_lng)
  );

  const totalDriveHrs = (totalDriveMins + depotReturnMins) / 60;
  const totalWorkdayHrs = totalProductiveHrs + totalDriveHrs;

  return {
    total_productive_hrs: totalProductiveHrs,
    total_drive_hrs: totalDriveHrs,
    total_workday_hrs: totalWorkdayHrs,
    capacity_status: getCapacityStatus(totalWorkdayHrs),
    stop_count: stops.length,
    total_acres: totalAcres,
  };
}

function getMowRate(route: any, crew: any | null): number {
  if (route.mow_rate_override) return Number(route.mow_rate_override);
  if (crew) return Number(crew.mow_rate_ac_hr);
  return 2.50;
}

export async function getRouteWithSummary(tenantId: string, routeId: string): Promise<RouteWithSummary | null> {
  const route = await routesRepo.getRouteById(tenantId, routeId);
  if (!route) return null;

  const stops = await routesRepo.getStopsByRouteId(tenantId, routeId);
  const summary = computeSummary(route, stops);

  return { route, stops, summary };
}

export async function getRoutesBySeasonWithSummary(tenantId: string, seasonId: string): Promise<RouteWithSummary[]> {
  const routes = await routesRepo.getRoutesBySeasonId(tenantId, seasonId);
  const results: RouteWithSummary[] = [];

  for (const route of routes) {
    const stops = await routesRepo.getStopsByRouteId(tenantId, route.id);
    const summary = computeSummary(route, stops);
    results.push({ route, stops, summary });
  }

  return results;
}

export async function assignCrewToRoute(tenantId: string, routeId: string, crewId: string): Promise<RouteWithSummary> {
  const route = await routesRepo.getRouteById(tenantId, routeId);
  if (!route) throw new Error('Route not found');

  const conflicts = await routesRepo.getRoutesByCrewAndDay(
    tenantId,
    route.season_id,
    crewId,
    route.day_of_week,
    routeId
  );

  if (conflicts.length > 0) {
    const crew = await routesRepo.getCrewById(tenantId, crewId);
    const crewCode = crew?.crew_code || crewId;
    throw new ConflictError(
      `${crewCode} is already assigned to ${conflicts[0].route_label} on ${route.day_of_week}. Choose a different crew.`
    );
  }

  await routesRepo.updateRoute(tenantId, routeId, { crew_id: crewId });

  const crew = await routesRepo.getCrewById(tenantId, crewId);
  const mowRate = getMowRate(route, crew);

  const stops = await routesRepo.getStopsByRouteId(tenantId, routeId);
  for (const stop of stops) {
    const mowHrs = calcMowTime(Number(stop.acres), mowRate);
    const trimHrs = calcTrimTime(mowHrs);
    const productiveHrs = calcProductiveTime(mowHrs, trimHrs);
    await routesRepo.updateStop(tenantId, stop.id, {
      mow_time_hrs: mowHrs,
      trim_time_hrs: trimHrs,
      productive_time_hrs: productiveHrs,
      mow_rate_override: mowRate,
    });
  }

  return (await getRouteWithSummary(tenantId, routeId))!;
}

export async function addStopToRoute(tenantId: string, routeId: string, clientId: string): Promise<RouteWithSummary> {
  const route = await routesRepo.getRouteById(tenantId, routeId);
  if (!route) throw new Error('Route not found');

  const alreadyAssigned = await routesRepo.isClientAlreadyOnRoute(tenantId, route.season_id, clientId);
  if (alreadyAssigned) {
    throw new ConflictError('Client is already assigned to a route in this season.');
  }

  const client = await routesRepo.getClientById(tenantId, clientId);
  if (!client) throw new Error('Client not found');

  let crew = null;
  if (route.crew_id) {
    crew = await routesRepo.getCrewById(tenantId, route.crew_id);
  }
  const mowRate = getMowRate(route, crew);

  const maxSeq = await routesRepo.getMaxSequenceOrder(tenantId, routeId);
  const newSeq = maxSeq + 1;
  const isFirstStop = maxSeq === 0;

  let prevLat: number;
  let prevLng: number;
  if (isFirstStop) {
    prevLat = Number(route.depot_lat);
    prevLng = Number(route.depot_lng);
  } else {
    const lastStop = await routesRepo.getStopByPosition(tenantId, routeId, maxSeq);
    prevLat = Number(lastStop.address_lat);
    prevLng = Number(lastStop.address_lng);
  }

  const times = calculateStopTimes(client, prevLat, prevLng, mowRate, isFirstStop);

  await routesRepo.createStop(tenantId, {
    route_id: routeId,
    client_id: clientId,
    sequence_order: newSeq,
    mow_time_hrs: times.mow_time_hrs,
    trim_time_hrs: times.trim_time_hrs,
    productive_time_hrs: times.productive_time_hrs,
    drive_time_from_prev_mins: times.drive_time_from_prev_mins,
    mow_rate_override: times.effective_mow_rate,
  });

  return (await getRouteWithSummary(tenantId, routeId))!;
}

export async function removeStop(tenantId: string, stopId: string): Promise<RouteWithSummary> {
  const stop = await routesRepo.getStopById(tenantId, stopId);
  if (!stop) throw new Error('Stop not found');

  const routeId = stop.route_id;
  const wasFirstStop = stop.sequence_order === 1;

  await routesRepo.softDeleteStop(tenantId, stopId);

  if (wasFirstStop) {
    const remainingStops = await routesRepo.getStopsByRouteId(tenantId, routeId);
    if (remainingStops.length > 0) {
      const route = await routesRepo.getRouteById(tenantId, routeId);
      const newFirst = remainingStops[0];
      const driveFromDepot = calcDriveTime(
        Number(route.depot_lat),
        Number(route.depot_lng),
        Number(newFirst.address_lat),
        Number(newFirst.address_lng)
      );
      await routesRepo.updateStop(tenantId, newFirst.id, {
        drive_time_from_prev_mins: driveFromDepot,
      });
    }
  }

  return (await getRouteWithSummary(tenantId, routeId))!;
}

export async function optimizeRouteOrder(tenantId: string, routeId: string): Promise<RouteWithSummary> {
  const route = await routesRepo.getRouteById(tenantId, routeId);
  if (!route) throw new Error('Route not found');

  const stops = await routesRepo.getStopsByRouteId(tenantId, routeId);
  if (stops.length <= 1) return (await getRouteWithSummary(tenantId, routeId))!;

  // Nearest-neighbor greedy sort starting from depot
  const depotLat = Number(route.depot_lat);
  const depotLng = Number(route.depot_lng);

  const remaining = [...stops];
  const ordered: typeof stops = [];
  let curLat = depotLat;
  let curLng = depotLng;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const d = calcDriveTime(curLat, curLng, Number(remaining[i].address_lat), Number(remaining[i].address_lng));
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push(next);
    curLat = Number(next.address_lat);
    curLng = Number(next.address_lng);
  }

  // 2-opt improvement pass on the nearest-neighbor result
  const depot = { lat: depotLat, lng: depotLng };
  const stopsWithCoords = ordered.map((s) => ({
    ...s,
    lat: Number(s.address_lat),
    lng: Number(s.address_lng),
  }));
  const optimized = twoOptImprove(stopsWithCoords, depot);

  const orderedIds = optimized.map((s) => s.id);
  return reorderStops(tenantId, routeId, orderedIds);
}

export async function reorderStops(
  tenantId: string,
  routeId: string,
  orderedStopIds: string[]
): Promise<RouteWithSummary> {
  await routesRepo.reorderStops(tenantId, routeId, orderedStopIds);

  const route = await routesRepo.getRouteById(tenantId, routeId);
  if (!route) throw new Error('Route not found');

  const stops = await routesRepo.getStopsByRouteId(tenantId, routeId);

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    let prevLat: number;
    let prevLng: number;

    if (i === 0) {
      prevLat = Number(route.depot_lat);
      prevLng = Number(route.depot_lng);
    } else {
      prevLat = Number(stops[i - 1].address_lat);
      prevLng = Number(stops[i - 1].address_lng);
    }

    const driveMins = calcDriveTime(prevLat, prevLng, Number(stop.address_lat), Number(stop.address_lng));
    await routesRepo.updateStop(tenantId, stop.id, {
      drive_time_from_prev_mins: driveMins,
    });
  }

  return (await getRouteWithSummary(tenantId, routeId))!;
}

export interface OptimizeRouteResult {
  improved: boolean;
  oldDistanceKm: number;
  newDistanceKm: number;
  reductionPercent: number;
  stopsReordered: number;
  newWorkdayHrs: number;
}

export async function optimizeSingleRoute(tenantId: string, routeId: string): Promise<OptimizeRouteResult> {
  const route = await routesRepo.getRouteById(tenantId, routeId);
  if (!route) throw new Error('Route not found');

  const stops = await routesRepo.getStopsByRouteId(tenantId, routeId);
  if (stops.length <= 1) {
    const rws = await getRouteWithSummary(tenantId, routeId);
    return {
      improved: false,
      oldDistanceKm: 0,
      newDistanceKm: 0,
      reductionPercent: 0,
      stopsReordered: 0,
      newWorkdayHrs: rws!.summary.total_workday_hrs,
    };
  }

  const depotLat = Number(route.depot_lat);
  const depotLng = Number(route.depot_lng);
  const depot = { lat: depotLat, lng: depotLng };

  const currentCoords = stops.map((s) => ({
    ...s,
    lat: Number(s.address_lat),
    lng: Number(s.address_lng),
  }));

  const oldDistanceKm = calcRouteTotalDistance(currentCoords, depot);
  const optimized = twoOptImprove(currentCoords, depot);
  const newDistanceKm = calcRouteTotalDistance(optimized, depot);

  let stopsReordered = 0;
  for (let i = 0; i < stops.length; i++) {
    if (stops[i].id !== optimized[i].id) stopsReordered++;
  }

  const improved = stopsReordered > 0;

  if (improved) {
    const orderedIds = optimized.map((s) => s.id);
    await reorderStops(tenantId, routeId, orderedIds);
  }

  const rws = await getRouteWithSummary(tenantId, routeId);
  const reductionPercent = oldDistanceKm > 0
    ? Math.round((oldDistanceKm - newDistanceKm) / oldDistanceKm * 1000) / 10
    : 0;

  return {
    improved,
    oldDistanceKm: Math.round(oldDistanceKm * 100) / 100,
    newDistanceKm: Math.round(newDistanceKm * 100) / 100,
    reductionPercent,
    stopsReordered,
    newWorkdayHrs: rws!.summary.total_workday_hrs,
  };
}
