import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { AuthenticatedRequest } from '../types/auth.types';
import { getClientsBySeason } from '../repositories/client.repo';
import { pool } from '../db/pool';
import { geocodeAddress } from '../services/geocoding.service';

const router = Router();

router.get('/v1/clients', authenticateToken, (async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const seasonId = req.query.season_id as string;
  const serviceType = req.query.service_type as string | undefined;

  if (!seasonId) {
    res.status(400).json({ success: false, error: 'season_id query parameter is required.' });
    return;
  }

  let clients = await getClientsBySeason(tenantId, seasonId);

  // Optional service_type filter (mow, plow, salt, plow_salt)
  if (serviceType) {
    clients = clients.filter((c: any) => c.service_type === serviceType);
  }

  res.json({ success: true, data: clients });
}) as any);

router.post('/v1/clients/:id/retry-geocode', authenticateToken, (async (_req: AuthenticatedRequest, res: Response) => {
  res.status(501).json({ success: false, error: 'Geocode retry not yet implemented (Sprint 11).' });
}) as any);

// ── POST /v1/clients — Create a single client with geocoding ──

const createClientSchema = z.object({
  client_name: z.string().min(1),
  service_address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1).default('IL'),
  zip: z.string().min(1),
  acres: z.number().positive(),
  service_frequency: z.enum(['weekly', 'biweekly', 'monthly']),
  client_status: z.string().optional().default('new'),
  annual_revenue: z.number().optional(),
  snow_service: z.boolean().optional().default(false),
  service_type: z.enum(['mow', 'plow', 'salt', 'plow_salt']).optional().default('mow'),
  snow_priority: z.number().int().min(1).max(5).optional(),
  lot_size_sqft: z.number().int().positive().optional(),
  time_constraints: z.string().optional(),
  access_notes: z.string().optional(),
});

