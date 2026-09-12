import { QueryClient } from '@tanstack/react-query';
import { fetchWithTimeout } from './fetch';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const STALE_STATS_MS = 30_000;
export const STALE_LIST_MS = 30_000;
export const STALE_REFERENCE_MS = 5 * 60_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_LIST_MS,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const queryKeys = {
  analyticsSummary: (search) => ['analytics', 'summary', search || ''],
  bets: (search) => ['bets', 'list', search || ''],
  bet: (betId) => ['bets', 'detail', betId],
  recentBets: (limit) => ['bets', 'recent', limit],
  pendingBets: (limit) => ['bets', 'pending', limit],
  calendarBets: (from, to) => ['bets', 'calendar', from, to],
  favoritePins: ['favorites', 'pins'],
  favoriteMatches: (date, tab, filter) => ['favorites', 'matches', date, tab, filter],
};

export async function fetchJson(path, options = {}, timeoutMs) {
  if (!BACKEND_URL) {
    throw new Error('Backend-URL mangler');
  }
  const url = path.startsWith('http') ? path : `${BACKEND_URL}${path}`;
  const { headers, ...rest } = options;
  const response = await fetchWithTimeout(
    url,
    {
      credentials: 'include',
      headers,
      ...rest,
    },
    timeoutMs
  );
  if (!response.ok) {
    let detail = '';
    try {
      const data = await response.json();
      detail = typeof data?.detail === 'string' ? data.detail : '';
    } catch {
      /* ignore */
    }
    const error = new Error(detail || `Forespørselen feilet (${response.status})`);
    error.status = response.status;
    error.body = null;
    throw error;
  }
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  return response.json();
}

export function invalidateTrackerData(client = queryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: ['analytics'] }),
    client.invalidateQueries({ queryKey: ['bets'] }),
    client.invalidateQueries({ queryKey: ['favorites'] }),
  ]);
}
