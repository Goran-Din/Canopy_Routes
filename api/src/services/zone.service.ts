// api/src/services/zone.service.ts
// Pure zone suggestion algorithm — no DB calls, no side effects
// Last modified: 2026-03-04

export interface ZoneBoundary {
  rule_number: number;
  zone_label: string;
  bearing_min: number | null;
  bearing_max: number | null;
  distance_min_mi: number | null;
  distance_max_mi: number | null;
  requires_commercial: boolean;
  description: string;
}

export interface ZoneSuggestion {
  zone: string;
  day: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  bearing: number;
  distanceMi: number;
  alternatives: Array<{ zone: string; day: string; reason: string }>;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function calcBearing(
  clientLat: number,
  clientLng: number,
  depotLat: number,
  depotLng: number
): number {
  const dLng = toRad(clientLng - depotLng);
  const lat1 = toRad(depotLat);
  const lat2 = toRad(clientLat);
  const x = Math.sin(dLng) * Math.cos(lat2);
  const y =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(x, y)) + 360) % 360;
}

export function calcDistanceMiles(
  clientLat: number,
  clientLng: number,
  depotLat: number,
  depotLng: number
): number {
  const R = 3958.8;
  const dLat = toRad(clientLat - depotLat);
  const dLng = toRad(clientLng - depotLng);
  const lat1 = toRad(depotLat);
  const lat2 = toRad(clientLat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function matchesRule(
  rule: ZoneBoundary,
  bearing: number,
  distanceMi: number,
  clientType: string
): boolean {
  if (rule.requires_commercial && clientType !== 'commercial') {
    return false;
  }

  const hasNoGeoConstraints =
    rule.bearing_min === null &&
    rule.bearing_max === null &&
    rule.distance_min_mi === null &&
    rule.distance_max_mi === null;

  // Commercial override or catch-all: no geo constraints
  if (hasNoGeoConstraints) {
    return true;
  }

  // Bearing check
  if (rule.bearing_min !== null && rule.bearing_max !== null) {
    if (bearing < rule.bearing_min || bearing > rule.bearing_max) {
      return false;
    }
  }

  // Distance checks
  if (rule.distance_min_mi !== null && distanceMi < rule.distance_min_mi) {
    return false;
  }
  if (rule.distance_max_mi !== null && distanceMi > rule.distance_max_mi) {
    return false;
  }

  return true;
}

const ZONE_DAY_MAP: Record<string, string> = {
  A: 'Monday',
  B: 'Tuesday',
  C: 'Wednesday',
  D: 'Thursday',
  E: 'Friday',
  'SN-01': 'N/A',
  'SN-02': 'N/A',
  'SN-03': 'N/A',
};

export function getZoneDay(zoneLabel: string): string {
  return ZONE_DAY_MAP[zoneLabel] || 'Unknown';
}

const BEARING_TOLERANCE = 5;
const DISTANCE_TOLERANCE = 1;

function extractBearingBoundaries(boundaries: ZoneBoundary[]): number[] {
  const values = new Set<number>();
  for (const rule of boundaries) {
    if (rule.bearing_min !== null) values.add(rule.bearing_min);
    if (rule.bearing_max !== null) values.add(rule.bearing_max);
  }
  return Array.from(values).sort((a, b) => a - b);
}

function extractDistanceBoundaries(boundaries: ZoneBoundary[]): number[] {
  const values = new Set<number>();
  for (const rule of boundaries) {
    if (rule.distance_min_mi !== null) values.add(rule.distance_min_mi);
    if (rule.distance_max_mi !== null) values.add(rule.distance_max_mi);
  }
  return Array.from(values).sort((a, b) => a - b);
}

export function calcConfidence(
  bearing: number,
  distanceMi: number,
  matchedZone: string,
  clientType: string,
  boundaries: ZoneBoundary[]
): 'HIGH' | 'MEDIUM' | 'LOW' {
  // Rule 9 catch-all for non-commercial → LOW
  if (matchedZone === 'A' && clientType !== 'commercial') {
    return 'LOW';
  }

  const bearingBoundaries = extractBearingBoundaries(boundaries);
  const distanceBoundaries = extractDistanceBoundaries(boundaries);

  const nearBearingBoundary = bearingBoundaries.some(
    (b) => Math.abs(bearing - b) <= BEARING_TOLERANCE
  );
  const nearDistBoundary = distanceBoundaries.some(
    (d) => Math.abs(distanceMi - d) <= DISTANCE_TOLERANCE
  );

  if (nearBearingBoundary || nearDistBoundary) {
    return 'MEDIUM';
  }

  return 'HIGH';
}

export function findAlternatives(
  bearing: number,
  distanceMi: number,
  clientType: string,
  boundaries: ZoneBoundary[],
  excludeZone: string
): Array<{ zone: string; day: string; reason: string }> {
  const alts: Array<{ zone: string; day: string; reason: string }> = [];
  const seen = new Set<string>();

  for (const rule of boundaries) {
    if (seen.has(rule.zone_label) || rule.zone_label === excludeZone) continue;
    if (rule.requires_commercial && clientType !== 'commercial') continue;

    let reason = '';

    if (rule.bearing_min !== null && rule.bearing_max !== null) {
      const nearMin = Math.abs(bearing - rule.bearing_min) <= BEARING_TOLERANCE;
      const nearMax = Math.abs(bearing - rule.bearing_max) <= BEARING_TOLERANCE;
      const inBearing = bearing >= rule.bearing_min && bearing <= rule.bearing_max;

      if (nearMin || nearMax || inBearing) {
        if (nearMin) reason = `Near bearing boundary ${rule.bearing_min}\u00B0 (\u00B1${BEARING_TOLERANCE}\u00B0)`;
        else if (nearMax) reason = `Near bearing boundary ${rule.bearing_max}\u00B0 (\u00B1${BEARING_TOLERANCE}\u00B0)`;
        else reason = `Within bearing range ${rule.bearing_min}\u00B0\u2013${rule.bearing_max}\u00B0`;
      } else {
        continue;
      }
    }

    if (rule.distance_min_mi !== null && distanceMi < rule.distance_min_mi) {
      if (Math.abs(distanceMi - rule.distance_min_mi) <= DISTANCE_TOLERANCE) {
        reason = reason || `Near distance boundary ${rule.distance_min_mi}mi (\u00B1${DISTANCE_TOLERANCE}mi)`;
      } else {
        continue;
      }
    }
    if (rule.distance_max_mi !== null && distanceMi > rule.distance_max_mi) {
      if (Math.abs(distanceMi - rule.distance_max_mi) <= DISTANCE_TOLERANCE) {
        reason = reason || `Near distance boundary ${rule.distance_max_mi}mi (\u00B1${DISTANCE_TOLERANCE}mi)`;
      } else {
        continue;
      }
    }

    if (!reason && !rule.requires_commercial && rule.bearing_min === null && rule.distance_min_mi === null) {
      reason = 'Catch-all fallback';
    }

    if (!reason) {
      reason = `Matches rule ${rule.rule_number}: ${rule.description}`;
    }

    seen.add(rule.zone_label);
    alts.push({ zone: rule.zone_label, day: getZoneDay(rule.zone_label), reason });

    if (alts.length >= 2) break;
  }

  return alts;
}

export function suggestZone(
  clientLat: number,
  clientLng: number,
  clientType: 'residential' | 'commercial',
  depotLat: number,
  depotLng: number,
  boundaries: ZoneBoundary[]
): ZoneSuggestion {
  const bearing = calcBearing(clientLat, clientLng, depotLat, depotLng);
  const distanceMi = calcDistanceMiles(clientLat, clientLng, depotLat, depotLng);

  const sorted = [...boundaries].sort((a, b) => a.rule_number - b.rule_number);

  for (const rule of sorted) {
    if (matchesRule(rule, bearing, distanceMi, clientType)) {
      const zone = rule.zone_label;
      const day = getZoneDay(zone);
      const confidence = calcConfidence(bearing, distanceMi, zone, clientType, sorted);
      const alternatives = findAlternatives(bearing, distanceMi, clientType, sorted, zone);

      return {
        zone,
        day,
        confidence,
        bearing: Math.round(bearing * 100) / 100,
        distanceMi: Math.round(distanceMi * 100) / 100,
        alternatives,
      };
    }
  }

  throw new Error('Zone suggestion algorithm error: no rule matched');
}
