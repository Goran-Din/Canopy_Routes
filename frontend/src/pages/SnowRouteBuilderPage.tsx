import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { fetchSeasons } from '../api/auth.api';
import { fetchClients, assignClientToRoute } from '../api/clients.api';
import { fetchRoutes, fetchStops, removeStop, reorderStops } from '../api/routes.api';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { NavBar } from '../components/NavBar';
import { MapCanvas } from '../components/map/MapCanvas';
import { DepotPin } from '../components/map/DepotPin';
import { MarkerManager } from '../components/map/MarkerManager';
import { DriveLines } from '../components/map/DriveLines';
import { UploadModal } from '../components/upload/UploadModal';
import type { Client, RouteWithSummary, RouteStop } from '../types/map.types';

const SERVICE_TYPE_LABELS: Record<string, string> = {
  plow: 'Plow',
  salt: 'Salt',
  plow_salt: 'Plow + Salt',
};

const PRIORITY_LABELS: Record<number, string> = {
  1: 'P1 - Critical',
  2: 'P2 - High',
  3: 'P3 - Normal',
  4: 'P4 - Low',
  5: 'P5 - Deferred',
};

const PRIORITY_COLOURS: Record<number, string> = {
  1: 'bg-red-100 text-red-700',
  2: 'bg-orange-100 text-orange-700',
  3: 'bg-blue-100 text-blue-700',
  4: 'bg-gray-100 text-gray-600',
  5: 'bg-gray-50 text-gray-400',
};

