const VALID_PERIODS = new Set(['7', '30', '90', '365', 'all', 'custom']);
const ODDS_BOUNDS = {
  '1.00-1.50': { odds_min: 1, odds_max: 1.5 },
  '1.51-2.00': { odds_min: 1.51, odds_max: 2 },
  '2.01-3.00': { odds_min: 2.01, odds_max: 3 },
  '3.01-5.00': { odds_min: 3.01, odds_max: 5 },
  '5.01+': { odds_min: 5.01, odds_max: undefined },
};
const FILTER_KEYS = [
  'period',
  'from',
  'to',
  'sport',
  'status',
  'bookie',
  'tipster',
  'league',
  'ticketType',
  'oddsRange',
  'q',
  'date',
  'month',
];
const BETS_KEYS = [
  'period',
  'from',
  'to',
  'sport',
  'status',
  'bookie',
  'tipster',
  'league',
  'ticketType',
  'oddsRange',
  'q',
];
const ANALYTICS_KEYS = ['period', 'from', 'to', 'sport', 'bookie', 'tipster'];
const CALENDAR_KEYS = ['date', 'month'];
const EMPTY_FILTERS = FILTER_KEYS.reduce((acc, key) => {
  acc[key] = '';
  return acc;
}, {});
const PIE_STATUS = {
  Vunnet: 'won',
  Tapt: 'lost',
  Push: 'push',
  Cashout: 'cashed',
  Åpne: 'pending',
};

function pad(value) {
  return String(value).padStart(2, '0');
}

function localDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toParams(input) {
  if (!input) return new URLSearchParams();
  if (typeof input === 'string') {
    return new URLSearchParams(input.startsWith('?') ? input.slice(1) : input);
  }
  if (typeof input.get === 'function') return new URLSearchParams(input.toString());
  return new URLSearchParams();
}

function emptyToAll(value) {
  if (!value || value === 'all') return '';
  return value;
}

function parseFilters(input) {
  const params = toParams(input);
  const filters = { ...EMPTY_FILTERS };
  FILTER_KEYS.forEach((key) => {
    filters[key] = params.get(key) || '';
  });
  if (!VALID_PERIODS.has(filters.period)) filters.period = '';
  if (!filters.period && (filters.from || filters.to)) filters.period = 'custom';
  return filters;
}

function toSearch(filters = {}, keys = FILTER_KEYS) {
  const params = new URLSearchParams();
  keys.forEach((key) => {
    const value = filters[key];
    if (!value || value === 'all') return;
    params.set(key, value);
  });
  return params.toString();
}

function periodToRange(period, now = new Date(), custom = {}) {
  if (!period || period === 'all') return { from: '', to: '' };
  if (period === 'custom') return { from: custom.from || '', to: custom.to || '' };
  const days = Number(period);
  if (!days) return { from: '', to: '' };
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return { from: localDateKey(start), to: localDateKey(end) };
}

function resolvedRange(filters = {}, now = new Date()) {
  const period = filters.period || '';
  if (period === 'custom' || (!period && (filters.from || filters.to))) {
    return { from: filters.from || '', to: filters.to || '' };
  }
  return periodToRange(period, now, filters);
}

function oddsRangeToBounds(oddsRange) {
  return ODDS_BOUNDS[oddsRange] || { odds_min: undefined, odds_max: undefined };
}

function pathWith(pathname, filters, keys) {
  const search = toSearch(filters, keys);
  return search ? `${pathname}?${search}` : pathname;
}

function betsPath(filters = {}) {
  return pathWith('/bets', filters, BETS_KEYS);
}

function analyticsPath(filters = {}) {
  return pathWith('/analytics', filters, ANALYTICS_KEYS);
}

function calendarPath(filters = {}) {
  return pathWith('/calendar', filters, CALENDAR_KEYS);
}

function toAnalyticsApiSearch(filters = {}, now = new Date()) {
  const params = new URLSearchParams();
  const range = resolvedRange(filters, now);
  if (range.from) params.set('date_from', range.from);
  if (range.to) params.set('date_to', range.to);
  if (filters.sport && filters.sport !== 'all') params.set('sport', filters.sport);
  if (filters.bookie && filters.bookie !== 'all') params.set('bookie', filters.bookie);
  if (filters.tipster && filters.tipster !== 'all') params.set('tipster', filters.tipster);
  return params.toString();
}

