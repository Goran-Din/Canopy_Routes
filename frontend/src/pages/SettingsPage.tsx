import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { fetchSeasons } from '../api/auth.api';
import { getSettings, updateCrew, updateRoute } from '../api/settings.api';
import { NavBar } from '../components/NavBar';
import type { CrewSettings, RouteSlotSettings } from '../api/settings.api';

function CrewRow({ crew, onSaved }: { crew: CrewSettings; onSaved: () => void }) {
  const [mowRate, setMowRate] = useState(Number(crew.mow_rate_ac_hr));
  const [crewType, setCrewType] = useState(crew.crew_type || 'mixed');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateCrew(crew.id, { mow_rate_ac_hr: mowRate, crew_type: crewType });
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  const dirty = mowRate !== Number(crew.mow_rate_ac_hr) || crewType !== (crew.crew_type || 'mixed');

  return (
    <tr className="border-b border-gray-100">
      <td className="py-2 px-3 font-medium text-sm">{crew.crew_code}</td>
      <td className="py-2 px-3 text-sm text-gray-600">{crew.display_name}</td>
      <td className="py-2 px-3">
        <input
          type="number"
          step="0.10"
          min="0.5"
          max="10"
          value={mowRate}
          onChange={(e) => setMowRate(parseFloat(e.target.value) || 0)}
          className="w-20 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-300"
        />
      </td>
      <td className="py-2 px-3">
        <select
          value={crewType}
          onChange={(e) => setCrewType(e.target.value)}
          className="text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-300"
        >
          <option value="mixed">Mixed</option>
          <option value="commercial_only">Commercial Only</option>
          <option value="residential_only">Residential Only</option>
        </select>
      </td>
      <td className="py-2 px-3">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className={`text-xs font-medium px-3 py-1 rounded ${
            saved
              ? 'bg-green-100 text-green-700'
              : dirty
              ? 'bg-cr-navy text-white hover:opacity-90'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {saved ? 'Saved' : saving ? '...' : 'Save'}
        </button>
      </td>
    </tr>
  );
}

function RouteRow({ route, onSaved }: { route: RouteSlotSettings; onSaved: () => void }) {
  const [maxStops, setMaxStops] = useState(Number(route.max_stops));
  const [targetHours, setTargetHours] = useState(Number(route.target_hours));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateRoute(route.id, { max_stops: maxStops, target_hours: targetHours });
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  const dirty = maxStops !== Number(route.max_stops) || targetHours !== Number(route.target_hours);

  return (
    <tr className="border-b border-gray-100">
      <td className="py-2 px-3 text-sm font-medium">{route.route_label}</td>
      <td className="py-2 px-3">
        <span className="text-[10px] uppercase bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded tracking-wide">
          {route.day_of_week}
        </span>
      </td>
      <td className="py-2 px-3 text-sm text-gray-600">{route.crew_code || '—'}</td>
      <td className="py-2 px-3">
        <input
          type="number"
          min="10"
          max="100"
          value={maxStops}
          onChange={(e) => setMaxStops(parseInt(e.target.value) || 0)}
          className="w-16 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-300"
        />
      </td>
      <td className="py-2 px-3">
        <input
          type="number"
          step="0.25"
          min="4"
          max="12"
          value={targetHours}
          onChange={(e) => setTargetHours(parseFloat(e.target.value) || 0)}
          className="w-20 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-300"
        />
      </td>
      <td className="py-2 px-3">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className={`text-xs font-medium px-3 py-1 rounded ${
            saved
              ? 'bg-green-100 text-green-700'
              : dirty
              ? 'bg-cr-navy text-white hover:opacity-90'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {saved ? 'Saved' : saving ? '...' : 'Save'}
        </button>
      </td>
    </tr>
  );
}

export function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: seasons = [] } = useQuery({
    queryKey: ['seasons'],
    queryFn: fetchSeasons,
  });

  const activeSeason =
    seasons.find((s) => s.tab === 'maintenance' && s.status === 'draft') ??
    seasons.find((s) => s.status === 'draft') ??
    seasons[0];

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings', activeSeason?.id],
    queryFn: () => getSettings(activeSeason!.id),
    enabled: !!activeSeason,
  });

  function handleSaved() {
    queryClient.invalidateQueries({ queryKey: ['settings'] });
    queryClient.invalidateQueries({ queryKey: ['routes'] });
  }

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center h-screen bg-cr-surface text-cr-text-muted">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cr-surface">
      <NavBar />

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-cr-text">Settings</h1>
          {activeSeason && (
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              {activeSeason.season_label}
            </span>
          )}
        </div>
        {/* Crews Section */}
        <section>
          <h2 className="text-lg font-semibold text-cr-text mb-3">Crews</h2>
          <div className="bg-white rounded-lg border border-cr-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 uppercase border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-2 px-3 font-medium">Code</th>
                  <th className="text-left py-2 px-3 font-medium">Name</th>
                  <th className="text-left py-2 px-3 font-medium">Mow Rate (ac/hr)</th>
                  <th className="text-left py-2 px-3 font-medium">Crew Type</th>
                  <th className="text-left py-2 px-3 font-medium w-20"></th>
                </tr>
              </thead>
              <tbody>
                {settings.crews.map((crew) => (
                  <CrewRow key={crew.id} crew={crew} onSaved={handleSaved} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Route Slots Section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold text-cr-text">Route Slots</h2>
            <div className="group relative">
              <Info size={14} className="text-gray-400" />
              <div className="hidden group-hover:block absolute left-6 top-0 z-10 bg-gray-800 text-white text-xs rounded px-3 py-2 w-64 shadow-lg">
                Max stops overrides hour cap — whichever limit is hit first stops new assignments during auto-suggest.
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-cr-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 uppercase border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-2 px-3 font-medium">Route</th>
                  <th className="text-left py-2 px-3 font-medium">Day</th>
                  <th className="text-left py-2 px-3 font-medium">Crew</th>
                  <th className="text-left py-2 px-3 font-medium">Max Stops</th>
                  <th className="text-left py-2 px-3 font-medium">Target Hours</th>
                  <th className="text-left py-2 px-3 font-medium w-20"></th>
                </tr>
              </thead>
              <tbody>
                {settings.routes.map((route) => (
                  <RouteRow key={route.id} route={route} onSaved={handleSaved} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
