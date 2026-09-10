const assert = require('node:assert/strict');
const { before, test } = require('node:test');

let parseFilters;
let toSearch;
let periodToRange;
let oddsRangeToBounds;
let betsPath;
let analyticsPath;
let calendarPath;
let toAnalyticsApiSearch;
let chartQuery;
let toBetsApiSearch;
let filterBets;
let pickInsight;
let pieStatus;

before(async () => {
  ({
    parseFilters,
    toSearch,
    periodToRange,
    oddsRangeToBounds,
    betsPath,
    analyticsPath,
    calendarPath,
    toAnalyticsApiSearch,
    chartQuery,
    toBetsApiSearch,
    filterBets,
    pickInsight,
    pieStatus,
  } = await import('./filters.js'));
});

const NOW = new Date(2026, 8, 10);

test('parseFilters treats empty input as all', () => {
  assert.deepEqual(parseFilters(''), {
    period: '',
    from: '',
    to: '',
    sport: '',
    status: '',
    bookie: '',
    tipster: '',
    league: '',
    ticketType: '',
    oddsRange: '',
    q: '',
    date: '',
    month: '',
  });
  assert.deepEqual(parseFilters(null), parseFilters(''));
});

test('parseFilters reads known URL params', () => {
  const filters = parseFilters(
    'period=30&from=2026-08-01&to=2026-08-31&sport=Football&status=won&bookie=Coolbet&tipster=Ada&league=Eliteserien&ticketType=combo&oddsRange=1.51-2.00&q=Brann&date=2026-09-10&month=2026-09'
  );
  assert.equal(filters.period, '30');
  assert.equal(filters.from, '2026-08-01');
  assert.equal(filters.sport, 'Football');
  assert.equal(filters.ticketType, 'combo');
  assert.equal(filters.oddsRange, '1.51-2.00');
  assert.equal(filters.q, 'Brann');
  assert.equal(filters.date, '2026-09-10');
  assert.equal(filters.month, '2026-09');
});

test('parseFilters infers custom period from from/to', () => {
  const filters = parseFilters('from=2026-09-01&to=2026-09-10');
  assert.equal(filters.period, 'custom');
  assert.equal(filters.from, '2026-09-01');
  assert.equal(filters.to, '2026-09-10');
});

test('parseFilters ignores invalid period', () => {
  assert.equal(parseFilters('period=14').period, '');
});

test('toSearch omits empty values and period=all', () => {
  assert.equal(toSearch(parseFilters('')), '');
  assert.equal(toSearch({ period: 'all', sport: '' }), '');
  assert.equal(toSearch({ period: '30', sport: 'Football', status: 'all' }), 'period=30&sport=Football');
});

test('parseFilters roundtrips through toSearch', () => {
  const original = parseFilters('period=90&sport=Tennis&bookie=Coolbet&q=Oslo');
  assert.deepEqual(parseFilters(toSearch(original)), original);
});

test('periodToRange maps numbered periods to inclusive local dates', () => {
  assert.deepEqual(periodToRange('all', NOW), { from: '', to: '' });
  assert.deepEqual(periodToRange('', NOW), { from: '', to: '' });
  assert.deepEqual(periodToRange('7', NOW), { from: '2026-09-03', to: '2026-09-10' });
  assert.deepEqual(periodToRange('30', NOW), { from: '2026-08-11', to: '2026-09-10' });
  assert.deepEqual(periodToRange('custom', NOW, { from: '2026-01-01', to: '2026-02-01' }), {
    from: '2026-01-01',
    to: '2026-02-01',
  });
});

test('oddsRangeToBounds maps known buckets', () => {
  assert.deepEqual(oddsRangeToBounds('1.00-1.50'), { odds_min: 1, odds_max: 1.5 });
  assert.deepEqual(oddsRangeToBounds('1.51-2.00'), { odds_min: 1.51, odds_max: 2 });
  assert.deepEqual(oddsRangeToBounds('2.01-3.00'), { odds_min: 2.01, odds_max: 3 });
  assert.deepEqual(oddsRangeToBounds('3.01-5.00'), { odds_min: 3.01, odds_max: 5 });
  assert.deepEqual(oddsRangeToBounds('5.01+'), { odds_min: 5.01, odds_max: undefined });
  assert.deepEqual(oddsRangeToBounds(''), { odds_min: undefined, odds_max: undefined });
});

test('betsPath and analyticsPath keep shared filters', () => {
  const filters = {
    period: '30',
    sport: 'Football',
    bookie: 'Coolbet',
    tipster: 'Ada',
    status: 'won',
  };
  assert.equal(betsPath(filters), '/bets?period=30&sport=Football&status=won&bookie=Coolbet&tipster=Ada');
  assert.equal(analyticsPath(filters), '/analytics?period=30&sport=Football&bookie=Coolbet&tipster=Ada');
  assert.equal(betsPath({ q: 'Brann' }), '/bets?q=Brann');
  assert.equal(betsPath({ from: '2026-09-10', to: '2026-09-10' }), '/bets?from=2026-09-10&to=2026-09-10');
});