router.post('/v1/clients', authenticateToken, requireRole('owner', 'coordinator'), (async (req: AuthenticatedRequest, res: Response) => {
  const parsed = createClientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  const tenantId = req.user!.tenantId;
  const d = parsed.data;

  // Insert with geocode_status = 'pending'
  const insertResult = await pool.query<{ id: string }>(
    `INSERT INTO rpw_clients (
      tenant_id, client_name, service_address, city, state, zip,
      acres, service_frequency, client_status, annual_revenue,
      snow_service, service_type, snow_priority, lot_size_sqft,
      time_constraints, access_notes, geocode_status
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10,
      $11, $12, $13, $14,
      $15, $16, 'pending'
    ) RETURNING id`,
    [
      tenantId, d.client_name, d.service_address, d.city, d.state, d.zip,
      d.acres, d.service_frequency, d.client_status, d.annual_revenue ?? null,
      d.snow_service, d.service_type ?? 'mow', d.snow_priority ?? null, d.lot_size_sqft ?? null,
      d.time_constraints ?? null, d.access_notes ?? null,
    ]
  );

  const clientId = insertResult.rows[0].id;

  // Attempt geocoding
  const addressString = `${d.service_address}, ${d.city}, ${d.state} ${d.zip}`;
  const geo = await geocodeAddress(addressString);

  if (geo.geocodeStatus === 'success') {
    await pool.query(
      `UPDATE rpw_clients SET address_lat = $1, address_lng = $2, geocode_status = 'success', updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4`,
      [geo.lat, geo.lng, clientId, tenantId]
    );
  } else {
    await pool.query(
      `UPDATE rpw_clients SET geocode_status = 'failed', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [clientId, tenantId]
    );
  }

  // Return the full client row
  const clientRow = await pool.query(
    `SELECT * FROM rpw_clients WHERE id = $1 AND tenant_id = $2`,
    [clientId, tenantId]
  );

  res.status(201).json({ success: true, data: clientRow.rows[0] });
}) as any);

// ── PATCH /v1/clients/:id/status — Update client status ──

const updateStatusSchema = z.object({
  client_status: z.enum(['confirmed', 'pending', 'new', 'at_risk', 'inactive']),
});

router.patch('/v1/clients/:id/status', authenticateToken, requireRole('owner', 'coordinator'), (async (req: AuthenticatedRequest, res: Response) => {
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  const tenantId = req.user!.tenantId;
  const clientId = req.params.id;

  const result = await pool.query(
    `UPDATE rpw_clients SET client_status = $1, updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL
     RETURNING *`,
    [parsed.data.client_status, clientId, tenantId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ success: false, error: 'Client not found.' });
    return;
  }

  res.json({ success: true, data: result.rows[0] });
}) as any);

// ── PATCH /v1/clients/:id — General-purpose field update ──

// ── PATCH /v1/clients/:id/snow-fields — Update snow-specific fields ──

const snowFieldsSchema = z.object({
  service_type: z.enum(['mow', 'plow', 'salt', 'plow_salt']).optional(),
  snow_priority: z.number().int().min(1).max(5).optional(),
  lot_size_sqft: z.number().int().positive().nullable().optional(),
});

router.patch('/v1/clients/:id/snow-fields', authenticateToken, requireRole('owner', 'coordinator'), (async (req: AuthenticatedRequest, res: Response) => {
  const parsed = snowFieldsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  const fields = parsed.data;
  if (Object.keys(fields).length === 0) {
    res.status(400).json({ success: false, error: 'No fields to update.' });
    return;
  }

  const tenantId = req.user!.tenantId;
  const clientId = req.params.id;

  const setClauses: string[] = [];
  const values: any[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(fields)) {
    setClauses.push(`${key} = $${idx}`);
    values.push(value);
    idx++;
  }
  setClauses.push(`updated_at = NOW()`);

  values.push(clientId, tenantId);
  const result = await pool.query(
    `UPDATE rpw_clients SET ${setClauses.join(', ')}
     WHERE id = $${idx} AND tenant_id = $${idx + 1} AND deleted_at IS NULL
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    res.status(404).json({ success: false, error: 'Client not found.' });
    return;
  }

  res.json({ success: true, data: result.rows[0] });
}) as any);

const updateClientSchema = z.object({
  client_name: z.string().min(1).optional(),
  service_address: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  zip: z.string().min(1).optional(),
  acres: z.number().positive().optional(),
  service_frequency: z.enum(['weekly', 'biweekly', 'monthly']).optional(),
  client_status: z.enum(['confirmed', 'pending', 'new', 'at_risk', 'inactive']).optional(),
  annual_revenue: z.number().nullable().optional(),
  snow_service: z.boolean().optional(),
  service_type: z.enum(['mow', 'plow', 'salt', 'plow_salt']).optional(),
  snow_priority: z.number().int().min(1).max(5).optional(),
  lot_size_sqft: z.number().int().positive().nullable().optional(),
  time_constraints: z.string().nullable().optional(),
  access_notes: z.string().nullable().optional(),
  acreage_confirmed: z.boolean().optional(),
});

router.patch('/v1/clients/:id', authenticateToken, requireRole('owner', 'coordinator'), (async (req: AuthenticatedRequest, res: Response) => {
  const parsed = updateClientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  const fields = parsed.data;
  if (Object.keys(fields).length === 0) {
    res.status(400).json({ success: false, error: 'No fields to update.' });
    return;
  }

  const tenantId = req.user!.tenantId;
  const clientId = req.params.id;

  // Build dynamic SET clause
  const setClauses: string[] = [];
  const values: any[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(fields)) {
    setClauses.push(`${key} = $${idx}`);
    values.push(value);
    idx++;
  }
  setClauses.push(`updated_at = NOW()`);

  values.push(clientId, tenantId);
  const result = await pool.query(
    `UPDATE rpw_clients SET ${setClauses.join(', ')}
     WHERE id = $${idx} AND tenant_id = $${idx + 1} AND deleted_at IS NULL
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    res.status(404).json({ success: false, error: 'Client not found.' });
    return;
  }

  // If address fields changed, re-geocode
  if (fields.service_address || fields.city || fields.state || fields.zip) {
    const row = result.rows[0];
    const addressString = `${row.service_address}, ${row.city}, ${row.state} ${row.zip}`;
    const geo = await geocodeAddress(addressString);

    if (geo.geocodeStatus === 'success') {
      await pool.query(
        `UPDATE rpw_clients SET address_lat = $1, address_lng = $2, geocode_status = 'success', updated_at = NOW()
         WHERE id = $3 AND tenant_id = $4`,
        [geo.lat, geo.lng, clientId, tenantId]
      );
    } else {
      await pool.query(
        `UPDATE rpw_clients SET geocode_status = 'failed', updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [clientId, tenantId]
      );
    }

    // Re-fetch after geocode update
    const updated = await pool.query(
      `SELECT * FROM rpw_clients WHERE id = $1 AND tenant_id = $2`,
      [clientId, tenantId]
    );
    res.json({ success: true, data: updated.rows[0] });
    return;
  }

  res.json({ success: true, data: result.rows[0] });
}) as any);

// ── PATCH /v1/clients/:id/coordinates — Manual coordinate override ──

const updateCoordsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

router.patch('/v1/clients/:id/coordinates', authenticateToken, requireRole('owner', 'coordinator'), (async (req: AuthenticatedRequest, res: Response) => {
  const parsed = updateCoordsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  const tenantId = req.user!.tenantId;
  const clientId = req.params.id;

  const result = await pool.query(
    `UPDATE rpw_clients SET address_lat = $1, address_lng = $2, geocode_status = 'manual', updated_at = NOW()
     WHERE id = $3 AND tenant_id = $4 AND deleted_at IS NULL
     RETURNING *`,
    [parsed.data.lat, parsed.data.lng, clientId, tenantId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ success: false, error: 'Client not found.' });
    return;
  }

  res.json({ success: true, data: result.rows[0] });
}) as any);

// ── GET /v1/clients/:id/history — Client history across seasons ──

router.get('/v1/clients/:id/history', authenticateToken, requireRole('owner', 'coordinator'), (async (req: AuthenticatedRequest, res: Response) => {
  const result = await pool.query(
    `SELECT ch.*, s.season_label
     FROM rpw_client_history ch
     LEFT JOIN rpw_seasons s ON s.id = ch.season_id
     WHERE ch.client_id = $1 AND ch.tenant_id = $2
     ORDER BY ch.season_year DESC`,
    [req.params.id, req.user!.tenantId]
  );
  res.json({
    success: true,
    data: result.rows.map((r) => ({
      seasonYear: r.season_year,
      seasonLabel: r.season_label,
      routeName: r.route_name,
      annualRevenue: parseFloat(r.annual_revenue || '0'),
      wasRetained: r.was_retained,
    })),
  });
}) as any);

export { router as clientsRouter };
