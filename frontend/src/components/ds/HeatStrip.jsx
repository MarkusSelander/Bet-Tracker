import { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { eachDay } from '../../lib/calendar';
import { calendarPath } from '../../lib/filters';
import { formatSignedCurrency } from '../../lib/format';
import { heatStyle, maxAbs } from '../../lib/tone';
import { cn } from '../../lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { formatLongDate, formatShortDate } from './ChartTooltip';

/**
 * One cell per calendar day in [from, to], tinted by that day's result.
 * Rows come from the summary chart (only days with bets), so missing days are quiet.
 */
export default function HeatStrip({ from, to, rows, currency, todayKey, className }) {
  const byDate = useMemo(() => {
    const map = {};
    (rows || []).forEach((row) => {
      if (row?.date) map[row.date] = row;
    });
    return map;
  }, [rows]);
  const days = useMemo(() => eachDay(from, to), [from, to]);
  const max = maxAbs(days.map((date) => byDate[date]?.daily_pl));
  const active = days.filter((date) => byDate[date]?.bets);
  const up = active.filter((date) => byDate[date].daily_pl > 0).length;
  const down = active.filter((date) => byDate[date].daily_pl < 0).length;
  const refs = useRef([]);

  if (!days.length) return null;

  const focusDay = (event, index) => {
    const steps = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: days.length - 1 - index };
    if (!(event.key in steps)) return;
    event.preventDefault();
    const next = Math.min(days.length - 1, Math.max(0, index + steps[event.key]));
    refs.current[next]?.focus();
  };

  return (
    <div className={className}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="eyebrow">Dagsrytme</span>
        <span className="text-[11px] text-text-muted figure">
          <span className="text-primary">{up}</span> opp · <span className="text-destructive">{down}</span> ned ·{' '}
          {days.length - active.length} uten spill
        </span>
      </div>
      <TooltipProvider delayDuration={80} skipDelayDuration={0}>
        <div
          className="grid gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
          data-testid="heat-strip"
        >
          {days.map((date, index) => {
            const row = byDate[date];
            const value = row?.daily_pl || 0;
            const isToday = date === todayKey;
            const label = row?.bets
              ? `${formatLongDate(date)}: ${formatSignedCurrency(value, currency)}, ${row.bets} spill`
              : `${formatLongDate(date)}: ingen spill`;
            return (
              <Tooltip key={date}>
                <TooltipTrigger asChild>
                  <Link
                    ref={(node) => {
                      refs.current[index] = node;
                    }}
                    to={calendarPath({ date, month: date.slice(0, 7) })}
                    aria-label={label}
                    tabIndex={index === days.length - 1 ? 0 : -1}
                    onKeyDown={(event) => focusDay(event, index)}
                    className={cn(
                      'block h-7 rounded-[3px] border transition-[transform,border-color] duration-150 ease-out hover:-translate-y-px hover:border-text-secondary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
                      row?.bets ? 'border-transparent' : 'border-hairline bg-sunken',
                      row?.bets && value === 0 && 'bg-elevated',
                      isToday && 'ring-1 ring-text-secondary/50 ring-offset-1 ring-offset-surface'
                    )}
                    style={row?.bets ? heatStyle(value, max, { floor: 0.16, ceil: 0.9 }) : undefined}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="border border-border bg-popover text-text-primary shadow-popover">
                  <p className="text-[11px] capitalize text-text-secondary">{formatLongDate(date)}</p>
                  {row?.bets ? (
                    <p className="mt-0.5 text-xs font-medium figure">
                      <span className={value > 0 ? 'text-primary' : value < 0 ? 'text-destructive' : ''}>
                        {formatSignedCurrency(value, currency)}
                      </span>
                      <span className="text-text-muted"> · {row.bets} spill</span>
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-text-muted">Ingen spill</p>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
      <div className="mt-1.5 flex justify-between text-[10.5px] text-text-muted figure">
        <span>{formatShortDate(from)}</span>
        <span>{todayKey && to === todayKey ? 'I dag' : formatShortDate(to)}</span>
      </div>
    </div>
  );
}
