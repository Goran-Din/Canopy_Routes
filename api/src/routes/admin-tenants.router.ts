// api/src/routes/admin-tenants.router.ts
// Super-admin tenant management endpoints

import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { pool } from '../db/pool';
import { requireSuperAdmin } from '../middleware/auth.middleware';

function generateTempPassword(): string {
  return crypto.randomBytes(9).toString('base64url').slice(0, 12);
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function logAction(adminId: string, action: string, targetId: string | null, payload: any) {
  await pool.query(
    'INSERT INTO rpw_admin_audit_log (admin_id, action, target_id, payload) VALUES ($1, $2, $3, $4)',
    [adminId, action, targetId, JSON.stringify(payload)]
  );
}

const router = Router();
router.use(requireSuperAdmin());

// GET / — list all tenants
router.get('/', async (req: any, res) => {
  try {
    const result = await pool.query(`
      SELECT
        t.id, t.name, t.slug, t.status, t.contact_email, t.contact_phone,
        t.logo_url, t.created_at, t.suspended_at,
        COUNT(DISTINCT u.id) as user_count,
        COUNT(DISTINCT s.id) as season_count
      FROM tenants t
      LEFT JOIN users u ON u.tenant_id = t.id AND u.is_active = true
      LEFT JOIN rpw_seasons s ON s.tenant_id = t.id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `);
    res.json({
      success: true,
      data: result.rows.map(r => ({
        id: r.id, name: r.name, slug: r.slug, status: r.status,
        contactEmail: r.contact_email, contactPhone: r.contact_phone,
        logoUrl: r.logo_url, createdAt: r.created_at, suspendedAt: r.suspended_at,
        userCount: parseInt(r.user_count), seasonCount: parseInt(r.season_count),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST / — create new tenant
router.post('/', async (req: any, res) => {
  const { name, slug, contactEmail, contactPhone, logoUrl } = req.body;
  if (!name) return res.status(400).json({ success: false, error: 'name required' });

  const tenantSlug = slug || slugify(name);

  try {
    const existing = await pool.query('SELECT id FROM tenants WHERE slug = $1', [tenantSlug]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Slug already in use' });
    }

    const result = await pool.query(
      `INSERT INTO tenants (name, slug, contact_email, contact_phone, logo_url, status)
       VALUES ($1, $2, $3, $4, $5, 'onboarding')
       RETURNING id, name, slug, status, created_at`,
      [name, tenantSlug, contactEmail || null, contactPhone || null, logoUrl || null]
    );

    const tenant = result.rows[0];

    // Create default cost config
    await pool.query(
      `INSERT INTO rpw_cost_config (tenant_id, labor_rate, crew_size, fuel_cost_per_mile, equipment_cost_per_hour, overhead_rate_percent)
       VALUES ($1, 18.00, 2, 0.21, 4.50, 12.0)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [tenant.id]
    );

    await logAction(req.adminId, 'create_tenant', tenant.id, { name, slug: tenantSlug });

    res.status(201).json({ success: true, data: { id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /:slug — tenant detail
router.get('/:slug', async (req: any, res) => {
  try {
    const tenantResult = await pool.query('SELECT * FROM tenants WHERE slug = $1', [req.params.slug]);
    if (tenantResult.rows.length === 0) return res.status(404).json({ success: false, error: 'Tenant not found' });
    const t = tenantResult.rows[0];

    const usersResult = await pool.query(
      'SELECT id, display_name as name, email, role, must_change_password, created_at FROM users WHERE tenant_id = $1 AND is_active = true ORDER BY created_at',
      [t.id]
    );

    const costResult = await pool.query('SELECT * FROM rpw_cost_config WHERE tenant_id = $1', [t.id]);
    const zoneResult = await pool.query('SELECT * FROM rpw_zone_config WHERE tenant_id = $1 ORDER BY zone_label', [t.id]);

    res.json({
      success: true,
      data: {
        id: t.id, name: t.name, slug: t.slug, status: t.status,
        contactEmail: t.contact_email, contactPhone: t.contact_phone,
        logoUrl: t.logo_url, createdAt: t.created_at, suspendedAt: t.suspended_at,
        users: usersResult.rows,
        costConfig: costResult.rows[0] || null,
        zoneCount: zoneResult.rows.length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /:slug — update profile
router.patch('/:slug', async (req: any, res) => {
  const { name, contactEmail, contactPhone, logoUrl } = req.body;
  try {
    const tenantResult = await pool.query('SELECT id FROM tenants WHERE slug = $1', [req.params.slug]);
    if (tenantResult.rows.length === 0) return res.status(404).json({ success: false, error: 'Tenant not found' });
    const tenantId = tenantResult.rows[0].id;

    await pool.query(
      `UPDATE tenants SET
        name = COALESCE($1, name),
        contact_email = COALESCE($2, contact_email),
        contact_phone = COALESCE($3, contact_phone),
        logo_url = COALESCE($4, logo_url)
       WHERE id = $5`,
      [name || null, contactEmail || null, contactPhone || null, logoUrl || null, tenantId]
    );

    await logAction(req.adminId, 'update_tenant', tenantId, req.body);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /:slug/activate
router.post('/:slug/activate', async (req: any, res) => {
  try {
    const result = await pool.query(
      "UPDATE tenants SET status = 'active', suspended_at = NULL WHERE slug = $1 RETURNING id",
      [req.params.slug]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Tenant not found' });
    await logAction(req.adminId, 'activate_tenant', result.rows[0].id, {});
    res.json({ success: true, data: { status: 'active' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /:slug/suspend
router.post('/:slug/suspend', async (req: any, res) => {
  const { reason } = req.body;
  try {
    const result = await pool.query(
      "UPDATE tenants SET status = 'suspended', suspended_at = NOW() WHERE slug = $1 RETURNING id",
      [req.params.slug]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Tenant not found' });
    await logAction(req.adminId, 'suspend_tenant', result.rows[0].id, { reason });
    res.json({ success: true, data: { status: 'suspended' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /:slug/users — create user for tenant
router.post('/:slug/users', async (req: any, res) => {
  const { name, email, role = 'owner' } = req.body;
  if (!name || !email) return res.status(400).json({ success: false, error: 'name and email required' });

  try {
    const tenantResult = await pool.query('SELECT id FROM tenants WHERE slug = $1', [req.params.slug]);
    if (tenantResult.rows.length === 0) return res.status(404).json({ success: false, error: 'Tenant not found' });
    const tenantId = tenantResult.rows[0].id;

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) return res.status(409).json({ success: false, error: 'Email already in use' });

    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 12);

    const userResult = await pool.query(
      `INSERT INTO users (tenant_id, display_name, email, password_hash, role, must_change_password)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, display_name as name, email, role`,
      [tenantId, name, email.toLowerCase(), hash, role]
    );

    await logAction(req.adminId, 'create_user', tenantId, { name, email, role });

    res.status(201).json({
      success: true,
      data: {
        user: userResult.rows[0],
        tempPassword,
        note: 'User must change password on first login',
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /:slug/cost-config
router.post('/:slug/cost-config', async (req: any, res) => {
  const { laborRate, crewSize, fuelCostPerMile, equipmentCostPerHour, overheadRatePercent } = req.body;
  try {
    const tenantResult = await pool.query('SELECT id FROM tenants WHERE slug = $1', [req.params.slug]);
    if (tenantResult.rows.length === 0) return res.status(404).json({ success: false, error: 'Tenant not found' });
    const tenantId = tenantResult.rows[0].id;

    await pool.query(
      `INSERT INTO rpw_cost_config (tenant_id, labor_rate, crew_size, fuel_cost_per_mile, equipment_cost_per_hour, overhead_rate_percent)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id) DO UPDATE SET
         labor_rate = EXCLUDED.labor_rate,
         crew_size = EXCLUDED.crew_size,
         fuel_cost_per_mile = EXCLUDED.fuel_cost_per_mile,
         equipment_cost_per_hour = EXCLUDED.equipment_cost_per_hour,
         overhead_rate_percent = EXCLUDED.overhead_rate_percent`,
      [tenantId, laborRate ?? 18, crewSize ?? 2, fuelCostPerMile ?? 0.21, equipmentCostPerHour ?? 4.50, overheadRatePercent ?? 12]
    );

    await logAction(req.adminId, 'set_cost_config', tenantId, req.body);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /:slug/zone-config
router.post('/:slug/zone-config', async (req: any, res) => {
  const { zones } = req.body;
  // zones: [{ zoneLabel, zoneName, dayOfWeek, crewSlots?, displayColour?, isCommercialDay? }]
  if (!zones?.length) return res.status(400).json({ success: false, error: 'zones array required' });

  try {
    const tenantResult = await pool.query('SELECT id FROM tenants WHERE slug = $1', [req.params.slug]);
    if (tenantResult.rows.length === 0) return res.status(404).json({ success: false, error: 'Tenant not found' });
    const tenantId = tenantResult.rows[0].id;

    const defaultColours = ['#2E75B6', '#2E8B57', '#6B3FA0', '#D4760A', '#0D7377', '#DC2626', '#7C3AED'];
    await pool.query('DELETE FROM rpw_zone_config WHERE tenant_id = $1', [tenantId]);

    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      await pool.query(
        `INSERT INTO rpw_zone_config (tenant_id, zone_label, zone_name, day_of_week, crew_slots, display_colour, is_commercial_day, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [tenantId, z.zoneLabel, z.zoneName, z.dayOfWeek, z.crewSlots ?? 3, z.displayColour ?? defaultColours[i % defaultColours.length], z.isCommercialDay ?? false, i + 1]
      );
    }

    await logAction(req.adminId, 'set_zone_config', tenantId, { zoneCount: zones.length });
    res.json({ success: true, data: { zonesCreated: zones.length } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /audit-log — must be registered BEFORE /:slug to avoid route conflict
// (handled by ordering — Express matches in registration order)

export { router as adminTenantsRouter };
