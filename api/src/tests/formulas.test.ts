// api/src/tests/formulas.test.ts
// Unit tests for the formula engine (Sprint 4)
// Last modified: 2026-03-05

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcMowTime,
  calcTrimTime,
  calcProductiveTime,
  calcDriveTime,
  getCapacityStatus,
  calcRouteWorkday,
  calcRouteTotalDistance,
  twoOptImprove,
  calcSnowServiceTime,
  calcSnowRouteWorkday,
  StopInput,
  SnowStopInput,
} from '../services/formulas.service';

// ── calcMowTime ──────────────────────────────────────────────────

describe('calcMowTime', () => {
  it('FORM-1: 0.45 ac at 2.50 ac/hr → 0.1800', () => {
    const result = calcMowTime(0.45, 2.50);
    assert.ok(Math.abs(result - 0.1800) < 0.001, `Expected ~0.1800, got ${result}`);
  });

  it('FORM-2: 2.0 ac at 2.50 ac/hr → 0.80', () => {
    const result = calcMowTime(2.0, 2.50);
    assert.ok(Math.abs(result - 0.80) < 0.001, `Expected ~0.80, got ${result}`);
  });

  it('FORM-3: acres = 0 → 0', () => {
    assert.equal(calcMowTime(0, 2.50), 0);
  });

  it('FORM-4: negative acres → 0', () => {
    assert.equal(calcMowTime(-1, 2.50), 0);
  });

  it('FORM-5: mowRate = 0 → 0', () => {
    assert.equal(calcMowTime(1.0, 0), 0);
  });
});

// ── calcTrimTime ─────────────────────────────────────────────────

describe('calcTrimTime', () => {
  it('FORM-6: 0.1800 → 0.0720', () => {
    const result = calcTrimTime(0.1800);
    assert.ok(Math.abs(result - 0.0720) < 0.001, `Expected ~0.0720, got ${result}`);
  });

  it('FORM-7: 0 → 0', () => {
    assert.equal(calcTrimTime(0), 0);
  });

  it('FORM-8: negative → 0', () => {
    assert.equal(calcTrimTime(-0.5), 0);
  });
});

// ── calcProductiveTime ───────────────────────────────────────────

describe('calcProductiveTime', () => {
  it('FORM-9: 0.1800 + 0.0720 → 0.2520', () => {
    const result = calcProductiveTime(0.1800, 0.0720);
    assert.ok(Math.abs(result - 0.2520) < 0.001, `Expected ~0.2520, got ${result}`);
  });
});

// ── calcDriveTime ────────────────────────────────────────────────

describe('calcDriveTime', () => {
  it('FORM-10: identical coordinates → exactly 0', () => {
    assert.equal(calcDriveTime(41.7606, -88.1381, 41.7606, -88.1381), 0);
  });

  it('FORM-11: result is never negative', () => {
    const result = calcDriveTime(41.76, -88.14, 41.80, -88.10);
    assert.ok(result >= 0, `Expected non-negative, got ${result}`);
  });

  it('FORM-12: ~8km distance returns between 5 and 45 minutes', () => {
    // Naperville depot to ~8km away
    const result = calcDriveTime(41.7606, -88.1381, 41.8100, -88.0900);
    assert.ok(result >= 5 && result <= 45, `Expected 5-45 min, got ${result}`);
  });
});

// ── getCapacityStatus ────────────────────────────────────────────

describe('getCapacityStatus', () => {
  it('FORM-13: 5.9h → orange', () => {
    assert.equal(getCapacityStatus(5.9), 'orange');
  });

  it('FORM-14: 6.0h → green', () => {
    assert.equal(getCapacityStatus(6.0), 'green');
  });

  it('FORM-15: 8.4h → green', () => {
    assert.equal(getCapacityStatus(8.4), 'green');
  });

  it('FORM-16: 8.5h → green (boundary)', () => {
    assert.equal(getCapacityStatus(8.5), 'green');
  });

  it('FORM-17: 8.51h → yellow', () => {
    assert.equal(getCapacityStatus(8.51), 'yellow');
  });

  it('FORM-18: 9.0h → yellow (boundary)', () => {
    assert.equal(getCapacityStatus(9.0), 'yellow');
  });

  it('FORM-19: 9.01h → red', () => {
    assert.equal(getCapacityStatus(9.01), 'red');
  });
});

// ── calcRouteWorkday ─────────────────────────────────────────────

