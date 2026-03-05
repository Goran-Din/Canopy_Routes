// api/src/services/geocoding.service.test.ts
// Unit tests for geocoding service in mock mode (3 test cases)
// Last modified: 2026-03-05

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildAddressString, geocodeAddress, geocodeBatch } from './geocoding.service';
import { ValidatedRow } from '../types/upload.types';

// Ensure mock mode
process.env.GOOGLE_MAPS_API_KEY = 'REPLACE_WITH_KEY';

function makeValidatedRow(overrides: Partial<ValidatedRow> = {}): ValidatedRow {
  return {
    clientName: 'Acme Corp',
    serviceAddress: '123 Main St',
    city: 'Aurora',
    state: 'IL',
    zip: '60505',
    acres: 1.5,
    clientType: 'residential',
    acreageConfirmed: true,
    serviceFrequency: 'weekly',
    clientStatus: 'confirmed',
    annualRevenue: null,
    snowService: false,
    snowContractType: 'none',
    priorRoute: null,
    priorDay: null,
    priorCrew: null,
    timeConstraints: null,
    accessNotes: null,
    billingAccounts: 1,
    externalId: null,
    propertyNotes: null,
    rowNumber: 2,
    warnings: [],
    ...overrides,
  };
}

describe('geocoding.service', () => {
  it('GEO-1: buildAddressString formats correctly', () => {
    const row = makeValidatedRow({ serviceAddress: '123 Main St', city: 'Aurora', state: 'IL', zip: '60505' });
    const result = buildAddressString(row);
    assert.equal(result, '123 Main St, Aurora, IL 60505, USA');
  });

  it('GEO-2: geocodeAddress in mock mode returns success with coordinates', async () => {
    const result = await geocodeAddress('123 Main St, Aurora, IL 60505, USA');
    assert.equal(result.geocodeStatus, 'success');
    assert.notEqual(result.lat, null);
    assert.notEqual(result.lng, null);
    assert.ok(result.formattedAddress?.includes('(MOCK)'));
  });

  it('GEO-3: geocodeBatch with 3 rows returns 3 results in mock mode', async () => {
    const rows = [
      makeValidatedRow({ serviceAddress: '100 First St', rowNumber: 2 }),
      makeValidatedRow({ serviceAddress: '200 Second St', rowNumber: 3 }),
      makeValidatedRow({ serviceAddress: '300 Third St', rowNumber: 4 }),
    ];
    const results = await geocodeBatch(rows);
    assert.equal(results.length, 3);
    assert.ok(results.every((r) => r.geocodeStatus === 'success'));
    assert.ok(results.every((r) => r.lat !== null && r.lng !== null));
  });
});
