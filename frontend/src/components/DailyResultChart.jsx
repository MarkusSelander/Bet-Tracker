import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Rectangle,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency } from '../lib/format';

function parseDate(isoDate) {
  if (!isoDate) return null;
  const date = new Date(`${isoDate}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatShortDate(isoDate) {
  const date = parseDate(isoDate);
  if (!date) return isoDate || '';
  return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }).replace(/\.$/, '');
}

function formatLongDate(isoDate) {
  const date = parseDate(isoDate);
  if (!date) return isoDate || '';
  return date.toLocaleDateString('nb-NO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatAxisAmount(value) {
  const n = Number(value) || 0;
  if (n === 0) return '0';
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(n);
  if (abs >= 10000) return `${sign}${Math.round(abs / 1000)}k`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1).replace('.', ',')}k`;
  return `${sign}${Math.round(abs)}`;
}

function signedText(value) {
  if (value > 0) return 'text-primary';
  if (value < 0) return 'text-destructive';
  return 'text-text-secondary';
}

function signedMoney(value, currency) {
  const n = Number(value) || 0;
  return `${n > 0 ? '+' : ''}${formatCurrency(n, currency)}`;
}

function DailyBar(props) {
  const { x, y, width, height, payload } = props;
  const positive = (payload?.daily_pl || 0) >= 0;
  const barY = height < 0 ? y + height : y;
  const barH = Math.abs(height);
  if (!barH) return null;

  return (
    <Rectangle
      x={x}
      y={barY}
      width={width}
      height={barH}
      radius={positive ? [4, 4, 0, 0] : [0, 0, 4, 4]}
      fill={positive ? 'url(#dailyGainFill)' : 'url(#dailyLossFill)'}
    />
  );
}

function DailyTooltip({ active, payload, currency }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="rounded-lg border border-[#27272A] bg-[#121214]/95 px-3 py-2.5 shadow-xl backdrop-blur-sm min-w-[180px]">
      <p className="text-[11px] font-medium text-text-secondary mb-1.5 capitalize">{formatLongDate(row.date)}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="text-xs text-text-secondary">Resultat</span>
          <span className={`text-xs font-mono font-medium ${signedText(row.daily_pl)}`}>
            {signedMoney(row.daily_pl, currency)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-xs text-text-secondary">Spill</span>
          <span className="text-xs font-mono">{row.bets || 0}</span>
        </div>
        <div className="flex items-center justify-between gap-6 pt-1 border-t border-white/5">
          <span className="text-xs text-text-secondary">Akkumulert</span>
          <span className={`text-xs font-mono ${signedText(row.cumulative_pl)}`}>
            {signedMoney(row.cumulative_pl, currency)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function DailyResultChart({ data, currency, truncated, onDateSelect }) {
  const rows = useMemo(() => data || [], [data]);

  const summary = useMemo(() => {
    if (!rows.length) {
      return { positive: 0, negative: 0, best: null, worst: null };
    }
    return rows.reduce(
      (acc, row) => {
        if (row.daily_pl > 0) acc.positive += 1;
        if (row.daily_pl < 0) acc.negative += 1;
        if (!acc.best || row.daily_pl > acc.best.daily_pl) acc.best = row;
        if (!acc.worst || row.daily_pl < acc.worst.daily_pl) acc.worst = row;
        return acc;
      },
      { positive: 0, negative: 0, best: null, worst: null }
    );
  }, [rows]);

  const xInterval = rows.length > 12 ? Math.ceil(rows.length / 7) - 1 : 0;

  const openDate = (date) => {
    if (date && onDateSelect) onDateSelect(date);
  };

  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6" data-testid="analytics-daily-chart">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div>
          <h2 className="text-base font-bold">Daglig resultat</h2>
          <p className="text-xs text-text-muted mt-1">
            {truncated ? 'Siste 40 dager med aktivitet' : 'Resultat per dag i utvalget'}
            {rows.length ? ` · ${rows.length} dager` : ''}
          </p>
        </div>
        {rows.length ? (
          <div className="flex items-center gap-3 text-[11px] text-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-primary" />
              Pluss
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-destructive" />
              Minus
            </span>
          </div>
        ) : null}
      </div>

      {rows.length ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <button
              type="button"
              onClick={() => openDate(summary.best?.date)}
              className="rounded-lg bg-black/25 border border-white/5 px-3 py-2.5 text-left hover:border-white/15 transition-colors"
            >
              <p className="text-[11px] text-text-muted mb-0.5">Beste dag</p>
              <p className={`text-sm font-mono font-medium ${signedText(summary.best?.daily_pl)}`}>
                {signedMoney(summary.best?.daily_pl, currency)}
              </p>
              <p className="text-[11px] text-text-muted mt-0.5">{formatShortDate(summary.best?.date)}</p>
            </button>
            <button
              type="button"
              onClick={() => openDate(summary.worst?.date)}
              className="rounded-lg bg-black/25 border border-white/5 px-3 py-2.5 text-left hover:border-white/15 transition-colors"
            >
              <p className="text-[11px] text-text-muted mb-0.5">Verste dag</p>
              <p className={`text-sm font-mono font-medium ${signedText(summary.worst?.daily_pl)}`}>
                {signedMoney(summary.worst?.daily_pl, currency)}
              </p>
              <p className="text-[11px] text-text-muted mt-0.5">{formatShortDate(summary.worst?.date)}</p>
            </button>
            <div className="rounded-lg bg-black/25 border border-white/5 px-3 py-2.5">
              <p className="text-[11px] text-text-muted mb-0.5">I pluss</p>
              <p className="text-sm font-mono font-medium text-primary">{summary.positive}</p>
              <p className="text-[11px] text-text-muted mt-0.5">
                {rows.length ? Math.round((summary.positive / rows.length) * 100) : 0}% av dagene
              </p>
            </div>
            <div className="rounded-lg bg-black/25 border border-white/5 px-3 py-2.5">
              <p className="text-[11px] text-text-muted mb-0.5">I minus</p>
              <p className="text-sm font-mono font-medium text-destructive">{summary.negative}</p>
              <p className="text-[11px] text-text-muted mt-0.5">
                {rows.length ? Math.round((summary.negative / rows.length) * 100) : 0}% av dagene
              </p>
            </div>
          </div>

          <div className="h-[240px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                barCategoryGap="28%"
                margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                onClick={(state) => openDate(state?.activeLabel || state?.activePayload?.[0]?.payload?.date)}
                style={{ cursor: 'pointer' }}
              >
                <defs>
                  <linearGradient id="dailyGainFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34D399" />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.85} />
                  </linearGradient>
                  <linearGradient id="dailyLossFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#DC2626" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#F87171" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#27272A" strokeOpacity={0.8} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  interval={xInterval}
                  minTickGap={18}
                  tickFormatter={formatShortDate}
                  tick={{ fill: '#71717A', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={42}
                  tickFormatter={formatAxisAmount}
                  tick={{ fill: '#71717A', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
                />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.035)' }} content={<DailyTooltip currency={currency} />} />
                <ReferenceLine y={0} stroke="#52525B" strokeWidth={1} />
                <Bar dataKey="daily_pl" name="Resultat" shape={DailyBar} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <p className="text-sm text-text-muted py-16 text-center">Ingen daglige resultater i utvalget</p>
      )}
    </div>
  );
}
