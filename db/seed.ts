// db/seed.ts
// Seed runner — executes seed SQL files against the database
// Last modified: 2026-03-04

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function seed(): Promise<void> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('Connected to database');

  // Check if Sunset Services tenant already exists
  const existing = await client.query(
    "SELECT id FROM tenants WHERE slug = 'sunset-services'"
  );

  if (existing.rowCount && existing.rowCount > 0) {
    console.log('Sunset Services tenant already exists — skipping seed.');
    await client.end();
    process.exit(0);
  }

  // Run the seed file
  const seedFile = path.join(__dirname, 'seeds', '001_sunset_services.sql');
  const sql = fs.readFileSync(seedFile, 'utf-8');

  try {
    await client.query(sql);
    console.log('  OK: 001_sunset_services.sql');
    console.log('');
    console.log('Seeded:');
    console.log('  - 1 tenant (Sunset Services US)');
    console.log('  - 1 user (erick@sunsetservices.us)');
    console.log('  - 3 crews (MAINT-1, MAINT-2, MAINT-3)');
    console.log('  - 2 seasons (2026 Maintenance, 2026 Snow)');
    console.log('  - 18 routes (15 maintenance + 3 snow)');
    console.log('  - 5 zone configs (A–E)');
    console.log('  - 9 zone boundary rules');
  } catch (err) {
    console.error('FAIL: 001_sunset_services.sql');
    console.error(err);
    await client.end();
    process.exit(1);
  }

  await client.end();
}

seed();
