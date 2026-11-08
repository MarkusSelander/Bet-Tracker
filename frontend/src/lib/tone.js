export function toneOf(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return 'flat';
  return n > 0 ? 'pos' : 'neg';
}

export function toneTextClass(value) {
  const tone = toneOf(value);
  if (tone === 'pos') return 'text-primary';
  if (tone === 'neg') return 'text-destructive';
  return 'text-text-secondary';
}

export function maxAbs(values) {
  return (values || []).reduce((max, value) => {
    const n = Math.abs(Number(value));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
}

// Square-root scale so small days stay visible next to one huge day.
export function heatLevel(value, max) {
  const n = Math.abs(Number(value));
  if (!Number.isFinite(n) || n === 0 || !(max > 0)) return 0;
  return Math.min(1, Math.sqrt(n / max));
}

export function heatStyle(value, max, { floor = 0.07, ceil = 0.34 } = {}) {
  const level = heatLevel(value, max);
  const tone = toneOf(value);
  if (!level || tone === 'flat') return undefined;
  const alpha = floor + (ceil - floor) * level;
  const channel = tone === 'pos' ? 'var(--primary)' : 'var(--destructive)';
  return {
    backgroundColor: `rgb(${channel} / ${alpha.toFixed(3)})`,
    borderColor: `rgb(${channel} / ${Math.min(0.55, alpha + 0.12).toFixed(3)})`,
  };
}

export function delta(current, previous) {
  const a = Number(current);
  const b = Number(previous);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a - b;
}

// The curve starts at 0 before the first day, so the running peak never drops below 0.
export function withDrawdown(rows, key = 'cumulative_pl') {
  let peak = 0;
  return (rows || []).map((row) => {
    const value = Number(row?.[key]) || 0;
    peak = Math.max(peak, value);
    return { ...row, peak, drawdown: value - peak };
  });
}

export function curveSummary(rows, key = 'cumulative_pl') {
  const points = withDrawdown(rows, key);
  if (!points.length) return { last: 0, peak: 0, trough: 0, drawdown: 0, maxDrawdown: 0 };
  const values = points.map((row) => Number(row[key]) || 0);
  return {
    last: values[values.length - 1],
    peak: Math.max(0, ...values),
    trough: Math.min(0, ...values),
    drawdown: points[points.length - 1].drawdown,
    maxDrawdown: Math.min(0, ...points.map((row) => row.drawdown)),
  };
}

export function isoWeek(dateKey) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  return 1 + Math.round((date - firstThursday) / (7 * 24 * 3600 * 1000));
}
