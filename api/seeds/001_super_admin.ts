import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const pool = new Pool({
  host: process.env.DB_HOST || 'canopy-routes-db',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'canopy_routes',
  user: process.env.DB_USER || 'canopy',
  password: process.env.DB_PASSWORD || 'canopy_dev',
});

async function seedSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL || 'Gdinov@gmail.com';
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME || 'Goran Dinov';

  if (!password) {
    console.error('ERROR: SUPER_ADMIN_PASSWORD environment variable is required');
    process.exit(1);
  }

  const existing = await pool.query('SELECT id FROM rpw_super_admins WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    console.log(`Super-admin already exists for ${email} — skipping`);
    await pool.end();
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    'INSERT INTO rpw_super_admins (email, name, password_hash) VALUES ($1, $2, $3)',
    [email, name, hash]
  );

  console.log(`Super-admin created: ${email}`);
  await pool.end();
}

seedSuperAdmin().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