test('calendarPath writes date and month', () => {
  assert.equal(calendarPath({ date: '2026-09-10' }), '/calendar?date=2026-09-10');
  assert.equal(calendarPath({ date: '2026-09-10', month: '2026-09' }), '/calendar?date=2026-09-10&month=2026-09');
  assert.equal(calendarPath({}), '/calendar');
});

test('toAnalyticsApiSearch sends date_from/to and omits days for all', () => {
  assert.equal(toAnalyticsApiSearch({ period: 'all' }, NOW), '');
  assert.equal(toAnalyticsApiSearch({ period: '' }, NOW), '');
  assert.equal(
    toAnalyticsApiSearch({ period: '30', sport: 'Football', bookie: 'Coolbet', tipster: 'Ada' }, NOW),
    'date_from=2026-08-11&date_to=2026-09-10&sport=Football&bookie=Coolbet&tipster=Ada'
  );
  assert.ok(!toAnalyticsApiSearch({ period: 'all' }, NOW).includes('days'));
  assert.ok(!toAnalyticsApiSearch({ period: '30' }, NOW).includes('days'));
});

test('chartQuery sends days=all for period all so the chart is all-time', () => {
  assert.equal(chartQuery({ period: 'all' }, NOW), 'days=all');
  assert.equal(chartQuery({ period: '' }, NOW), 'days=all');
  assert.equal(
    chartQuery({ period: '30', sport: 'Football' }, NOW),
    'date_from=2026-08-11&date_to=2026-09-10&sport=Football'
  );
  assert.equal(
    chartQuery({ period: 'custom', from: '2026-01-01', to: '2026-02-01' }, NOW),
    'date_from=2026-01-01&date_to=2026-02-01'
  );
  assert.ok(!chartQuery({ period: '30' }, NOW).includes('days'));
});

test('chartQuery omits sport=all and bookie=all', () => {
  assert.equal(chartQuery({ period: 'all', sport: 'all', bookie: 'all' }, NOW), 'days=all');
  assert.equal(
    chartQuery({ period: 'all', sport: 'Football', bookie: 'Coolbet', tipster: 'Ada' }, NOW),
    'days=all&sport=Football&bookie=Coolbet&tipster=Ada'
  );
});

test('toBetsApiSearch maps ticket type and odds range', () => {
  assert.equal(
    toBetsApiSearch(
      { period: '7', sport: 'Football', league: 'Eliteserien', ticketType: 'combo', oddsRange: '1.51-2.00' },
      NOW
    ),
    'date_from=2026-09-03&date_to=2026-09-10&sport=Football&league=Eliteserien&ticket_type=combo&odds_min=1.51&odds_max=2'
  );
  assert.equal(toBetsApiSearch({ oddsRange: '5.01+' }, NOW), 'odds_min=5.01');
  assert.equal(toBetsApiSearch({ status: 'pending' }, NOW), 'status=pending');
});

test('filterBets honors incoming analyse dimensions client-side', () => {
  const bets = [
    {
      game: 'Brann vs Viking',
      sport: 'Football',
      league: 'Eliteserien',
      ticket_type: 'combo',
      odds: 1.8,
      status: 'won',
      bookie: 'Coolbet',
      date: '2026-09-09',
    },
    {
      game: 'Djokovic vs Sinner',
      sport: 'Tennis',
      league: 'US Open',
      ticket_type: 'single',
      odds: 2.2,
      status: 'lost',
      bookie: 'Bet365',
      date: '2026-09-08',
    },
    {
      game: 'Open slip',
      sport: 'Football',
      league: 'Eliteserien',
      ticket_type: 'single',
      odds: 5.5,
      status: 'pending',
      bookie: 'Coolbet',
      date: '2026-09-10',
    },
  ];
  assert.equal(filterBets(bets, { sport: 'Football' }).length, 2);
  assert.equal(filterBets(bets, { q: 'Brann' }).length, 1);
  assert.equal(filterBets(bets, { oddsRange: '1.51-2.00' }).length, 1);
  assert.equal(filterBets(bets, { ticketType: 'combo' }).length, 1);
  assert.equal(filterBets(bets, { status: 'pending' }).length, 1);
  assert.equal(filterBets(bets, { from: '2026-09-09', to: '2026-09-10' }).length, 2);
});

test('pickInsight requires at least five settled rows', () => {
  const rows = [
    { name: 'Football', profit_loss: 200, won: 4, lost: 2, pending: 0 },
    { name: 'Tennis', profit_loss: 900, won: 2, lost: 1, pending: 0 },
    { name: 'Hockey', profit_loss: -50, won: 3, lost: 3, pending: 1 },
  ];
  assert.equal(pickInsight(rows, 'best').name, 'Football');
  assert.equal(pickInsight(rows, 'worst').name, 'Hockey');
  assert.equal(pickInsight([{ name: 'Tiny', profit_loss: 10, won: 2, lost: 1 }], 'best'), null);
});

test('pieStatus maps Norwegian slice names', () => {
  assert.equal(pieStatus('Vunnet'), 'won');
  assert.equal(pieStatus('Tapt'), 'lost');
  assert.equal(pieStatus('Åpne'), 'pending');
  assert.equal(pieStatus('Cashout'), 'cashed');
});
