/* eslint-env jest */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { localDateKey, monthRange } from '../lib/calendar';
import { chartQuery, parseFilters, previousPeriodRange, toAnalyticsApiSearch, toBetsApiSearch } from '../lib/filters';
import { dashboardSearch } from '../lib/queries';
import { queryKeys } from '../lib/queryClient';
import AnalyticsPage from './AnalyticsPage';
import BetsPage from './BetsPage';
import CalendarPage from './CalendarPage';
import Dashboard from './Dashboard';

const USER = { name: 'Test', email: 'test@example.com', currency: 'NOK' };
const today = localDateKey();

function daysAgo(n) {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return localDateKey(date);
}

const BETS = [
  {
    bet_id: 'b1',
    date: today,
    time: '18:00:00',
    game: 'Brann vs Molde',
    bet: 'Brann',
    odds: 2.1,
    stake: 200,
    status: 'won',
    result: 220,
    sport: 'Fotball',
    bookie: 'Coolbet',
    legs: [],
  },
  {
    bet_id: 'b2',
    date: today,
    time: '20:00:00',
    game: 'Arsenal vs Chelsea (+1)',
    bet: 'Arsenal',
    odds: 3.4,
    stake: 100,
    status: 'pending',
    result: 0,
    sport: 'Fotball',
    bookie: 'Unibet',
    ticket_type: 'combo',
    total_matches: 2,
    legs: [
      { match: 'Arsenal vs Chelsea', market: '1X2', outcome: 'Arsenal', odds: 1.7, status: 'pending' },
      { match: 'Liverpool vs Spurs', market: '1X2', outcome: 'Liverpool', odds: 2.0, status: 'won' },
    ],
  },
  {
    bet_id: 'b3',
    date: daysAgo(3),
    time: '12:00:00',
    game: 'Sinner vs Alcaraz',
    bet: 'Sinner',
    odds: 1.9,
    stake: 300,
    status: 'lost',
    result: -300,
    sport: 'Tennis',
    bookie: 'Bet365',
    legs: [],
  },
];

const CHART = [
  { date: daysAgo(6), daily_pl: -150, cumulative_pl: -150, bets: 2, daily_stake: 300, cumulative_stake: 300 },
  { date: daysAgo(3), daily_pl: -300, cumulative_pl: -450, bets: 1, daily_stake: 300, cumulative_stake: 600 },
  { date: daysAgo(1), daily_pl: 900, cumulative_pl: 450, bets: 3, daily_stake: 500, cumulative_stake: 1100 },
  { date: today, daily_pl: 220, cumulative_pl: 670, bets: 2, daily_stake: 200, cumulative_stake: 1300 },
];

const STATS = {
  total_bets: 8,
  total_stake: 1300,
  total_profit_loss: 670,
  roi: 51.5,
  won_count: 4,
  lost_count: 2,
  push_count: 0,
  pending_count: 1,
  cashed_count: 1,
  win_rate: 66.7,
  current_streak: 2,
  current_streak_type: 'won',
  best_win_streak: 3,
  worst_loss_streak: 2,
};

const BREAKDOWN = [
  { name: 'Fotball', bets: 6, win_rate: 70, stake: 900, result: 800, roi: 88.9, profit_loss: 800, won: 4, lost: 1 },
  { name: 'Tennis', bets: 2, win_rate: 0, stake: 400, result: -130, roi: -32.5, profit_loss: -130, won: 0, lost: 2 },
];

const SUMMARY = {
  stats: STATS,
  chart: CHART,
  sports: BREAKDOWN,
  leagues: [],
  odds_range: BREAKDOWN,
  bookmakers: BREAKDOWN,
  tipsters: [],
  ticket_types: [],
  sport_options: ['Fotball', 'Tennis'],
  bookie_options: ['Coolbet'],
  tipster_options: [],
};

