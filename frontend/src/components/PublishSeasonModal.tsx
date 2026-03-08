import { useState, useEffect } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { getSeasonValidation, publishSeason, ValidationCheck } from '../api/dashboard.api';
import type { DashboardData } from '../api/dashboard.api';

interface PublishSeasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublished: () => void;
  seasonId: string;
  dashboard: DashboardData;
}

export function PublishSeasonModal({ isOpen, onClose, onPublished, seasonId, dashboard }: PublishSeasonModalProps) {
  const [checks, setChecks] = useState<ValidationCheck[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setChecks(null);
      setPublishing(false);
      setPublished(false);
      setError('');
      return;
    }
    setLoading(true);
    getSeasonValidation(seasonId)
      .then((res) => setChecks(res.checks))
      .catch(() => setError('Failed to load validation checks.'))
      .finally(() => setLoading(false));
  }, [isOpen, seasonId]);

  if (!isOpen) return null;

  const allPassed = checks?.every((c) => c.passed) ?? false;
  const { clients, routes, revenue } = dashboard;

  async function handlePublish() {
    setPublishing(true);
    setError('');
    try {
      await publishSeason(seasonId);
      setPublished(true);
      setTimeout(() => {
        onPublished();
        onClose();
      }, 2000);
    } catch (err: any) {
      if (err.response?.status === 422 && err.response?.data?.checks) {
        setChecks(err.response.data.checks);
        setError('Pre-publish validation failed.');
      } else {
        setError(err.response?.data?.error ?? 'Publish failed.');
      }
      setPublishing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-cr-navy">Publish {dashboard.season.label}</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {published ? (
            <div className="flex flex-col items-center py-8 gap-3">
              <CheckCircle size={48} className="text-green-500" />
              <div className="text-lg font-semibold text-green-700">Season Published!</div>
            </div>
          ) : (
            <>
              {/* Validation checks */}
              <div>
                <h3 className="text-sm font-semibold text-cr-text mb-2">Pre-publish Validation</h3>
                {loading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                    <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    Running checks...
                  </div>
                ) : checks ? (
                  <div className="space-y-2">
                    {checks.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 text-sm">
                        {c.passed ? (
                          <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle size={16} className="text-red-500 flex-shrink-0" />
                        )}
                        <span className={c.passed ? 'text-gray-700' : 'text-red-700 font-medium'}>
                          {c.label}
                        </span>
                        {!c.passed && (
                          <span className="text-xs text-red-500 ml-1">(blocking)</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Season summary */}
              <div>
                <h3 className="text-sm font-semibold text-cr-text mb-2">Season Summary</h3>
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-cr-text">{routes.total}</div>
                    <div className="text-xs text-gray-500">Routes</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-cr-text">{clients.assigned}</div>
                    <div className="text-xs text-gray-500">Assigned Clients</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-cr-text">${Math.round(revenue.annual_total).toLocaleString()}</div>
                    <div className="text-xs text-gray-500">Annual Revenue</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-cr-text">
                      {routes.total > 0
                        ? (dashboard.route_slots.reduce((s, r) => s + r.workday_hrs, 0) / routes.total).toFixed(1)
                        : '0.0'}h
                    </div>
                    <div className="text-xs text-gray-500">Avg Workday</div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {!published && (
          <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
            <button
              onClick={onClose}
              disabled={publishing}
              className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-cr-border rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handlePublish}
              disabled={!allPassed || publishing || loading}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-cr-navy rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {publishing && (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Publish Season
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
