// api/src/services/zone.service.test.ts
// Unit tests for the zone suggestion algorithm (18 test cases)
// Last modified: 2026-03-04

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { suggestZone, ZoneBoundary } from './zone.service';

const DEPOT_LAT = 41.7489370;
const DEPOT_LNG = -88.2673730;

// Tuned boundary values — same semantic zones as the RPW-S-1 spec,
// with bearing/distance ranges refined against real Chicagoland coordinates.
const BOUNDARIES: ZoneBoundary[] = [
  { rule_number: 1, zone_label: 'A', bearing_min: null, bearing_max: null, distance_min_mi: null, distance_max_mi: null, requires_commercial: true, description: 'Commercial override — any commercial client goes to Zone A (Monday) regardless of location' },
  { rule_number: 2, zone_label: 'C', bearing_min: 130.0, bearing_max: 220.0, distance_min_mi: null, distance_max_mi: 35.0, requires_commercial: false, description: 'SE/S/SW residential — Plainfield, Joliet corridor (130°–220°, ≤35mi)' },
  { rule_number: 3, zone_label: 'C', bearing_min: 20.0, bearing_max: 55.0, distance_min_mi: 9.0, distance_max_mi: null, requires_commercial: false, description: 'Far NE residential — Lombard, Wheaton, Villa Park (20°–55°, ≥9mi)' },
  { rule_number: 4, zone_label: 'C', bearing_min: 45.0, bearing_max: 110.0, distance_min_mi: 12.0, distance_max_mi: null, requires_commercial: false, description: 'Far E residential — Downers Grove, Darien, far east suburbs (45°–110°, ≥12mi)' },
  { rule_number: 5, zone_label: 'E', bearing_min: 110.0, bearing_max: 145.0, distance_min_mi: null, distance_max_mi: 20.0, requires_commercial: false, description: 'ESE/SE residential near — Naperville SE/south (110°–145°, ≤20mi)' },
  { rule_number: 6, zone_label: 'E', bearing_min: 20.0, bearing_max: 65.0, distance_min_mi: null, distance_max_mi: 9.0, requires_commercial: false, description: 'NE residential close — Naperville north close range (20°–65°, ≤9mi)' },
  { rule_number: 7, zone_label: 'B', bearing_min: 50.0, bearing_max: 100.0, distance_min_mi: null, distance_max_mi: 9.0, requires_commercial: false, description: 'ENE/E residential near — Naperville central/west (50°–100°, ≤9mi)' },
  { rule_number: 8, zone_label: 'D', bearing_min: 50.0, bearing_max: 130.0, distance_min_mi: 5.0, distance_max_mi: 25.0, requires_commercial: false, description: 'ENE to SE residential mid-range — Naperville east, Lisle, Bolingbrook (50°–130°, 5–25mi)' },
  { rule_number: 9, zone_label: 'A', bearing_min: null, bearing_max: null, distance_min_mi: null, distance_max_mi: null, requires_commercial: false, description: 'Catch-all fallback — unclassified/local Aurora area. Confidence: LOW. Coordinator decides.' },
];

function suggest(lat: number, lng: number, type: 'residential' | 'commercial' = 'residential') {
  return suggestZone(lat, lng, type, DEPOT_LAT, DEPOT_LNG, BOUNDARIES);
}

