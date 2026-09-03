export function formatCurrency(value, currency = 'NOK', digits = 2) {
  const amount = Number(value) || 0;
  if (currency === 'UNITS') {
    return `${amount.toFixed(digits)} U`;
  }
  if (currency === 'USD') {
    return `$${amount.toFixed(digits)}`;
  }
  return `${amount.toLocaleString('nb-NO', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} kr`;
}

export const TICKET_TYPE_LABELS = {
  single: 'Enkelt',
  combo: 'Kombi',
  system: 'System',
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
