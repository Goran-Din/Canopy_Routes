// api/src/services/csv-parse.service.ts
// CSV parsing, header validation, row validation, and deduplication
// Last modified: 2026-03-05

import Papa from 'papaparse';
import { RawCsvRow, ValidatedRow, ValidationResult } from '../types/upload.types';

export const REQUIRED_HEADERS = ['client_name', 'service_address', 'city', 'state', 'zip', 'acres'];

export function parseCSVBuffer(buffer: Buffer): { headers: string[]; rows: RawCsvRow[]; parseErrors: string[] } {
  const text = buffer.toString('utf-8');
  const result = Papa.parse<RawCsvRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim().toLowerCase(),
  });

  const parseErrors = (result.errors || []).map(
    (e) => `Row ${e.row !== undefined ? e.row + 2 : '?'}: ${e.message}`
  );

  return {
    headers: result.meta.fields || [],
    rows: result.data,
    parseErrors,
  };
}

export function validateHeaders(headers: string[]): { valid: boolean; missingHeaders: string[] } {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const missing = REQUIRED_HEADERS.filter((r) => !lower.includes(r));
  return { valid: missing.length === 0, missingHeaders: missing };
}

function parseBool(val: string | undefined, defaultVal: boolean): boolean {
  if (!val || val.trim() === '') return defaultVal;
  const v = val.trim().toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(v)) return true;
  if (['false', 'no', 'n', '0'].includes(v)) return false;
  return defaultVal;
}

const VALID_CLIENT_TYPES = ['residential', 'commercial'] as const;
const VALID_FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'as_needed'] as const;
const VALID_STATUSES = ['confirmed', 'pending', 'new', 'at_risk', 'inactive'] as const;
const VALID_SNOW_CONTRACTS = ['monthly_fixed', 'per_run', 'none'] as const;

