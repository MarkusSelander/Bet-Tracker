import { LineChart as LineChartIcon } from 'lucide-react';
import { useId, useMemo } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useReducedMotion } from '../hooks/use-reduced-motion';
import { bandDomain, curveDomain, niceTicks } from '../lib/chartScale';
import { formatAxisAmount, formatCurrency, formatSignedCurrency } from '../lib/format';
import { AXIS_TICK, CHART } from '../lib/theme';
import { curveSummary, maxAbs, withDrawdown } from '../lib/tone';
import { cn } from '../lib/utils';
import { ChartExtremeDot, latestExtremeDates } from './ChartExtremeDot';
import { ChartTooltipFrame, formatLongDate, formatShortDate } from './ds/ChartTooltip';
import { EmptyState } from './ds/Section';

function toneClass(value) {
  if (value > 0) return 'text-primary';
  if (value < 0) return 'text-destructive';
  return '';
}

function toneColor(value) {
  return value < 0 ? CHART.negative : CHART.positive;
}

function drawdownRow(drawdown, currency) {
  return {
    label: 'Fra toppen',
    value: formatSignedCurrency(drawdown, currency),
    className: 'text-destructive',
    divider: true,
  };
}

function PerformanceTooltip({ active, payload, currency, clickable }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <ChartTooltipFrame
      title={formatLongDate(row.date)}
      rows={[
        {
          label: 'Akkumulert',
          value: formatSignedCurrency(row.cumulative_pl, currency),
          className: cn('text-[13px] font-semibold', toneClass(row.cumulative_pl)),
        },
        {
          label: 'Dagens resultat',
          value: formatSignedCurrency(row.daily_pl, currency),
          className: toneClass(row.daily_pl),
        },
        { label: 'Spill', value: row.bets ?? 0 },
        row.daily_stake ? { label: 'Oppgjort innsats', value: formatCurrency(row.daily_stake, currency) } : null,
        row.drawdown < 0 && drawdownRow(row.drawdown, currency),
      ]}
      footer={clickable ? 'Klikk for å åpne dagen i kalenderen' : null}
    />
  );
}

function LastValueTag({ viewBox, text, color }) {
  if (!viewBox) return null;
  const { x, y, width } = viewBox;
  const w = text.length * 6.3 + 12;
  return (
    <g transform={`translate(${x + width + 6}, ${y})`} aria-hidden="true">
      <rect x={0} y={-9} width={w} height={18} rx={4} fill={color} />
      <text
        x={w / 2}
        y={0}
        dy="0.35em"
        textAnchor="middle"
        fontSize={10.5}
        fontWeight={600}
        fill={CHART.background}
        fontFamily="Inter, ui-sans-serif, sans-serif"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {text}
      </text>
    </g>
  );
}

function ActiveDot({ cx, cy, payload }) {
  if (cx == null || cy == null) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4.5}
      fill={CHART.background}
      stroke={toneColor(payload?.cumulative_pl)}
      strokeWidth={2}
    />
  );
}

export function PerformanceLegend({ showDaily = false, showDrawdown = true }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted" aria-label="Forklaring">
      <li className="flex items-center gap-1.5">
        <span className="h-[2px] w-3.5 rounded-full bg-gradient-to-r from-primary from-50% to-destructive to-50%" />
        Akkumulert
      </li>
      {showDaily ? (
        <li className="flex items-center gap-1.5">
          <span className="flex h-2.5 items-end gap-[2px]">
            <span className="h-2 w-[3px] rounded-[1px] bg-primary/60" />
            <span className="h-1 w-[3px] rounded-[1px] bg-destructive/60" />
          </span>
          Daglig
        </li>
      ) : null}
      {showDrawdown ? (
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-3.5 rounded-[2px] border border-dashed border-text-muted/70 bg-[repeating-linear-gradient(45deg,rgb(var(--destructive)/0.35)_0,rgb(var(--destructive)/0.35)_1px,transparent_1px,transparent_4px)]" />
          Fra toppen
        </li>
      ) : null}
    </ul>
  );
}

/**
 * Signature equity curve: the line changes color where it crosses zero, the hatched band shows
 * how far it sits under its running peak, daily results sit as a quiet band underneath, and the
 * latest value is tagged on the axis.
 */
