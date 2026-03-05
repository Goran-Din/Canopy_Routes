// api/src/services/csv-parse.service.test.ts
// Unit tests for CSV parsing and validation (10 test cases)
// Last modified: 2026-03-05

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSVBuffer, validateHeaders, validateRows, deduplicateRows } from './csv-parse.service';
import { RawCsvRow } from '../types/upload.types';

function makeRow(overrides: Partial<RawCsvRow> = {}): RawCsvRow {
  return {
    client_name: 'Acme Corp',
    service_address: '123 Main St',
    city: 'Naperville',
    state: 'IL',
    zip: '60540',
    acres: '1.5',
    ...overrides,
  };
}

describe('validateHeaders', () => {
  it('CSV-1: All required headers present → valid', () => {
    const result = validateHeaders(['client_name', 'service_address', 'city', 'state', 'zip', 'acres', 'notes']);
    assert.equal(result.valid, true);
    assert.deepEqual(result.missingHeaders, []);
  });

  it('CSV-2: Missing acres and zip → lists missing', () => {
    const result = validateHeaders(['client_name', 'service_address', 'city', 'state']);
    assert.equal(result.valid, false);
    assert.deepEqual(result.missingHeaders, ['zip', 'acres']);
  });
});

describe('validateRows', () => {
  it('CSV-3: One valid row → 1 valid, 0 errors', () => {
    const result = validateRows([makeRow()]);
    assert.equal(result.valid.length, 1);
    assert.equal(result.errors.length, 0);
    assert.equal(result.valid[0].clientName, 'Acme Corp');
    assert.equal(result.valid[0].acres, 1.5);
  });

  it('CSV-4: Missing client_name → 0 valid, 1 error', () => {
    const result = validateRows([makeRow({ client_name: '' })]);
    assert.equal(result.valid.length, 0);
    assert.equal(result.errors.length, 1);
    assert.ok(result.errors[0].errorMessage.includes('client_name'));
  });

  it('CSV-5: Invalid acres (abc) → 0 valid, 1 error', () => {
    const result = validateRows([makeRow({ acres: 'abc' })]);
    assert.equal(result.valid.length, 0);
    assert.equal(result.errors.length, 1);
    assert.ok(result.errors[0].errorMessage.includes('acres'));
  });

  it('CSV-6: Invalid client_type → 1 valid with default, 1 warning', () => {
    const result = validateRows([makeRow({ client_type: 'unknown' })]);
    assert.equal(result.valid.length, 1);
    assert.equal(result.valid[0].clientType, 'residential');
    assert.equal(result.warnings.length, 1);
    assert.equal(result.warnings[0].field, 'client_type');
  });

  it('CSV-7: Invalid service_frequency → 1 valid with default, 1 warning', () => {
    const result = validateRows([makeRow({ service_frequency: 'quarterly' })]);
    assert.equal(result.valid.length, 1);
    assert.equal(result.valid[0].serviceFrequency, 'weekly');
    assert.equal(result.warnings.length, 1);
    assert.equal(result.warnings[0].field, 'service_frequency');
  });

  it('CSV-10: Acres = 0 → acreageConfirmed = false', () => {
    const result = validateRows([makeRow({ acres: '0', acreage_confirmed: 'true' })]);
    assert.equal(result.valid.length, 1);
    assert.equal(result.valid[0].acres, 0);
    assert.equal(result.valid[0].acreageConfirmed, false);
  });
});

describe('deduplicateRows', () => {
  it('CSV-8: 2 identical addresses → 1 row with billingAccounts = 2', () => {
    const rows = validateRows([makeRow(), makeRow({ client_name: 'Acme Corp Branch' })]);
    const deduped = deduplicateRows(rows.valid);
    assert.equal(deduped.length, 1);
    assert.equal(deduped[0].billingAccounts, 2);
  });
});

describe('parseCSVBuffer', () => {
  it('CSV-9: Valid CSV buffer → headers present, rows parsed', () => {
    const csv = 'client_name,service_address,city,state,zip,acres\nAcme Corp,123 Main St,Naperville,IL,60540,1.5\n';
    const result = parseCSVBuffer(Buffer.from(csv));
    assert.ok(result.headers.includes('client_name'));
    assert.ok(result.headers.includes('acres'));
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].client_name, 'Acme Corp');
    assert.equal(result.parseErrors.length, 0);
  });
});
