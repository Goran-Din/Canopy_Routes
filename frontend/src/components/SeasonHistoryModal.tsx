import { useQuery } from '@tanstack/react-query';
import { fetchSnapshots } from '../api/snapshots.api';
import type { Snapshot } from '../api/snapshots.api';

interface Props {
  open: boolean;
  onClose: () => void;
}

function fmt$(n: number) { return '$' + Math.round(n).toLocaleString(); }

export function SeasonHistoryModal({ open, onClose }: Props) {
  const { data: snapshots = [], isLoading } = useQuery<Snapshot[]>({
    queryKey: ['season-snapshots'],
    queryFn: fetchSnapshots,
    enabled: open,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Season History</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && <div className="text-sm text-gray-400">Loading history...</div>}
          {!isLoading && snapshots.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 text-sm">No archived seasons yet.</div>
              <div className="text-gray-400 text-xs mt-1">Snapshots are created when a season is archived.</div>
            </div>
          )}
          {snapshots.length > 0 && (
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Season</th>
                  <th className="px-3 py-2 text-right">Clients</th>
                  <th className="px-3 py-2 text-right">Revenue</th>
                  <th className="px-3 py-2 text-right">Avg Margin</th>
                  <th className="px-3 py-2 text-left">Archived</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {snapshots.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 font-medium text-gray-800">
                      {s.seasonYear} <span className="text-gray-400 font-normal capitalize">({s.seasonType})</span>
                    </td>
                    <td className="px-3 py-3 text-right text-gray-600">{s.totalClients}</td>
                    <td className="px-3 py-3 text-right text-gray-800">{fmt$(s.totalRevenue)}</td>
                    <td className="px-3 py-3 text-right font-semibold">
                      <span className={s.avgMarginPercent >= 35 ? 'text-green-700' : s.avgMarginPercent >= 20 ? 'text-amber-600' : 'text-red-600'}>
                        {s.avgMarginPercent}%
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-400 text-xs">
                      {new Date(s.snapshotAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <p className="text-xs text-gray-400">Snapshots are read-only records of each archived season. The AI assistant has access to this history.</p>
        </div>
      </div>
    </div>
  );
}
