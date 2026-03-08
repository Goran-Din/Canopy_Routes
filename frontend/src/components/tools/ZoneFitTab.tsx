import { useState } from 'react';
import { zoneFit } from '../../api/tools.api';
import { CapacityBar } from '../panel/CapacityBar';
import type { ZoneFitResult } from '../../types/map.types';

const ZONE_COLOURS: Record<string, string> = {
  A: '#2E75B6', B: '#2E8B57', C: '#6B3FA0', D: '#D4760A', E: '#0D7377',
};
const CONFIDENCE_COLOURS: Record<string, { bg: string; text: string }> = {
  HIGH: { bg: '#DEF7EC', text: '#03543F' },
  MEDIUM: { bg: '#FEF3C7', text: '#92400E' },
  LOW: { bg: '#FEE2E2', text: '#991B1B' },
};

interface ZoneFitTabProps {
  seasonId: string;
  userRole: string;
}

export function ZoneFitTab({ seasonId, userRole }: ZoneFitTabProps) {
  const [address, setAddress] = useState('');
  const [acres, setAcres] = useState('');
  const [clientType, setClientType] = useState<'residential' | 'commercial'>('residential');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ZoneFitResult | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await zoneFit({
        address,
        acres: acres ? parseFloat(acres) : undefined,
        season_id: seasonId,
        client_type: clientType,
      });
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to calculate zone fit.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Input form */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter address..."
          className="w-full text-sm border border-cr-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cr-blue"
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Acres</label>
          <input
            type="number"
            value={acres}
            onChange={(e) => setAcres(e.target.value)}
            placeholder="Optional"
            step="0.01"
            min="0"
            className="w-full text-sm border border-cr-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cr-blue"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select
            value={clientType}
            onChange={(e) => setClientType(e.target.value as 'residential' | 'commercial')}
            className="w-full text-sm border border-cr-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cr-blue"
          >
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
          </select>
        </div>
      </div>
      <button
        onClick={handleSubmit}
        disabled={!address.trim() || loading}
        className="w-full py-2 bg-cr-navy text-white rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Calculating...' : 'Find Best Route'}
      </button>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Zone badge */}
          <div className="flex items-center gap-3">
            <span
              className="text-lg font-bold text-white px-4 py-1.5 rounded-lg"
              style={{ backgroundColor: ZONE_COLOURS[result.zone] ?? '#64748B' }}
            >
              Zone {result.zone}
            </span>
            <span className="text-sm font-medium text-gray-600">→ {result.day}</span>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: CONFIDENCE_COLOURS[result.confidence]?.bg,
                color: CONFIDENCE_COLOURS[result.confidence]?.text,
              }}
            >
              {result.confidence}
            </span>
          </div>

          {/* Geocoded address */}
          <div className="text-xs text-gray-500">{result.geocoded_address}</div>

          {/* Best route card */}
          <div className="border border-cr-border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{result.suggested_route.route_label}</span>
              {result.suggested_route.crew_code && (
                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                  {result.suggested_route.crew_code}
                </span>
              )}
              <span className="text-[10px] uppercase text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                {result.suggested_route.day_of_week}
              </span>
            </div>
            <CapacityBar totalWorkdayHrs={result.suggested_route.projected_workday_hrs} />
            <div className="text-xs text-gray-600">
              Current: {result.suggested_route.current_workday_hrs.toFixed(1)}h → After adding:{' '}
              <span className="font-semibold">
                {result.suggested_route.projected_workday_hrs.toFixed(1)}h
              </span>{' '}
              <CapacityBadge status={result.suggested_route.capacity_status} />
            </div>
            <div className="flex gap-4 text-xs text-gray-600">
              <span>+{Math.round(result.drive_time_addition_mins)} min drive</span>
              <span>+{Math.round(result.productive_time_addition_mins)} min productive</span>
            </div>
            {result.annual_revenue != null && userRole !== 'salesperson' && (
              <div className="text-xs text-gray-600">
                Est. value: <span className="font-semibold">${result.annual_revenue.toLocaleString()}/yr</span>
              </div>
            )}
          </div>

          {/* Alternatives */}
          {result.alternatives.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Alternatives</h4>
              {result.alternatives.map((alt, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 text-xs text-gray-600 border-b border-gray-100 last:border-b-0">
                  <span>
                    <span className="font-medium">Zone {alt.zone}</span> — {alt.day}
                    {alt.route_label && <span className="text-gray-400 ml-1">({alt.route_label})</span>}
                  </span>
                  <span>
                    {alt.projected_workday_hrs.toFixed(1)}h{' '}
                    <CapacityBadge status={alt.capacity_status} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CapacityBadge({ status }: { status: string }) {
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
