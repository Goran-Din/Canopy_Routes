import { useState } from 'react';
import { recordActuals } from '../api/snapshots.api';

interface Props {
  routeId: string;
  routeName: string;
  seasonId: string;
  estimatedHrs: number;
  open: boolean;
  onClose: () => void;
}

export function EnterActualsModal({ routeId, routeName, seasonId, estimatedHrs, open, onClose }: Props) {
  const [weekOf, setWeekOf] = useState('');
  const [actualHrs, setActualHrs] = useState(estimatedHrs.toFixed(1));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!open) return null;

  async function save() {
    if (!weekOf || !actualHrs) return;
    setSaving(true);
    try {
      await recordActuals(routeId, seasonId, weekOf, parseFloat(actualHrs));
      setSaved(true);
      setTimeout(onClose, 1000);
    } catch {
      alert('Failed to save actuals. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const variance = parseFloat(actualHrs) - estimatedHrs;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900 text-sm">Enter Actual Hours</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg font-bold">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-sm text-gray-600 font-medium">{routeName}</div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Week of (Monday)</label>
            <input type="date" value={weekOf} onChange={(e) => setWeekOf(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Actual Hours <span className="text-gray-400">(estimated: {estimatedHrs.toFixed(1)}h)</span>
            </label>
            <input type="number" step="0.1" min="0" max="24" value={actualHrs}
              onChange={(e) => setActualHrs(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>

          {actualHrs && !isNaN(parseFloat(actualHrs)) && (
            <div className={`text-sm font-medium ${variance > 0 ? 'text-amber-600' : variance < 0 ? 'text-teal-600' : 'text-gray-500'}`}>
              Variance: {variance > 0 ? '+' : ''}{variance.toFixed(1)}h
              {Math.abs(variance) > 0.5 && (
                <span className="text-xs font-normal text-gray-400 ml-1">
                  {variance > 0 ? '(running long)' : '(running short)'}
                </span>
              )}
            </div>
          )}

          <button onClick={save} disabled={saving || !weekOf || saved}
            className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40">
            {saved ? 'Saved' : saving ? 'Saving...' : 'Save Actuals'}
          </button>
        </div>
      </div>
    </div>
  );
}
