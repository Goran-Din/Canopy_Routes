import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Upload, Map as MapIcon, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { fetchSeasons } from '../api/auth.api';
import { getDashboard, submitSeasonForReview } from '../api/dashboard.api';
import { exportRouteCsv } from '../api/routes.api';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { NavBar } from '../components/NavBar';
import { ProfitabilityTable } from '../components/ProfitabilityTable';
import { AiInsightsSection } from '../components/AiInsightsSection';
import { SeasonHistoryModal } from '../components/SeasonHistoryModal';
import { PublishSeasonModal } from '../components/PublishSeasonModal';
import { RequestChangesModal } from '../components/RequestChangesModal';
import type { DashboardData, RouteSlotSummary, NeedsAttentionItem } from '../api/dashboard.api';

function fmt$(n: number): string {
  return '$' + Math.round(n).toLocaleString();
}

const DAY_COLS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
const CREW_ROWS = [1, 2, 3] as const;

// ── Season Banner ──────────────────────────────────────────────
function SeasonBanner({
  data,
  role,
  onSubmitForReview,
  onPublish,
  onRequestChanges,
  submitting,
}: {
  data: DashboardData;
  role: string;
  onSubmitForReview: () => void;
  onPublish: () => void;
  onRequestChanges: () => void;
  submitting: boolean;
}) {
  const { season, clients, routes } = data;
  const s = season.status;

  if (s === 'draft') {
    const text = `${season.label} in progress \u00B7 ${clients.assigned} of ${clients.total} clients assigned${
      routes.red > 0 ? ` \u00B7 ${routes.red} route${routes.red > 1 ? 's' : ''} over capacity` : ''
    }`;
    return (
      <div>
        <div className="border border-amber-200 bg-amber-50 rounded-lg px-4 py-3 text-sm font-medium text-amber-900 flex items-center gap-3">
          <span className="flex-1">{text}</span>
          {role === 'coordinator' && (
            <button
              onClick={onSubmitForReview}
              disabled={submitting}
              className="flex-shrink-0 bg-cr-navy text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit for Review'}
            </button>
          )}
          {role === 'owner' && (
            <button
              onClick={onPublish}
              className="flex-shrink-0 bg-cr-navy text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:opacity-90"
            >
              Publish Season
            </button>
          )}
        </div>
        {season.request_changes_note && (
          <div className="mt-2 border border-blue-200 bg-blue-50 rounded-lg px-4 py-2.5 text-sm text-blue-800">
            <span className="font-semibold">Erick requested changes:</span> {season.request_changes_note}
          </div>
        )}
      </div>
    );
  }

  if (s === 'pending_approval') {
    const submittedDate = season.submitted_at
      ? new Date(season.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '';
    return (
      <div className="border border-blue-200 bg-blue-50 rounded-lg px-4 py-3 text-sm font-medium text-blue-900 flex items-center gap-3">
        {role === 'owner' ? (
          <>
            <span className="flex-1">{'\uD83D\uDCCB'} Season Ready for Your Review \u00B7 Submitted {submittedDate}</span>
            <button
              onClick={onRequestChanges}
              className="flex-shrink-0 border border-blue-300 text-blue-800 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-blue-100"
            >
              Request Changes
            </button>
            <button
              onClick={onPublish}
              className="flex-shrink-0 bg-cr-navy text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:opacity-90"
            >
              Publish Season
            </button>
          </>
        ) : (
          <span className="flex-1">{'\u23F3'} Awaiting Erick's Review \u00B7 Submitted {submittedDate}</span>
        )}
      </div>
    );
  }

  if (s === 'published') {
    const pubDate = season.published_at
      ? new Date(season.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';
    return (
      <div className="border border-green-200 bg-green-50 rounded-lg px-4 py-3 text-sm font-medium text-green-900">
        {'\u2713'} {season.label} Published \u00B7 {pubDate} \u00B7 {routes.total} routes \u00B7 {clients.total} clients
      </div>
    );
  }

  return (
    <div className="border border-slate-200 bg-slate-100 rounded-lg px-4 py-3 text-sm font-medium text-slate-600">
      Archived season — viewing historical data only
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────
function KpiCard({
  accent,
  value,
  label,
  detail,
  onClick,
}: {
  accent: string;
  value: string;
  label: string;
  detail: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-cr-border overflow-hidden ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="h-1 rounded-t-xl" style={{ backgroundColor: accent }} />
      <div className="px-4 py-4">
        <div className="text-3xl font-bold text-cr-text">{value}</div>
        <div className="text-sm text-cr-text-muted mt-1">{label}</div>
        <div className="text-xs text-cr-text-muted mt-1">{detail}</div>
      </div>
    </div>
  );
}

// ── Route Health Cell ──────────────────────────────────────────
function RouteCell({ slot, onClick }: { slot: RouteSlotSummary; onClick: () => void }) {
  const fillColor =
    slot.capacity_status === 'red' ? '#DC2626' :
    slot.capacity_status === 'yellow' ? '#F59E0B' : '#2E8B57';
  const pct = Math.min((slot.workday_hrs / 9.0) * 100, 100);
  const isThursday = slot.day_of_week === 'thursday';

  return (
    <div
      onClick={onClick}
      className="relative bg-white border border-cr-border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow"
    >
      {isThursday && (
        <span
          className="absolute top-1 right-1 text-amber-500 text-xs font-bold"
          title="91-min depot return applies on Thursdays"
        >!</span>
      )}
      <div className="text-sm font-medium text-cr-text truncate">{slot.route_label}</div>
      <div className="text-xs text-cr-text-muted">{slot.crew_code ?? 'No crew'}</div>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded bg-cr-border overflow-hidden">
          <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: fillColor }} />
        </div>
        <span className="text-xs font-medium text-cr-text">{slot.workday_hrs.toFixed(1)}h</span>
      </div>
      <div className="text-xs text-cr-text-muted mt-1">{slot.stops} stops</div>
    </div>
  );
}

// ── Attention Icon ─────────────────────────────────────────────
function AttentionIcon({ type }: { type: NeedsAttentionItem['type'] }) {
  const icons: Record<string, string> = {
    geocode_failed: '\uD83D\uDCCD',
    over_capacity: '\u26A0',
    unconfirmed_acres: '\u2605',
    unassigned_clients: '\uD83D\uDCCB',
    no_crew: '\uD83D\uDC65',
  };
  return <span className="text-base">{icons[type] ?? '?'}</span>;
}

function SeverityBadge({ severity }: { severity: string }) {
  const cls =
    severity === 'high' ? 'bg-red-100 text-red-700' :
    severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600';
  return (
    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${cls}`}>
      {severity}
    </span>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────
export function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.role) ?? 'coordinator';
  const addToast = useUIStore((s) => s.addToast);
  const setActiveRouteId = useUIStore((s) => s.setActiveRouteId);
  const setUploadOpen = useUIStore((s) => s.setUploadOpen);
  const [attentionOpen, setAttentionOpen] = useState(true);
  const [publishOpen, setPublishOpen] = useState(false);
  const [requestChangesOpen, setRequestChangesOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: seasons = [], isLoading: seasonsLoading } = useQuery({
    queryKey: ['seasons'],
    queryFn: fetchSeasons,
  });

  const activeSeason =
    seasons.find((s) => s.tab === 'maintenance' && (s.status === 'draft' || s.status === 'pending_approval' || s.status === 'published')) ??
    seasons[0];

  function invalidateDashboard() {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['seasons'] });
  }

  async function handleSubmitForReview() {
    if (!activeSeason) return;
    setSubmitting(true);
    try {
      await submitSeasonForReview(activeSeason.id);
      addToast('Season submitted for review', 'success');
      invalidateDashboard();
    } catch (err: any) {
      addToast(err.response?.data?.error ?? 'Failed to submit for review', 'error');
    } finally {
      setSubmitting(false);
      setConfirmSubmit(false);
    }
  }

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard', activeSeason?.id],
    queryFn: () => getDashboard(activeSeason!.id),
    enabled: !!activeSeason,
  });

  if (seasonsLoading || dashLoading || !dashboard) {
    return (
      <div className="min-h-screen bg-cr-surface">
        <NavBar />
        <div className="flex items-center justify-center h-[calc(100vh-3rem)] text-cr-text-muted">
          Loading dashboard...
        </div>
      </div>
    );
  }

  const { clients, revenue, routes, route_slots, needs_attention } = dashboard;
  const isSalesperson = role === 'salesperson';

  // Build the 5x3 grid map: day → crew_index → slot
  const gridMap = new Map<string, RouteSlotSummary>();
  for (const slot of route_slots) {
    gridMap.set(`${slot.day_of_week}-${slot.crew_code}`, slot);
  }

  // Map crew rows to crew codes
  const crewCodes = ['MAINT-1', 'MAINT-2', 'MAINT-3'];

  function handleRouteClick(routeId: string) {
    setActiveRouteId(routeId);
    navigate('/routes');
  }

  function handleAttentionAction(item: NeedsAttentionItem) {
    if (item.action === 'view_unassigned') {
      navigate('/routes');
    } else if (item.action === 'open_settings') {
      navigate('/settings');
    } else if (item.action.startsWith('open_route_')) {
      const routeId = item.action.replace('open_route_', '');
      setActiveRouteId(routeId);
      navigate('/routes');
    } else {
      navigate('/routes');
    }
  }

  // Route F status — find the "F" or last route pattern
  const routeFSlot = route_slots.find((s) => s.route_label.includes('F'));
  const routeFSafe = !routeFSlot || routeFSlot.capacity_status !== 'red';

  return (
    <div className="min-h-screen bg-cr-surface">
      <NavBar />

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Section 1: Season Banner */}
        <SeasonBanner
          data={dashboard}
          role={role}
          onSubmitForReview={() => setConfirmSubmit(true)}
          onPublish={() => setPublishOpen(true)}
          onRequestChanges={() => setRequestChangesOpen(true)}
          submitting={submitting}
        />

        {/* Submit confirmation dialog */}
        {confirmSubmit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
              <h3 className="text-sm font-semibold text-cr-text">Submit {dashboard.season.label} for Erick's review?</h3>
              <p className="text-xs text-gray-500">You will not be able to make changes until Erick reviews or requests changes.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmSubmit(false)}
                  disabled={submitting}
                  className="flex-1 py-2 text-sm font-medium text-gray-600 border border-cr-border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitForReview}
                  disabled={submitting}
                  className="flex-1 py-2 text-sm font-medium text-white bg-cr-navy rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section 2: KPI Cards */}
        <div className={`grid gap-4 ${isSalesperson ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3'}`}>
          <KpiCard
            accent="#2E75B6"
            value={String(clients.total)}
            label="Total Clients"
            detail={`Confirmed: ${clients.confirmed} \u00B7 Pending: ${clients.pending} \u00B7 At Risk: ${clients.at_risk}`}
          />
          <KpiCard
            accent="#2E8B57"
            value={`${clients.assigned} / ${clients.total}`}
            label="Assigned"
            detail={`${clients.unassigned} unassigned`}
            onClick={() => navigate('/routes')}
          />
          <KpiCard
            accent="#D4760A"
            value={String(routes.total)}
            label="Routes"
            detail={`GREEN: ${routes.green} \u00B7 YELLOW: ${routes.yellow} \u00B7 RED: ${routes.red}`}
          />
          {!isSalesperson && (
            <KpiCard
              accent="#0D7377"
              value={fmt$(revenue.annual_total)}
              label="Annual Revenue"
              detail={`${fmt$(revenue.monthly_avg)}/mo avg`}
            />
          )}
          <KpiCard
            accent="#F59E0B"
            value={`${needs_attention.length} items`}
            label="Needs Attention"
            detail={[...new Set(needs_attention.map((i) => i.type.replace(/_/g, ' ')))].join(', ') || 'All clear'}
          />
          {!isSalesperson && (
            <KpiCard
              accent={routeFSafe ? '#2E8B57' : '#DC2626'}
              value={routeFSafe ? 'SAFE' : 'AT RISK'}
              label="Route F Status"
              detail={routeFSlot ? `${routeFSlot.stops} of ${routeFSlot.max_stops} stop capacity` : 'No Route F'}
            />
          )}
        </div>

        {/* Section 3: Quick Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setUploadOpen(true); navigate('/routes'); }}
            className="flex items-center gap-2 bg-white border border-cr-border text-cr-text text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50"
          >
            <Upload size={16} />
            Upload Client CSV
          </button>
          <button
            onClick={() => navigate('/routes')}
            className="flex items-center gap-2 bg-cr-navy text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90"
          >
            <MapIcon size={16} />
            Open Route Builder
          </button>
          {activeSeason && (
            <button
              onClick={() => exportRouteCsv(activeSeason.id)}
              className="flex items-center gap-2 bg-white border border-cr-border text-cr-text text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50"
            >
              <Download size={16} />
              Export Route Plan
            </button>
          )}
          {!isSalesperson && (
            <button
              onClick={() => setHistoryOpen(true)}
              className="text-sm text-blue-600 hover:underline ml-2"
            >
              View History
            </button>
          )}
        </div>

        {/* Section 4: Route Health Grid */}
        <section>
          <h2 className="text-lg font-semibold text-cr-text mb-3">Route Health</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-separate" style={{ borderSpacing: '8px' }}>
              <thead>
                <tr>
                  <th className="w-16" />
                  {DAY_COLS.map((day) => (
                    <th key={day} className="text-[10px] uppercase tracking-widest text-cr-text-muted font-semibold text-center pb-1">
                      {day.slice(0, 3)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CREW_ROWS.map((crewNum) => (
                  <tr key={crewNum}>
                    <td className="text-xs text-cr-text-muted font-medium pr-2 text-right whitespace-nowrap">
                      Crew {crewNum}
                    </td>
                    {DAY_COLS.map((day) => {
                      const slot = gridMap.get(`${day}-${crewCodes[crewNum - 1]}`);
                      if (!slot) {
                        return (
                          <td key={day}>
                            <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-3 text-center text-xs text-gray-300">
                              —
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td key={day}>
                          <RouteCell slot={slot} onClick={() => handleRouteClick(slot.id)} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 5: Needs Attention */}
        <section>
          <button
            onClick={() => setAttentionOpen(!attentionOpen)}
            className="flex items-center gap-2 text-lg font-semibold text-cr-text mb-3"
          >
            {attentionOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            Needs Attention
            {needs_attention.length > 0 && (
              <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                {needs_attention.length}
              </span>
            )}
          </button>

          {attentionOpen && (
            <div className="bg-white rounded-xl border border-cr-border divide-y divide-cr-border">
              {needs_attention.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-cr-text-muted">
                  All clear — no items need attention.
                </div>
              )}
              {needs_attention.map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <AttentionIcon type={item.type} />
                  <SeverityBadge severity={item.severity} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-cr-text">{item.label}</div>
                    <div className="text-xs text-cr-text-muted">{item.detail}</div>
                  </div>
                  <button
                    onClick={() => handleAttentionAction(item)}
                    className="text-xs font-medium text-cr-navy hover:underline flex-shrink-0"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 6: Profitability */}
        {!isSalesperson && activeSeason && (
          <ProfitabilityTable seasonId={activeSeason.id} />
        )}

        {/* Section 7: AI Insights */}
        {!isSalesperson && activeSeason && (
          <AiInsightsSection seasonId={activeSeason.id} />
        )}
      </div>

      <SeasonHistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />

      {/* Modals */}
      {activeSeason && (
        <>
          <PublishSeasonModal
            isOpen={publishOpen}
            onClose={() => setPublishOpen(false)}
            onPublished={() => { invalidateDashboard(); addToast('Season published!', 'success'); }}
            seasonId={activeSeason.id}
            dashboard={dashboard}
          />
          <RequestChangesModal
            isOpen={requestChangesOpen}
            onClose={() => setRequestChangesOpen(false)}
            onRequested={() => { invalidateDashboard(); addToast('Changes requested — coordinator notified', 'success'); }}
            seasonId={activeSeason.id}
          />
        </>
      )}
    </div>
  );
}