describe('calcRouteWorkday', () => {
  const DEPOT_LAT = 41.7606;
  const DEPOT_LNG = -88.1381;
  const MOW_RATE = 2.50;

  it('FORM-20: 0 stops → all zeros, orange, stopCount 0', () => {
    const result = calcRouteWorkday([], MOW_RATE, DEPOT_LAT, DEPOT_LNG);
    assert.equal(result.totalWorkdayHrs, 0);
    assert.equal(result.totalProductiveHrs, 0);
    assert.equal(result.totalDriveHrs, 0);
    assert.equal(result.capacityStatus, 'orange');
    assert.equal(result.stopCount, 0);
  });

  it('FORM-21: 1 stop → workday > 0, stopCount = 1', () => {
    const stops: StopInput[] = [{
      lat: 41.78, lng: -88.12, acres: 0.45, isBiweekly: false,
      prevLat: DEPOT_LAT, prevLng: DEPOT_LNG,
    }];
    const result = calcRouteWorkday(stops, MOW_RATE, DEPOT_LAT, DEPOT_LNG);
    assert.ok(result.totalWorkdayHrs > 0, `Expected > 0, got ${result.totalWorkdayHrs}`);
    assert.equal(result.stopCount, 1);
  });

  it('FORM-22: biweekly stop productive time is half of weekly', () => {
    const weeklyStop: StopInput = {
      lat: 41.78, lng: -88.12, acres: 0.50, isBiweekly: false,
      prevLat: DEPOT_LAT, prevLng: DEPOT_LNG,
    };
    const biweeklyStop: StopInput = {
      lat: 41.78, lng: -88.12, acres: 0.50, isBiweekly: true,
      prevLat: DEPOT_LAT, prevLng: DEPOT_LNG,
    };

    const weeklyResult = calcRouteWorkday([weeklyStop], MOW_RATE, DEPOT_LAT, DEPOT_LNG);
    const biweeklyResult = calcRouteWorkday([biweeklyStop], MOW_RATE, DEPOT_LAT, DEPOT_LNG);

    // Drive time is the same for both, so productive difference is the key
    assert.ok(
      Math.abs(biweeklyResult.totalProductiveHrs - weeklyResult.totalProductiveHrs * 0.5) < 0.001,
      `Biweekly productive ${biweeklyResult.totalProductiveHrs} should be half of weekly ${weeklyResult.totalProductiveHrs}`,
    );
  });

  it('FORM-23: Route B ground truth — 12 stops, ~7.0h workday', () => {
    // Erick's 2026 Route B: 12 stops across Aurora/Naperville service area
    // 3 biweekly stops (indices 2, 7, 10), rest weekly
    // Realistic suburban lot sizes, zigzag pattern across ~6km service area
    const coords: Array<{ lat: number; lng: number; acres: number; isBiweekly: boolean }> = [
      { lat: 41.7720, lng: -88.1100, acres: 0.85, isBiweekly: false },
      { lat: 41.7850, lng: -88.1450, acres: 1.00, isBiweekly: false },
      { lat: 41.7950, lng: -88.1150, acres: 0.80, isBiweekly: true },
      { lat: 41.8050, lng: -88.1550, acres: 0.95, isBiweekly: false },
      { lat: 41.8150, lng: -88.1200, acres: 0.82, isBiweekly: false },
      { lat: 41.8250, lng: -88.1500, acres: 1.05, isBiweekly: false },
      { lat: 41.8100, lng: -88.1050, acres: 0.75, isBiweekly: false },
      { lat: 41.7900, lng: -88.1600, acres: 0.70, isBiweekly: true },
      { lat: 41.7750, lng: -88.0950, acres: 0.90, isBiweekly: false },
      { lat: 41.8000, lng: -88.1700, acres: 0.78, isBiweekly: false },
      { lat: 41.8200, lng: -88.1100, acres: 0.65, isBiweekly: true },
      { lat: 41.7800, lng: -88.1400, acres: 1.10, isBiweekly: false },
    ];

    // Build chained stops — each prevLat/prevLng comes from the previous stop
    const stops: StopInput[] = coords.map((c, i) => ({
      lat: c.lat,
      lng: c.lng,
      acres: c.acres,
      isBiweekly: c.isBiweekly,
      prevLat: i === 0 ? DEPOT_LAT : coords[i - 1].lat,
      prevLng: i === 0 ? DEPOT_LNG : coords[i - 1].lng,
    }));

    const result = calcRouteWorkday(stops, MOW_RATE, DEPOT_LAT, DEPOT_LNG);

    console.log('=== Route B Ground Truth ===');
    console.log(`  Workday hours:    ${result.totalWorkdayHrs.toFixed(4)}`);
    console.log(`  Productive hours: ${result.totalProductiveHrs.toFixed(4)}`);
    console.log(`  Drive hours:      ${result.totalDriveHrs.toFixed(4)}`);
    console.log(`  Capacity status:  ${result.capacityStatus}`);
    console.log(`  Stop count:       ${result.stopCount}`);
    console.log('============================');

    assert.equal(result.stopCount, 12);
    assert.ok(
      result.totalWorkdayHrs >= 6.8 && result.totalWorkdayHrs <= 7.2,
      `Expected 6.8–7.2h, got ${result.totalWorkdayHrs.toFixed(4)}`,
    );
    assert.equal(result.capacityStatus, 'green');
  });
});

// ── calcRouteTotalDistance ────────────────────────────────────