function seededClient() {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(queryKeys.dashboard(dashboardSearch()), {
    summary: SUMMARY,
    recent: BETS,
    pending: BETS.filter((bet) => bet.status === 'pending'),
  });
  const prev = previousPeriodRange('30');
  client.setQueryData(
    queryKeys.analyticsSummary(toAnalyticsApiSearch({ period: 'custom', from: prev.from, to: prev.to })),
    { ...SUMMARY, stats: { ...STATS, total_profit_loss: 200, roi: 10 } }
  );
  client.setQueryData(queryKeys.analyticsSummary(chartQuery(parseFilters(''))), SUMMARY);
  client.setQueryData(queryKeys.bets(toBetsApiSearch(parseFilters(''))), BETS);
  const now = new Date();
  const { dateFrom, dateTo } = monthRange(now.getFullYear(), now.getMonth());
  client.setQueryData([...queryKeys.calendarBets(dateFrom, dateTo), 'legs'], BETS);
  return client;
}

function Shell() {
  return <Outlet context={{ user: USER }} />;
}

async function renderAt(path, element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={seededClient()}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<Shell />}>
              <Route path={path} element={element} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  });
  return {
    text: container.textContent,
    container,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

let errors;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

// CRA runs Jest with resetMocks, so mocks must be set up per test.
beforeEach(() => {
  errors = [];
  jest.spyOn(console, 'error').mockImplementation((...args) => errors.push(args.map(String).join(' ')));
  // Give ResponsiveContainer a real size so the charts draw instead of bailing out at 0×0.
  jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 960,
    height: 320,
    top: 0,
    left: 0,
    right: 960,
    bottom: 320,
    x: 0,
    y: 0,
    toJSON() {},
  });
});

afterEach(() => {
  console.error.mockRestore();
  Element.prototype.getBoundingClientRect.mockRestore();
});

test('overview renders hero, metrics, exposure and recent bets', async () => {
  const view = await renderAt('/dashboard', <Dashboard />);
  expect(view.text).toContain('Oversikt');
  expect(view.text).toContain('Resultat · 30 dager');
  expect(view.text).toContain('Åpne spill');
  expect(view.text).toContain('Siste spill');
  expect(view.container.querySelector('[data-testid="heat-strip"]')).not.toBeNull();
  expect(view.container.querySelector('[data-testid="pending-bet-b2"]')).not.toBeNull();
  const chart = view.container.querySelector('[data-testid="dashboard-chart"]');
  expect(chart.querySelector('svg.recharts-surface')).not.toBeNull();
  expect(chart.querySelectorAll('linearGradient').length).toBeGreaterThanOrEqual(2);
  expect(chart.querySelector('pattern')).not.toBeNull();
  expect(chart.querySelector('.recharts-area-curve')).not.toBeNull();
  expect(chart.querySelector('.recharts-bar-rectangle')).toBeNull();
  expect(chart.textContent).toContain('+670');
  view.cleanup();
  expect(errors).toEqual([]);
});

test('bets ledger renders rows and expands combo legs', async () => {
  const view = await renderAt('/bets', <BetsPage />);
  expect(view.container.querySelector('[data-testid="bet-row-b1"]')).not.toBeNull();
  const toggle = view.container.querySelector('[aria-controls="legs-b2"]');
  expect(toggle).not.toBeNull();
  await act(async () => toggle.click());
  expect(view.container.textContent).toContain('Liverpool vs Spurs');
  view.cleanup();
  expect(errors).toEqual([]);
});

test('calendar renders the heat grid and the selected day', async () => {
  const view = await renderAt('/calendar', <CalendarPage />);
  expect(view.container.querySelector('[data-testid="calendar-day-panel"]')).not.toBeNull();
  expect(view.text).toContain('Valgt dag');
  expect(view.text).toContain('Brann vs Molde');
  view.cleanup();
  expect(errors).toEqual([]);
});

test('analytics renders the workspace with breakdowns', async () => {
  const view = await renderAt('/analytics', <AnalyticsPage />);
  expect(view.text).toContain('Akkumulert resultat');
  expect(view.text).toContain('Hvor kommer resultatet fra?');
  expect(view.container.querySelector('[data-testid="insight-best-sport"]')).not.toBeNull();
  view.cleanup();
  expect(errors).toEqual([]);
});
