import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
  const abs = Math.abs(n);
  if (abs >= 10000) return `${Math.round(abs / 1000)}k`;
  if (abs >= 1000) return `${(abs / 1000).toFixed(1).replace('.', ',')}k`;
  return `${Math.round(abs)}`;
}

function TurnoverTooltip({ active, payload, currency }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="rounded-lg border border-[#27272A] bg-[#121214]/95 px-3 py-2.5 shadow-xl backdrop-blur-sm min-w-[180px]">
      <p className="text-[11px] font-medium text-text-secondary mb-1.5 capitalize">{formatLongDate(row.date)}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="text-xs text-text-secondary">Omsetning</span>
          <span className="text-xs font-mono font-medium">{formatCurrency(row.daily_stake, currency)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-xs text-text-secondary">Spill</span>
          <span className="text-xs font-mono">{row.bets || 0}</span>
        </div>
        <div className="flex items-center justify-between gap-6 pt-1 border-t border-white/5">
          <span className="text-xs text-text-secondary">Akkumulert</span>
          <span className="text-xs font-mono">{formatCurrency(row.cumulative_stake, currency)}</span>
        </div>
      </div>
    </div>
  );
}

function withStake(rows) {
  return (rows || []).reduce((acc, row) => {
    const dailyStake = Number(row.daily_stake) || 0;
    const previous = acc.length ? acc[acc.length - 1].cumulative_stake : 0;
    const cumulative = row.cumulative_stake == null ? previous + dailyStake : Number(row.cumulative_stake) || 0;
    return acc.concat({
      ...row,
      daily_stake: dailyStake,
      cumulative_stake: cumulative,
    });
  }, []);
}

export default function DailyTurnoverChart({ data, currency, truncated, onDateSelect }) {
  const rows = useMemo(() => withStake(data), [data]);

  const summary = useMemo(() => {
    if (!rows.length) {
      return { total: 0, peak: null, bets: 0 };
    }
    return rows.reduce(
      (acc, row) => {
        acc.total += row.daily_stake;
        acc.bets += row.bets || 0;
        if (!acc.peak || row.daily_stake > acc.peak.daily_stake) acc.peak = row;
        return acc;
      },
      { total: 0, peak: null, bets: 0 }
    );
  }, [rows]);

  const average = rows.length ? summary.total / rows.length : 0;
  const xInterval = rows.length > 12 ? Math.ceil(rows.length / 7) - 1 : 0;
  const hasTurnover = summary.total > 0;

  const openDate = (date) => {
    if (date && onDateSelect) onDateSelect(date);
  };

  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6" data-testid="analytics-turnover-chart">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div>
          <h2 className="text-base font-bold">Omsetning</h2>
          <p className="text-xs text-text-muted mt-1">
            {truncated ? 'Siste 40 dager med aktivitet' : 'Innsats per dag i utvalget'}
            {rows.length ? ` · ${rows.length} dager` : ''}
          </p>
        </div>
      </div>

      {hasTurnover ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <div className="rounded-lg bg-black/25 border border-white/5 px-3 py-2.5">
              <p className="text-[11px] text-text-muted mb-0.5">Totalt</p>
              <p className="text-sm font-mono font-medium">{formatCurrency(summary.total, currency)}</p>
              <p className="text-[11px] text-text-muted mt-0.5">oppgjort innsats</p>
            </div>
            <div className="rounded-lg bg-black/25 border border-white/5 px-3 py-2.5">
              <p className="text-[11px] text-text-muted mb-0.5">Snitt per dag</p>
              <p className="text-sm font-mono font-medium">{formatCurrency(average, currency)}</p>
              <p className="text-[11px] text-text-muted mt-0.5">{summary.bets} spill</p>
            </div>
            <button
              type="button"
              onClick={() => openDate(summary.peak?.date)}
              className="rounded-lg bg-black/25 border border-white/5 px-3 py-2.5 text-left hover:border-white/15 transition-colors"
            >
              <p className="text-[11px] text-text-muted mb-0.5">Høyeste dag</p>
              <p className="text-sm font-mono font-medium">{formatCurrency(summary.peak?.daily_stake, currency)}</p>
              <p className="text-[11px] text-text-muted mt-0.5">{formatShortDate(summary.peak?.date)}</p>
            </button>
            <div className="rounded-lg bg-black/25 border border-white/5 px-3 py-2.5">
              <p className="text-[11px] text-text-muted mb-0.5">Akkumulert</p>
              <p className="text-sm font-mono font-medium">
                {formatCurrency(rows[rows.length - 1]?.cumulative_stake, currency)}
              </p>
              <p className="text-[11px] text-text-muted mt-0.5">ved siste dag</p>
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
                  <linearGradient id="turnoverFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38BDF8" />
                    <stop offset="100%" stopColor="#0284C7" stopOpacity={0.85} />
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
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.035)' }}
                  content={<TurnoverTooltip currency={currency} />}
                />
                <Bar
                  dataKey="daily_stake"
                  name="Omsetning"
                  fill="url(#turnoverFill)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <p className="text-sm text-text-muted py-16 text-center">Ingen omsetning i utvalget</p>
      )}
    </div>
  );
}
