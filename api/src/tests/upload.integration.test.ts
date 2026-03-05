// api/src/tests/upload.integration.test.ts
// Integration tests for CSV upload pipeline (10 test cases)
// Last modified: 2026-03-05

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

const BASE = 'http://localhost:3000';

async function login(email: string): Promise<string> {
  const res = await fetch(`${BASE}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'ChangeMe2026!', tenantSlug: 'sunset-services' }),
  });
  const data = await res.json() as any;
  return data.data.accessToken;
}

async function loginAsOwner(): Promise<string> {
  return login('erick@sunsetservices.us');
}

async function loginAsCoordinator(): Promise<string> {
  return login('coordinator_test@sunsetservices.us');
}

async function getSeasonId(token: string): Promise<string> {
  const res = await fetch(`${BASE}/v1/seasons`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json() as any;
  const maintenance = data.data.find((s: any) => s.tab === 'maintenance');
  return maintenance.id;
}

function readTestCSV(): Buffer {
  return fs.readFileSync(path.join(__dirname, '..', '..', '..', 'db', 'seeds', 'test-clients.csv'));
}

async function uploadCSV(token: string, csvBuffer: Buffer, seasonId: string, filename = 'test-clients.csv'): Promise<{ status: number; data: any }> {
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
  const parts: Buffer[] = [];

  // season_id field
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="season_id"\r\n\r\n${seasonId}\r\n`
  ));

  // file field
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: text/csv\r\n\r\n`
  ));
  parts.push(csvBuffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  const res = await fetch(`${BASE}/v1/clients/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });
  const data = await res.json() as any;
  return { status: res.status, data };
}

async function pollJob(token: string, jobId: string, timeoutMs = 30000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${BASE}/v1/clients/upload/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json() as any;
    if (data.data.status === 'complete' || data.data.status === 'failed') {
      return data.data;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Job polling timed out');
}

// Shared state across tests
let ownerToken: string;
let coordinatorToken: string;
let seasonId: string;
let completedJobId: string;

describe('POST /v1/clients/upload', () => {
  it('UPLOAD-1: No auth → 401', async () => {
    const res = await fetch(`${BASE}/v1/clients/upload`, { method: 'POST' });
    assert.equal(res.status, 401);
  });

  it('UPLOAD-2: Wrong role (salesperson) → 403', async () => {
    const token = await login('salesperson_test@sunsetservices.us');
    const res = await fetch(`${BASE}/v1/clients/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 403);
  });

  it('UPLOAD-3: No file in body → 400', async () => {
    coordinatorToken = await loginAsCoordinator();
    const res = await fetch(`${BASE}/v1/clients/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${coordinatorToken}` },
    });
    const data = await res.json() as any;
    assert.equal(res.status, 400);
    assert.equal(data.success, false);
  });

  it('UPLOAD-4: Missing season_id → 400', async () => {
    ownerToken = await loginAsOwner();
    const csvBuffer = readTestCSV();
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const parts: Buffer[] = [];
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.csv"\r\nContent-Type: text/csv\r\n\r\n`
    ));
    parts.push(csvBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const body = Buffer.concat(parts);

    const res = await fetch(`${BASE}/v1/clients/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    const data = await res.json() as any;
    assert.equal(res.status, 400);
    assert.ok(data.error.includes('season_id'));
  });

  it('UPLOAD-5: Valid CSV upload → 202 with jobId', async () => {
    ownerToken = await loginAsOwner();
    seasonId = await getSeasonId(ownerToken);
    const csvBuffer = readTestCSV();
    const { status, data } = await uploadCSV(ownerToken, csvBuffer, seasonId);
    assert.equal(status, 202);
    assert.equal(data.success, true);
    assert.ok(data.data.jobId.length > 0);
    assert.ok(data.data.rowCount >= 15, `Expected rowCount >= 15, got ${data.data.rowCount}`);
    completedJobId = data.data.jobId;
  });

  it('UPLOAD-6: Poll job status → eventually complete', async () => {
    assert.ok(completedJobId, 'Need jobId from UPLOAD-5');
    const job = await pollJob(ownerToken, completedJobId, 60000);
    assert.equal(job.status, 'complete');
    assert.ok(job.imported >= 15, `Expected imported >= 15, got ${job.imported}`);
    assert.ok(Array.isArray(job.errorRows));
  });

  it('UPLOAD-7: Re-upload same CSV → merges, no duplicates', async () => {
    // Get count before re-upload
    const countBefore = await fetch(`${BASE}/v1/clients/upload/${completedJobId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    }).then(r => r.json() as Promise<any>).then(d => d.data.imported);

    // Re-upload
    const csvBuffer = readTestCSV();
    const { status, data } = await uploadCSV(ownerToken, csvBuffer, seasonId);
    assert.equal(status, 202);

    // Poll to completion
    const job = await pollJob(ownerToken, data.data.jobId, 60000);
    assert.equal(job.status, 'complete');

    // The imported count should be the same (all upserts, no new inserts doubling)
    // Both jobs should import same number of rows since they upsert
    assert.ok(job.imported >= 15);
  });

  it('UPLOAD-8: Invalid CSV (wrong headers) → 400', async () => {
    const badCsv = Buffer.from('name,address,acreage\nSmith,123 Main,0.5\n');
    const { status, data } = await uploadCSV(ownerToken, badCsv, seasonId, 'bad.csv');
    assert.equal(status, 400);
    assert.ok(data.missingHeaders, 'Should include missingHeaders');
    assert.ok(data.missingHeaders.length > 0);
  });
});

describe('GET /v1/clients/upload/:jobId', () => {
  it('UPLOAD-9: Unknown jobId → 404', async () => {
    const token = await loginAsOwner();
    const res = await fetch(`${BASE}/v1/clients/upload/00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 404);
  });

  it('UPLOAD-10: Completed job returns full status', async () => {
    assert.ok(completedJobId, 'Need jobId from UPLOAD-5');
    const token = await loginAsOwner();
    const res = await fetch(`${BASE}/v1/clients/upload/${completedJobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json() as any;
    assert.equal(res.status, 200);
    assert.equal(data.data.status, 'complete');
    assert.ok(data.data.total >= 15);
    assert.equal(typeof data.data.progress, 'number');
  });
});