function SnowClientRow({
  client,
  onAssign,
  routes,
}: {
  client: Client;
  onAssign: (routeId: string, clientId: string) => void;
  routes: RouteWithSummary[];
}) {
  const priority = client.snow_priority ?? 3;

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-sm border-b border-cr-border hover:bg-gray-50">
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${PRIORITY_COLOURS[priority]}`}>
        P{priority}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-cr-text truncate">{client.client_name}</div>
        <div className="text-xs text-cr-text-muted">
          {SERVICE_TYPE_LABELS[client.service_type] ?? client.service_type}
          {client.lot_size_sqft ? ` · ${(client.lot_size_sqft / 1000).toFixed(1)}k sqft` : ''}
        </div>
      </div>
      {!client.assigned_route_id && routes.length > 0 && (
        <select
          className="text-xs border border-cr-border rounded px-1 py-0.5"
          defaultValue=""
          onChange={(e) => { if (e.target.value) onAssign(e.target.value, client.id); }}
        >
          <option value="">Assign...</option>
          {routes.map((r) => (
            <option key={r.route.id} value={r.route.id}>{r.route.route_label}</option>
          ))}
        </select>
      )}
      {client.assigned_route_id && (
        <span className="text-xs text-cr-text-muted">{client.assigned_route_label}</span>
      )}
    </div>
  );
}

function SnowRouteCard({
  rws,
  stopsByRouteId,
  onRemoveStop,
  onReorder,
}: {
  rws: RouteWithSummary;
  stopsByRouteId: Record<string, RouteStop[]>;
  onRemoveStop: (stopId: string) => void;
  onReorder: (routeId: string, orderedStopIds: string[]) => void;
}) {
  const selectedRouteId = useUIStore((s) => s.selectedRouteId);
  const toggleRouteExpanded = useUIStore((s) => s.toggleRouteExpanded);
  const isExpanded = useUIStore((s) => !!s.expandedRouteIds[rws.route.id]);
  const stops = stopsByRouteId[rws.route.id] ?? rws.stops;
  const isSelected = selectedRouteId === rws.route.id;

  const statusColour = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-400',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
  }[rws.summary.capacity_status];

  return (
    <div className={`border rounded-lg mb-2 ${isSelected ? 'border-cr-navy ring-1 ring-cr-navy' : 'border-cr-border'}`}>
      <button
        className="w-full px-3 py-2.5 flex items-center gap-2 text-left hover:bg-gray-50"
        onClick={() => toggleRouteExpanded(rws.route.id)}
      >
        <div className={`w-2.5 h-2.5 rounded-full ${statusColour}`} />
        <span className="font-semibold text-sm text-cr-text">{rws.route.route_label}</span>
        <span className="text-xs text-cr-text-muted ml-auto">
          {rws.summary.stop_count} stops · {rws.summary.total_workday_hrs.toFixed(1)}h
        </span>
        <span className="text-xs text-cr-text-muted">{isExpanded ? '\u25B2' : '\u25BC'}</span>
      </button>

      {isExpanded && (
        <div className="border-t border-cr-border">
          {stops.length === 0 && (
            <div className="px-3 py-4 text-xs text-cr-text-muted text-center">No stops assigned</div>
          )}
          {stops.map((stop, i) => (
            <div key={stop.id} className="flex items-center gap-2 px-3 py-1.5 text-xs border-b border-gray-100 last:border-0">
              <span className="w-5 text-center text-cr-text-muted font-mono">{String(i + 1).padStart(2, '0')}</span>
              <span className="flex-1 truncate text-cr-text">{stop.client_name}</span>
              <span className="text-cr-text-muted">{stop.productive_time_hrs.toFixed(2)}h</span>
              <button
                onClick={() => onRemoveStop(stop.id)}
                className="text-red-400 hover:text-red-600 text-xs"
                title="Remove stop"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SnowRouteBuilderPage() {
  const role = useAuthStore((s) => s.role) ?? 'coordinator';
  const queryClient = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: seasons = [], isLoading: seasonsLoading } = useQuery({
    queryKey: ['seasons'],
    queryFn: fetchSeasons,
  });

  const activeSeason =
    seasons.find((s) => s.tab === 'snow' && s.status === 'draft') ??
    seasons.find((s) => s.tab === 'snow' && s.status === 'pending_approval') ??
    seasons.find((s) => s.tab === 'snow' && s.status === 'published') ??
    null;

  const seasonId = activeSeason?.id ?? '';

  const { data: allClients = [] } = useQuery({
    queryKey: ['clients', seasonId],
    queryFn: () => fetchClients(seasonId),
    enabled: !!seasonId,
  });

  // Filter to snow service types only
  const clients = useMemo(
    () => allClients.filter((c) => c.service_type === 'plow' || c.service_type === 'salt' || c.service_type === 'plow_salt'),
    [allClients]
  );

  const { data: routes = [] } = useQuery({
    queryKey: ['routes', seasonId],
    queryFn: () => fetchRoutes(seasonId),
    enabled: !!seasonId,
  });

  const stopsQueries = useQueries({
    queries: routes.map((r) => ({
      queryKey: ['stops', r.route.id],
      queryFn: () => fetchStops(r.route.id),
      enabled: !!r.route.id,
    })),
  });

  const stopsByRouteId = useMemo(() => {
    const map: Record<string, RouteStop[]> = {};
    routes.forEach((r, i) => {
      map[r.route.id] = stopsQueries[i]?.data ?? r.stops;
    });
    return map;
  }, [routes, stopsQueries]);

  const invalidateAll = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['clients', seasonId] });
    await queryClient.invalidateQueries({ queryKey: ['routes', seasonId] });
    await queryClient.invalidateQueries({ queryKey: ['stops'] });
  }, [seasonId, queryClient]);

  const handleAssign = useCallback(
    async (routeId: string, clientId: string) => {
      try {
        await assignClientToRoute(routeId, clientId);
        await invalidateAll();
      } catch {
        addToast('Failed to assign client', 'error');
      }
    },
    [invalidateAll, addToast]
  );

  const handleRemoveStop = useCallback(
    async (stopId: string) => {
      try {
        await removeStop(stopId);
        await invalidateAll();
      } catch {
        addToast('Failed to remove stop', 'error');
      }
    },
    [invalidateAll, addToast]
  );

  const handleReorder = useCallback(
    async (routeId: string, orderedStopIds: string[]) => {
      try {
        await reorderStops(routeId, orderedStopIds);
        await invalidateAll();
      } catch {
        addToast('Failed to reorder stops', 'error');
      }
    },
    [invalidateAll, addToast]
  );

  const unassigned = clients.filter((c) => !c.assigned_route_id);
  const handleClientClick = useCallback(() => {}, []);

  if (seasonsLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-cr-surface text-cr-text-muted">
        Loading...
      </div>
    );
  }

  if (!activeSeason) {
    return (
      <div className="h-screen w-screen flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center bg-cr-surface text-cr-text-muted">
          No snow season found. Create a snow season to get started.
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col">
      <NavBar />
      <div className="flex-1 overflow-hidden flex">
        {/* Left Panel — Snow routes + unassigned */}
        <div className="w-80 border-r border-cr-border bg-white flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-cr-border flex items-center justify-between">
            <h2 className="font-semibold text-sm text-cr-text">Snow Routes</h2>
            <button
              onClick={() => setUploadOpen(true)}
              className="text-xs text-cr-navy hover:underline"
            >
              Upload CSV
            </button>
          </div>

          {/* Route cards */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {routes.length === 0 && (
              <div className="text-xs text-cr-text-muted text-center py-6">No routes yet</div>
            )}
            {routes.map((rws) => (
              <SnowRouteCard
                key={rws.route.id}
                rws={rws}
                stopsByRouteId={stopsByRouteId}
                onRemoveStop={handleRemoveStop}
                onReorder={handleReorder}
              />
            ))}

            {/* Unassigned pool */}
            {unassigned.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-cr-text-muted uppercase tracking-wide px-1 mb-2">
                  Unassigned ({unassigned.length})
                </div>
                {unassigned
                  .sort((a, b) => (a.snow_priority ?? 3) - (b.snow_priority ?? 3))
                  .map((c) => (
                    <SnowClientRow key={c.id} client={c} onAssign={handleAssign} routes={routes} />
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="relative flex-1 h-full">
          <MapCanvas>
            <DepotPin />
            <MarkerManager
              clients={clients}
              routes={routes}
              stopsByRouteId={stopsByRouteId}
              onClientClick={handleClientClick}
            />
            <DriveLines routes={routes} />
          </MapCanvas>
        </div>
      </div>

      <UploadModal
        isOpen={uploadOpen}
        seasonId={seasonId}
        seasonName={activeSeason.season_label}
        onClose={() => setUploadOpen(false)}
        onComplete={invalidateAll}
      />
    </div>
  );
}