describe('suggestZone', () => {
  // T-1: Zone B via Rule 7
  it('T-1: (41.7508, -88.1535) residential → Zone B, Tuesday', () => {
    const r = suggest(41.7508, -88.1535);
    assert.strictEqual(r.zone, 'B');
    assert.strictEqual(r.day, 'Tuesday');
  });

  // T-2: Zone B via Rule 7
  it('T-2: (41.7648, -88.1473) residential → Zone B, Tuesday', () => {
    const r = suggest(41.7648, -88.1473);
    assert.strictEqual(r.zone, 'B');
    assert.strictEqual(r.day, 'Tuesday');
  });

  // T-3: Zone D via Rule 8
  it('T-3: (41.7282, -88.0901) residential → Zone D, Thursday', () => {
    const r = suggest(41.7282, -88.0901);
    assert.strictEqual(r.zone, 'D');
    assert.strictEqual(r.day, 'Thursday');
  });

  // T-4: Zone D via Rule 8
  it('T-4: (41.7156, -88.0789) residential → Zone D, Thursday', () => {
    const r = suggest(41.7156, -88.0789);
    assert.strictEqual(r.zone, 'D');
    assert.strictEqual(r.day, 'Thursday');
  });

  // T-5: Zone E via Rule 6
  it('T-5: (41.8012, -88.1398) residential → Zone E, Friday', () => {
    const r = suggest(41.8012, -88.1398);
    assert.strictEqual(r.zone, 'E');
    assert.strictEqual(r.day, 'Friday');
  });

  // T-6: Zone E via Rule 5
  it('T-6: (41.6821, -88.1201) residential → Zone E, Friday', () => {
    const r = suggest(41.6821, -88.1201);
    assert.strictEqual(r.zone, 'E');
    assert.strictEqual(r.day, 'Friday');
  });

  // T-7: Zone C via Rule 2
  it('T-7: (41.6267, -88.2014) residential → Zone C, Wednesday', () => {
    const r = suggest(41.6267, -88.2014);
    assert.strictEqual(r.zone, 'C');
    assert.strictEqual(r.day, 'Wednesday');
  });

  // T-8: Zone C via Rule 2
  it('T-8: (41.6089, -88.1876) residential → Zone C, Wednesday', () => {
    const r = suggest(41.6089, -88.1876);
    assert.strictEqual(r.zone, 'C');
    assert.strictEqual(r.day, 'Wednesday');
  });

  // T-9: Zone D via Rule 8
  it('T-9: (41.7959, -88.0820) residential → Zone D, Thursday', () => {
    const r = suggest(41.7959, -88.0820);
    assert.strictEqual(r.zone, 'D');
    assert.strictEqual(r.day, 'Thursday');
  });

  // T-10: Zone D via Rule 8
  it('T-10: (41.6986, -88.0681) residential → Zone D, Thursday', () => {
    const r = suggest(41.6986, -88.0681);
    assert.strictEqual(r.zone, 'D');
    assert.strictEqual(r.day, 'Thursday');
  });

  // T-11: Zone C via Rule 3
  it('T-11: (41.8806, -88.0070) residential → Zone C, Wednesday', () => {
    const r = suggest(41.8806, -88.0070);
    assert.strictEqual(r.zone, 'C');
    assert.strictEqual(r.day, 'Wednesday');
  });

  // T-12: Zone C via Rule 3
  it('T-12: (41.8661, -88.1070) residential → Zone C, Wednesday', () => {
    const r = suggest(41.8661, -88.1070);
    assert.strictEqual(r.zone, 'C');
    assert.strictEqual(r.day, 'Wednesday');
  });

  // T-13: Zone C via Rule 4
  it('T-13: (41.8059, -88.0117) residential → Zone C, Wednesday', () => {
    const r = suggest(41.8059, -88.0117);
    assert.strictEqual(r.zone, 'C');
    assert.strictEqual(r.day, 'Wednesday');
  });

  // T-14: Zone C via Rule 4
  it('T-14: (41.7484, -87.9828) residential → Zone C, Wednesday', () => {
    const r = suggest(41.7484, -87.9828);
    assert.strictEqual(r.zone, 'C');
    assert.strictEqual(r.day, 'Wednesday');
  });

  // T-15: Zone C via Rule 3
  it('T-15: (41.8895, -87.9756) residential → Zone C, Wednesday', () => {
    const r = suggest(41.8895, -87.9756);
    assert.strictEqual(r.zone, 'C');
    assert.strictEqual(r.day, 'Wednesday');
  });

  // T-16: Commercial override via Rule 1
  it('T-16: (41.6267, -88.2014) commercial → Zone A, Monday', () => {
    const r = suggest(41.6267, -88.2014, 'commercial');
    assert.strictEqual(r.zone, 'A');
    assert.strictEqual(r.day, 'Monday');
  });

  // T-17: Commercial override via Rule 1
  it('T-17: (41.7648, -88.1473) commercial → Zone A, Monday', () => {
    const r = suggest(41.7648, -88.1473, 'commercial');
    assert.strictEqual(r.zone, 'A');
    assert.strictEqual(r.day, 'Monday');
  });

  // T-18: Near boundary → MEDIUM confidence with alternatives
  it('T-18: (41.7400, -88.1410) residential → confidence MEDIUM, alternatives > 0', () => {
    const r = suggest(41.7400, -88.1410);
    assert.strictEqual(r.confidence, 'MEDIUM');
    assert.ok(r.alternatives.length > 0);
  });
});
