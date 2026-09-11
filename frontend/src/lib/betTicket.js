export const CORE_FIELDS = ['game', 'status', 'bet', 'stake', 'odds', 'sport', 'tipster', 'bookie'];

export const DETAIL_FIELDS = [
  'date',
  'time',
  'notes',
  'league',
  'ticket_type',
  'product',
  'total_matches',
  'result',
  'expected_result_date',
  'cashout_amount',
  'display_id',
  'source_id',
  'legs',
];

const WRITABLE_DETAIL_FIELDS = ['date', 'time', 'notes'];

export function isDetailFieldWritable(key) {
  return WRITABLE_DETAIL_FIELDS.includes(key);
}

export function isPresent(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && value !== '';
}

export function shouldShowDetailField(key, { mode, values } = {}) {
  if (mode !== 'view' && isDetailFieldWritable(key)) return true;
  const value = values?.[key];
  return isPresent(value) || value === 0;
}

export function defaultCreateValues(now = new Date()) {
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  return {
    date,
    time: now.toTimeString().slice(0, 8),
    game: '',
    bet: '',
    stake: '',
    odds: '',
    status: 'pending',
    bookie: '',
    tipster: '',
    sport: '',
    notes: '',
  };
}

export function valuesFromBet(bet, now = new Date()) {
  const defaults = defaultCreateValues(now);
  if (!bet) return defaults;
  return {
    ...defaults,
    date: bet.date || defaults.date,
    time: bet.time || '',
    game: bet.game || '',
    bet: bet.bet || '',
    stake: bet.stake === 0 || bet.stake ? String(bet.stake) : '',
    odds: bet.odds === 0 || bet.odds ? String(bet.odds) : '',
    status: bet.status || 'pending',
    bookie: bet.bookie || '',
    tipster: bet.tipster || '',
    sport: bet.sport || '',
    notes: bet.notes || '',
    league: bet.league,
    ticket_type: bet.ticket_type,
    product: bet.product,
    total_matches: bet.total_matches,
    result: bet.result,
    expected_result_date: bet.expected_result_date,
    cashout_amount: bet.cashout_amount,
    display_id: bet.display_id,
    source_id: bet.source_id,
    legs: bet.legs,
  };
}

export function toCreatePayload(values) {
  return {
    date: values.date,
    time: values.time,
    game: values.game,
    bet: values.bet,
    stake: parseFloat(values.stake),
    odds: parseFloat(values.odds),
    status: values.status,
    bookie: values.bookie,
    tipster: values.tipster,
    sport: values.sport,
    notes: values.notes,
  };
}

export function toUpdatePayload(values) {
  return {
    date: values.date,
    time: values.time,
    game: values.game,
    bet: values.bet,
    stake: values.stake,
    odds: values.odds,
    status: values.status,
    bookie: values.bookie,
    tipster: values.tipster,
    sport: values.sport,
    notes: values.notes,
  };
}

export function stakeAffix(currency = 'NOK') {
  if (currency === 'UNITS') return 'U';
  if (currency === 'USD') return '$';
  return 'kr';
}
