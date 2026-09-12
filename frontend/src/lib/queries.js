import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchJson, queryKeys, STALE_LIST_MS, STALE_REFERENCE_MS, STALE_STATS_MS } from './queryClient';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function useAnalyticsSummary(search) {
  const qs = search ? `?${search}` : '';
  return useQuery({
    queryKey: queryKeys.analyticsSummary(search),
    queryFn: () => fetchJson(`/api/analytics/summary${qs}`),
    staleTime: STALE_STATS_MS,
    placeholderData: keepPreviousData,
  });
}

export function useBets(search) {
  const params = new URLSearchParams(search || '');
  params.set('include_legs', 'true');
  const qs = params.toString();
  return useQuery({
    queryKey: queryKeys.bets(search),
    queryFn: async () => asArray(await fetchJson(`/api/bets?${qs}`)),
    staleTime: STALE_LIST_MS,
    placeholderData: keepPreviousData,
  });
}

export function useBet(betId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.bet(betId),
    queryFn: () => fetchJson(`/api/bets/${encodeURIComponent(betId)}`),
    enabled: Boolean(betId) && enabled,
    staleTime: STALE_LIST_MS,
  });
}

export function useRecentBets(limit = 8) {
  return useQuery({
    queryKey: queryKeys.recentBets(limit),
    queryFn: async () => asArray(await fetchJson(`/api/bets/recent?limit=${limit}`)),
    staleTime: STALE_LIST_MS,
  });
}

export function usePendingBets(limit) {
  const search = limit ? `status=pending&limit=${limit}` : 'status=pending';
  return useQuery({
    queryKey: queryKeys.pendingBets(limit || 'all'),
    queryFn: async () => asArray(await fetchJson(`/api/bets?${search}`)),
    staleTime: STALE_LIST_MS,
  });
}

export function useCalendarBets(dateFrom, dateTo) {
  const search = `date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`;
  return useQuery({
    queryKey: queryKeys.calendarBets(dateFrom, dateTo),
    queryFn: async () => asArray(await fetchJson(`/api/bets?${search}`, {}, 15000)),
    staleTime: STALE_LIST_MS,
    placeholderData: keepPreviousData,
    enabled: Boolean(dateFrom && dateTo),
  });
}

export function useFavoritePins() {
  return useQuery({
    queryKey: queryKeys.favoritePins,
    queryFn: async () => {
      const [leagues, teams, events] = await Promise.all([
        fetchJson('/api/favorites/leagues'),
        fetchJson('/api/favorites/teams'),
        fetchJson('/api/favorites/events'),
      ]);
      return {
        leagues: asArray(leagues),
        teams: asArray(teams),
        eventIds: asArray(events)
          .map((row) => row.event_id)
          .filter(Boolean),
      };
    },
    staleTime: STALE_REFERENCE_MS,
  });
}

export function useFavoriteMatches(date, tab, filter) {
  return useQuery({
    queryKey: queryKeys.favoriteMatches(date, tab, filter),
    queryFn: async () => {
      const path = `/api/odds/matches?date=${encodeURIComponent(date)}&tab=${encodeURIComponent(tab)}&filter=${encodeURIComponent(filter)}`;
      try {
        return asArray(await fetchJson(path));
      } catch (error) {
        error.matches = [];
        throw error;
      }
    },
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}
