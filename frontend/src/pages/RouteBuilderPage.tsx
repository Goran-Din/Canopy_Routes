import { useQuery } from '@tanstack/react-query';
import { fetchSeasons } from '../api/auth.api';
import { useAuthStore } from '../store/authStore';
import { RouteBuilderMap } from '../components/map/RouteBuilderMap';
import { NavBar } from '../components/NavBar';

export function RouteBuilderPage() {
  const role = useAuthStore((s) => s.role) ?? 'coordinator';

  const { data: seasons = [], isLoading } = useQuery({
    queryKey: ['seasons'],
    queryFn: fetchSeasons,
  });

  const activeSeason =
    seasons.find((s) => s.tab === 'maintenance' && s.status === 'draft') ??
    seasons.find((s) => s.tab === 'maintenance' && s.status === 'pending_approval') ??
    seasons.find((s) => s.tab === 'maintenance' && s.status === 'published') ??
    seasons.find((s) => s.status === 'draft') ??
    seasons[0];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-cr-surface text-cr-text-muted">
        Loading seasons...
      </div>
    );
  }

  if (!activeSeason) {
    return (
      <div className="flex items-center justify-center h-screen bg-cr-surface text-cr-text-muted">
        No seasons found. Create a season to get started.
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col">
      <NavBar />
      <div className="flex-1 overflow-hidden">
        <RouteBuilderMap seasonId={activeSeason.id} seasonName={activeSeason.season_label} userRole={role} seasonStatus={activeSeason.status} />
      </div>
    </div>
  );
}