function chartQuery(filters = {}, now = new Date()) {
  const params = new URLSearchParams();
  const period = filters.period || 'all';
  const range = resolvedRange(filters, now);
  if (period === 'all' && !range.from && !range.to) {
    params.set('days', 'all');
  }
  if (range.from) params.set('date_from', range.from);
  if (range.to) params.set('date_to', range.to);
  if (filters.sport && filters.sport !== 'all') params.set('sport', filters.sport);
  if (filters.bookie && filters.bookie !== 'all') params.set('bookie', filters.bookie);
  if (filters.tipster && filters.tipster !== 'all') params.set('tipster', filters.tipster);
  return params.toString();
}

function toBetsApiSearch(filters = {}, now = new Date()) {
  const params = new URLSearchParams();
  const range = resolvedRange(filters, now);
  if (range.from) params.set('date_from', range.from);
  if (range.to) params.set('date_to', range.to);
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.sport && filters.sport !== 'all') params.set('sport', filters.sport);
  if (filters.bookie && filters.bookie !== 'all') params.set('bookie', filters.bookie);
  if (filters.tipster && filters.tipster !== 'all') params.set('tipster', filters.tipster);
  if (filters.league && filters.league !== 'all') params.set('league', filters.league);
  if (filters.ticketType && filters.ticketType !== 'all') params.set('ticket_type', filters.ticketType);
  const bounds = oddsRangeToBounds(filters.oddsRange);
  if (bounds.odds_min != null) params.set('odds_min', String(bounds.odds_min));
  if (bounds.odds_max != null) params.set('odds_max', String(bounds.odds_max));
  return params.toString();
}

function oddsInRange(odds, oddsRange) {
  const bounds = oddsRangeToBounds(oddsRange);
  if (bounds.odds_min == null && bounds.odds_max == null) return true;
  const value = Number(odds);
  if (Number.isNaN(value)) return false;
  if (bounds.odds_min != null && value < bounds.odds_min) return false;
  if (bounds.odds_max != null && value > bounds.odds_max) return false;
  return true;
}

function filterBets(bets, filters = {}, now = new Date()) {
  const range = resolvedRange(filters, now);
  const q = String(filters.q || '')
    .trim()
    .toLowerCase();
  return (bets || []).filter((bet) => {
    if (range.from && bet.date < range.from) return false;
    if (range.to && bet.date > range.to) return false;
    if (filters.status && filters.status !== 'all' && bet.status !== filters.status) return false;
    if (filters.sport && filters.sport !== 'all' && bet.sport !== filters.sport) return false;
    if (filters.bookie && filters.bookie !== 'all' && bet.bookie !== filters.bookie) return false;
    if (filters.tipster && filters.tipster !== 'all' && bet.tipster !== filters.tipster) return false;
    if (filters.league && filters.league !== 'all' && bet.league !== filters.league) return false;
    if (filters.ticketType && filters.ticketType !== 'all' && bet.ticket_type !== filters.ticketType) return false;
    if (filters.oddsRange && !oddsInRange(bet.odds, filters.oddsRange)) return false;
    if (q) {
      const haystack = [bet.game, bet.bet, bet.sport, bet.league, bet.bookie, bet.tipster]
        .map((field) => String(field || '').toLowerCase())
        .join(' ');
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function settledCount(row) {
  return (row.won || 0) + (row.lost || 0) + (row.push || 0) + (row.cashed || 0);
}

function pickInsight(rows, direction = 'best', minSettled = 5) {
  const eligible = (rows || []).filter((row) => settledCount(row) >= minSettled);
  if (!eligible.length) return null;
  const sorted = [...eligible].sort((a, b) => (a.profit_loss || 0) - (b.profit_loss || 0));
  return direction === 'worst' ? sorted[0] : sorted[sorted.length - 1];
}

function pieStatus(name) {
  return PIE_STATUS[name] || '';
}

exports.__esModule = true;
exports.VALID_PERIODS = VALID_PERIODS;
exports.ODDS_RANGES = Object.keys(ODDS_BOUNDS);
exports.EMPTY_FILTERS = EMPTY_FILTERS;
exports.parseFilters = parseFilters;
exports.toSearch = toSearch;
exports.periodToRange = periodToRange;
exports.resolvedRange = resolvedRange;
exports.oddsRangeToBounds = oddsRangeToBounds;
exports.betsPath = betsPath;
exports.analyticsPath = analyticsPath;
exports.calendarPath = calendarPath;
exports.toAnalyticsApiSearch = toAnalyticsApiSearch;
exports.chartQuery = chartQuery;
exports.toBetsApiSearch = toBetsApiSearch;
exports.filterBets = filterBets;
exports.pickInsight = pickInsight;
exports.pieStatus = pieStatus;
exports.emptyToAll = emptyToAll;
exports.localDateKey = localDateKey;
