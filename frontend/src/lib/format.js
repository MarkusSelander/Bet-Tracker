const moneyRates = {
  unitSize: null,
  nokPerUsd: null,
};

export function setMoneyRates({ unitSize, nokPerUsd } = {}) {
  if (unitSize !== undefined) moneyRates.unitSize = unitSize;
  if (nokPerUsd !== undefined) moneyRates.nokPerUsd = nokPerUsd;
}

export function convertFromNok(value, currency = 'NOK') {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  if (currency === 'UNITS') {
    const unit = Number(moneyRates.unitSize);
    if (!(unit > 0)) return null;
    return amount / unit;
  }
  if (currency === 'USD') {
    const rate = Number(moneyRates.nokPerUsd);
    if (!(rate > 0)) return null;
    return amount / rate;
  }
  return amount;
}

function formatNumber(amount, digits) {
  return amount.toLocaleString('nb-NO', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatCurrency(value, currency = 'NOK', digits = 2) {
  const amount = convertFromNok(value, currency);
  if (amount == null) return '–';
  if (currency === 'UNITS') return `${formatNumber(amount, digits)} u`;
  if (currency === 'USD') return `${formatNumber(amount, digits)} $`;
  return `${formatNumber(amount, digits)} kr`;
}

export function formatAxisAmount(value, currency = 'NOK') {
  const amount = convertFromNok(value, currency);
  if (amount == null) return '';
  if (amount === 0) return '0';
  const sign = amount < 0 ? '−' : '';
  const abs = Math.abs(amount);
  const suffix = currency === 'USD' ? ' $' : currency === 'UNITS' ? ' u' : '';
  if (abs >= 10000) return `${sign}${Math.round(abs / 1000)}k${suffix}`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1).replace('.', ',')}${suffix}`;
  return `${sign}${Math.round(abs)}${suffix}`;
}

export const TICKET_TYPE_LABELS = {
  single: 'Enkelt',
  combo: 'Kombi',
  system: 'System',
  betbuilder: 'Bet Builder',
};

export const PRODUCT_LABELS = {
  PREMATCH: 'Prematch',
  LIVE: 'Live',
  MIXED: 'Blandet',
};

export const STATUS_LABELS = {
  won: 'Vunnet',
  lost: 'Tapt',
  push: 'Push',
  pending: 'Åpen',
  cashed: 'Cashout',
};

export function statusClass(status) {
  if (status === 'won') return 'bg-primary/10 text-primary';
  if (status === 'lost') return 'bg-destructive/10 text-destructive';
  if (status === 'cashed') return 'bg-amber-500/10 text-amber-400';
  if (status === 'push') return 'bg-white/10 text-text-secondary';
  return 'bg-accent/10 text-accent';
}
