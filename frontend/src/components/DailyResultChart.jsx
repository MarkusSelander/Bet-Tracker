import { BarChart3 } from 'lucide-react';
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
import { useReducedMotion } from '../hooks/use-reduced-motion';
import { formatAxisAmount, formatSignedCurrency } from '../lib/format';
import { AXIS_TICK, CHART } from '../lib/theme';
import { cn } from '../lib/utils';
import { ChartTooltipFrame, formatLongDate, formatShortDate } from './ds/ChartTooltip';
import Money from './ds/Money';
import { EmptyState, Panel, SectionHeader } from './ds/Section';
import { Stat, StatLine } from './ds/StatLine';

function toneClass(value) {
  if (value > 0) return 'text-primary';
  if (value < 0) return 'text-destructive';
  return 'text-text-secondary';
}

function DailyBar(props) {
  const { x, y, width, height, payload, bestDate, worstDate } = props;
  const positive = (payload?.daily_pl || 0) >= 0;
  const barY = height < 0 ? y + height : y;
  const barH = Math.abs(height);
  if (!barH) return null;

  const isBest = payload?.date && payload.date === bestDate;
  const isWorst = payload?.date && payload.date === worstDate && bestDate !== worstDate;
  const marked = isBest || isWorst;
  const color = positive ? CHART.positive : CHART.negative;
  const cx = x + width / 2;
  const cy = positive ? barY : barY + barH;

  return (
    <g>
      <Rectangle
        x={x}
        y={barY}
        width={width}
        height={barH}
        radius={positive ? [3, 3, 0, 0] : [0, 0, 3, 3]}
        fill={color}
        fillOpacity={marked ? 1 : 0.78}
      />
      {marked ? (
        <g>
          <circle cx={cx} cy={cy} r={7} fill={color} fillOpacity={0.2} />
          <circle cx={cx} cy={cy} r={3} fill={color} stroke={CHART.background} strokeWidth={1.5} />
        </g>
      ) : null}
    </g>
  );
}

function DailyTooltip({ active, payload, currency }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <ChartTooltipFrame
      title={formatLongDate(row.date)}
      rows={[
        {
          label: 'Resultat',
          value: formatSignedCurrency(row.daily_pl, currency),
          className: cn('text-[13px] font-semibold', toneClass(row.daily_pl)),
        },
        { label: 'Spill', value: row.bets || 0 },
        {
          label: 'Akkumulert',
          value: formatSignedCurrency(row.cumulative_pl, currency),
          className: toneClass(row.cumulative_pl),
          divider: true,
        },
      ]}
    />
  );
}

export default function DailyResultChart({ data, currency, truncated, onDateSelect }) {
  const rows = useMemo(() => data || [], [data]);
  const reducedMotion = useReducedMotion();

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

  const openDate = (date) => {
    if (date && onDateSelect) onDateSelect(date);
  };

  return (
    <Panel className="flex flex-col overflow-hidden" data-testid="analytics-daily-chart" aria-labelledby="daily-title">
      <div className="p-5">
        <SectionHeader
          id="daily-title"
          eyebrow="Dag for dag"
          title="Daglig resultat"
          description={`${truncated ? 'Siste 40 dager med aktivitet' : 'Resultat per dag i utvalget'}${
            rows.length ? ` · ${rows.length} dager` : ''
          }`}
        />
      </div>

      {rows.length ? (
        <>
          <StatLine>
            <Stat
              label="Beste dag"
              value={<Money value={summary.best?.daily_pl} currency={currency} signed />}
              sub={formatShortDate(summary.best?.date)}
              onClick={() => openDate(summary.best?.date)}
            />
            <Stat
              label="Verste dag"
              value={<Money value={summary.worst?.daily_pl} currency={currency} signed />}
              sub={formatShortDate(summary.worst?.date)}
              onClick={() => openDate(summary.worst?.date)}
            />
            <Stat
              label="I pluss"
              value={<span className="text-primary">{summary.positive}</span>}
              sub={`${Math.round((summary.positive / rows.length) * 100)} % av dagene`}
            />
            <Stat
              label="I minus"
              value={<span className="text-destructive">{summary.negative}</span>}
              sub={`${Math.round((summary.negative / rows.length) * 100)} % av dagene`}
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
                  content={<DailyTooltip currency={currency} />}
                  isAnimationActive={false}
                />
                <ReferenceLine y={0} stroke={CHART.zero} strokeWidth={1} />
                <Bar
                  dataKey="daily_pl"
                  name="Resultat"
                  maxBarSize={28}
                  isAnimationActive={!reducedMotion}
                  shape={(barProps) => (
                    <DailyBar {...barProps} bestDate={summary.best?.date} worstDate={summary.worst?.date} />
                  )}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <EmptyState icon={BarChart3} title="Ingen daglige resultater i utvalget" />
      )}
    </Panel>
  );
}
