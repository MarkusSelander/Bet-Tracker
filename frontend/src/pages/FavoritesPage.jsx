import { ChevronLeft, ChevronRight, Plus, Search, Star, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import MatchMarketsDialog from '../components/MatchMarketsDialog';
import PageHeader from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { localDateKey } from '../lib/calendar';
import { fetchWithTimeout } from '../lib/fetch';
import { MATCH_FILTERS, formatKickoff, groupByLeague, sportTabs } from '../lib/oddsFavorites';
import { useFavoriteMatches, useFavoritePins } from '../lib/queries';
import { queryClient, queryKeys } from '../lib/queryClient';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const EMPTY_LIST = [];

function shiftDate(iso, days) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function formatDateLabel(iso) {
  const parsed = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' });
}

function oddsValue(odds, key) {
  const value = odds?.[key];
  if (value == null) return '';
  const number = Number(value);
  return Number.isNaN(number) ? '' : number.toFixed(2);
}

function apiErrorMessage(status, data, fallback) {
  const detail = typeof data?.detail === 'string' ? data.detail : '';
  if (status === 429) {
    return detail || 'Odds API-kvote brukt opp';
  }
  if (status === 502 || status === 503) {
    return detail || 'Odds API utilgjengelig';
  }
  return fallback;
}

function isLive(match) {
  return Boolean(match?.scores) && !match?.completed;
}

export default function FavoritesPage() {
  const [tab, setTab] = useState('favorites');
  const [filter, setFilter] = useState('all');
  const [date, setDate] = useState(() => localDateKey());
  const [error, setError] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [marketsLoading, setMarketsLoading] = useState(false);
  const [marketsError, setMarketsError] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ leagues: [], teams: [] });
  const [searchError, setSearchError] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const { data: pins } = useFavoritePins();
  const {
    data: matches = EMPTY_LIST,
    error: matchesError,
    isError: matchesIsError,
  } = useFavoriteMatches(date, tab, filter);
  const leagues = pins?.leagues || EMPTY_LIST;
  const teams = pins?.teams || EMPTY_LIST;
  const eventIds = pins?.eventIds || EMPTY_LIST;

  const leagueKeys = useMemo(() => new Set(leagues.map((row) => row.key)), [leagues]);
  const starredIds = useMemo(() => new Set(eventIds), [eventIds]);
  const groups = useMemo(() => groupByLeague(matches), [matches]);
  const noPins = leagues.length === 0 && teams.length === 0 && eventIds.length === 0;
  const emptyFavorites = tab === 'favorites' && matches.length === 0 && !error && noPins;

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
      setSearchResults({ leagues: [], teams: [] });
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
          setSearchError(apiErrorMessage(response.status, data, 'Kunne ikke søke'));
          setSearchResults({ leagues: [], teams: [] });
          return;
        }
        setSearchError(null);
        setSearchResults({ leagues: data.leagues || [], teams: data.teams || [] });
      } catch (err) {
        if (cancelled) return;
        setSearchError(err.message || 'Kunne ikke søke');
        setSearchResults({ leagues: [], teams: [] });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.favoritePins }),
      queryClient.invalidateQueries({ queryKey: ['favorites', 'matches'] }),
    ]);
  };

  const toggleLeague = async (league) => {
    const key = league.key || league.sport_key;
    const pinned = leagueKeys.has(key);
    await fetchWithTimeout(
      pinned
        ? `${BACKEND_URL}/api/favorites/leagues/${encodeURIComponent(key)}`
        : `${BACKEND_URL}/api/favorites/leagues`,
      {
        method: pinned ? 'DELETE' : 'POST',
        credentials: 'include',
        headers: pinned ? undefined : { 'Content-Type': 'application/json' },
        body: pinned ? undefined : JSON.stringify({ key, title: league.title, group: league.group || '' }),
      }
    );
    await refresh();
  };

  const addTeam = async (team) => {
    await fetchWithTimeout(`${BACKEND_URL}/api/favorites/teams`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: team.name, sport_key: team.sport_key }),
    });
    setSearchOpen(false);
    await refresh();
  };

  const removeTeam = async (team) => {
    await fetchWithTimeout(`${BACKEND_URL}/api/favorites/teams`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: team.name, sport_key: team.sport_key }),
    });
    await refresh();
  };

  const toggleEvent = async (event, match) => {
    event.stopPropagation();
    const starred = starredIds.has(match.id);
    await fetchWithTimeout(`${BACKEND_URL}/api/favorites/events`, {
      method: starred ? 'DELETE' : 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: match.id, sport_key: match.sport_key }),
    });
    await refresh();
  };

  const openMatch = async (match) => {
    setSelectedMatch(match);
    setMarkets([]);
    setMarketsError(null);
    setMarketsLoading(true);
    try {
      const response = await fetchWithTimeout(
        `${BACKEND_URL}/api/odds/matches/${encodeURIComponent(match.id)}/markets?sport_key=${encodeURIComponent(match.sport_key)}`,
        { credentials: 'include' }
      );
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        setMarketsError(apiErrorMessage(response.status, data, 'Kunne ikke hente markeder'));
        return;
      }
      setMarkets(Array.isArray(data) ? data : []);
    } catch (err) {
      setMarketsError(err.message || 'Kunne ikke hente markeder');
    } finally {
      setMarketsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Favoritter" testId="favorites-title" />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-[#1f2a33] bg-[#0d1419] overflow-hidden">
        <div className="flex gap-1 overflow-x-auto border-b border-[#1f2a33] px-2 py-2">
          {sportTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm ${
                tab === item.id ? 'bg-white/10 text-white' : 'text-text-secondary hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid gap-0 lg:grid-cols-[210px_1fr]">
          <aside className="border-b lg:border-b-0 lg:border-r border-[#1f2a33] p-3 space-y-4">
            <section>
              <h2 className="text-xs uppercase tracking-wide text-text-muted mb-2">Festede ligaer</h2>
              {leagues.length === 0 ? (
                <p className="text-xs text-text-secondary">Ingen ligaer festet</p>
              ) : (
                <ul className="space-y-1">
                  {leagues.map((league) => (
                    <li key={league.key} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{league.title}</span>
                      <button
                        type="button"
                        aria-label={`Fjern ${league.title}`}
                        onClick={() => toggleLeague(league)}
                        className="text-amber-400 hover:text-amber-300"
                      >
                        <Star className="h-3.5 w-3.5 fill-current" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-xs uppercase tracking-wide text-text-muted mb-2">Mine lag</h2>
              {teams.length === 0 ? (
                <p className="text-xs text-text-secondary">Ingen lag fulgt</p>
              ) : (
                <ul className="space-y-1">
                  {teams.map((team) => (
                    <li
                      key={`${team.sport_key}-${team.name}`}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="truncate">{team.name}</span>
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

          <section className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 border-b border-[#1f2a33] px-3 py-2">
              {MATCH_FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`rounded-full px-3 py-1 text-xs ${
                    filter === item.id ? 'bg-white/15 text-white' : 'text-text-secondary hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1">
                <button type="button" aria-label="Forrige dag" onClick={() => setDate((value) => shiftDate(value, -1))}>
                  <ChevronLeft className="h-4 w-4 text-text-secondary" />
                </button>
                <span className="text-xs text-text-secondary min-w-[7rem] text-center">{formatDateLabel(date)}</span>
                <button type="button" aria-label="Neste dag" onClick={() => setDate((value) => shiftDate(value, 1))}>
                  <ChevronRight className="h-4 w-4 text-text-secondary" />
                </button>
              </div>
            </div>

            {emptyFavorites ? (
              <div className="p-6 space-y-3">
                <p className="text-sm text-text-secondary">Fest en liga eller legg til et lag for å se kamper.</p>
                <Button type="button" size="sm" onClick={() => setSearchOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Legg til lag
                </Button>
              </div>
            ) : error ? null : groups.length === 0 ? (
              <p className="p-6 text-sm text-text-secondary">Ingen kamper for valgt dag.</p>
            ) : (
              <div>
                {groups.map((group) => (
                  <div key={group.sport_key}>
                    <div className="flex items-center justify-between gap-2 bg-[#12202b] px-3 py-2">
                      <h3 className="text-sm font-medium truncate">{group.title}</h3>
                      <button
                        type="button"
                        aria-label={leagueKeys.has(group.sport_key) ? 'Fjern liga' : 'Fest liga'}
                        onClick={() => toggleLeague({ key: group.sport_key, title: group.title, group: '' })}
                        className={
                          leagueKeys.has(group.sport_key) ? 'text-amber-400' : 'text-text-muted hover:text-amber-300'
                        }
                      >
                        <Star className={`h-4 w-4 ${leagueKeys.has(group.sport_key) ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                    <ul>
                      {group.matches.map((match) => (
                        <li
                          key={match.id}
                          className="grid grid-cols-[minmax(0,1fr)_1.75rem] items-stretch border-b border-white/5 hover:bg-white/5"
                        >
                          <button
                            type="button"
                            onClick={() => openMatch(match)}
                            className="grid grid-cols-[3.5rem_1fr_7.5rem] items-center gap-2 px-3 py-2 text-left"
                          >
                            <span className="text-[11px] text-text-muted tabular-nums">
                              {isLive(match) ? 'LIVE' : formatKickoff(match.commence_time)}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm truncate">{match.home_team}</span>
                              <span className="block text-sm truncate text-text-secondary">{match.away_team}</span>
                            </span>
                            <span className="grid grid-cols-3 gap-1 text-center text-xs tabular-nums">
                              <span className="rounded bg-white/5 py-1">{oddsValue(match.odds_1x2, 'home')}</span>
                              <span className="rounded bg-white/5 py-1">{oddsValue(match.odds_1x2, 'draw')}</span>
                              <span className="rounded bg-white/5 py-1">{oddsValue(match.odds_1x2, 'away')}</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            aria-label={starredIds.has(match.id) ? 'Fjern kamp' : 'Merk kamp'}
                            onClick={(event) => toggleEvent(event, match)}
                            className={starredIds.has(match.id) ? 'text-amber-400' : 'text-text-muted'}
                          >
                            <Star className={`h-4 w-4 ${starredIds.has(match.id) ? 'fill-current' : ''}`} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <MatchMarketsDialog
        match={selectedMatch}
        markets={markets}
        open={Boolean(selectedMatch)}
        onOpenChange={(next) => {
          if (!next) setSelectedMatch(null);
        }}
        loading={marketsLoading}
        error={marketsError}
      />

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="bg-[#18181B] border-[#27272A] text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Legg til lag</DialogTitle>
            <DialogDescription>Søk etter liga eller lagnavn.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Søk Eliteserien eller Brann"
              className="bg-transparent"
            />
            <Button type="button" size="icon" variant="secondary" aria-label="Søk">
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {searchError ? <p className="text-sm text-destructive">{searchError}</p> : null}
            {!searchError &&
            !searchLoading &&
            searchQuery.trim() &&
            (searchResults.leagues || []).length === 0 &&
            (searchResults.teams || []).length === 0 ? (
              <p className="text-sm text-text-secondary">Ingen treff</p>
            ) : null}
            {(searchResults.leagues || []).map((league) => (
              <button
                key={league.key}
                type="button"
                onClick={() => toggleLeague(league)}
                className="w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-white/5"
              >
                {league.title}
                <span className="block text-[11px] text-text-muted">{league.group}</span>
              </button>
            ))}
            {(searchResults.teams || []).map((team) => (
              <button
                key={`${team.sport_key}-${team.name}`}
                type="button"
                onClick={() => addTeam(team)}
                className="w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-white/5"
              >
                {team.name}
                <span className="block text-[11px] text-text-muted">{team.sport_key}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
