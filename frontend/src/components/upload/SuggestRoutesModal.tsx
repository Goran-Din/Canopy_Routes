import { useState, useEffect } from 'react';
import { getSuggestedRoutes, applySuggestions } from '../../api/tools.api';
import type { SuggestRoutesResult } from '../../api/tools.api';

type View = 'loading' | 'summary' | 'detail' | 'applying' | 'error';

const CONFIDENCE_COLOURS: Record<string, { bg: string; text: string }> = {
  HIGH: { bg: '#DEF7EC', text: '#03543F' },
  MEDIUM: { bg: '#FEF3C7', text: '#92400E' },
  LOW: { bg: '#FEE2E2', text: '#991B1B' },
};

const STATUS_COLOURS: Record<string, { bg: string; text: string }> = {
  green: { bg: '#DEF7EC', text: '#03543F' },
  yellow: { bg: '#FEF3C7', text: '#92400E' },
  red: { bg: '#FEE2E2', text: '#991B1B' },
};

interface SuggestRoutesModalProps {
  isOpen: boolean;
  seasonId: string;
  routes: Array<{ route: { id: string; route_label: string } }>;
  onClose: () => void;
  onComplete: () => void;
}

export function SuggestRoutesModal({ isOpen, seasonId, routes, onClose, onComplete }: SuggestRoutesModalProps) {
  const [view, setView] = useState<View>('loading');
  const [data, setData] = useState<SuggestRoutesResult | null>(null);
  const [error, setError] = useState('');
  const [assignments, setAssignments] = useState<Array<{ client_id: string; route_id: string }>>([]);

  useEffect(() => {
    if (!isOpen) return;
    setView('loading');
    setError('');
    getSuggestedRoutes(seasonId)
      .then((result) => {
        setData(result);
        setAssignments(
          result.suggestions.map((s) => ({
            client_id: s.client_id,
            route_id: s.suggested_route_id,
          }))
        );
        setView('summary');
      })
      .catch((err: any) => {
        setError(err.response?.data?.error ?? 'Failed to generate suggestions.');
        setView('error');
      });
  }, [isOpen, seasonId]);

  async function handleApply() {
    setView('applying');
    try {
      await applySuggestions(seasonId, assignments);
      onComplete();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to apply suggestions.');
      setView('error');
    }
  }

  function handleChangeRoute(clientId: string, newRouteId: string) {
    setAssignments((prev) =>
      prev.map((a) => (a.client_id === clientId ? { ...a, route_id: newRouteId } : a))
    );
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-cr-text">
            {view === 'detail' ? 'Individual Assignments' : 'Route Suggestions'}
          </h2>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Loading */}
          {view === 'loading' && (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-3 border-cr-navy border-t-transparent rounded-full animate-spin mb-3" />
              <div className="text-sm text-gray-600">Analysing clients and generating route suggestions...</div>
            </div>
          )}

          {/* Error */}
          {view === 'error' && (
            <div className="text-center py-8 space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600 text-2xl font-bold">
                &#10007;
              </div>
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {/* Applying */}
          {view === 'applying' && (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-3 border-cr-navy border-t-transparent rounded-full animate-spin mb-3" />
              <div className="text-sm text-gray-600">Assigning {assignments.length} clients to routes...</div>
            </div>
          )}

          {/* Summary view */}
          {view === 'summary' && data && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                <span className="font-semibold text-cr-text">{data.total_clients}</span> clients analysed.{' '}
                <span className="font-semibold text-green-700">{data.assigned}</span> assigned
                {data.unassignable > 0 && (
                  <>, <span className="font-semibold text-red-600">{data.unassignable}</span> could not be assigned</>
                )}
                .
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase border-b border-gray-200">
                    <th className="text-left py-2 font-medium">Route</th>
                    <th className="text-left py-2 font-medium">Day</th>
                    <th className="text-right py-2 font-medium">Stops</th>
                    <th className="text-right py-2 font-medium">Added</th>
                    <th className="text-right py-2 font-medium">Total</th>
                    <th className="text-right py-2 font-medium">Hours</th>
                    <th className="text-right py-2 font-medium w-24">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.route_summary.map((r) => {
                    const sc = STATUS_COLOURS[r.capacity_status] ?? STATUS_COLOURS.green;
                    return (
                      <tr key={r.route_id} className="border-b border-gray-100">
                        <td className="py-2 font-medium">{r.route_label}</td>
                        <td className="py-2">
                          <span className="text-[10px] uppercase bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                            {r.day_of_week}
                          </span>
                        </td>
                        <td className="py-2 text-right text-gray-500">{r.current_stops}</td>
                        <td className="py-2 text-right text-green-600 font-medium">
                          {r.suggested_additions > 0 ? `+${r.suggested_additions}` : '—'}
                        </td>
                        <td className="py-2 text-right font-semibold">
                          {r.projected_stops}/{r.max_stops}
                        </td>
                        <td className="py-2 text-right font-medium">{r.projected_hours}h</td>
                        <td className="py-2 text-right">
                          <span
                            className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: sc.bg, color: sc.text }}
                          >
                            {r.capacity_status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {data.unassignable_clients && data.unassignable_clients.length > 0 && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-xs font-semibold text-red-700 mb-1">
                    Unassignable Clients ({data.unassignable_clients.length})
                  </div>
                  <div className="text-xs text-red-600">
                    {data.unassignable_clients.map((c) => c.client_name).join(', ')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detail view */}
          {view === 'detail' && data && (
            <div className="space-y-1">
              <div className="text-xs text-gray-500 mb-2">{data.suggestions.length} clients</div>
              <div className="max-h-[55vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-xs text-gray-500 uppercase border-b border-gray-200">
                      <th className="text-left py-2 font-medium">Client</th>
                      <th className="text-left py-2 font-medium">Route</th>
                      <th className="text-left py-2 font-medium">Zone</th>
                      <th className="text-left py-2 font-medium">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.suggestions.map((s) => {
                      const currentRouteId = assignments.find((a) => a.client_id === s.client_id)?.route_id ?? s.suggested_route_id;
                      const conf = CONFIDENCE_COLOURS[s.confidence];
                      return (
                        <tr key={s.client_id} className="border-b border-gray-100">
                          <td className="py-1.5 truncate max-w-[180px]" title={s.client_name}>{s.client_name}</td>
                          <td className="py-1.5">
                            <select
                              value={currentRouteId}
                              onChange={(e) => handleChangeRoute(s.client_id, e.target.value)}
                              className="text-xs border border-gray-200 rounded px-1 py-0.5"
                            >
                              {routes.map((r) => (
                                <option key={r.route.id} value={r.route.id}>{r.route.route_label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1.5 text-xs">{s.zone}</td>
                          <td className="py-1.5">
                            <span
                              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: conf?.bg, color: conf?.text }}
                            >
                              {s.confidence}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end flex-shrink-0">
          {view === 'summary' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-cr-border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setView('detail')}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-cr-border rounded-lg hover:bg-gray-50"
              >
                Review Individual Assignments
              </button>
              <button
                onClick={handleApply}
                className="px-4 py-2 text-sm font-medium text-white bg-cr-navy rounded-lg hover:opacity-90"
              >
                Apply All Suggestions
              </button>
            </>
          )}
          {view === 'detail' && (
            <>
              <button
                onClick={() => setView('summary')}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-cr-border rounded-lg hover:bg-gray-50"
              >
                Back to Summary
              </button>
              <button
                onClick={handleApply}
                className="px-4 py-2 text-sm font-medium text-white bg-cr-navy rounded-lg hover:opacity-90"
              >
                Apply Assignments
              </button>
            </>
          )}
          {view === 'error' && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-cr-border rounded-lg hover:bg-gray-50"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
