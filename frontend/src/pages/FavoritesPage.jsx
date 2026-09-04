import { Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import MatchOddsDialog from '../components/MatchOddsDialog';
import PageHeader from '../components/PageHeader';
import { Input } from '../components/ui/input';
import { buildFavoriteFeed, formatKickoff } from '../lib/favorites';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const cardClass = 'bg-[#18181B] border border-[#27272A] rounded-xl p-4';

function formatOdd(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(2);
}

function formatDayHeading(dateStr) {
  const parsed = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  const heading = parsed.toLocaleDateString('nb-NO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return heading.charAt(0).toUpperCase() + heading.slice(1);
}

function TeamBadge({ src, alt }) {
  if (!src) return null;
  return <img src={src} alt={alt || ''} className="h-5 w-5 shrink-0 rounded-full object-contain bg-white/5" />;
}

export default function FavoritesPage() {
  useOutletContext();
  const [teams, setTeams] = useState([]);
  const [feed, setFeed] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [marketsMissing, setMarketsMissing] = useState(false);
  const [marketsLoading, setMarketsLoading] = useState(false);
  const searchWrapRef = useRef(null);

  const favoriteIds = useMemo(() => new Set(teams.map((team) => team.team_id)), [teams]);

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

  const loadFeed = useCallback(async () => {
    if (!BACKEND_URL) return;
    setLoadingFeed(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/favorites/upcoming-matches`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Kamper ${response.status}`);
      const data = await response.json();
      setFeed(buildFavoriteFeed(data));
    } catch (error) {
      console.error('Error fetching favorite matches:', error);
      toast.error('Kunne ikke laste kommende kamper');
      setFeed([]);
    } finally {
      setLoadingFeed(false);
    }
  }, []);

  useEffect(() => {
    const boot = async () => {
      try {
        const list = await loadTeams();
        if (list.length > 0) await loadFeed();
        else setFeed([]);
      } catch (error) {
        console.error('Error fetching favorite teams:', error);
        toast.error('Kunne ikke laste favorittlag');
        setTeams([]);
      } finally {
        setLoadingTeams(false);
      }
    };
    boot();
  }, [loadTeams, loadFeed]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`${BACKEND_URL}/api/teams/search?query=${encodeURIComponent(trimmed)}`, {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Søk ${response.status}`);
        const data = await response.json();
        setResults(Array.isArray(data) ? data : []);
        setSearchOpen(true);
      } catch (error) {
        if (error?.name === 'AbortError') return;
        console.error('Error searching teams:', error);
        toast.error('Kunne ikke søke etter lag');
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!searchWrapRef.current?.contains(event.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const addTeam = async (team) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/favorites/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          team_id: team.team_id,
          team_name: team.team_name,
          sport: team.sport,
          league: team.league,
          badge: team.team_badge,
        }),
      });
      if (response.status === 400) {
        toast.error('Laget er allerede i favoritter');
        return;
      }
      if (!response.ok) throw new Error(`Lagre ${response.status}`);
      setQuery('');
      setResults([]);
      setSearchOpen(false);
      toast.success(`${team.team_name} lagt til`);
      await loadTeams();
      await loadFeed();
    } catch (error) {
      console.error('Error adding favorite team:', error);
      toast.error('Kunne ikke legge til lag');
    }
  };

  const removeTeam = async (team) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/favorites/teams/${team.team_id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Slett ${response.status}`);
      toast.success(`${team.team_name} fjernet`);
      const remaining = teams.filter((item) => item.team_id !== team.team_id);
      setTeams(remaining);
      if (remaining.length === 0) setFeed([]);
      else await loadFeed();
    } catch (error) {
      console.error('Error removing favorite team:', error);
      toast.error('Kunne ikke fjerne lag');
    }
  };

  const openMatch = async (match) => {
    setSelectedMatch(match);
    setMarkets([]);
    setMarketsMissing(false);
    setMarketsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/favorites/matches/${match.fixture_id}/markets`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Markeder ${response.status}`);
      const data = await response.json();
      setMarkets(Array.isArray(data?.markets) ? data.markets : []);
      setMarketsMissing(Boolean(data?.missing) || !Array.isArray(data?.markets) || data.markets.length === 0);
    } catch (error) {
      console.error('Error fetching match markets:', error);
      toast.error('Kunne ikke laste odds');
      setMarkets([]);
      setMarketsMissing(true);
    } finally {
      setMarketsLoading(false);
    }
  };

  const searchField = (
    <div ref={searchWrapRef} className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted pointer-events-none" />
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => {
          if (results.length > 0) setSearchOpen(true);
        }}
        placeholder="Søk og legg til lag…"
        className="pl-9 bg-black/20 border-white/10"
        data-testid="favorites-search"
        autoComplete="off"
      />
      {searchOpen && query.trim().length >= 2 ? (
        <div
          className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-[#27272A] bg-[#18181B] shadow-lg"
          data-testid="favorites-search-results"
        >
          {searching ? (
            <p className="px-3 py-2 text-sm text-text-muted">Søker…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-text-muted">Ingen lag funnet</p>
          ) : (
            results.map((team) => {
              const already = favoriteIds.has(team.team_id);
              return (
                <button
                  key={team.team_id}
                  type="button"
                  disabled={already}
                  onClick={() => addTeam(team)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5 disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <TeamBadge src={team.team_badge} alt="" />
                  <span className="min-w-0 flex-1 truncate">{team.team_name}</span>
                  <span className="shrink-0 text-xs text-text-muted">{team.league || team.sport}</span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );

  if (loadingTeams) {
    return (
      <div className="space-y-6">
        <PageHeader title="Favoritter" subtitle="Kommende kamper · odds fra Coolbet" testId="favorites-title" />
        <div className={`${cardClass} h-24 shimmer`} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Favoritter" subtitle="Kommende kamper · odds fra Coolbet" testId="favorites-title" />

      <div className={cardClass}>
        {searchField}
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
        ) : (
          <p className="mt-3 text-sm text-text-muted">Søk opp lag du vil følge.</p>
        )}
      </div>

      {teams.length > 0 && loadingFeed ? <div className={`${cardClass} h-32 shimmer`} /> : null}

      {teams.length > 0 && !loadingFeed && feed.length === 0 ? (
        <p className="text-sm text-text-muted">Ingen kommende kamper for favorittlagene.</p>
      ) : null}

      {feed.map((day) => (
        <section key={day.date} className="space-y-3">
          <h2 className="text-sm font-semibold text-text-secondary">{formatDayHeading(day.date)}</h2>
          {day.leagues.map((league) => (
            <div key={`${day.date}-${league.name}`} className={cardClass}>
              <p className="text-xs font-medium text-text-secondary mb-3">{league.name}</p>
              <div className="divide-y divide-white/5">
                {league.matches.map((match) => {
                  const odds = match.odds_1x2;
                  return (
                    <button
                      key={match.fixture_id}
                      type="button"
                      onClick={() => openMatch(match)}
                      className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-white/[0.03] -mx-1 px-1 rounded-md"
                      data-testid={`favorite-match-${match.fixture_id}`}
                    >
                      <span className="w-12 shrink-0 text-xs font-mono text-text-muted">
                        {formatKickoff(match.event_time)}
                      </span>
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <TeamBadge src={match.home_team_badge} alt="" />
                        <span className="min-w-0 truncate text-sm">
                          {match.home_team_name} – {match.away_team_name}
                        </span>
                        <TeamBadge src={match.away_team_badge} alt="" />
                      </div>
                      <div className="grid grid-cols-3 gap-2 sm:gap-3 w-[7.5rem] sm:w-36 shrink-0 text-right font-mono text-xs sm:text-sm tabular-nums">
                        <span>{formatOdd(odds?.home)}</span>
                        <span>{formatOdd(odds?.draw)}</span>
                        <span>{formatOdd(odds?.away)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ))}

      <MatchOddsDialog
        match={selectedMatch}
        markets={markets}
        missing={marketsMissing}
        loading={marketsLoading}
        open={Boolean(selectedMatch)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedMatch(null);
        }}
      />
    </div>
  );
}
