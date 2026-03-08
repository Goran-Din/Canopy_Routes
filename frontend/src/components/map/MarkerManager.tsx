import { useEffect, useRef } from 'react';
import { useMap } from './MapCanvas';
import { useLayerStore } from '../../store/layerStore';
import { useUIStore } from '../../store/uiStore';
import type { Client, RouteWithSummary, RouteStop } from '../../types/map.types';

const ROUTE_COLOURS: Record<string, string> = {
  A: '#3b82f6',
  B: '#22c55e',
  C: '#a855f7',
  D: '#f97316',
  E: '#14b8a6',
};
const GREY = '#9E9E9E';

const DEPOT = { lat: 41.7606, lng: -88.1381 };

function getRouteColourFromLabel(label: string): string {
  const upper = (label || '').toUpperCase();
  for (const key of Object.keys(ROUTE_COLOURS)) {
    if (upper.includes(key)) return ROUTE_COLOURS[key];
  }
  return '#64748b';
}

function getRouteColour(client: Client, routes: RouteWithSummary[]): string {
  if (!client.assigned_route_id) return GREY;
  const route = routes.find((r) => r.route.id === client.assigned_route_id);
  if (!route) return GREY;
  return getRouteColourFromLabel(route.route.route_label || route.route.zone_label || '');
}

function getStatusBadgeLabel(client: Client): string | null {
  if (client.client_status === 'at_risk') return '!';
  if (client.client_status === 'new') return '+';
  return null;
}

function getStatusBadgeColour(client: Client): string {
  if (client.client_status === 'pending') return '#F59E0B';
  if (client.client_status === 'at_risk') return '#D4760A';
  if (client.client_status === 'new') return '#2E8B57';
  return '#9E9E9E';
}

interface MarkerManagerProps {
  clients: Client[];
  routes: RouteWithSummary[];
  stopsByRouteId: Record<string, RouteStop[]>;
  onClientClick: (client: Client) => void;
}

export function MarkerManager({ clients, routes, stopsByRouteId, onClientClick }: MarkerManagerProps) {
  const map = useMap();
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const { routeColours, clientStatusBadges, acreageFlags } = useLayerStore();
  const selectedRouteId = useUIStore((s) => s.selectedRouteId);

  useEffect(() => {
    if (!map) return;

    // Remove old markers
    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }

    // Build selected-route stop lookup: client_id → sequence_order
    const selectedRoute = selectedRouteId ? routes.find((r) => r.route.id === selectedRouteId) : null;
    const selectedStops = selectedRouteId ? (stopsByRouteId[selectedRouteId] ?? selectedRoute?.stops ?? []) : [];
    const stopSeqMap = new Map<string, number>();
    for (const s of selectedStops) {
      stopSeqMap.set(s.client_id, s.sequence_order);
    }

    const geocoded = clients.filter(
      (c) =>
        (c.geocode_status === 'success' || c.geocode_status === 'manual') &&
        c.address_lat != null &&
        c.address_lng != null
    );

    for (const client of geocoded) {
      const isOnSelectedRoute = selectedRouteId ? stopSeqMap.has(client.id) : false;
      const dimmed = selectedRouteId != null && !isOnSelectedRoute;
      const seqNum = stopSeqMap.get(client.id);

      let colour = routeColours ? getRouteColour(client, routes) : GREY;
      const opacity = dimmed ? 0.25 : 1;
      const scale = isOnSelectedRoute ? 13 : 10;

      // Determine label
      let labelObj: google.maps.MarkerLabel | undefined = undefined;
      if (isOnSelectedRoute && seqNum != null) {
        labelObj = {
          text: String(seqNum + 1).padStart(2, '0'),
          color: '#ffffff',
          fontSize: '9px',
          fontWeight: 'bold',
        };
      }

      const marker = new google.maps.Marker({
        map,
        position: { lat: Number(client.address_lat), lng: Number(client.address_lng) },
        title: client.client_name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale,
          fillColor: colour,
          fillOpacity: opacity,
          strokeColor: '#ffffff',
          strokeWeight: dimmed ? 1 : 2,
        },
        label: labelObj,
        zIndex: isOnSelectedRoute ? 10 : 1,
      });

      // Status badge (only when not in selected-route mode, or when on selected route)
      if (clientStatusBadges && !dimmed && !isOnSelectedRoute) {
        const badgeLabel = getStatusBadgeLabel(client);
        if (badgeLabel) {
          marker.setLabel({
            text: badgeLabel,
            color: '#ffffff',
            fontSize: '10px',
            fontWeight: 'bold',
          });
          marker.setIcon({
            path: google.maps.SymbolPath.CIRCLE,
            scale,
            fillColor: getStatusBadgeColour(client),
            fillOpacity: opacity,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          });
        }
      }

      // Acreage flag
      if (acreageFlags && !client.acreage_confirmed && !dimmed) {
        marker.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          scale,
          fillColor: colour,
          fillOpacity: opacity,
          strokeColor: '#F59E0B',
          strokeWeight: 3,
        });
        // Re-apply sequence label if on selected route
        if (labelObj) marker.setLabel(labelObj);
      }

      marker.addListener('click', () => onClientClick(client));
      markersRef.current.push(marker);
    }

    // Draw polyline and fitBounds for selected route
    if (selectedRoute && selectedStops.length > 0) {
      const routeColour = getRouteColourFromLabel(selectedRoute.route.route_label || '');
      const depot = {
        lat: Number(selectedRoute.route.depot_lat) || DEPOT.lat,
        lng: Number(selectedRoute.route.depot_lng) || DEPOT.lng,
      };

      // Sort stops by sequence_order
      const sorted = [...selectedStops]
        .filter((s) => s.address_lat != null && s.address_lng != null)
        .sort((a, b) => a.sequence_order - b.sequence_order);

      const path: google.maps.LatLngLiteral[] = [depot];
      for (const s of sorted) {
        path.push({ lat: Number(s.address_lat!), lng: Number(s.address_lng!) });
      }
      path.push(depot);

      polylineRef.current = new google.maps.Polyline({
        path,
        strokeColor: routeColour,
        strokeWeight: 2,
        strokeOpacity: 0.6,
        map,
      });

      // Fit bounds to include all stops + depot
      const bounds = new google.maps.LatLngBounds();
      for (const pt of path) bounds.extend(pt);
      map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
    }

    return () => {
      for (const m of markersRef.current) m.setMap(null);
      markersRef.current = [];
      if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }
    };
  }, [map, clients, routes, stopsByRouteId, routeColours, clientStatusBadges, acreageFlags, onClientClick, selectedRouteId]);

  return null;
}