export default function PerformanceChart({
  data,
  currency = 'NOK',
  height = 300,
  mode = 'line',
  showDaily = false,
  onDateSelect,
  testId,
  className,
  emptyText = 'Ingen oppgjorte spill i perioden',
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const reducedMotion = useReducedMotion();
  const rows = useMemo(() => withDrawdown(Array.isArray(data) ? data : []), [data]);
  const summary = useMemo(() => curveSummary(rows), [rows]);
  const extremes = useMemo(() => latestExtremeDates(rows, 'cumulative_pl'), [rows]);

  if (!rows.length) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }} data-testid={testId}>
        <EmptyState
          icon={LineChartIcon}
          title={emptyText}
          description="Kurven fylles ut etter hvert som spill gjøres opp."
        />
      </div>
    );
  }

  const values = rows.map((row) => Number(row.cumulative_pl) || 0);
  const dataMax = Math.max(...values);
  const dataMin = Math.min(...values);
  const hi = Math.max(0, dataMax);
  const lo = Math.min(0, dataMin);
  const split = hi <= 0 ? 0 : lo >= 0 ? 1 : hi / (hi - lo);
  const flatLine = dataMax === dataMin;
  const bandOn = showDaily && mode === 'line';
  const drawdownOn = mode === 'line' && summary.maxDrawdown < 0;
  const domain = curveDomain(dataMin, dataMax, { bottom: bandOn ? 0.42 : 0.08, top: 0.12 });
  const ticks = niceTicks(lo, hi, 4);
  const dailyDomain = bandDomain(maxAbs(rows.map((row) => row.daily_pl)), 0.2);
  const { last } = summary;
  const lastText = `${last > 0 ? '+' : ''}${formatAxisAmount(last, currency)}`;
  const animate = !reducedMotion;
  const clickable = Boolean(onDateSelect);

  const handleClick = (state) => {
    const date = state?.activeLabel || state?.activePayload?.[0]?.payload?.date;
    if (date && onDateSelect) onDateSelect(date);
  };

  const ariaLabel = `Akkumulert resultat ${formatSignedCurrency(last, currency)}. Topp ${formatSignedCurrency(
    summary.peak,
    currency
  )}, bunn ${formatSignedCurrency(summary.trough, currency)}, ${rows.length} dager med spill.`;

  return (
    <div className={cn('w-full', className)} data-testid={testId} role="group" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={rows}
          margin={{ top: 12, right: 4, left: 4, bottom: 0 }}
          onClick={clickable ? handleClick : undefined}
          style={clickable ? { cursor: 'pointer' } : undefined}
          barCategoryGap="22%"
          accessibilityLayer
        >
          <defs>
            <linearGradient id={`${uid}-stroke`} x1="0" y1="0" x2="0" y2="1">
              <stop offset={split} stopColor={CHART.positive} />
              <stop offset={split} stopColor={CHART.negative} />
            </linearGradient>
            <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset={0} stopColor={CHART.positive} stopOpacity={0.24} />
              <stop offset={split} stopColor={CHART.positive} stopOpacity={0.015} />
              <stop offset={split} stopColor={CHART.negative} stopOpacity={0.015} />
              <stop offset={1} stopColor={CHART.negative} stopOpacity={0.24} />
            </linearGradient>
            <pattern
              id={`${uid}-hatch`}
              width="5"
              height="5"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="5" height="5" fill={CHART.negative} fillOpacity="0.04" />
              <line x1="0" y1="0" x2="0" y2="5" stroke={CHART.negative} strokeOpacity="0.3" strokeWidth="1" />
            </pattern>
          </defs>

          <YAxis
            yAxisId="main"
            orientation="right"
            domain={domain}
            ticks={ticks}
            allowDataOverflow
            tickFormatter={(value) => formatAxisAmount(value, currency)}
            axisLine={false}
            tickLine={false}
            width={62}
            tick={AXIS_TICK}
          />
          <YAxis yAxisId="daily" hide domain={dailyDomain} allowDataOverflow />
          <CartesianGrid vertical={false} stroke={CHART.grid} syncWithTicks />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            axisLine={false}
            tickLine={false}
            minTickGap={36}
            interval="preserveStartEnd"
            tick={AXIS_TICK}
            dy={6}
          />
          <Tooltip
            cursor={{ stroke: CHART.axis, strokeOpacity: 0.45, strokeDasharray: '3 3' }}
            content={<PerformanceTooltip currency={currency} clickable={clickable} />}
            isAnimationActive={false}
          />
          <ReferenceLine yAxisId="main" y={0} stroke={CHART.zero} strokeWidth={1} />

          {bandOn ? (
            <Bar
              yAxisId="daily"
              dataKey="daily_pl"
              maxBarSize={7}
              isAnimationActive={animate}
              animationDuration={500}
              name="Daglig"
            >
              {rows.map((row) => (
                <Cell key={row.date} fill={toneColor(row.daily_pl)} fillOpacity={0.5} />
              ))}
            </Bar>
          ) : null}

          {mode === 'bar' ? (
            <Bar
              yAxisId="main"
              dataKey="cumulative_pl"
              name="Akkumulert"
              radius={[2, 2, 0, 0]}
              maxBarSize={18}
              isAnimationActive={animate}
            >
              {rows.map((row) => (
                <Cell key={row.date} fill={toneColor(row.cumulative_pl)} fillOpacity={0.85} />
              ))}
            </Bar>
          ) : null}

          {/* No fragments here: Recharts' react-is 18 does not recognise React 19 fragments and drops their children. */}
          {drawdownOn ? (
            <Area
              yAxisId="main"
              type="monotone"
              dataKey={(row) => [row.cumulative_pl, row.peak]}
              stroke="none"
              fill={`url(#${uid}-hatch)`}
              isAnimationActive={false}
              activeDot={false}
              name="Fra toppen"
            />
          ) : null}
          {drawdownOn ? (
            <Line
              yAxisId="main"
              type="stepAfter"
              dataKey="peak"
              stroke={CHART.axis}
              strokeOpacity={0.55}
              strokeWidth={1}
              strokeDasharray="2 3"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              name="Topp"
            />
          ) : null}
          {mode === 'bar' ? null : (
            <Area
              yAxisId="main"
              type="monotone"
              dataKey="cumulative_pl"
              baseValue={0}
              stroke={flatLine ? toneColor(dataMax) : `url(#${uid}-stroke)`}
              strokeWidth={2}
              fill={`url(#${uid}-fill)`}
              name="Akkumulert"
              dot={({ key, ...props }) => (
                <ChartExtremeDot key={key} {...props} highDate={extremes.highDate} lowDate={extremes.lowDate} />
              )}
              activeDot={({ key, ...props }) => <ActiveDot key={key} {...props} />}
              isAnimationActive={animate}
              animationDuration={700}
              animationEasing="ease-out"
            />
          )}

          <ReferenceLine
            yAxisId="main"
            y={last}
            stroke={toneColor(last)}
            strokeOpacity={0.35}
            strokeDasharray="2 4"
            ifOverflow="visible"
            label={<LastValueTag text={lastText} color={toneColor(last)} />}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
