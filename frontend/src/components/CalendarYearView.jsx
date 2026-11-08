import { ChevronLeft, ChevronRight } from 'lucide-react';
import { betsPath } from '../lib/filters';
import { formatCurrency, formatPercent } from '../lib/format';
import { heatLevel, heatStyle, maxAbs } from '../lib/tone';
import { cn } from '../lib/utils';
import HeatLegend from './ds/HeatLegend';
import { Metric, MetricRail } from './ds/Metric';
import Money from './ds/Money';
import { Panel } from './ds/Section';
import { Button } from './ui/button';

function signedClass(value, strong = false) {
  if (value > 0) return strong ? 'text-primary-strong' : 'text-primary';
  if (value < 0) return strong ? 'text-destructive-strong' : 'text-destructive';
  return 'text-text-secondary';
}

export default function CalendarYearView({ year, model, months, currentMonth, currency, onYearChange, onSelectMonth }) {
  const { kpis } = model;
  const max = maxAbs(model.months.filter((cell) => cell.hasSettled).map((cell) => cell.profit));
  const monthLabel = (entry) => {
    const name = months[entry.monthIndex].slice(0, 3);
    return name.charAt(0).toUpperCase() + name.slice(1);
  };
  const yearPath = betsPath({ from: model.dateFrom, to: model.dateTo });

  return (
    <>
      <MetricRail>
        <Metric
          label={`Resultat ${year}`}
          to={yearPath}
          testId="calendar-year-profit-card"
          value={<Money value={kpis.profit} currency={currency} signed />}
        />
        <Metric
          label="Spill"
          to={yearPath}
          testId="calendar-year-bets-card"
          value={kpis.bets}
          hint={`Innsats ${formatCurrency(kpis.stake, currency, 0)}`}
        />
        <Metric label="Treff" testId="calendar-year-winrate-card" value={formatPercent(kpis.winRate)} />
        <Metric
          label="ROI"
          testId="calendar-year-roi-card"
          value={<span className={signedClass(kpis.roi)}>{formatPercent(kpis.roi, 1, { signed: true })}</span>}
        />
        <Metric
          label="Beste / verste måned"
          testId="calendar-year-highlights-card"
          value={
            <span className="block space-y-1 text-[13px] font-medium">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-text-muted">{kpis.bestMonth ? monthLabel(kpis.bestMonth) : '—'}</span>
                {kpis.bestMonth ? <Money value={kpis.bestMonth.profit} currency={currency} digits={0} signed /> : null}
              </span>
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-text-muted">{kpis.worstMonth ? monthLabel(kpis.worstMonth) : '—'}</span>
                {kpis.worstMonth ? (
                  <Money value={kpis.worstMonth.profit} currency={currency} digits={0} signed />
                ) : null}
              </span>
            </span>
          }
        />
      </MetricRail>

      <Panel aria-labelledby="calendar-year-title" className="p-3 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button
              data-testid="prev-year-btn"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onYearChange(-1)}
              aria-label="Forrige år"
            >
              <ChevronLeft />
            </Button>
            <h2 id="calendar-year-title" className="min-w-[80px] text-center text-[17px] font-semibold figure">
              {year}
            </h2>
            <Button
              data-testid="next-year-btn"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onYearChange(1)}
              aria-label="Neste år"
            >
              <ChevronRight />
            </Button>
          </div>
          <HeatLegend />
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 lg:grid-cols-4">
          {model.months.map((cell) => {
            const isCurrent = cell.month === currentMonth;
            const hasData = cell.count > 0;
            const style = cell.hasSettled ? heatStyle(cell.profit, max) : undefined;
            const strong = cell.hasSettled && heatLevel(cell.profit, max) > 0.55;
            return (
              <button
                key={cell.month}
                type="button"
                data-testid={`calendar-month-${cell.monthIndex + 1}`}
                onClick={() => onSelectMonth(cell)}
                aria-label={`Vis ${months[cell.monthIndex]} ${year} per dag`}
                style={style}
                className={cn(
                  'group flex min-h-[132px] flex-col rounded-lg border p-3 text-left transition-[box-shadow] duration-150 ease-out',
                  'hover:shadow-[0_0_0_1px_rgb(var(--text-muted)/0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70',
                  !style &&
                    (hasData && cell.pending > 0
                      ? 'border-accent/30 bg-accent/[0.06]'
                      : 'border-hairline bg-sunken/50'),
                  isCurrent && 'shadow-[0_0_0_1.5px_rgb(var(--text-primary)/0.7)]'
                )}
              >
                <span className="flex items-start justify-between gap-1">
                  <span className="text-[13px] font-medium capitalize">{months[cell.monthIndex]}</span>
                  {isCurrent ? (
                    <span className="rounded bg-text-primary px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide text-background">
                      Nå
                    </span>
                  ) : null}
                </span>
                {hasData ? (
                  <>
                    <span className="mt-auto block pt-3">
                      {cell.hasSettled ? (
                        <Money
                          value={cell.profit}
                          currency={currency}
                          digits={0}
                          signed
                          tone={signedClass(cell.profit, strong)}
                          className="block font-heading text-[19px] font-semibold leading-none tracking-tight"
                          unitClassName="text-[0.6em] text-current opacity-70"
                        />
                      ) : (
                        <span className="block text-[15px] font-medium text-accent">Åpen</span>
                      )}
                    </span>
                    <span className="mt-2 block text-[11px] text-text-muted figure">
                      {cell.count} spill{cell.pending > 0 ? ` · ${cell.pending} åpne` : ''} · innsats{' '}
                      {formatCurrency(cell.stake, currency, 0)}
                    </span>
                    {cell.hasSettled ? (
                      <span className="mt-1 flex flex-wrap gap-x-2.5 text-[11px] font-medium figure">
                        <span className={signedClass(cell.roi, strong)}>ROI {formatPercent(cell.roi)}</span>
                        {cell.won + cell.lost > 0 ? (
                          <span className="text-text-secondary">Treff {formatPercent(cell.winRate, 0)}</span>
                        ) : null}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="mt-auto text-xs text-text-muted">Ingen spill</span>
                )}
              </button>
            );
          })}
        </div>
      </Panel>
    </>
  );
}
