import { CHART } from '../lib/theme';

export function latestExtremeDates(data, key) {
  if (!data?.length) return { highDate: null, lowDate: null };
  let high = data[0];
  let low = data[0];
  for (const row of data) {
    const value = Number(row?.[key]);
    if (!Number.isFinite(value)) continue;
    const highValue = Number(high?.[key]);
    const lowValue = Number(low?.[key]);
    if (!Number.isFinite(highValue) || value >= highValue) high = row;
    if (!Number.isFinite(lowValue) || value <= lowValue) low = row;
  }
  return { highDate: high?.date ?? null, lowDate: low?.date ?? null };
}

export function ChartExtremeDot({ cx, cy, payload, value, highDate, lowDate }) {
  if (cx == null || cy == null || !payload?.date) return null;
  const isHigh = payload.date === highDate;
  const isLow = payload.date === lowDate && highDate !== lowDate;
  if (!isHigh && !isLow) return null;

  const amount = Number(Array.isArray(value) ? value[1] : (value ?? payload.cumulative_pl));
  const color = Number.isFinite(amount) && amount < 0 ? CHART.negative : CHART.positive;

  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill={color} fillOpacity={0.18} />
      <circle cx={cx} cy={cy} r={4} fill={CHART.background} />
      <circle cx={cx} cy={cy} r={2.5} fill={color} />
    </g>
  );
}
