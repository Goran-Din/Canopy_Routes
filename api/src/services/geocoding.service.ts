// api/src/services/geocoding.service.ts
// Google Maps Geocoding API client with mock mode for development
// Last modified: 2026-03-05

import axios from 'axios';
import winston from 'winston';
import { ValidatedRow } from '../types/upload.types';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

export interface GeocodedResult {
  lat: number | null;
  lng: number | null;
  geocodeStatus: 'success' | 'failed' | 'pending';
  partialMatch: boolean;
  formattedAddress: string | null;
}

const ACCEPTABLE_LOCATION_TYPES = ['ROOFTOP', 'RANGE_INTERPOLATED', 'GEOMETRIC_CENTER'];

function isMockMode(): boolean {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  return !key || key === 'REPLACE_WITH_KEY';
}

export function buildAddressString(row: Pick<ValidatedRow, 'serviceAddress' | 'city' | 'state' | 'zip'>): string {
  return `${row.serviceAddress}, ${row.city}, ${row.state} ${row.zip}, USA`;
}

export async function geocodeAddress(addressString: string): Promise<GeocodedResult> {
  if (isMockMode()) {
    logger.debug('Geocoding: using mock mode (no API key configured)');
    return {
      lat: 41.7489370,
      lng: -88.2673730,
      geocodeStatus: 'success',
      partialMatch: false,
      formattedAddress: addressString + ' (MOCK)',
    };
  }

  try {
    const res = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: addressString,
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
    });

    const data = res.data;
    if (
      data.status === 'OK' &&
      data.results?.[0]?.geometry?.location &&
      ACCEPTABLE_LOCATION_TYPES.includes(data.results[0].geometry.location_type)
    ) {
      const result = data.results[0];
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        geocodeStatus: 'success',
        partialMatch: result.partial_match ?? false,
        formattedAddress: result.formatted_address,
      };
    }

    return { lat: null, lng: null, geocodeStatus: 'failed', partialMatch: false, formattedAddress: null };
  } catch (err) {
    logger.warn({ message: 'Geocoding API error', address: addressString, error: (err as Error).message });
    return { lat: null, lng: null, geocodeStatus: 'failed', partialMatch: false, formattedAddress: null };
  }
}

export async function geocodeBatch(rows: ValidatedRow[]): Promise<Array<ValidatedRow & GeocodedResult>> {
  const results: Array<ValidatedRow & GeocodedResult> = [];
  const batchSize = 50;
  const totalBatches = Math.ceil(rows.length / batchSize);

  for (let i = 0; i < rows.length; i += batchSize) {
    const batchNum = Math.floor(i / batchSize) + 1;
    const batch = rows.slice(i, i + batchSize);
    logger.info(`Geocoding batch ${batchNum}/${totalBatches}: ${batch.length} addresses`);

    const geoResults = await Promise.all(
      batch.map((row) => geocodeAddress(buildAddressString(row)))
    );

    for (let j = 0; j < batch.length; j++) {
      results.push({ ...batch[j], ...geoResults[j] });
    }

    if (i + batchSize < rows.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return results;
}
