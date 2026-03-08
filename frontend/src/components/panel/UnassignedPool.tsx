import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { ChevronDown, ChevronRight, GripVertical, Upload, Sparkles, Plus } from 'lucide-react';
import { updateClientStatus } from '../../api/clients.api';
import { useUIStore } from '../../store/uiStore';
import type { Client } from '../../types/map.types';

interface UnassignedPoolProps {
  clients: Client[];
  userRole: string;
  readOnly?: boolean;
  onUploadClick?: () => void;
  onSuggestClick?: () => void;
  onAddClientClick?: () => void;
  onClientStatusChanged?: () => void;
}

function DraggableClientCard({ client, readOnly, onStatusChanged }: { client: Client; readOnly?: boolean; onStatusChanged?: () => void }) {
  const addToast = useUIStore((s) => s.addToast);
  const [status, setStatus] = useState(client.client_status);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `client-${client.id}`,
    data: { clientId: client.id },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const isInactive = status === 'inactive';

  async function handleStatusChange(newStatus: string) {
    const prev = status;
    setStatus(newStatus as Client['client_status']);
    try {
      await updateClientStatus(client.id, newStatus);
      onStatusChanged?.();
    } catch {
      setStatus(prev);
      addToast('Failed to update status', 'error');
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border border-gray-200 rounded px-2 py-1.5 mb-1.5 bg-white cursor-grab active:cursor-grabbing transition-opacity ${
        isDragging ? 'opacity-50 border-dashed' : ''
      } ${isInactive ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-1.5">
        {!readOnly && (
          <button {...attributes} {...listeners} className="mt-0.5 text-gray-400">
            <GripVertical size={12} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold truncate">{client.client_name}</span>
            {isInactive && <span className="text-[10px] text-gray-400">(Inactive)</span>}
          </div>
          <div className="text-xs text-gray-500 truncate">
            {client.service_address}, {client.city}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-600">{Number(client.acres).toFixed(2)} ac</span>
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-cr-blue cursor-pointer"
            >
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="new">New</option>
              <option value="at_risk">At Risk</option>
              <option value="inactive">Inactive</option>
            </select>
            <span className="text-[10px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded">
              {client.city}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UnassignedPool({ clients, readOnly = false, onUploadClick, onSuggestClick, onAddClientClick, onClientStatusChanged }: UnassignedPoolProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [filter, setFilter] = useState('');

  const geocodeErrors = clients.filter((c) => c.geocode_status === 'failed');
  const assignable = clients.filter(
    (c) => c.geocode_status === 'success' || c.geocode_status === 'manual'
  );

  const filtered = filter
    ? assignable.filter(
        (c) =>
          c.client_name.toLowerCase().includes(filter.toLowerCase()) ||
          c.city.toLowerCase().includes(filter.toLowerCase())
      )
    : assignable;

  return (
    <div className="border-t border-gray-200">
      {/* Header */}
      <div className="flex items-center">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Unassigned Clients ({assignable.length})
        </button>
        {onAddClientClick && (
          <button
            onClick={onAddClientClick}
            className="flex items-center gap-1 text-xs font-medium text-cr-navy border border-cr-navy/30 rounded px-2 py-1 mr-3 hover:bg-cr-navy/5"
            title="Add a single client"
          >
            <Plus size={12} />
            Add Client
          </button>
        )}
      </div>

      {isExpanded && clients.length === 0 && onUploadClick && (
        <div className="px-3 pb-4 text-center">
          <div className="py-4">
            <Upload size={32} className="mx-auto text-gray-300 mb-2" />
            <div className="text-sm font-medium text-gray-600 mb-1">No clients yet</div>
            <div className="text-xs text-gray-400 mb-3">Upload your client CSV to get started</div>
            <button
              onClick={onUploadClick}
              className="w-full py-2 bg-cr-navy text-white rounded-lg font-medium text-sm hover:opacity-90"
            >
              Upload CSV
            </button>
          </div>
        </div>
      )}

      {isExpanded && (clients.length > 0 || !onUploadClick) && (
        <div className="px-3 pb-3">
          {/* Suggest Routes button */}
          {onSuggestClick && assignable.length > 0 && (
            <button
              onClick={onSuggestClick}
              className="w-full flex items-center justify-center gap-1.5 py-2 mb-2 bg-cr-navy text-white rounded-lg font-medium text-sm hover:opacity-90"
            >
              <Sparkles size={14} />
              Suggest Routes ({assignable.length})
            </button>
          )}

          {/* Filter */}
          <input
            type="text"
            placeholder="Filter by name or city..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 mb-2 focus:outline-none focus:border-blue-300"
          />

          {/* Client cards */}
          <div className="max-h-80 overflow-y-auto">
            {filtered.map((client) => (
              <DraggableClientCard key={client.id} client={client} readOnly={readOnly} onStatusChanged={onClientStatusChanged} />
            ))}
            {filtered.length === 0 && (
              <div className="text-xs text-gray-400 text-center py-3">
                {filter ? 'No matches' : 'All clients assigned'}
              </div>
            )}
          </div>

          {/* Geocode errors */}
          {geocodeErrors.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-red-600 mb-1">
                Geocode Errors ({geocodeErrors.length})
              </div>
              {geocodeErrors.map((c) => (
                <div
                  key={c.id}
                  className="border border-red-200 rounded px-2 py-1.5 mb-1 text-xs bg-red-50"
                >
                  <div className="font-semibold">{c.client_name}</div>
                  <div className="text-gray-500">{c.service_address}, {c.city}</div>
                  <button className="text-red-600 text-[10px] font-semibold mt-0.5 hover:underline">
                    Fix
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
