import { Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import PageHeader from '../components/PageHeader';
import { Input } from '../components/ui/input';
import { buildFavoriteFeed, favoritesStatus, filterFeedBySport, formatKickoff } from '../lib/favorites';
import { betsPath } from '../lib/filters';
import { fetchWithTimeout } from '../lib/fetch';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const cardClass = 'bg-[#18181B] border border-[#27272A] rounded-xl p-4';
const status = favoritesStatus();

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

function resultKey(item) {
  return item.kind === 'player' ? item.player_id : item.team_id;
}

export default function FavoritesPage() {
  useOutletContext();
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [sports, setSports] = useState([]);
  const [sportFilter, setSportFilter] = useState('all');
  const [feed, setFeed] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchWrapRef = useRef(null);

  const favoriteIds = useMemo(
    () => new Set([...teams.map((team) => team.team_id), ...players.map((player) => player.player_id)]),
    [teams, players]
  );
  const hasFavorites = teams.length + players.length > 0;
  const visibleFeed = useMemo(() => filterFeedBySport(feed, sportFilter === 'all' ? 'all' : sportFilter), [feed, sportFilter]);

  const loadFavorites = useCallback(async () => {
    if (!BACKEND_URL) {
      toast.error('Backend-URL mangler');
      setLoadingTeams(false);
      return { teams: [], players: [] };
    }
    const [teamsRes, playersRes, sportsRes] = await Promise.all([
      fetchWithTimeout(`${BACKEND_URL}/api/favorites/teams`, { credentials: 'include' }),
      fetchWithTimeout(`${BACKEND_URL}/api/favorites/players`, { credentials: 'include' }),
      fetchWithTimeout(`${BACKEND_URL}/api/favorites/sports`, { credentials: 'include' }),
    ]);
    if (!teamsRes.ok) throw new Error(`Favoritter ${teamsRes.status}`);
    const teamsData = await teamsRes.json();
    const playersData = playersRes.ok ? await playersRes.json() : [];
    const sportsData = sportsRes.ok ? await sportsRes.json() : [];
    const nextTeams = Array.isArray(teamsData) ? teamsData : [];
    const nextPlayers = Array.isArray(playersData) ? playersData : [];
    setTeams(nextTeams);
    setPlayers(nextPlayers);
    setSports(Array.isArray(sportsData) ? sportsData : []);
    return { teams: nextTeams, players: nextPlayers };
  }, []);

  const loadFeed = useCallback(async () => {
    if (!BACKEND_URL) return;
    setLoadingFeed(true);
    try {
      const sportQuery = sportFilter !== 'all' ? `?sport=${encodeURIComponent(sportFilter)}` : '';
      const response = await fetchWithTimeout(`${BACKEND_URL}/api/favorites/upcoming-matches${sportQuery}`, {
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
  }, [sportFilter]);

  useEffect(() => {
    const boot = async () => {
      try {
        const list = await loadFavorites();
        if (list.teams.length + list.players.length > 0) await loadFeed();
        else setFeed([]);
      } catch (error) {
        console.error('Error fetching favorites:', error);
        toast.error('Kunne ikke laste favoritter');
        setTeams([]);
        setPlayers([]);
      } finally {
        setLoadingTeams(false);
      }
    };
    boot();
  }, [loadFavorites, loadFeed]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setSearching(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const sportQuery = sportFilter !== 'all' ? `&sport=${encodeURIComponent(sportFilter)}` : '';
        const response = await fetchWithTimeout(
          `${BACKEND_URL}/api/favorites/search?query=${encodeURIComponent(trimmed)}${sportQuery}`,
          { credentials: 'include', signal: controller.signal }
        );
        if (!response.ok) throw new Error(`Søk ${response.status}`);
        const data = await response.json();
        setResults(Array.isArray(data?.items) ? data.items : []);
        setSearchOpen(true);
      } catch (error) {
        if (error?.name === 'AbortError') return;
        console.error('Error searching favorites:', error);
        toast.error('Kunne ikke søke');
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, sportFilter]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!searchWrapRef.current?.contains(event.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const addFavorite = async (item) => {
    try {
      const isPlayer = item.kind === 'player';
      const response = await fetchWithTimeout(
        `${BACKEND_URL}/api/favorites/${isPlayer ? 'players' : 'teams'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(
            isPlayer
              ? {
                  player_id: item.player_id,
                  player_name: item.player_name,
                  sport: item.sport,
                  photo: item.photo,
                  team_id: item.team_id,
                  team_name: item.team_name,
                  team_badge: item.team_badge,
                  league: item.league,
                  source: item.source || 'api-sports',
                }
              : {
                  team_id: item.team_id,
                  team_name: item.team_name,
                  sport: item.sport,
                  league: item.league,
                  badge: item.team_badge,
                  source: item.source || 'api-sports',
                }
          ),
        }
      );
      if (response.status === 400) {
        toast.error(isPlayer ? 'Spilleren er allerede i favoritter' : 'Laget er allerede i favoritter');
        return;
      }
      if (!response.ok) throw new Error(`Lagre ${response.status}`);
      setQuery('');
      setResults([]);
      setSearchOpen(false);
      toast.success(`${isPlayer ? item.player_name : item.team_name} lagt til`);
      await loadFavorites();
      await loadFeed();
    } catch (error) {
      console.error('Error adding favorite:', error);
      toast.error('Kunne ikke legge til favoritt');
    }
  };

  const removeTeam = async (team) => {
    try {
      const response = await fetchWithTimeout(`${BACKEND_URL}/api/favorites/teams/${encodeURIComponent(team.team_id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Slett ${response.status}`);
      toast.success(`${team.team_name} fjernet`);
      const remaining = teams.filter((item) => item.team_id !== team.team_id);
      setTeams(remaining);
      if (remaining.length + players.length === 0) setFeed([]);
      else await loadFeed();
    } catch (error) {
      console.error('Error removing favorite team:', error);
      toast.error('Kunne ikke fjerne lag');
    }
  };

  const removePlayer = async (player) => {
    try {
      const response = await fetchWithTimeout(
        `${BACKEND_URL}/api/favorites/players/${encodeURIComponent(player.player_id)}`,
        { method: 'DELETE', credentials: 'include' }
      );
      if (!response.ok) throw new Error(`Slett ${response.status}`);
      toast.success(`${player.player_name} fjernet`);
      const remaining = players.filter((item) => item.player_id !== player.player_id);
      setPlayers(remaining);
      if (teams.length + remaining.length === 0) setFeed([]);
      else await loadFeed();
    } catch (error) {
      console.error('Error removing favorite player:', error);
      toast.error('Kunne ikke fjerne spiller');
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
        placeholder="Søk etter lag eller spillere…"
        className="pl-9 bg-black/20 border-white/10"
        data-testid="favorites-search"
        autoComplete="off"
      />
      {searchOpen && query.trim().length >= 3 ? (
        <div
          className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-[#27272A] bg-[#18181B] shadow-lg"
          data-testid="favorites-search-results"
        >
          {searching ? (
            <p className="px-3 py-2 text-sm text-text-muted">Søker…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-text-muted">Ingen treff. Prøv minst tre bokstaver.</p>
          ) : (
            results.map((item) => {
              const key = resultKey(item);
              const already = favoriteIds.has(key);
              const name = item.kind === 'player' ? item.player_name : item.team_name;
              const meta = item.kind === 'player'
                ? [item.team_name, item.sport].filter(Boolean).join(' · ')
                : item.league || item.sport;
              return (
                <button
                  key={`${item.kind}-${key}`}
                  type="button"
                  disabled={already}
                  onClick={() => addFavorite(item)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5 disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <TeamBadge src={item.kind === 'player' ? item.photo : item.team_badge} alt="" />
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <span className="shrink-0 text-xs text-text-muted">
                    {item.kind === 'player' ? 'Spiller' : 'Lag'}
                    {meta ? ` · ${meta}` : ''}
                  </span>
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
        <PageHeader title="Favoritter" subtitle={status.subtitle} testId="favorites-title" />
        <div className={`${cardClass} h-24 shimmer`} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Favoritter" subtitle={status.subtitle} testId="favorites-title" />

      <div className={cardClass}>
        <div className="mb-3 flex flex-wrap gap-2" data-testid="favorites-sport-filter">
          <button
            type="button"
            onClick={() => setSportFilter('all')}
            className={`rounded-full px-3 py-1 text-xs ${sportFilter === 'all' ? 'bg-white/15 text-white' : 'bg-white/5 text-text-muted'}`}
          >
            Alle
          </button>
          {sports.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSportFilter(item.id)}
              className={`rounded-full px-3 py-1 text-xs ${sportFilter === item.id ? 'bg-white/15 text-white' : 'bg-white/5 text-text-muted'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {searchField}
        {hasFavorites ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {teams.map((team) => (
              <span
                key={team.team_id}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 pl-1.5 pr-1 py-1 text-sm"
                data-testid={`favorite-chip-${team.team_id}`}
              >
                <TeamBadge src={team.team_badge || team.badge} alt="" />
                <span>{team.team_name}</span>
                <Link
                  to={betsPath({ q: team.team_name })}
                  className="px-1.5 text-xs text-primary hover:underline"
                  data-testid={`favorite-history-${team.team_id}`}
                >
                  Historikk
                </Link>
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
            {players.map((player) => (
              <span
                key={player.player_id}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 pl-1.5 pr-1 py-1 text-sm"
                data-testid={`favorite-chip-${player.player_id}`}
              >
                <TeamBadge src={player.photo} alt="" />
                <span>{player.player_name}</span>
                <Link
                  to={betsPath({ q: player.player_name })}
                  className="px-1.5 text-xs text-primary hover:underline"
                  data-testid={`favorite-history-${player.player_id}`}
                >
                  Historikk
                </Link>
                <button
                  type="button"
                  onClick={() => removePlayer(player)}
                  className="rounded-full p-0.5 text-text-muted hover:bg-white/10 hover:text-text-primary"
                  aria-label={`Fjern ${player.player_name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-text-muted" data-testid="favorites-empty-hint">
            {status.emptyHint}
          </p>
        )}
      </div>

      {hasFavorites && loadingFeed ? <div className={`${cardClass} h-32 shimmer`} /> : null}

      {hasFavorites && !loadingFeed && visibleFeed.length === 0 ? (
        <p className="text-sm text-text-muted">Ingen kommende kamper for favorittene.</p>
      ) : null}

      {visibleFeed.map((day) => (
        <section key={day.date} className="space-y-3">
          <h2 className="text-sm font-semibold text-text-secondary">{formatDayHeading(day.date)}</h2>
          {day.leagues.map((league) => (
            <div key={`${day.date}-${league.name}`} className={cardClass}>
              <p className="text-xs font-medium text-text-secondary mb-3">{league.name}</p>
              <div className="divide-y divide-white/5">
                {league.matches.map((match) => (
                  <div
                    key={match.fixture_id}
                    className="flex w-full items-center gap-3 py-2.5"
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
                      {match.has_bet ? (
                        <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                          Spill
                        </span>
                      ) : null}
                    </div>
                    <Link
                      to={betsPath({ q: `${match.home_team_name} ${match.away_team_name}` })}
                      className="shrink-0 text-xs text-primary hover:underline"
                    >
                      Historikk
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
