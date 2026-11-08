import { Coins } from 'lucide-react';
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useReducedMotion } from '../hooks/use-reduced-motion';
import { formatAxisAmount, formatCurrency } from '../lib/format';
import { AXIS_TICK, CHART } from '../lib/theme';
import { ChartTooltipFrame, formatLongDate, formatShortDate } from './ds/ChartTooltip';
import Money from './ds/Money';
import { EmptyState, Panel, SectionHeader } from './ds/Section';
import { Stat, StatLine } from './ds/StatLine';

function TurnoverTooltip({ active, payload, currency }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <ChartTooltipFrame
      title={formatLongDate(row.date)}
      rows={[
        {
          label: 'Omsetning',
          value: formatCurrency(row.daily_stake, currency),
          className: 'text-[13px] font-semibold',
        },
        { label: 'Spill', value: row.bets || 0 },
        { label: 'Akkumulert', value: formatCurrency(row.cumulative_stake, currency), divider: true },
      ]}
    />
  );
}

function TurnoverBar(props) {
  const { x, y, width, height, payload, peakDate, lowDate } = props;
  const barH = Math.abs(height || 0);
  if (!barH) return null;
  const barY = height < 0 ? y + height : y;
  const marked =
    (payload?.date && payload.date === peakDate) || (payload?.date && payload.date === lowDate && peakDate !== lowDate);
  const cx = x + width / 2;

  return (
    <g>
      <Rectangle
        x={x}
        y={barY}
        width={width}
        height={barH}
        radius={[3, 3, 0, 0]}
        fill={CHART.info}
        fillOpacity={marked ? 1 : 0.7}
      />
      {marked ? (
        <g>
          <circle cx={cx} cy={barY} r={7} fill={CHART.info} fillOpacity={0.2} />
          <circle cx={cx} cy={barY} r={3} fill={CHART.info} stroke={CHART.background} strokeWidth={1.5} />
        </g>
      ) : null}
    </g>
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
  const reducedMotion = useReducedMotion();

  const summary = useMemo(() => {
    if (!rows.length) {
      return { total: 0, peak: null, low: null, bets: 0 };
    }
    return rows.reduce(
      (acc, row) => {
        acc.total += row.daily_stake;
        acc.bets += row.bets || 0;
        if (!acc.peak || row.daily_stake >= acc.peak.daily_stake) acc.peak = row;
        if (row.daily_stake > 0 && (!acc.low || row.daily_stake <= acc.low.daily_stake)) acc.low = row;
        return acc;
      },
      { total: 0, peak: null, low: null, bets: 0 }
    );
  }, [rows]);

  const average = rows.length ? summary.total / rows.length : 0;
  const hasTurnover = summary.total > 0;

  const openDate = (date) => {
    if (date && onDateSelect) onDateSelect(date);
  };

  return (
    <Panel
      className="flex flex-col overflow-hidden"
      data-testid="analytics-turnover-chart"
      aria-labelledby="turnover-title"
    >
      <div className="p-5">
        <SectionHeader
          id="turnover-title"
          eyebrow="Volum"
          title="Omsetning"
          description={`${truncated ? 'Siste 40 dager med aktivitet' : 'Innsats per dag i utvalget'}${
            rows.length ? ` · ${rows.length} dager` : ''
          }`}
        />
      </div>

      {hasTurnover ? (
        <>
          <StatLine>
            <Stat
              label="Totalt"
              value={<Money value={summary.total} currency={currency} digits={0} />}
              sub="oppgjort innsats"
            />
            <Stat
              label="Snitt per dag"
              value={<Money value={average} currency={currency} digits={0} />}
              sub={`${summary.bets} spill`}
            />
            <Stat
              label="Høyeste dag"
              value={<Money value={summary.peak?.daily_stake} currency={currency} digits={0} />}
              sub={formatShortDate(summary.peak?.date)}
              onClick={() => openDate(summary.peak?.date)}
            />
            <Stat
              label="Akkumulert"
              value={<Money value={rows[rows.length - 1]?.cumulative_stake} currency={currency} digits={0} />}
              sub="ved siste dag"
            />
          </StatLine>

          <div className="h-[240px] px-2 pb-3 pt-4 sm:h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                barCategoryGap="26%"
                margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                onClick={(state) => openDate(state?.activeLabel || state?.activePayload?.[0]?.payload?.date)}
                style={{ cursor: 'pointer' }}
                accessibilityLayer
              >
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  minTickGap={28}
                  interval="preserveStartEnd"
                  tickFormatter={formatShortDate}
                  tick={AXIS_TICK}
                  dy={6}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(value) => formatAxisAmount(value, currency)}
                  tick={AXIS_TICK}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(242,245,244,0.04)' }}
                  content={<TurnoverTooltip currency={currency} />}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="daily_stake"
                  name="Omsetning"
                  maxBarSize={28}
                  isAnimationActive={!reducedMotion}
                  shape={(barProps) => (
                    <TurnoverBar {...barProps} peakDate={summary.peak?.date} lowDate={summary.low?.date} />
                  )}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <EmptyState icon={Coins} title="Ingen omsetning i utvalget" />
      )}
    </Panel>
  );
}
