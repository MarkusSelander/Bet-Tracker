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

export function currencyUnit(currency = 'NOK') {
  if (currency === 'UNITS') return 'u';
  if (currency === 'USD') return '$';
  return 'kr';
}

export function formatMoneyParts(value, currency = 'NOK', digits = 2) {
  const amount = convertFromNok(value, currency);
  if (amount == null) return null;
  const rounded = Number(amount.toFixed(digits));
  const body = formatNumber(Math.abs(rounded), digits);
  const separator = body.lastIndexOf(',');
  return {
    sign: rounded > 0 ? '+' : rounded < 0 ? '−' : '',
    integer: separator === -1 ? body : body.slice(0, separator),
    fraction: separator === -1 ? '' : body.slice(separator),
    unit: currencyUnit(currency),
  };
}

export function formatSignedCurrency(value, currency = 'NOK', digits = 2) {
  const parts = formatMoneyParts(value, currency, digits);
  if (!parts) return '–';
  return `${parts.sign}${parts.integer}${parts.fraction} ${parts.unit}`;
}

export function formatPercent(value, digits = 1, { signed = false } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '–';
  const body = Math.abs(n).toLocaleString('nb-NO', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const sign = n < 0 ? '−' : signed && n > 0 ? '+' : '';
  return `${sign}${body} %`;
}

export function formatAxisAmount(value, currency = 'NOK') {
  const amount = convertFromNok(value, currency);
  if (amount == null) return '';
  if (amount === 0) return '0';
  const sign = amount < 0 ? '−' : '';
  const abs = Math.abs(amount);
  const suffix = currency === 'USD' ? ' $' : currency === 'UNITS' ? ' u' : '';
  if (abs >= 10000) return `${sign}${Math.round(abs / 1000)}k${suffix}`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1).replace('.', ',').replace(/,0$/, '')}k${suffix}`;
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
  if (status === 'won') return 'bg-primary/10 text-primary border-primary/25';
  if (status === 'lost') return 'bg-destructive/10 text-destructive border-destructive/25';
  if (status === 'cashed') return 'bg-warning/10 text-warning border-warning/25';
  if (status === 'push') return 'bg-elevated text-text-secondary border-border';
  return 'bg-accent/10 text-accent border-accent/25';
}