describe('calcRouteTotalDistance', () => {
  it('FORM-24: 0 stops → 0', () => {
    assert.equal(calcRouteTotalDistance([], { lat: 41.76, lng: -88.32 }), 0);
  });
});

// ── twoOptImprove ────────────────────────────────────────────

describe('twoOptImprove', () => {
  const depot = { lat: 41.76, lng: -88.32 };

  it('FORM-25: 3 stops (already optimal) returns same order', () => {
    const stops = [
      { lat: 41.77, lng: -88.31 },
      { lat: 41.78, lng: -88.30 },
      { lat: 41.79, lng: -88.29 },
    ];
    const result = twoOptImprove(stops, depot);
    assert.equal(result.length, 3);
    // With 3 stops (boundary), returns a copy unchanged
    assert.deepEqual(result, stops);
  });

  it('FORM-26: zigzag 4 stops are improved by 2-opt', () => {
    const stops = [
      { lat: 41.80, lng: -88.30 },  // north
      { lat: 41.72, lng: -88.28 },  // south-east
      { lat: 41.78, lng: -88.35 },  // north-west
      { lat: 41.74, lng: -88.33 },  // south-west
    ];
    const originalDistance = calcRouteTotalDistance(stops, depot);
    const result = twoOptImprove(stops, depot);
    const improvedDistance = calcRouteTotalDistance(result, depot);

    assert.ok(
      improvedDistance < originalDistance,
      `Expected improved (${improvedDistance.toFixed(3)}) < original (${originalDistance.toFixed(3)})`
    );
  });

  it('FORM-27: 0 or 1 stops returns input unchanged', () => {
    const empty = twoOptImprove([], depot);
    assert.deepEqual(empty, []);

    const single = [{ lat: 41.77, lng: -88.31 }];
    const result = twoOptImprove(single, depot);
    assert.deepEqual(result, single);
  });

  it('FORM-28: does not mutate the original array', () => {
    const stops = [
      { lat: 41.80, lng: -88.30 },
      { lat: 41.72, lng: -88.28 },
      { lat: 41.78, lng: -88.35 },
      { lat: 41.74, lng: -88.33 },
    ];
    const originalOrder = stops.map((s) => ({ ...s }));
    twoOptImprove(stops, depot);
    assert.deepEqual(stops, originalOrder, 'Original array should not be mutated');
  });
});

// ── calcSnowServiceTime ──────────────────────────────────────

describe('calcSnowServiceTime', () => {
  it('SNOW-1: plow 15000 sqft → 1.0 hr', () => {
    const result = calcSnowServiceTime(15_000, 'plow');
    assert.ok(Math.abs(result - 1.0) < 0.001, `Expected 1.0, got ${result}`);
  });

  it('SNOW-2: salt 25000 sqft → 1.0 hr', () => {
    const result = calcSnowServiceTime(25_000, 'salt');
    assert.ok(Math.abs(result - 1.0) < 0.001, `Expected 1.0, got ${result}`);
  });

  it('SNOW-3: plow_salt 15000 sqft → 1.6 hr (plow 1.0 + salt 0.6)', () => {
    const result = calcSnowServiceTime(15_000, 'plow_salt');
    const expected = 15_000 / 15_000 + 15_000 / 25_000; // 1.0 + 0.6 = 1.6
    assert.ok(Math.abs(result - expected) < 0.001, `Expected ${expected}, got ${result}`);
  });

  it('SNOW-4: 0 sqft → 0', () => {
    assert.equal(calcSnowServiceTime(0, 'plow'), 0);
  });
});

// ── calcSnowRouteWorkday ─────────────────────────────────────

describe('calcSnowRouteWorkday', () => {
  const DEPOT_LAT = 41.7606;
  const DEPOT_LNG = -88.1381;

  it('SNOW-5: 3 plow stops totaling 45000 sqft → ~3h service + drive', () => {
    const stops: SnowStopInput[] = [
      { lat: 41.77, lng: -88.12, lotSizeSqft: 15_000, serviceType: 'plow', priority: 1, prevLat: DEPOT_LAT, prevLng: DEPOT_LNG },
      { lat: 41.78, lng: -88.13, lotSizeSqft: 15_000, serviceType: 'plow', priority: 2, prevLat: 41.77, prevLng: -88.12 },
      { lat: 41.79, lng: -88.14, lotSizeSqft: 15_000, serviceType: 'plow', priority: 3, prevLat: 41.78, prevLng: -88.13 },
    ];
    const result = calcSnowRouteWorkday(stops, DEPOT_LAT, DEPOT_LNG);

    assert.equal(result.stopCount, 3);
    // 3 * 1.0h = 3.0h service + drive time
    assert.ok(Math.abs(result.totalServiceHrs - 3.0) < 0.001, `Expected 3.0h service, got ${result.totalServiceHrs}`);
    assert.ok(result.totalWorkdayHrs > 3.0, `Expected workday > 3.0 (includes drive), got ${result.totalWorkdayHrs}`);
    assert.ok(result.totalDriveHrs > 0, 'Expected drive time > 0');
  });
});
