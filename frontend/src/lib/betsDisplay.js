import { STATUS_LABELS, TICKET_TYPE_LABELS, formatCurrency } from './format.js';

const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];

const SORT_GETTERS = {
  date: (bet) => `${bet.date || ''}T${bet.time || '00:00:00'}`,
  sport: (bet) => (getBetSports(bet)[0] || '').toLowerCase(),
  match: (bet) => (getMatchSummary(bet).primary || '').toLowerCase(),
  selection: (bet) => (getSelectionSummary(bet).primary || '').toLowerCase(),
  bookie: (bet) => (bet.bookie || '').toLowerCase(),
  stake: (bet) => Number(bet.stake) || 0,
  odds: (bet) => Number(bet.odds) || 0,
  status: (bet) => bet.status || '',
};

export function parseGameExtras(game) {
  const raw = String(game || '').trim();
  const match = raw.match(/^(.*?)\s*\(\+(\d+)\)\s*$/);
  if (!match) return { name: raw, extra: 0 };
  return { name: match[1].trim(), extra: Number(match[2]) };
}

export function formatBetDate(date, time) {
  if (!date) return '—';
  const parts = String(date).split('-').map(Number);
  const monthIndex = (parts[1] || 0) - 1;
  const day = parts[2];
  if (!day || monthIndex < 0 || monthIndex > 11) return String(date);
  const month = MONTHS_SHORT[monthIndex];
  const clock = time ? String(time).slice(0, 5) : '';
  return clock ? `${day}. ${month} ${clock}` : `${day}. ${month}`;
}

export function isComboBet(bet) {
  const total = Number(bet?.total_matches) || 0;
  const legs = Array.isArray(bet?.legs) ? bet.legs.length : 0;
  const extra = parseGameExtras(bet?.game).extra;
  return total > 1 || legs > 1 || extra > 0 || ['combo', 'system', 'betbuilder'].includes(bet?.ticket_type);
}

export function getBetSports(bet) {
  const seen = new Set();
  const sports = [];
  const add = (sport) => {
    const value = String(sport || '').trim();
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    sports.push(value);
  };
  add(bet?.sport);
  for (const leg of bet?.legs || []) add(leg.sport);
  return sports;
}

export function getMatchSummary(bet) {
  const parsed = parseGameExtras(bet?.game);
  const legs = Array.isArray(bet?.legs) ? bet.legs.filter((leg) => leg?.match) : [];
  const totalMatches = Math.max(
    Number(bet?.total_matches) || 0,
    legs.length,
    parsed.extra + (parsed.name ? 1 : 0)
  );
  const combo = isComboBet(bet);
  const primary = (legs[0]?.match || parsed.name || bet?.game || '').trim();
  const extraCount = Math.max(0, totalMatches - 1, parsed.extra, Math.max(0, legs.length - 1));
  return {
    isCombo: combo,
    prefix: combo ? TICKET_TYPE_LABELS[bet?.ticket_type] || 'Kombi' : null,
    primary,
    extraCount,
  };
}

export function getSelectionSummary(bet) {
  const legs = Array.isArray(bet?.legs) ? bet.legs : [];
  const labels = legs.map((leg) => leg.outcome || leg.market || '').filter(Boolean);
  const primary = labels[0] || bet?.bet || '';
  const knownCount = labels.length || (primary ? 1 : 0);
  const total = Math.max(knownCount, Number(bet?.total_matches) || 0);
  return {
    primary,
    extraCount: Math.max(0, total - 1, labels.length - 1),
  };
}

export function potentialProfit(bet) {
  const stake = Number(bet?.stake) || 0;
  const odds = Number(bet?.odds) || 0;
  return Math.max(0, stake * (odds - 1));
}

export function computeActiveKpis(bets) {
  const pending = (bets || []).filter((bet) => bet.status === 'pending');
  return {
    count: pending.length,
    stake: pending.reduce((sum, bet) => sum + (Number(bet.stake) || 0), 0),
    potential: pending.reduce((sum, bet) => sum + potentialProfit(bet), 0),
  };
}

export function sortBets(bets, key, dir = 'desc') {
  if (!key) return bets || [];
  const get = SORT_GETTERS[key] || ((bet) => bet[key]);
  const mul = dir === 'asc' ? 1 : -1;
  return [...(bets || [])].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul;
    return String(va).localeCompare(String(vb), 'nb') * mul;
  });
}

export function nextSortState(currentKey, currentDir, clickedKey) {
  if (currentKey !== clickedKey) return { key: clickedKey, dir: 'asc' };
  if (currentDir === 'asc') return { key: clickedKey, dir: 'desc' };
  return { key: 'date', dir: 'desc' };
}

export function sortTooltip(currentKey, currentDir, columnKey) {
  if (currentKey !== columnKey) return 'Klikk for å sortere stigende';
  if (currentDir === 'asc') return 'Klikk for å sortere synkende';
  return 'Klikk for å tilbakestille sortering';
}

export function statusDotClass(status) {
  if (status === 'won') return 'bg-primary';
  if (status === 'lost') return 'bg-destructive';
  if (status === 'cashed') return 'bg-amber-400';
  if (status === 'push') return 'bg-zinc-500';
  return 'bg-accent';
}

export function statusTextClass(status) {
  if (status === 'won') return 'text-primary';
  if (status === 'lost') return 'text-destructive';
  if (status === 'cashed') return 'text-amber-400';
  if (status === 'push') return 'text-text-secondary';
  return 'text-accent';
}

export function formatStatusLine(bet, currency = 'NOK') {
  const label = STATUS_LABELS[bet?.status] || bet?.status || '';
  if (!bet?.status || bet.status === 'pending' || bet.status === 'push') return label;
  const raw = Number(bet.result);
  const amount = bet.status === 'lost' ? Math.abs(Number.isFinite(raw) ? raw : Number(bet.stake) || 0) : raw || 0;
  return `${label} ${formatCurrency(amount, currency)}`;
}
