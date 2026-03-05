// db/migrate.ts
// Database migration runner — reads and executes .sql files sequentially
// Last modified: 2026-03-04

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function migrate(): Promise<void> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('Connected to database');

  // Create migrations_log table if it doesn't exist
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations_log (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Read all .sql files from migrations/ in alphabetical order
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter((f: string) => f.endsWith('.sql'))
    .sort();

  // Get already-run migrations
  const result = await client.query('SELECT filename FROM migrations_log');
  const executed = new Set(result.rows.map((r: { filename: string }) => r.filename));

  let ranCount = 0;

  for (const file of files) {
    if (executed.has(file)) {
      console.log(`SKIP: ${file} (already executed)`);
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO migrations_log (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  OK: ${file}`);
      ranCount++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`FAIL: ${file}`);
      console.error(err);
      await client.end();
      process.exit(1);
    }
  }

  console.log(`\nMigrations complete. ${ranCount} new, ${executed.size} previously run.`);
  await client.end();
}

migrate();
