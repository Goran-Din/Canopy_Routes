import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { removalImpact as removalImpactApi } from '../../api/tools.api';
import { removeStop } from '../../api/routes.api';
import type { Client, RouteWithSummary, RemovalImpactResult } from '../../types/map.types';

interface RemovalImpactTabProps {
  clients: Client[];
  routes: RouteWithSummary[];
}

export function RemovalImpactTab({ clients, routes }: RemovalImpactTabProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [result, setResult] = useState<RemovalImpactResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');

  const assignedClients = useMemo(
    () => clients.filter((c) => c.assigned_route_id),
    [clients]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return assignedClients.slice(0, 20);
    const q = search.toLowerCase();
    return assignedClients.filter(
      (c) => c.client_name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [search, assignedClients]);

  function findStopId(client: Client): string | null {
    for (const r of routes) {
      const stop = r.stops.find((s) => s.client_id === client.id);
      if (stop) return stop.id;
    }
    return null;
  }

  async function handleSelect(client: Client) {
    setSelectedClient(client);
    setSearch(client.client_name);
    setResult(null);
    setError('');

    const stopId = findStopId(client);
    if (!stopId) {
      setError('No active stop found for this client.');
      return;
    }

    setLoading(true);
    try {
      const data = await removalImpactApi({ client_id: client.id, route_stop_id: stopId });
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to calculate removal impact.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    if (!selectedClient) return;
    const stopId = findStopId(selectedClient);
    if (!stopId) return;

    setRemoving(true);
    try {
      await removeStop(stopId);
      await queryClient.invalidateQueries({ queryKey: ['routes'] });
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['stops'] });
      setResult(null);
      setSelectedClient(null);
      setSearch('');
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to remove stop.');
    } finally {
      setRemoving(false);
    }
  }

  function handleCancel() {
    setResult(null);
    setSelectedClient(null);
    setSearch('');
    setError('');
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Search assigned client</label>
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSelectedClient(null); setResult(null); }}
          placeholder="Search by client name..."
          className="w-full text-sm border border-cr-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cr-blue"
        />
      </div>

      {/* Dropdown */}
      {search && !selectedClient && (
        <div className="max-h-48 overflow-y-auto border border-cr-border rounded-lg">
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400">No matches</div>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelect(c)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
            >
              <div className="font-medium truncate">{c.client_name}</div>
              <div className="text-xs text-gray-500">{c.assigned_route_label} &middot; {c.city}</div>
            </button>
          ))}
        </div>
      )}

      {loading && <div className="text-sm text-gray-500 text-center py-4">Calculating impact...</div>}
      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* Results */}
      {result && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Impact Analysis</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase border-b border-gray-200">
                <th className="text-left py-1.5 font-medium">Metric</th>
                <th className="text-right py-1.5 font-medium">Before</th>
                <th className="text-right py-1.5 font-medium">After</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 text-gray-600">Workday</td>
                <td className="text-right">{result.before.total_workday_hrs.toFixed(1)}h</td>
                <td className="text-right font-medium">{result.after.total_workday_hrs.toFixed(1)}h</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 text-gray-600">Capacity</td>
                <td className="text-right"><StatusBadge status={result.before.capacity_status} /></td>
                <td className="text-right"><StatusBadge status={result.after.capacity_status} /></td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 text-gray-600">Stops</td>
                <td className="text-right">{result.before.stop_count}</td>
                <td className="text-right font-medium">{result.after.stop_count}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 text-gray-600">Revenue</td>
                <td className="text-right">${result.before.annual_revenue.toLocaleString()}</td>
                <td className="text-right font-medium">
                  ${result.after.annual_revenue.toLocaleString()}
                  {result.revenue_delta !== 0 && (
                    <span className={`ml-1 text-xs ${result.revenue_delta < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ({result.revenue_delta < 0 ? '' : '+'}{result.revenue_delta.toLocaleString()})
                    </span>
                  )}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 text-gray-600">Drive saved</td>
                <td></td>
                <td className="text-right font-medium text-green-600">
                  -{Math.round(result.drive_time_saved_mins)} min
                </td>
              </tr>
            </tbody>
          </table>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleRemove}
              disabled={removing}
              className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium text-sm hover:bg-red-700 disabled:opacity-50"
            >
              {removing ? 'Removing...' : 'Remove from Route'}
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 py-2 border border-cr-border text-gray-600 rounded-lg font-medium text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    orange: 'bg-orange-100 text-orange-800',
    red: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${colours[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.toUpperCase()}
    </span>
  );
}
