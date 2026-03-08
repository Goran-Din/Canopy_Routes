import { useEffect, useState } from 'react';
import { getRouteFStatus } from '../../api/tools.api';
import type { RouteFStatus } from '../../types/map.types';

const STATUS_CONFIG: Record<string, { colour: string; bg: string; label: string }> = {
  safe: { colour: '#059669', bg: '#D1FAE5', label: 'Safe' },
  approaching: { colour: '#2563EB', bg: '#DBEAFE', label: 'Approaching' },
  warning: { colour: '#D97706', bg: '#FEF3C7', label: 'Warning' },
  critical: { colour: '#DC2626', bg: '#FEE2E2', label: 'Critical' },
};

interface RouteFTabProps {
  seasonId: string;
}

export function RouteFTab({ seasonId }: RouteFTabProps) {
  const [data, setData] = useState<RouteFStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getRouteFStatus(seasonId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err: any) => { if (!cancelled) setError(err.response?.data?.error ?? 'Failed to load Route F status.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [seasonId]);

  if (loading) return <div className="text-sm text-gray-500 text-center py-8">Loading...</div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>;
  if (!data) return null;

  const cfg = STATUS_CONFIG[data.status] ?? STATUS_CONFIG.safe;
  const stopPct = Math.min((data.stop_count / data.threshold_stops) * 100, 100);
  const acresPct = Math.min((data.total_acres / data.threshold_acres) * 100, 100);

  return (
    <div className="space-y-5">
      {/* Status indicator */}
      <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: cfg.bg }}>
        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cfg.colour }} />
        <div>
          <div className="text-sm font-semibold" style={{ color: cfg.colour }}>{cfg.label}</div>
          <div className="text-xs text-gray-600">Route F overflow status</div>
        </div>
      </div>

      {/* Stops progress */}
      <div>
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Stops</span>
          <span className="font-medium">{data.stop_count} / {data.threshold_stops}</span>
        </div>
        <div className="w-full h-3 rounded-full bg-gray-200">
          <div
            className="h-3 rounded-full transition-all duration-300"
            style={{ width: `${stopPct}%`, backgroundColor: cfg.colour }}
          />
        </div>
      </div>

      {/* Large number displays */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-cr-border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-cr-text">{data.stop_count}</div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">Stops</div>
        </div>
        <div className="border border-cr-border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-cr-text">{data.total_acres.toFixed(1)}</div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">Acres</div>
        </div>
      </div>

      {/* Acres progress */}
      <div>
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Acres</span>
          <span className="font-medium">{data.total_acres.toFixed(1)} / {data.threshold_acres}</span>
        </div>
        <div className="w-full h-3 rounded-full bg-gray-200">
          <div
            className="h-3 rounded-full transition-all duration-300"
            style={{ width: `${acresPct}%`, backgroundColor: cfg.colour }}
          />
        </div>
      </div>

      {/* Season Setup Checklist */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Season Setup Checklist</h4>
        <div className="space-y-2">
          <ChecklistItem done label="Routes created for season" />
          <ChecklistItem done label="Zone boundaries configured" />
          <ChecklistItem done={data.stop_count > 0} label="Clients assigned to routes" />
          <ChecklistItem done={data.total_acres > 0} label="Acreage data populated" />
          <ChecklistItem done={data.status !== 'critical'} label="Route F within capacity" />
        </div>
      </div>
    </div>
  );
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
          done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
        }`}
      >
        {done ? '\u2713' : '\u2013'}
      </div>
      <span className={done ? 'text-gray-700' : 'text-gray-400'}>{label}</span>
    </div>
  );
}
