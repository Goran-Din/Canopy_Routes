// api/src/services/formulas.service.ts
// Pure math module for route workday calculations
// Last modified: 2026-03-05

export type CapacityStatus = 'green' | 'yellow' | 'orange' | 'red';

export interface StopInput {
  lat: number;
  lng: number;
  acres: number;
  isBiweekly: boolean;
  prevLat: number;
  prevLng: number;
}

export interface RouteCalc {
  totalProductiveHrs: number;
  totalDriveHrs: number;
  totalWorkdayHrs: number;
  capacityStatus: CapacityStatus;
  stopCount: number;
}

const EARTH_RADIUS_KM = 6371;
const ROAD_FACTOR = 1.35;
const AVG_SPEED_KMH = 40;
const TRIM_RATIO = 0.40;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  if (lat1 === lat2 && lng1 === lng2) return 0;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function calcMowTime(acres: number, mowRate: number): number {
  if (acres <= 0 || mowRate <= 0) return 0;
  return acres / mowRate;
}

export function calcTrimTime(mowHours: number): number {
  if (mowHours <= 0) return 0;
  return mowHours * TRIM_RATIO;
}

export function calcProductiveTime(mowHours: number, trimHours: number): number {
  return mowHours + trimHours;
}

export function calcDriveTime(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const distanceKm = haversineKm(lat1, lng1, lat2, lng2);
  if (distanceKm === 0) return 0;
  return (distanceKm * ROAD_FACTOR) / AVG_SPEED_KMH * 60;
}

export function getCapacityStatus(totalHours: number): CapacityStatus {
  if (totalHours > 9.0) return 'red';
  if (totalHours > 8.5) return 'yellow';
  if (totalHours >= 6.0) return 'green';
  return 'orange';
}

export function calcRouteWorkday(
  stops: StopInput[],
  mowRate: number,
  depotLat: number,
  depotLng: number,
): RouteCalc {
  if (stops.length === 0) {
    return {
      totalProductiveHrs: 0,
      totalDriveHrs: 0,
      totalWorkdayHrs: 0,
      capacityStatus: 'orange',
      stopCount: 0,
    };
  }

  let totalDriveMinutes = 0;
  let totalProductiveHrs = 0;

  for (const stop of stops) {
    totalDriveMinutes += calcDriveTime(stop.prevLat, stop.prevLng, stop.lat, stop.lng);

    const mow = calcMowTime(stop.acres, mowRate);
    const trim = calcTrimTime(mow);
    const productive = calcProductiveTime(mow, trim);

    totalProductiveHrs += stop.isBiweekly ? productive * 0.5 : productive;
  }

  const lastStop = stops[stops.length - 1];
  totalDriveMinutes += calcDriveTime(lastStop.lat, lastStop.lng, depotLat, depotLng);

  const totalDriveHrs = totalDriveMinutes / 60;
  const totalWorkdayHrs = totalProductiveHrs + totalDriveHrs;
  const capacityStatus = getCapacityStatus(totalWorkdayHrs);

  return {
    totalProductiveHrs,
    totalDriveHrs,
    totalWorkdayHrs,
    capacityStatus,
    stopCount: stops.length,
  };
}

// ── Snow route formulas ──────────────────────────────────────────

export type SnowServiceType = 'plow' | 'salt' | 'plow_salt';

export interface SnowStopInput {
  lat: number;
  lng: number;
  lotSizeSqft: number;
  serviceType: SnowServiceType;
  priority: number;  // 1-5
  prevLat: number;
  prevLng: number;
}

export interface SnowRouteCalc {
  totalServiceHrs: number;
  totalDriveHrs: number;
  totalWorkdayHrs: number;
  capacityStatus: CapacityStatus;
  stopCount: number;
}

// Snow plowing rate: 15,000 sqft per hour
const PLOW_RATE_SQFT_PER_HR = 15_000;
// Salt application rate: 25,000 sqft per hour
const SALT_RATE_SQFT_PER_HR = 25_000;

