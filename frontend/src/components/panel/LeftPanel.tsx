import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { PanelLeftClose, PanelLeft, Upload, Download, AlertTriangle, Lock } from 'lucide-react';
import { RouteSlotCard } from './RouteSlotCard';
import { UnassignedPool } from './UnassignedPool';
import { useUIStore } from '../../store/uiStore';
import { exportRouteCsv } from '../../api/routes.api';
import type { RouteWithSummary, RouteStop, Client } from '../../types/map.types';

interface LeftPanelProps {
  seasonId: string;
  routes: RouteWithSummary[];
  clients: Client[];
  stopsByRouteId: Record<string, RouteStop[]>;
  userRole: string;
  readOnly?: boolean;
  onAssignClient: (routeId: string, clientId: string) => void;
  onRemoveStop: (stopId: string) => void;
  onReorder: (routeId: string, orderedStopIds: string[]) => void;
  onUploadClick?: () => void;
  onSuggestClick?: () => void;
  onAddClientClick?: () => void;
  onClientStatusChanged?: () => void;
  geocodeFailedCount?: number;
}

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'unscheduled'] as const;

function groupRoutesByDay(routes: RouteWithSummary[]) {
  const groups: Record<string, RouteWithSummary[]> = {};
  for (const day of DAY_ORDER) groups[day] = [];
  for (const r of routes) {
    const day = (r.route.day_of_week ?? 'unscheduled').toLowerCase();
    if (groups[day]) groups[day].push(r);
    else groups[day] = [r];
  }
  return groups;
}

export function LeftPanel({
  seasonId,
  routes,
  clients,
  stopsByRouteId,
  userRole,
  readOnly = false,
  onAssignClient,
  onRemoveStop,
  onReorder,
  onUploadClick,
  onSuggestClick,
  onAddClientClick,
  onClientStatusChanged,
  geocodeFailedCount = 0,
}: LeftPanelProps) {
  const collapsed = useUIStore((s) => s.isLeftPanelCollapsed);
  const togglePanel = useUIStore((s) => s.toggleLeftPanel);
  const setGeocoderPanelOpen = useUIStore((s) => s.setGeocoderPanelOpen);

  const dayGroups = groupRoutesByDay(routes);

  const unassignedClients = clients.filter(
    (c) =>
      !c.assigned_route_id &&
      (c.geocode_status === 'success' || c.geocode_status === 'manual' || c.geocode_status === 'failed')
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Client dropped onto route
    if (activeId.startsWith('client-') && overId.startsWith('route-')) {
      const clientId = activeId.replace('client-', '');
      const routeId = overId.replace('route-', '');
      onAssignClient(routeId, clientId);
      return;
    }

    // Stop reordered within same route
    if (activeId.startsWith('stop-') && overId.startsWith('stop-')) {
      const activeStopId = activeId.replace('stop-', '');
      const overStopId = overId.replace('stop-', '');

      // Find the route containing these stops
      for (const routeData of routes) {
        const stops = stopsByRouteId[routeData.route.id] ?? routeData.stops;
        const stopIds = stops.map((s) => s.id);
        const activeIdx = stopIds.indexOf(activeStopId);
        const overIdx = stopIds.indexOf(overStopId);

        if (activeIdx !== -1 && overIdx !== -1) {
          const newOrder = [...stopIds];
          newOrder.splice(activeIdx, 1);
          newOrder.splice(overIdx, 0, activeStopId);
          onReorder(routeData.route.id, newOrder);
          return;
        }
      }
    }
  }

  if (collapsed) {
    return (
      <div className="w-10 flex-shrink-0 h-full bg-white border-r border-cr-border flex flex-col items-center pt-3">
        <button
          onClick={togglePanel}
          className="text-gray-400 hover:text-gray-600"
          title="Expand panel"
        >
          <PanelLeft size={18} />
        </button>
      </div>
    );
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="w-80 flex-shrink-0 h-full flex flex-col bg-white border-r border-cr-border overflow-hidden">
        {/* Panel Header */}
        <div className="h-12 flex items-center px-4 border-b border-cr-border">
          <h2 className="font-semibold text-cr-text">Routes</h2>
          <div className="flex-1" />
          <button
            onClick={() => exportRouteCsv(seasonId)}
            className="flex items-center gap-1 border border-gray-300 text-gray-600 text-xs font-medium px-2 py-1 rounded hover:bg-gray-50 mr-2"
            title="Export All Routes"
          >
            <Download size={12} />
            Export All
          </button>
          {onUploadClick && !readOnly && (
            <button
              onClick={onUploadClick}
              className="flex items-center gap-1 bg-cr-navy text-white text-xs font-medium px-2 py-1 rounded hover:opacity-90 mr-2"
              title="Upload CSV"
            >
              <Upload size={12} />
              Upload CSV
            </button>
          )}
          <button
            onClick={togglePanel}
            className="text-gray-400 hover:text-gray-600"
            title="Collapse panel"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        {/* Read-only banner */}
        {readOnly && (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border-b border-gray-200 text-xs text-gray-600 font-medium">
            <Lock size={12} />
            Season published — route editing disabled
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {DAY_ORDER.map((day) => {
            const dayRoutes = dayGroups[day];
            if (!dayRoutes || dayRoutes.length === 0) return null;

            return (
              <div key={day}>
                {/* Day header */}
                <div className="sticky top-0 z-10 h-8 flex items-center px-3 bg-gray-100 text-[10px] font-semibold uppercase tracking-widest text-gray-500 border-b border-gray-200">
                  {day}
                </div>
                <div className="p-2">
                  {dayRoutes.map((rd) => (
                    <RouteSlotCard
                      key={rd.route.id}
                      routeData={rd}
                      stops={stopsByRouteId[rd.route.id] ?? rd.stops}
                      seasonId={seasonId}
                      userRole={userRole}
                      readOnly={readOnly}
                      onAssignClient={onAssignClient}
                      onRemoveStop={onRemoveStop}
                      onReorder={onReorder}
                      onOptimized={onClientStatusChanged}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Geocode Issues */}
          {geocodeFailedCount > 0 && (
            <div className="px-3 py-2">
              <button
                onClick={() => setGeocoderPanelOpen(true)}
                className="w-full flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium px-3 py-2 rounded-lg hover:bg-amber-100"
              >
                <AlertTriangle size={14} />
                Geocode Issues ({geocodeFailedCount})
              </button>
            </div>
          )}

          {/* Unassigned Pool */}
          <UnassignedPool clients={unassignedClients} userRole={userRole} readOnly={readOnly} onUploadClick={readOnly ? undefined : onUploadClick} onSuggestClick={readOnly ? undefined : onSuggestClick} onAddClientClick={readOnly ? undefined : onAddClientClick} onClientStatusChanged={onClientStatusChanged} />
        </div>
      </div>
    </DndContext>
  );
}
