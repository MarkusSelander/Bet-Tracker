import { Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import FixtureBoard from '../components/FixtureBoard';
import PageHeader from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { fetchWithTimeout } from '../lib/fetch';
import { useFavoriteTeams, useFavoriteToday } from '../lib/queries';
import { queryClient, queryKeys } from '../lib/queryClient';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const EMPTY_LIST = [];
const SPORT_LABEL = { football: 'Fotball', tennis: 'Tennis' };
const SPORT_ORDER = ['football', 'tennis'];

function sportLabel(sport) {
  return SPORT_LABEL[sport] || sport;
}

function formatKickoff(iso) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

function scoreText(match) {
  if (match.home_score == null && match.away_score == null) return '';
  return `${match.home_score ?? '–'}–${match.away_score ?? '–'}`;
}

function isLive(match) {
  return match?.status === 'inprogress';
}

export default function FavoritesPage() {
  const [error, setError] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const { data: teams = EMPTY_LIST, isLoading: teamsLoading } = useFavoriteTeams();
  const {
    data: matches = EMPTY_LIST,
    error: matchesError,
    isError: matchesIsError,
    isFetching: matchesFetching,
  } = useFavoriteToday();

  const groups = useMemo(() => {
    return SPORT_ORDER.map((sport) => ({
      sport,
      label: sportLabel(sport),
      matches: matches.filter((match) => match.sport === sport),
    })).filter((group) => group.matches.length > 0);
  }, [matches]);

  useEffect(() => {
    if (!matchesIsError) {
      setError(null);
      return undefined;
    }
    setError(matchesError?.message || 'Kunne ikke hente kamper');
    return undefined;
  }, [matchesError, matchesIsError]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!searchOpen) return undefined;
    if (!query) {
      setSearchError(null);
      setSearchLoading(false);
      setSearchResults([]);
      return undefined;
    }
    setSearchLoading(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await fetchWithTimeout(
          `${BACKEND_URL}/api/favorites/search?query=${encodeURIComponent(query)}`,
          { credentials: 'include' }
        );
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          const detail = typeof data?.detail === 'string' ? data.detail : '';
          setSearchError(detail || 'Kunne ikke søke');
          setSearchResults([]);
          return;
        }
        setSearchError(null);
        setSearchResults(data.teams || []);
      } catch (err) {
        if (cancelled) return;
        setSearchError(err.message || 'Kunne ikke søke');
        setSearchResults([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchOpen, searchQuery]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.favoriteTeams }),
      queryClient.invalidateQueries({ queryKey: queryKeys.favoriteToday }),
    ]);
  };

  const addTeam = async (team) => {
    try {
      const response = await fetchWithTimeout(`${BACKEND_URL}/api/favorites/teams`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sofascore_id: team.sofascore_id,
          kind: team.kind,
          name: team.name,
          sport: team.sport,
          team_id: team.team_id,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSearchError(typeof data?.detail === 'string' ? data.detail : 'Kunne ikke lagre');
        return;
      }
      setSearchOpen(false);
      setSearchQuery('');
      await refresh();
    } catch (err) {
      setSearchError(err.message || 'Kunne ikke lagre');
    }
  };

  const removeTeam = async (team) => {
    try {
      const response = await fetchWithTimeout(`${BACKEND_URL}/api/favorites/teams`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sofascore_id: team.sofascore_id,
          kind: team.kind,
          name: team.name,
          sport: team.sport,
        }),
      });
      if (!response.ok) {
        setError('Kunne ikke fjerne laget');
        return;
      }
      await refresh();
    } catch (err) {
      setError(err.message || 'Kunne ikke fjerne laget');
    }
  };

  const noTeams = !teamsLoading && teams.length === 0;
  const showToday = matches.length > 0 || (teams.length > 0 && matchesFetching);

  return (
    <div className="space-y-4">
      <PageHeader title="Favoritter" subtitle="Følg dine favorittlag og kommende kamper" testId="favorites-title" />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="bg-[#18181B] border border-[#27272A] rounded-xl p-4 space-y-4 h-fit">
          <section>
            <h2 className="text-xs uppercase tracking-wide text-text-muted mb-2">Mine lag</h2>
            {noTeams ? (
              <p className="text-xs text-text-secondary">Ingen lag favorisert</p>
            ) : (
              <ul className="space-y-1">
                {teams.map((team) => (
                  <li
                    key={`${team.kind}-${team.sofascore_id}`}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{team.name}</span>
                      <span className="block text-[11px] text-text-muted">{sportLabel(team.sport)}</span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Fjern ${team.name}`}
                      onClick={() => removeTeam(team)}
                      className="text-text-muted hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Button type="button" size="sm" variant="secondary" className="w-full" onClick={() => setSearchOpen(true)}>
            <Plus className="h-4 w-4" />
            Legg til lag
          </Button>
        </aside>

        <section className="min-w-0 space-y-4">
          <FixtureBoard />
          {showToday ? (
            <div className="bg-[#18181B] border border-[#27272A] rounded-xl overflow-hidden">
              <div className="border-b border-[#27272A] px-3 py-2">
                <h2 className="text-sm font-medium">I dag</h2>
              </div>
              {matchesFetching && matches.length === 0 ? (
                <p className="p-4 text-sm text-text-secondary">Henter kamper…</p>
              ) : null}
              {groups.map((group) => (
                <div key={group.sport}>
                  <div className="bg-white/5 px-3 py-2">
                    <h3 className="text-sm font-medium">{group.label}</h3>
                  </div>
                  <ul>
                    {group.matches.map((match) => {
                      const score = scoreText(match);
                      return (
                        <li
                          key={match.id}
                          className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-white/5 px-3 py-2"
                        >
                          <span className="text-[11px] text-text-muted tabular-nums">
                            {isLive(match) ? 'LIVE' : formatKickoff(match.start)}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm truncate">{match.home}</span>
                            <span className="block text-sm truncate text-text-secondary">{match.away}</span>
                            {match.tournament ? (
                              <span className="block text-[11px] text-text-muted truncate">{match.tournament}</span>
                            ) : null}
                          </span>
                          <span className="text-sm tabular-nums text-right">{score}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="bg-[#18181B] border-[#27272A] text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Legg til lag</DialogTitle>
            <DialogDescription>Søk etter fotballag eller tennisspiller.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Søk Brann eller Sinner"
              className="bg-transparent"
            />
            <Button type="button" size="icon" variant="secondary" aria-label="Søk">
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {searchError ? <p className="text-sm text-destructive">{searchError}</p> : null}
            {searchLoading ? <p className="text-sm text-text-secondary">Søker…</p> : null}
            {!searchError && !searchLoading && searchQuery.trim() && searchResults.length === 0 ? (
              <p className="text-sm text-text-secondary">Ingen treff</p>
            ) : null}
            {searchResults.map((team) => (
              <button
                key={`${team.kind}-${team.sofascore_id}`}
                type="button"
                onClick={() => addTeam(team)}
                className="w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-white/5"
              >
                {team.name}
                <span className="block text-[11px] text-text-muted">{sportLabel(team.sport)}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
