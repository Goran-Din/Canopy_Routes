import { useState } from 'react';
import { createHardscapePin } from '../../api/hardscapePins.api';
import type { HardscapePin, CreatePinPayload } from '../../api/hardscapePins.api';

const CATEGORIES = [
  { value: 'driveway', label: 'Driveway' },
  { value: 'patio', label: 'Patio' },
  { value: 'retaining_wall', label: 'Retaining Wall' },
  { value: 'steps', label: 'Steps' },
  { value: 'other', label: 'Other' },
] as const;

interface AddHardscapePinModalProps {
  isOpen: boolean;
  lat: number;
  lng: number;
  seasonId?: string;
  onClose: () => void;
  onAdded: (pin: HardscapePin) => void;
}

export function AddHardscapePinModal({ isOpen, lat, lng, seasonId, onClose, onAdded }: AddHardscapePinModalProps) {
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<CreatePinPayload['category']>('driveway');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  async function handleSubmit() {
    if (!label.trim()) return;
    setLoading(true);
    setError('');
    try {
      const pin = await createHardscapePin({
        lat,
        lng,
        label: label.trim(),
        category,
        notes: notes.trim() || undefined,
        season_id: seasonId,
      });
      setLabel('');
      setNotes('');
      setCategory('driveway');
      onAdded(pin);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to create pin.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-cr-text">Add Hardscape Pin</h2>
        </div>

        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Label *</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={100}
              disabled={loading}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cr-blue disabled:bg-gray-50"
              placeholder="e.g. 123 Main St Driveway"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CreatePinPayload['category'])}
              disabled={loading}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cr-blue disabled:bg-gray-50"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={3}
              disabled={loading}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cr-blue resize-none disabled:bg-gray-50"
              placeholder="Optional notes..."
            />
            <div className="text-xs text-gray-400 text-right">{notes.length}/500</div>
          </div>

          <div className="flex gap-4 text-xs text-gray-500">
            <span>Lat: {lat.toFixed(6)}</span>
            <span>Lng: {lng.toFixed(6)}</span>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              {typeof error === 'string' ? error : 'Validation error'}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-cr-border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!label.trim() || loading}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-cr-navy rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Add Pin
          </button>
        </div>
      </div>
    </div>
  );
}