/**
 * Calculate snow service time for a single stop.
 * Plow: lotSize / 15000 sqft/hr
 * Salt: lotSize / 25000 sqft/hr
 * Plow+Salt: plow + salt combined
 */
export function calcSnowServiceTime(lotSizeSqft: number, serviceType: SnowServiceType): number {
  if (lotSizeSqft <= 0) return 0;

  const plowHrs = lotSizeSqft / PLOW_RATE_SQFT_PER_HR;
  const saltHrs = lotSizeSqft / SALT_RATE_SQFT_PER_HR;

  switch (serviceType) {
    case 'plow':      return plowHrs;
    case 'salt':      return saltHrs;
    case 'plow_salt': return plowHrs + saltHrs;
  }
}

/**
 * Calculate a full snow route workday from an ordered list of stops.
 * Stops should be pre-sorted by priority (1 first) then sequence.
 */
export function calcSnowRouteWorkday(
  stops: SnowStopInput[],
  depotLat: number,
  depotLng: number,
): SnowRouteCalc {
  if (stops.length === 0) {
    return {
      totalServiceHrs: 0,
      totalDriveHrs: 0,
      totalWorkdayHrs: 0,
      capacityStatus: 'orange',
      stopCount: 0,
    };
  }

  let totalDriveMinutes = 0;
  let totalServiceHrs = 0;

  for (const stop of stops) {
    totalDriveMinutes += calcDriveTime(stop.prevLat, stop.prevLng, stop.lat, stop.lng);
    totalServiceHrs += calcSnowServiceTime(stop.lotSizeSqft, stop.serviceType);
  }

  // Return-to-depot leg
  const lastStop = stops[stops.length - 1];
  totalDriveMinutes += calcDriveTime(lastStop.lat, lastStop.lng, depotLat, depotLng);

  const totalDriveHrs = totalDriveMinutes / 60;
  const totalWorkdayHrs = totalServiceHrs + totalDriveHrs;
  const capacityStatus = getCapacityStatus(totalWorkdayHrs);

  return {
    totalServiceHrs,
    totalDriveHrs,
    totalWorkdayHrs,
    capacityStatus,
    stopCount: stops.length,
  };
}

/**
 * Calculate total route drive distance (haversine, in km) for a sequence of stops.
 * Includes depot→first and last→depot legs.
 */
export function calcRouteTotalDistance(
  stops: Array<{ lat: number; lng: number }>,
  depot: { lat: number; lng: number }
): number {
  if (stops.length === 0) return 0;
  let total = haversineKm(depot.lat, depot.lng, stops[0].lat, stops[0].lng);
  for (let i = 0; i < stops.length - 1; i++) {
    total += haversineKm(stops[i].lat, stops[i].lng, stops[i + 1].lat, stops[i + 1].lng);
  }
  total += haversineKm(stops[stops.length - 1].lat, stops[stops.length - 1].lng, depot.lat, depot.lng);
  return total;
}

/**
 * 2-opt improvement pass on a stop sequence.
 * Returns a new array with stops in the improved order.
 * Does NOT modify the input array.
 * Max iterations: 1000 (safety cap for large routes).
 */
export function twoOptImprove<T extends { lat: number; lng: number }>(
  stops: T[],
  depot: { lat: number; lng: number }
): T[] {
  if (stops.length <= 3) return [...stops];

  let best = [...stops];
  let bestDistance = calcRouteTotalDistance(best, depot);
  let improved = true;
  let iterations = 0;
  const MAX_ITERATIONS = 1000;

  while (improved && iterations < MAX_ITERATIONS) {
    improved = false;
    iterations++;

    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1),
        ];
        const candidateDistance = calcRouteTotalDistance(candidate, depot);

        if (candidateDistance < bestDistance - 0.001) {
          best = candidate;
          bestDistance = candidateDistance;
          improved = true;
        }
      }
    }
  }

  return best;
}