export function validateRows(rows: RawCsvRow[]): ValidationResult {
  const valid: ValidatedRow[] = [];
  const errors: ValidationResult['errors'] = [];
  const warnings: ValidationResult['warnings'] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const rowWarnings: string[] = [];
    const clientName = (row.client_name || '').trim();
    const serviceAddress = (row.service_address || '').trim();
    const city = (row.city || '').trim();
    const state = (row.state || '').trim();
    const zipRaw = (row.zip || '').trim();

    // Required field validation
    const errorParts: string[] = [];
    if (!clientName) errorParts.push('client_name is required');
    else if (clientName.length > 255) errorParts.push('client_name exceeds 255 characters');
    if (!serviceAddress) errorParts.push('service_address is required');
    if (!city) errorParts.push('city is required');
    if (!state) errorParts.push('state is required');
    else if (!/^[A-Za-z]{2}$/.test(state)) errorParts.push('state must be 2 letters');
    if (!zipRaw) errorParts.push('zip is required');
    else if (!/^\d{5}$/.test(zipRaw)) errorParts.push('zip must be 5 digits');

    // Acres: empty → 0, non-numeric → error
    const acresRaw = (row.acres || '').trim();
    let acres = 0;
    if (acresRaw !== '') {
      acres = parseFloat(acresRaw);
      if (isNaN(acres) || acres < 0) {
        errorParts.push('acres must be a number >= 0');
      }
    }

    if (errorParts.length > 0) {
      errors.push({ rowNumber, clientName: clientName || '(empty)', serviceAddress: serviceAddress || '(empty)', errorMessage: errorParts.join('; ') });
      return;
    }

    // Optional: client_type
    let clientType: 'residential' | 'commercial' = 'residential';
    if (row.client_type && row.client_type.trim()) {
      const ct = row.client_type.trim().toLowerCase() as any;
      if (VALID_CLIENT_TYPES.includes(ct)) {
        clientType = ct;
      } else {
        rowWarnings.push(`Invalid client_type '${row.client_type.trim()}', defaulting to 'residential'`);
        warnings.push({ rowNumber, field: 'client_type', warningMessage: `Invalid value '${row.client_type.trim()}', defaulting to 'residential'` });
      }
    }

    // Optional: acreage_confirmed
    let acreageConfirmed = parseBool(row.acreage_confirmed, false);
    if (acres === 0) acreageConfirmed = false;

    // Optional: service_frequency
    let serviceFrequency: 'weekly' | 'biweekly' | 'monthly' | 'as_needed' = 'weekly';
    if (row.service_frequency && row.service_frequency.trim()) {
      const sf = row.service_frequency.trim().toLowerCase() as any;
      if (VALID_FREQUENCIES.includes(sf)) {
        serviceFrequency = sf;
      } else {
        rowWarnings.push(`Invalid service_frequency '${row.service_frequency.trim()}', defaulting to 'weekly'`);
        warnings.push({ rowNumber, field: 'service_frequency', warningMessage: `Invalid value '${row.service_frequency.trim()}', defaulting to 'weekly'` });
      }
    }

    // Optional: client_status
    let clientStatus: 'confirmed' | 'pending' | 'new' | 'at_risk' | 'inactive' = 'confirmed';
    if (row.client_status && row.client_status.trim()) {
      const cs = row.client_status.trim().toLowerCase() as any;
      if (VALID_STATUSES.includes(cs)) {
        clientStatus = cs;
      } else {
        rowWarnings.push(`Invalid client_status '${row.client_status.trim()}', defaulting to 'confirmed'`);
        warnings.push({ rowNumber, field: 'client_status', warningMessage: `Invalid value '${row.client_status.trim()}', defaulting to 'confirmed'` });
      }
    }

    // Optional: annual_revenue
    let annualRevenue: number | null = null;
    if (row.annual_revenue && row.annual_revenue.trim()) {
      const ar = parseFloat(row.annual_revenue.trim());
      if (!isNaN(ar) && ar >= 0) annualRevenue = ar;
    }

    // Optional: snow fields
    const snowService = parseBool(row.snow_service, false);
    let snowContractType: 'monthly_fixed' | 'per_run' | 'none' = 'none';
    if (row.snow_contract_type && row.snow_contract_type.trim()) {
      const sc = row.snow_contract_type.trim().toLowerCase() as any;
      if (VALID_SNOW_CONTRACTS.includes(sc)) snowContractType = sc;
    }

    // Optional: billing_accounts
    let billingAccounts = 1;
    if (row.billing_accounts && row.billing_accounts.trim()) {
      const ba = parseInt(row.billing_accounts.trim(), 10);
      if (!isNaN(ba) && ba >= 1) billingAccounts = ba;
    }

    valid.push({
      clientName,
      serviceAddress,
      city,
      state: state.toUpperCase(),
      zip: zipRaw,
      acres,
      clientType,
      acreageConfirmed,
      serviceFrequency,
      clientStatus,
      annualRevenue,
      snowService,
      snowContractType,
      priorRoute: row.prior_route?.trim() || null,
      priorDay: row.prior_day?.trim() || null,
      priorCrew: row.prior_crew?.trim() || null,
      timeConstraints: row.time_constraints?.trim() || null,
      accessNotes: row.access_notes?.trim() || null,
      billingAccounts,
      externalId: row.external_id?.trim() || null,
      propertyNotes: row.notes?.trim() || null,
      rowNumber,
      warnings: rowWarnings,
    });
  });

  return { valid, errors, warnings };
}

export function deduplicateRows(rows: ValidatedRow[]): ValidatedRow[] {
  const seen = new Map<string, ValidatedRow>();
  const counts = new Map<string, number>();

  for (const row of rows) {
    const key = `${row.serviceAddress.toLowerCase().trim()}|${row.city.toLowerCase().trim()}|${row.zip.trim()}`;
    counts.set(key, (counts.get(key) || 0) + 1);
    if (!seen.has(key)) {
      seen.set(key, row);
    }
  }

  const result: ValidatedRow[] = [];
  for (const [key, row] of seen) {
    row.billingAccounts = counts.get(key)!;
    result.push(row);
  }

  return result;
}
