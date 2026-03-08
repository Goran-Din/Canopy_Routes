import { useState } from 'react';
import { requestSeasonChanges } from '../api/dashboard.api';

interface RequestChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequested: () => void;
  seasonId: string;
}

export function RequestChangesModal({ isOpen, onClose, onRequested, seasonId }: RequestChangesModalProps) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  async function handleSubmit() {
    if (!note.trim()) return;
    setLoading(true);
    setError('');
    try {
      await requestSeasonChanges(seasonId, note.trim());
      setNote('');
      onRequested();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to request changes.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-cr-text">Request Changes</h2>
        </div>

        <div className="px-6 py-4 space-y-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">Note for coordinator</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={4}
            disabled={loading}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cr-blue resize-none disabled:bg-gray-50"
            placeholder="Describe what needs to be adjusted..."
          />
          <div className="text-xs text-gray-400 text-right">{note.length}/500</div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              {error}
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
            disabled={!note.trim() || loading}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-cr-navy rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Send Request
          </button>
        </div>
      </div>
    </div>
  );
}
