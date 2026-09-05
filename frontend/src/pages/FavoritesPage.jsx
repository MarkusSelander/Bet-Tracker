import { Search, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import PageHeader from '../components/PageHeader';
import { Input } from '../components/ui/input';
import { favoritesStatus } from '../lib/favorites';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const cardClass = 'bg-[#18181B] border border-[#27272A] rounded-xl p-4';
const status = favoritesStatus();

function TeamBadge({ src, alt }) {
  if (!src) return null;
  return <img src={src} alt={alt || ''} className="h-5 w-5 shrink-0 rounded-full object-contain bg-white/5" />;
}

export default function FavoritesPage() {
  useOutletContext();
  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(true);

  const loadTeams = useCallback(async () => {
    if (!BACKEND_URL) {
      toast.error('Backend-URL mangler');
      setLoadingTeams(false);
      return [];
    }
    const response = await fetch(`${BACKEND_URL}/api/favorites/teams`, { credentials: 'include' });
    if (!response.ok) throw new Error(`Favoritter ${response.status}`);
    const data = await response.json();
    const list = Array.isArray(data) ? data : [];
    setTeams(list);
    return list;
  }, []);

  useEffect(() => {
    const boot = async () => {
      try {
        await loadTeams();
      } catch (error) {
        console.error('Error fetching favorite teams:', error);
        toast.error('Kunne ikke laste favorittlag');
        setTeams([]);
      } finally {
        setLoadingTeams(false);
      }
    };
    boot();
  }, [loadTeams]);

  const removeTeam = async (team) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/favorites/teams/${team.team_id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Slett ${response.status}`);
      toast.success(`${team.team_name} fjernet`);
      setTeams((current) => current.filter((item) => item.team_id !== team.team_id));
    } catch (error) {
      console.error('Error removing favorite team:', error);
      toast.error('Kunne ikke fjerne lag');
    }
  };

  if (loadingTeams) {
    return (
      <div className="space-y-6">
        <PageHeader title="Favoritter" subtitle={status.subtitle} testId="favorites-title" />
        <div className={`${cardClass} h-24 shimmer`} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Favoritter" subtitle={status.subtitle} testId="favorites-title" />

      <div className={cardClass}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted pointer-events-none" />
          <Input
            value=""
            disabled
            placeholder="Søk og legg til lag…"
            className="pl-9 bg-black/20 border-white/10"
            data-testid="favorites-search"
            autoComplete="off"
          />
        </div>
        {teams.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {teams.map((team) => (
              <span
                key={team.team_id}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 pl-1.5 pr-1 py-1 text-sm"
                data-testid={`favorite-chip-${team.team_id}`}
              >
                <TeamBadge src={team.team_badge || team.badge} alt="" />
                <span>{team.team_name}</span>
                <button
                  type="button"
                  onClick={() => removeTeam(team)}
                  className="rounded-full p-0.5 text-text-muted hover:bg-white/10 hover:text-text-primary"
                  aria-label={`Fjern ${team.team_name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <p className="mt-3 text-sm text-text-muted" data-testid="favorites-empty-hint">
          {status.emptyHint}
        </p>
      </div>
    </div>
  );
}
