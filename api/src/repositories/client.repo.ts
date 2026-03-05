// api/src/repositories/client.repo.ts
// Database queries for rpw_clients — parameterised SQL only, no string interpolation
// Last modified: 2026-03-05

import { pool } from '../db/pool';
import { ValidatedRow } from '../types/upload.types';
import { GeocodedResult } from '../services/geocoding.service';

export async function upsertClient(
  tenantId: string,
  seasonId: string,
  row: ValidatedRow & GeocodedResult
): Promise<{ id: string; wasInsert: boolean }> {
  // Match key: normalized address + city + zip
  const existing = await pool.query<{ id: string; geocode_status: string }>(
    `SELECT id, geocode_status FROM rpw_clients
     WHERE tenant_id = $1
       AND LOWER(TRIM(service_address)) = $2
       AND LOWER(TRIM(city)) = $3
       AND TRIM(zip) = $4
       AND deleted_at IS NULL
     LIMIT 1`,
    [tenantId, row.serviceAddress.toLowerCase().trim(), row.city.toLowerCase().trim(), row.zip.trim()]
  );

  if (existing.rows.length > 0) {
    const record = existing.rows[0];
    const shouldUpdateGeo = record.geocode_status === 'pending' || record.geocode_status === 'failed';

    if (shouldUpdateGeo) {
      await pool.query(
        `UPDATE rpw_clients SET
          client_name = $2, client_type = $3, acres = $4, acreage_confirmed = $5,
          service_frequency = $6, client_status = $7, annual_revenue = $8,
          snow_service = $9, snow_contract_type = $10, billing_accounts = $11,
          time_constraints = $12, access_notes = $13, property_notes = $14,
          prior_route = $15, prior_crew = $16, external_id = $17,
          address_lat = $18, address_lng = $19, geocode_status = $20,
          updated_at = NOW()
         WHERE id = $1`,
        [
          record.id, row.clientName, row.clientType, row.acres, row.acreageConfirmed,
          row.serviceFrequency, row.clientStatus, row.annualRevenue,
          row.snowService, row.snowContractType, row.billingAccounts,
          row.timeConstraints, row.accessNotes, row.propertyNotes,
          row.priorRoute, row.priorCrew, row.externalId,
          row.lat, row.lng, row.geocodeStatus,
        ]
      );
    } else {
      await pool.query(
        `UPDATE rpw_clients SET
          client_name = $2, client_type = $3, acres = $4, acreage_confirmed = $5,
          service_frequency = $6, client_status = $7, annual_revenue = $8,
          snow_service = $9, snow_contract_type = $10, billing_accounts = $11,
          time_constraints = $12, access_notes = $13, property_notes = $14,
          prior_route = $15, prior_crew = $16, external_id = $17,
          updated_at = NOW()
         WHERE id = $1`,
        [
          record.id, row.clientName, row.clientType, row.acres, row.acreageConfirmed,
          row.serviceFrequency, row.clientStatus, row.annualRevenue,
          row.snowService, row.snowContractType, row.billingAccounts,
          row.timeConstraints, row.accessNotes, row.propertyNotes,
          row.priorRoute, row.priorCrew, row.externalId,
        ]
      );
    }

    return { id: record.id, wasInsert: false };
  }

  // INSERT new client
  const insertResult = await pool.query<{ id: string }>(
    `INSERT INTO rpw_clients (
      tenant_id, client_name, service_address, city, state, zip,
      client_type, acres, acreage_confirmed, service_frequency, client_status,
      annual_revenue, snow_service, snow_contract_type, billing_accounts,
      time_constraints, access_notes, property_notes, prior_route, prior_crew,
      external_id, address_lat, address_lng, geocode_status
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11,
      $12, $13, $14, $15,
      $16, $17, $18, $19, $20,
      $21, $22, $23, $24
    ) RETURNING id`,
    [
      tenantId, row.clientName, row.serviceAddress, row.city, row.state, row.zip,
      row.clientType, row.acres, row.acreageConfirmed, row.serviceFrequency, row.clientStatus,
      row.annualRevenue, row.snowService, row.snowContractType, row.billingAccounts,
      row.timeConstraints, row.accessNotes, row.propertyNotes, row.priorRoute, row.priorCrew,
      row.externalId, row.lat, row.lng, row.geocodeStatus,
    ]
  );

  return { id: insertResult.rows[0].id, wasInsert: true };
}

export async function updateGeocodeStatus(
  tenantId: string,
  clientId: string,
  lat: number | null,
  lng: number | null,
  status: string
): Promise<void> {
  await pool.query(
    `UPDATE rpw_clients SET address_lat = $3, address_lng = $4, geocode_status = $5, updated_at = NOW()
     WHERE id = $2 AND tenant_id = $1`,
    [tenantId, clientId, lat, lng, status]
  );
}

export async function getClientsByTenant(
  tenantId: string
): Promise<Array<{ id: string; clientName: string; geocodeStatus: string; addressLat: number | null; addressLng: number | null }>> {
  const result = await pool.query<{ id: string; client_name: string; geocode_status: string; address_lat: number | null; address_lng: number | null }>(
    `SELECT id, client_name, geocode_status, address_lat, address_lng
     FROM rpw_clients WHERE tenant_id = $1 AND deleted_at IS NULL
     ORDER BY client_name ASC`,
    [tenantId]
  );
  return result.rows.map((r) => ({
    id: r.id,
    clientName: r.client_name,
    geocodeStatus: r.geocode_status,
    addressLat: r.address_lat,
    addressLng: r.address_lng,
  }));
}
