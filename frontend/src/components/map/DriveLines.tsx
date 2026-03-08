import { useEffect, useRef } from 'react';
import { useMap } from './MapCanvas';
import { useLayerStore } from '../../store/layerStore';
import type { RouteWithSummary } from '../../types/map.types';

const ROUTE_COLOURS: Record<string, string> = {
  A: '#2E75B6',
  B: '#2E8B57',
  C: '#6B3FA0',
  D: '#D4760A',
  E: '#0D7377',
};
const GREY = '#9E9E9E';

function getColour(routeLabel: string, zoneLabel: string | null): string {
  const label = routeLabel || zoneLabel || '';
  for (const key of Object.keys(ROUTE_COLOURS)) {
    if (label.includes(key)) return ROUTE_COLOURS[key];
  }
  return GREY;
}

interface DriveLinesProps {
  routes: RouteWithSummary[];
}

export function DriveLines({ routes }: DriveLinesProps) {
  const map = useMap();
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const driveLines = useLayerStore((s) => s.driveLines);

  useEffect(() => {
    // Clear old polylines
    for (const p of polylinesRef.current) p.setMap(null);
    polylinesRef.current = [];

    if (!map || !driveLines) return;

    for (const r of routes) {
      const stops = r.stops.filter((s) => s.address_lat != null && s.address_lng != null);
      if (stops.length === 0) continue;

      const depot = { lat: Number(r.route.depot_lat), lng: Number(r.route.depot_lng) };
      const path: google.maps.LatLngLiteral[] = [depot];

      for (const s of stops) {
        path.push({ lat: Number(s.address_lat!), lng: Number(s.address_lng!) });
      }

      path.push(depot);

      const polyline = new google.maps.Polyline({
        path,
        strokeColor: getColour(r.route.route_label, r.route.zone_label),
        strokeWeight: 2,
        strokeOpacity: 0.7,
        map,
      });

      polylinesRef.current.push(polyline);
    }

    return () => {
      for (const p of polylinesRef.current) p.setMap(null);
      polylinesRef.current = [];
    };
  }, [map, routes, driveLines]);

  return null;
}
