import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, Download, GripVertical, Shuffle, X } from 'lucide-react';
import { CapacityBar } from './CapacityBar';
import { EnterActualsModal } from '../EnterActualsModal';
import { useUIStore } from '../../store/uiStore';
import { exportRouteCsv } from '../../api/routes.api';
import { removalImpact, optimizeRoute } from '../../api/tools.api';
import type { RouteWithSummary, RouteStop, RemovalImpactResult } from '../../types/map.types';

interface RouteSlotCardProps {
  routeData: RouteWithSummary;
  stops: RouteStop[];
  seasonId: string;
  userRole: string;
  readOnly?: boolean;
  onAssignClient: (routeId: string, clientId: string) => void;
  onRemoveStop: (stopId: string) => void;
  onReorder: (routeId: string, orderedStopIds: string[]) => void;
  onOptimized?: () => void;
}

const ROUTE_COLOURS: Record<string, string> = {
  A: '#2E75B6',
  B: '#2E8B57',
  C: '#6B3FA0',
  D: '#D4760A',
  E: '#0D7377',
};

function getAccentColour(label: string): string {
  const upper = label.toUpperCase();
  for (const key of Object.keys(ROUTE_COLOURS)) {
    if (upper.includes(key)) return ROUTE_COLOURS[key];
  }
  return '#64748B';
}

function StatusBadge({ status, acreageConfirmed }: { status: string; acreageConfirmed: boolean }) {
  return (
    <span className="flex items-center gap-1 text-xs">
      {status === 'pending' && <span className="w-2 h-2 rounded-full bg-yellow-400" />}
      {status === 'at_risk' && <span className="text-orange-500 font-bold">!</span>}
      {status === 'new' && <span className="text-green-600 font-bold">+</span>}
      {!acreageConfirmed && <span className="text-amber-500" title="Acreage unconfirmed">*</span>}
    </span>
  );
}

