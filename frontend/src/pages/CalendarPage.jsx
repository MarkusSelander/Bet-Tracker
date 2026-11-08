import { CalendarX2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import BetSummary from '../components/BetSummary';
import BetTicketDialog from '../components/BetTicketDialog';
import CalendarYearView from '../components/CalendarYearView';
import HeatLegend from '../components/ds/HeatLegend';
import { Metric, MetricRail, SplitBar } from '../components/ds/Metric';
import Money from '../components/ds/Money';
import { EmptyState, Panel, TextLink } from '../components/ds/Section';
import Segmented from '../components/ds/Segmented';
import StatusBadge from '../components/ds/StatusBadge';
import PageHeader from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { needsFullTicketBet } from '../lib/betTicket';
import {
  buildCalendarModel,
  buildYearModel,
  localDateKey,
  monthRange,
  readCalendarView,
  saveCalendarView,
  yearRange,
} from '../lib/calendar';
import { betsPath, parseFilters, toSearch } from '../lib/filters';
import { formatPercent, formatSignedCurrency } from '../lib/format';
import { useBet, useCalendarBets } from '../lib/queries';
import { heatLevel, heatStyle, isoWeek, maxAbs } from '../lib/tone';
import { cn } from '../lib/utils';

const EMPTY_BETS = [];
const DAYS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
const MONTHS = [
  'januar',
  'februar',
  'mars',
  'april',
  'mai',
  'juni',
  'juli',
  'august',
  'september',
  'oktober',
  'november',
  'desember',
];
const MAX_PIPS = 6;

const VIEW_OPTIONS = [
  { value: 'day', label: 'Dag', testId: 'calendar-view-day' },
  { value: 'month', label: 'Måned', testId: 'calendar-view-month' },
];

function signedClass(value, strong = false) {
  if (value > 0) return strong ? 'text-primary-strong' : 'text-primary';
  if (value < 0) return strong ? 'text-destructive-strong' : 'text-destructive';
  return 'text-text-secondary';
}

function formatDayHeading(dateStr) {
  const parsed = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatKpiDate(dateStr) {
  if (!dateStr) return '—';
  const parsed = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}

function monthKeyFromParts(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function shiftDate(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function ActivityPips({ won, lost, pending }) {
  const pips = [
    ...Array.from({ length: won }, () => 'bg-primary'),
    ...Array.from({ length: lost }, () => 'bg-destructive'),
    ...Array.from({ length: pending }, () => 'bg-accent'),
  ];
  const extra = pips.length - MAX_PIPS;
  return (
    <span className="hidden items-center gap-[3px] sm:flex" aria-hidden="true">
      {pips.slice(0, MAX_PIPS).map((tone, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <span key={index} className={cn('h-1 w-1 rounded-full', tone)} />
      ))}
      {extra > 0 ? <span className="ml-0.5 text-[9.5px] leading-none text-text-muted figure">+{extra}</span> : null}
    </span>
  );
}

function DayCell({ cell, max, isToday, isSelected, isFuture, currency, onSelect, onKeyDown }) {
  const hasData = cell.bets > 0;
  const settled = hasData && cell.hasSettled;
  const level = settled ? heatLevel(cell.profit, max) : 0;
  const style = settled ? heatStyle(cell.profit, max) : undefined;
  const pendingOnly = hasData && !cell.hasSettled;
  const dayResult = settled ? formatSignedCurrency(cell.profit, currency, 0) : 'åpne spill';
  const label = hasData
    ? `${formatDayHeading(cell.date)}: ${dayResult}, ${cell.bets} spill`
    : `${formatDayHeading(cell.date)}: ingen spill`;

  return (
    <button
      type="button"
      data-testid={`calendar-day-${cell.day}`}
      data-date={cell.date}
      tabIndex={isSelected ? 0 : -1}
      aria-pressed={isSelected}
      aria-current={isToday ? 'date' : undefined}
      aria-label={label}
      onClick={() => onSelect(cell.date)}
      onKeyDown={(event) => onKeyDown(event, cell.date)}
      style={style}
      className={cn(
        'group relative flex min-h-[64px] flex-col justify-between rounded-lg border p-1.5 text-left transition-[box-shadow,transform,background-color] duration-150 ease-out sm:min-h-[88px] sm:p-2',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70',
        !style && (pendingOnly ? 'border-accent/30 bg-accent/[0.06]' : 'border-hairline bg-sunken/50'),
        !hasData && isFuture && 'opacity-50',
        'hover:z-10 hover:shadow-[0_0_0_1px_rgb(var(--text-muted)/0.6)]',
        isSelected && 'z-10 shadow-[0_0_0_1.5px_rgb(var(--text-primary)),0_8px_24px_-12px_rgb(0_0_0/0.9)]'
      )}
    >
      <span className="flex items-start justify-between gap-1">
        <span
          className={cn(
            'inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[11px] font-medium figure',
            isToday ? 'bg-text-primary text-background' : 'text-text-secondary'
          )}
        >
          {cell.day}
        </span>
        {cell.pending > 0 ? (
          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent" title={`${cell.pending} åpne`} aria-hidden="true" />
        ) : null}
      </span>
      {hasData ? (
        <span className="block">
          {settled ? (
            <Money
              value={cell.profit}
              currency={currency}
              digits={0}
              signed
              tone={signedClass(cell.profit, level > 0.55)}
              className="block text-[11.5px] font-semibold sm:text-[13px]"
              unitClassName="hidden sm:inline text-[0.75em] text-current opacity-70"
            />
          ) : (
            <span className="block text-[11.5px] font-medium text-accent sm:text-[13px]">Åpen</span>
          )}
          <span className="mt-1 flex items-center justify-between gap-1">
            <ActivityPips won={cell.won} lost={cell.lost} pending={cell.pending} />
            <span className="hidden text-[10px] text-text-muted figure md:inline">{cell.bets} spill</span>
          </span>
        </span>
      ) : null}
    </button>
  );
}

function WeekCell({ week, weekNumber, max, currency }) {
  const style = week.bets ? heatStyle(week.profit, max, { floor: 0.05, ceil: 0.22 }) : undefined;
  return (
    <div
      style={style}
      className={cn(
        'hidden min-h-[88px] flex-col justify-between rounded-lg border p-2 md:flex',
        !style && 'border-dashed border-hairline'
      )}
    >
      <span className="eyebrow">Uke {weekNumber ?? '—'}</span>
      {week.bets ? (
        <span>
          <Money
            value={week.profit}
            currency={currency}
            digits={0}
            signed
            className="block text-[13px] font-semibold"
            unitClassName="text-[0.75em] text-current opacity-70"
          />
          <span className="text-[10px] text-text-muted figure">{week.bets} spill</span>
        </span>
      ) : (
        <span className="text-xs text-text-muted">—</span>
      )}
    </div>
  );
}

export default function CalendarPage() {
  const { user } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseFilters(searchParams);
  const [detailBet, setDetailBet] = useState(null);
  const gridRef = useRef(null);
  const currency = user?.currency || 'NOK';
  const needsFullBet = needsFullTicketBet(detailBet);
  const { data: fullDetailBet } = useBet(detailBet?.bet_id, { enabled: needsFullBet });
  const dialogBet = fullDetailBet || detailBet;
  const todayKey = localDateKey();
  const month = filters.month || (filters.date ? filters.date.slice(0, 7) : todayKey.slice(0, 7));
  const [year, monthPart] = month.split('-').map(Number);
  const monthIndex = Number.isFinite(monthPart) ? monthPart - 1 : new Date().getMonth();
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const [view, setView] = useState(readCalendarView);
  const isMonthView = view === 'month';
  const { dateFrom, dateTo } = monthRange(safeYear, monthIndex);
  const dayQuery = useCalendarBets(dateFrom, dateTo, { enabled: !isMonthView });
  const yearBounds = yearRange(safeYear);
  const yearQuery = useCalendarBets(yearBounds.dateFrom, yearBounds.dateTo, {
    includeLegs: false,
    enabled: isMonthView,
  });
  const { data, isPending, isError } = isMonthView ? yearQuery : dayQuery;
  const bets = data ?? EMPTY_BETS;
  const selectedDate =
    filters.date && filters.date >= dateFrom && filters.date <= dateTo
      ? filters.date
      : todayKey >= dateFrom && todayKey <= dateTo
        ? todayKey
        : dateFrom;

  const model = buildCalendarModel(safeYear, monthIndex, isMonthView ? EMPTY_BETS : bets);
  const yearModel = isMonthView ? buildYearModel(safeYear, bets) : null;
  const selectedDay = model.byDate[selectedDate] || { bets: [], profit: 0, won: 0, lost: 0, pending: 0, count: 0 };
  const dayMax = maxAbs(model.cells.filter((cell) => !cell.empty && cell.hasSettled).map((cell) => cell.profit));
  const weekMax = maxAbs(model.weeks.map((week) => week.profit));
  const weekRows = [];
  for (let i = 0; i < model.cells.length; i += 7) {
    const slice = model.cells.slice(i, i + 7);
    while (slice.length < 7) slice.push({ empty: true });
    const firstDate = slice.find((cell) => !cell.empty)?.date;
    weekRows.push({ cells: slice, week: model.weeks[i / 7], weekNumber: firstDate ? isoWeek(firstDate) : null });
  }

  const writeCalendar = (next) => {
    setSearchParams(toSearch({ date: next.date || '', month: next.month || '' }), { replace: true });
  };

  useEffect(() => {
    if (isError) toast.error('Kunne ikke laste kalenderen');
  }, [isError]);

  const goToToday = () => {
    writeCalendar({ date: todayKey, month: todayKey.slice(0, 7) });
  };

  const changeView = (nextView) => {
    setView(nextView);
    saveCalendarView(nextView);
  };

  const goYear = (delta) => {
    const nextYear = safeYear + delta;
    const range = yearRange(nextYear);
    const inYear = todayKey >= range.dateFrom && todayKey <= range.dateTo;
    writeCalendar({ month: inYear ? todayKey.slice(0, 7) : monthKeyFromParts(nextYear, 0) });
  };

  const openMonth = (cell) => {
    const nextDate = todayKey >= cell.dateFrom && todayKey <= cell.dateTo ? todayKey : cell.dateFrom;
    writeCalendar({ month: cell.month, date: nextDate });
    changeView('day');
  };

  const goMonth = (delta) => {
    const next = new Date(safeYear, monthIndex + delta, 1);
    const nextMonth = monthKeyFromParts(next.getFullYear(), next.getMonth());
    const range = monthRange(next.getFullYear(), next.getMonth());
    const nextDate = todayKey >= range.dateFrom && todayKey <= range.dateTo ? todayKey : range.dateFrom;
    writeCalendar({ month: nextMonth, date: nextDate });
  };

  const openBetDetails = (bet) => setDetailBet(bet);

  const selectDate = (date) => writeCalendar({ date, month: date.slice(0, 7) });

  const handleCellKeyDown = (event, date) => {
    const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(event.key in steps)) return;
    event.preventDefault();
    const next = shiftDate(date, steps[event.key]);
    const clamped = next < dateFrom ? dateFrom : next > dateTo ? dateTo : next;
    selectDate(clamped);
    requestAnimationFrame(() => gridRef.current?.querySelector(`[data-date="${clamped}"]`)?.focus());
  };

  const header = (
    <PageHeader
      eyebrow={isMonthView ? `Kalender · ${safeYear}` : `Kalender · ${MONTHS[monthIndex]} ${safeYear}`}
      title="Kalender"
      subtitle={isMonthView ? 'Resultat per måned' : 'Resultat per dag'}
      testId="calendar-title"
      action={
        <>
          <Segmented
            label="Kalendervisning"
            testId="calendar-view-toggle"
            options={VIEW_OPTIONS}
            value={view}
            onChange={changeView}
          />
          <Button variant="secondary" onClick={goToToday} data-testid="calendar-today-btn">
            I dag
          </Button>
        </>
      }
    />
  );

  if (isPending && bets.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-24 rounded-none" />
          ))}
        </div>
        <div className="skeleton h-[520px] w-full rounded-xl" />
      </div>
    );
  }

  if (isMonthView) {
    return (
      <div className="space-y-6">
        {header}
        <CalendarYearView
          year={safeYear}
          model={yearModel}
          months={MONTHS}
          currentMonth={todayKey.slice(0, 7)}
          currency={currency}
          onYearChange={goYear}
          onSelectMonth={openMonth}
        />
      </div>
    );
  }

  const { kpis } = model;
  const monthPath = betsPath({ from: dateFrom, to: dateTo });

  return (
    <div className="space-y-6">
      {header}

      <MetricRail>
        <Metric
          label="Resultat"
          to={monthPath}
          testId="calendar-profit-card"
          value={<Money value={kpis.profit} currency={currency} signed />}
          hint={`${MONTHS[monthIndex]} ${safeYear}`}
        />
        <Metric label="Spill" to={monthPath} testId="calendar-bets-card" value={kpis.bets} hint="denne måneden" />
        <Metric label="Treff" testId="calendar-winrate-card" value={formatPercent(kpis.winRate)} />
        <Metric
          label="ROI"
          testId="calendar-roi-card"
          value={<span className={signedClass(kpis.roi)}>{formatPercent(kpis.roi, 1, { signed: true })}</span>}
        />
        <Metric
          label="Beste / verste dag"
          testId="calendar-highlights-card"
          value={
            <span className="block space-y-1 text-[13px] font-medium">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-text-muted">{formatKpiDate(kpis.bestDay?.date)}</span>
                {kpis.bestDay ? (
                  <Money value={kpis.bestDay.profit} currency={currency} digits={0} signed />
                ) : (
                  <span className="text-text-muted">—</span>
                )}
              </span>
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-text-muted">{formatKpiDate(kpis.worstDay?.date)}</span>
                {kpis.worstDay ? (
                  <Money value={kpis.worstDay.profit} currency={currency} digits={0} signed />
                ) : (
                  <span className="text-text-muted">—</span>
                )}
              </span>
            </span>
          }
        />
      </MetricRail>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Panel aria-labelledby="calendar-month-title" className="p-3 sm:p-5 lg:col-span-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <Button
                data-testid="prev-month-btn"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => goMonth(-1)}
                aria-label="Forrige måned"
              >
                <ChevronLeft />
              </Button>
              <h2
                id="calendar-month-title"
                className="min-w-[150px] text-center text-[17px] font-semibold capitalize tracking-tight"
                aria-live="polite"
              >
                {MONTHS[monthIndex]} {safeYear}
              </h2>
              <Button
                data-testid="next-month-btn"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => goMonth(1)}
                aria-label="Neste måned"
              >
                <ChevronRight />
              </Button>
            </div>
            <HeatLegend />
          </div>

          <div className="grid grid-cols-7 gap-1 pb-2 sm:gap-1.5 md:grid-cols-[repeat(7,minmax(0,1fr))_92px]">
            {DAYS.map((day) => (
              <div key={day} className="eyebrow text-center">
                {day}
              </div>
            ))}
            <div className="eyebrow hidden text-center md:block">Uke</div>
          </div>

          <div ref={gridRef} className="space-y-1 sm:space-y-1.5" role="group" aria-label="Dager i måneden">
            {weekRows.map((row, rowIndex) => (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={`week-${rowIndex}`}
                className="grid grid-cols-7 gap-1 sm:gap-1.5 md:grid-cols-[repeat(7,minmax(0,1fr))_92px]"
              >
                {row.cells.map((cell, index) =>
                  cell.empty ? (
                    // eslint-disable-next-line react/no-array-index-key
                    <div key={`pad-${rowIndex}-${index}`} aria-hidden="true" />
                  ) : (
                    <DayCell
                      key={cell.date}
                      cell={cell}
                      max={dayMax}
                      currency={currency}
                      isToday={cell.date === todayKey}
                      isSelected={cell.date === selectedDate}
                      isFuture={cell.date > todayKey}
                      onSelect={selectDate}
                      onKeyDown={handleCellKeyDown}
                    />
                  )
                )}
                <WeekCell week={row.week} weekNumber={row.weekNumber} max={weekMax} currency={currency} />
              </div>
            ))}
          </div>
          <p className="mt-3 hidden text-[11px] text-text-muted sm:block">
            Bruk piltastene for å flytte mellom dagene. Fargestyrken viser hvor stort resultatet er.
          </p>
        </Panel>

        <aside className="lg:col-span-4" aria-labelledby="calendar-day-heading">
          <Panel
            as="div"
            className="flex max-h-[34rem] flex-col overflow-hidden lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)]"
            data-testid="calendar-day-panel"
          >
            <div className="shrink-0 border-b border-hairline p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="eyebrow mb-1.5">Valgt dag</p>
                  <h2 id="calendar-day-heading" className="text-[15px] font-semibold capitalize">
                    {formatDayHeading(selectedDate)}
                  </h2>
                </div>
                <TextLink to={betsPath({ from: selectedDate, to: selectedDate })} data-testid="calendar-view-bets">
                  Vis spill
                </TextLink>
              </div>
              <Money
                value={selectedDay.profit}
                currency={currency}
                signed
                className="mt-4 block font-heading text-[30px] font-semibold leading-none tracking-[-0.03em]"
                unitClassName="text-[0.45em] tracking-normal"
                fractionClassName="text-[0.6em]"
              />
              <p className="mt-2.5 text-xs text-text-muted figure">
                {selectedDay.count || selectedDay.bets.length} spill
                {selectedDay.won || selectedDay.lost ? (
                  <>
                    {' · '}
                    <span className="text-primary">{selectedDay.won} V</span> –{' '}
                    <span className="text-destructive">{selectedDay.lost} T</span>
                  </>
                ) : null}
                {selectedDay.pending ? <span className="text-accent"> · {selectedDay.pending} åpne</span> : null}
              </p>
              {selectedDay.won || selectedDay.lost ? (
                <SplitBar
                  left={selectedDay.won}
                  right={selectedDay.lost}
                  label={`${selectedDay.won} vunnet og ${selectedDay.lost} tapt`}
                />
              ) : null}
            </div>

            {selectedDay.bets.length === 0 ? (
              <EmptyState icon={CalendarX2} title="Ingen spill denne dagen" className="py-12" />
            ) : (
              <ul className="min-h-0 flex-1 divide-y divide-hairline overflow-y-auto overscroll-contain">
                {selectedDay.bets.map((bet) => (
                  <li key={bet.bet_id}>
                    <button
                      type="button"
                      data-testid={`calendar-bet-${bet.bet_id}`}
                      aria-label={`Vis detaljer for ${bet.game}`}
                      onClick={() => openBetDetails(bet)}
                      className="interactive-row grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-5 py-3 text-left"
                    >
                      <span className="min-w-0">
                        <BetSummary bet={bet} />
                        <span className="mt-1.5 flex items-center gap-2">
                          <StatusBadge status={bet.status} size="sm" />
                          <span className="truncate text-[11px] text-text-muted figure">
                            {[bet.sport, bet.odds ? Number(bet.odds).toFixed(2) : null].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </span>
                      <span className="text-[13px] font-semibold">
                        {bet.status === 'pending' ? (
                          <span className="text-text-muted">—</span>
                        ) : (
                          <Money value={bet.result} currency={currency} digits={0} signed />
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>

      <Panel className="p-5 md:hidden" aria-labelledby="week-summary-title">
        <h2 id="week-summary-title" className="text-[15px] font-semibold">
          Ukesoppsummering
        </h2>
        <ul className="mt-3 divide-y divide-hairline">
          {weekRows.map((row, index) => (
            <li
              // eslint-disable-next-line react/no-array-index-key
              key={`uke-${index}`}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <span className="eyebrow">Uke {row.weekNumber ?? index + 1}</span>
              <span className="flex items-baseline gap-3">
                <span className="text-[11px] text-text-muted figure">{row.week.bets} spill</span>
                {row.week.bets ? (
                  <Money
                    value={row.week.profit}
                    currency={currency}
                    digits={0}
                    signed
                    className="text-[13px] font-semibold"
                  />
                ) : (
                  <span className="text-xs text-text-muted">—</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <BetTicketDialog
        bet={dialogBet}
        mode="view"
        open={Boolean(detailBet)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDetailBet(null);
        }}
        currency={currency}
      />
    </div>
  );
}
