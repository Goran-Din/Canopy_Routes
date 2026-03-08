import { useQuery } from '@tanstack/react-query';
import { fetchProfitability } from '../api/profitability.api';
import type { RouteProfit } from '../api/profitability.api';

const STATUS_COLORS: Record<string, string> = {
  EXCELLENT: 'bg-green-100 text-green-800',
  GOOD: 'bg-blue-100 text-blue-800',
  FAIR: 'bg-yellow-100 text-yellow-800',
  POOR: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

function fmt$(n: number): string {
  return '$' + Math.round(n).toLocaleString();
}

interface ProfitabilityTableProps {
  seasonId: string;
}

export function ProfitabilityTable({ seasonId }: ProfitabilityTableProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['profitability', seasonId],
    queryFn: () => fetchProfitability(seasonId),
    enabled: !!seasonId,
  });

  if (isLoading) return <div className="text-sm text-gray-500 py-4">Loading profitability data...</div>;
  if (error || !data) return <div className="text-sm text-red-500 py-4">Failed to load profitability data.</div>;

  const { routes, summary } = data;

  if (routes.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold text-cr-text mb-3">Route Profitability</h2>

      {/* Summary KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-cr-border p-4">
          <div className="text-2xl font-bold text-cr-text">{summary.avgMarginPercent}%</div>
          <div className="text-sm text-cr-text-muted">Avg Route Margin</div>
        </div>
        <div className="bg-white rounded-xl border border-cr-border p-4">
          <div className="text-2xl font-bold text-green-700">{fmt$(summary.totalProfit)}</div>
          <div className="text-sm text-cr-text-muted">Season Profit Est.</div>
        </div>
        <div className="bg-white rounded-xl border border-cr-border p-4">
          <div className="text-2xl font-bold text-blue-700 truncate">{summary.bestRoute?.routeName ?? '\u2014'}</div>
          <div className="text-sm text-cr-text-muted">Best Route ({summary.bestRoute?.marginPercent ?? 0}%)</div>
        </div>
        <div className="bg-white rounded-xl border border-cr-border p-4">
          <div className={`text-2xl font-bold ${summary.routesNeedingReview > 0 ? 'text-red-600' : 'text-green-700'}`}>
            {summary.routesNeedingReview}
          </div>
          <div className="text-sm text-cr-text-muted">Routes Need Review</div>
        </div>
      </div>

      {/* Route profitability table */}
      <div className="bg-white rounded-xl border border-cr-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-cr-text-muted uppercase">
            <tr>
              <th className="px-4 py-2 text-left">Route</th>
              <th className="px-4 py-2 text-right">Stops</th>
              <th className="px-4 py-2 text-right">Revenue</th>
              <th className="px-4 py-2 text-right">Cost</th>
              <th className="px-4 py-2 text-right">Profit</th>
              <th className="px-4 py-2 text-right">Margin</th>
              <th className="px-4 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {routes.map((r: RouteProfit) => (
              <tr key={r.routeId} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-cr-text">{r.routeName}</td>
                <td className="px-4 py-2 text-right text-cr-text-muted">{r.stopCount}</td>
                <td className="px-4 py-2 text-right text-cr-text">{fmt$(r.annualRevenue)}</td>
                <td className="px-4 py-2 text-right text-cr-text-muted">{fmt$(r.annualCost)}</td>
                <td className={`px-4 py-2 text-right font-medium ${r.annualProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {fmt$(r.annualProfit)}
                </td>
                <td className="px-4 py-2 text-right font-bold">{r.marginPercent}%</td>
                <td className="px-4 py-2 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[r.status]}`}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-semibold text-sm border-t">
            <tr>
              <td className="px-4 py-2">TOTAL</td>
              <td />
              <td className="px-4 py-2 text-right">{fmt$(summary.totalRevenue)}</td>
              <td className="px-4 py-2 text-right">{fmt$(summary.totalCost)}</td>
              <td className={`px-4 py-2 text-right ${summary.totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {fmt$(summary.totalProfit)}
              </td>
              <td className="px-4 py-2 text-right">{summary.avgMarginPercent}%</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