function SortableStopRow({
  stop,
  index,
  routeLabel,
  readOnly,
  onRemoveStop,
}: {
  stop: RouteStop;
  index: number;
  routeLabel: string;
  readOnly?: boolean;
  onRemoveStop: (stopId: string) => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [impact, setImpact] = useState<RemovalImpactResult | null>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `stop-${stop.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const acres = Number(stop.acres) || 0.20;
  const mowTrimMins = Math.round((acres / 2.50) * 1.40 * 60);
  const driveMins = Math.round(Number(stop.drive_time_from_prev_mins) || 0);

  async function handleRemoveClick() {
    setLoadingImpact(true);
    setConfirmRemove(true);
    try {
      const result = await removalImpact({ client_id: stop.client_id, route_stop_id: stop.id });
      setImpact(result);
    } catch {
      setImpact(null);
    } finally {
      setLoadingImpact(false);
    }
  }

  function handleCancel() {
    setConfirmRemove(false);
    setImpact(null);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center px-2 border-b border-gray-100 hover:bg-gray-50 ${confirmRemove ? 'min-h-[72px] py-1' : 'h-14'}`}
    >
      {!readOnly && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing mr-1 text-gray-400"
        >
          <GripVertical size={14} />
        </button>
      )}
      <span className="text-xs text-gray-400 font-mono w-6 flex-shrink-0">
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className="flex-1 min-w-0 ml-1">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold truncate">{stop.client_name}</span>
          <StatusBadge status={stop.client_status} acreageConfirmed={stop.acreage_confirmed} />
        </div>
        <div className="text-xs text-gray-500 truncate">
          {acres.toFixed(2)} ac &middot; {mowTrimMins} min mow+trim{driveMins > 0 ? <> &middot; +{driveMins} min drive</> : null}
        </div>
      </div>
      <div className="flex-shrink-0 ml-1">
        {readOnly ? null : confirmRemove ? (
          <div className="flex flex-col items-end gap-0.5">
            {loadingImpact ? (
              <div className="text-[10px] text-gray-400">Loading impact...</div>
            ) : impact ? (
              <div className="text-[10px] text-gray-600 max-w-[160px] text-right leading-tight space-y-0.5">
                <div>{impact.after.total_workday_hrs.toFixed(1)}h workday after</div>
                <div className="text-green-600">-{impact.drive_time_saved_mins} min drive saved</div>
                {impact.revenue_delta !== 0 && (
                  <div className="text-red-600">-${Math.abs(impact.revenue_delta).toLocaleString()} rev</div>
                )}
              </div>
            ) : (
              <div className="text-[10px] text-gray-500 max-w-[140px] text-right leading-tight">
                Remove {stop.client_name} from {routeLabel}?
              </div>
            )}
            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={() => { onRemoveStop(stop.id); handleCancel(); }}
                className="text-red-600 font-semibold hover:underline"
              >
                Remove
              </button>
              <button
                onClick={handleCancel}
                className="text-gray-500 hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleRemoveClick}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export function RouteSlotCard({
  routeData,
  stops,
  seasonId,
  userRole,
  readOnly = false,
  onRemoveStop,
  onOptimized,
}: RouteSlotCardProps) {
  const { route, summary } = routeData;
  const expanded = useUIStore((s) => !!s.expandedRouteIds[route.id]);
  const toggleExpanded = useUIStore((s) => s.toggleRouteExpanded);
  const addToast = useUIStore((s) => s.addToast);
  const [optimizing, setOptimizing] = useState(false);
  const [actualsOpen, setActualsOpen] = useState(false);

  const { setNodeRef, isOver } = useDroppable({ id: `route-${route.id}` });

  const accentColour = getAccentColour(route.route_label ?? '');
  const isOverCapacity = summary.total_workday_hrs > 9.0;
  const isThursday = route.day_of_week === 'thursday';

  const sortableIds = stops.map((s) => `stop-${s.id}`);

  const totalProductiveHrs = stops.reduce(
    (sum, s) => sum + Number(s.productive_time_hrs) * (s.service_frequency === 'biweekly' ? 0.5 : 1),
    0
  );
  const totalDriveHrs = summary.total_drive_hrs;

  return (
    <div
      ref={setNodeRef}
      className={`relative border rounded-lg mb-2 bg-white overflow-hidden transition-colors ${
        isOver && !expanded ? 'bg-blue-50 border-blue-300 border-dashed' : 'border-gray-200'
      }`}
    >
      {/* Accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: accentColour }}
      />

      <div className="pl-3 pr-2 py-2">
        {/* Top row */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{route.route_label}</span>
          <span className="text-[10px] uppercase tracking-wide text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
            {route.day_of_week ?? 'unscheduled'}
          </span>
          <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
            {route.crew_id ? 'Crew' : 'No crew'}
          </span>
          <div className="flex-1" />
          {!readOnly && (userRole === 'owner' || userRole === 'coordinator') && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (optimizing) return;
                setOptimizing(true);
                try {
                  const result = await optimizeRoute(route.id);
                  if (result.improved) {
                    addToast(`Route optimized — saved ${result.reductionPercent.toFixed(1)}% (${(result.oldDistanceKm - result.newDistanceKm).toFixed(1)} km)`, 'success');
                    onOptimized?.();
                  } else {
                    addToast('Sequence is already optimal', 'success');
                  }
                } catch {
                  addToast('Failed to optimize route', 'error');
                } finally {
                  setOptimizing(false);
                }
              }}
              disabled={optimizing}
              className="text-gray-400 hover:text-cr-navy mr-1 disabled:opacity-50"
              title="Re-optimize stop sequence"
            >
              {optimizing
                ? <span className="inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                : <Shuffle size={14} />
              }
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); exportRouteCsv(seasonId, route.id); }}
            className="text-gray-400 hover:text-cr-navy mr-1"
            title="Download CSV"
          >
            <Download size={14} />
          </button>
          <button
            onClick={() => toggleExpanded(route.id)}
            className="text-gray-400 hover:text-gray-600"
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {/* Capacity bar */}
        <div className="mt-1.5">
          <CapacityBar totalWorkdayHrs={summary.total_workday_hrs} />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
          <span className={isOverCapacity ? 'text-red-600 font-semibold' : ''}>
            {summary.total_workday_hrs.toFixed(1)}h / 9.0h
          </span>
          <span>{summary.stop_count} stops &middot; {summary.total_acres.toFixed(1)} acres</span>
          {(userRole === 'owner' || userRole === 'coordinator') && (
            <button
              onClick={(e) => { e.stopPropagation(); setActualsOpen(true); }}
              className="text-xs text-gray-400 hover:text-blue-600 ml-auto"
              title="Enter actual hours"
            >
              + Actuals
            </button>
          )}
        </div>

        {/* Revenue (owner/coordinator only) */}
        {(userRole === 'owner' || userRole === 'coordinator') && (
          <div className="text-xs text-gray-500 mt-0.5">
            {/* Revenue placeholder — sum from stops not yet available */}
          </div>
        )}

        {/* Thursday warning */}
        {isThursday && (
          <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded px-2 py-1 text-xs text-amber-800">
            &#9888; 91 min depot return — depart 6:30 AM
          </div>
        )}
      </div>

      {/* Expanded stop list */}
      {expanded && (
        <div className="border-t border-gray-100">
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            {stops.map((stop, idx) => (
              <SortableStopRow
                key={stop.id}
                stop={stop}
                index={idx}
                routeLabel={route.route_label}
                readOnly={readOnly}
                onRemoveStop={onRemoveStop}
              />
            ))}
          </SortableContext>

          {stops.length > 0 && (
            <div className="px-3 py-2 bg-gray-50 text-xs text-gray-600 font-medium sticky bottom-0">
              TOTAL: {totalProductiveHrs.toFixed(1)}h productive + {totalDriveHrs.toFixed(1)}h driving = {summary.total_workday_hrs.toFixed(1)}h workday
            </div>
          )}

          {stops.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-gray-400">
              Drop clients here to add stops
            </div>
          )}
        </div>
      )}
      <EnterActualsModal
        routeId={route.id}
        routeName={route.route_label}
        seasonId={seasonId}
        estimatedHrs={summary.total_workday_hrs}
        open={actualsOpen}
        onClose={() => setActualsOpen(false)}
      />
    </div>
  );
}
