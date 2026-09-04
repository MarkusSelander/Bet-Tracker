import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import BetDetailsDialog from '../components/BetDetailsDialog';
import PageHeader from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { buildCalendarModel, localDateKey, monthRange } from '../lib/calendar';
import { fetchWithTimeout } from '../lib/fetch';
import { STATUS_LABELS, formatCurrency, statusClass } from '../lib/format';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const cardClass = 'bg-[#18181B] border border-[#27272A] rounded-xl p-4';
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

function signedClass(value) {
  if (value > 0) return 'text-primary';
  if (value < 0) return 'text-destructive';
  return 'text-text-secondary';
}

function formatDayHeading(dateStr) {
  const parsed = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' });
}

function formatKpiDate(dateStr) {
  if (!dateStr) return '—';
  const parsed = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}

export default function CalendarPage() {
  const { user } = useOutletContext();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => localDateKey());
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailBet, setDetailBet] = useState(null);
  const currency = user?.currency || 'NOK';
  const year = currentDate.getFullYear();
  const monthIndex = currentDate.getMonth();
  const todayKey = localDateKey();

  const model = useMemo(() => buildCalendarModel(year, monthIndex, bets), [year, monthIndex, bets]);
  const selectedDay = model.byDate[selectedDate] || { bets: [], profit: 0, won: 0, lost: 0, pending: 0, count: 0 };

  useEffect(() => {
    const { dateFrom, dateTo } = monthRange(year, monthIndex);
    if (selectedDate >= dateFrom && selectedDate <= dateTo) return;
    setSelectedDate(todayKey >= dateFrom && todayKey <= dateTo ? todayKey : dateFrom);
  }, [year, monthIndex, selectedDate, todayKey]);

  useEffect(() => {
    const loadMonth = async () => {
      if (!BACKEND_URL) {
        toast.error('Backend-URL mangler');
        setLoading(false);
        return;
      }

      const { dateFrom, dateTo } = monthRange(year, monthIndex);
      setBets([]);
      setLoading(true);
      try {
        const response = await fetchWithTimeout(
          `${BACKEND_URL}/api/bets?date_from=${dateFrom}&date_to=${dateTo}`,
          { credentials: 'include' },
          15000
        );
        if (!response.ok) throw new Error(`Kalender ${response.status}`);
        const data = await response.json();
        setBets(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching calendar data:', error);
        toast.error('Kunne ikke laste kalenderen');
        setBets([]);
      } finally {
        setLoading(false);
      }
    };

    loadMonth();
  }, [year, monthIndex]);

  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(localDateKey(now));
  };

  const openBetDetails = (bet) => setDetailBet(bet);

  const handleRowKeyDown = (event, bet) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openBetDetails(bet);
    }
  };

  const handleCellKeyDown = (event, date) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelectedDate(date);
    }
  };

  if (loading && bets.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Kalender" subtitle="Resultat per dag" testId="calendar-title" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-[#18181B] border border-[#27272A] rounded-lg p-6 h-24 shimmer" />
          ))}
        </div>
      </div>
    );
  }

  const { kpis } = model;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kalender"
        subtitle="Resultat per dag"
        testId="calendar-title"
        action={
          <Button
            variant="secondary"
            onClick={goToToday}
            className="bg-white/5 hover:bg-white/10 border border-white/10"
            data-testid="calendar-today-btn"
          >
            I dag
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className={cardClass} data-testid="calendar-profit-card">
          <p className="text-xs text-text-secondary mb-1">Resultat</p>
          <p className={`text-2xl font-bold font-mono ${signedClass(kpis.profit)}`}>
            {kpis.profit > 0 ? '+' : ''}
            {formatCurrency(kpis.profit, currency)}
          </p>
        </div>
        <div className={cardClass} data-testid="calendar-bets-card">
          <p className="text-xs text-text-secondary mb-1">Spill</p>
          <p className="text-2xl font-bold font-mono">{kpis.bets}</p>
        </div>
        <div className={cardClass} data-testid="calendar-winrate-card">
          <p className="text-xs text-text-secondary mb-1">Treff</p>
          <p className="text-2xl font-bold font-mono">{kpis.winRate.toFixed(1)}%</p>
        </div>
        <div className={cardClass} data-testid="calendar-roi-card">
          <p className="text-xs text-text-secondary mb-1">ROI</p>
          <p className={`text-2xl font-bold font-mono ${signedClass(kpis.roi)}`}>{kpis.roi.toFixed(1)}%</p>
        </div>
        <div className={`${cardClass} col-span-2 lg:col-span-1`} data-testid="calendar-highlights-card">
          <p className="text-xs text-text-secondary mb-1">Beste / verste dag</p>
          <p className="text-sm font-mono font-bold text-primary truncate">
            {kpis.bestDay
              ? `${formatKpiDate(kpis.bestDay.date)} +${formatCurrency(kpis.bestDay.profit, currency, 0)}`
              : '—'}
          </p>
          <p
            className={`text-sm font-mono font-bold truncate ${
              kpis.worstDay ? signedClass(kpis.worstDay.profit) : 'text-text-muted'
            }`}
          >
            {kpis.worstDay
              ? `${formatKpiDate(kpis.worstDay.date)} ${kpis.worstDay.profit > 0 ? '+' : ''}${formatCurrency(
                  kpis.worstDay.profit,
                  currency,
                  0
                )}`
              : '—'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={`lg:col-span-8 ${cardClass} p-4 sm:p-6`}>
          <div className="flex items-center justify-between mb-4">
            <Button
              data-testid="prev-month-btn"
              variant="secondary"
              size="sm"
              onClick={() => setCurrentDate(new Date(year, monthIndex - 1, 1))}
              className="bg-white/5 hover:bg-white/10"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-lg sm:text-xl font-bold capitalize">
              {MONTHS[monthIndex]} {year}
            </h2>
            <Button
              data-testid="next-month-btn"
              variant="secondary"
              size="sm"
              onClick={() => setCurrentDate(new Date(year, monthIndex + 1, 1))}
              className="bg-white/5 hover:bg-white/10"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
            {DAYS.map((day) => (
              <div key={day} className="text-center text-[11px] sm:text-xs font-medium text-text-secondary py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {model.cells.map((cell, index) => {
              if (cell.empty) {
                return <div key={`pad-${year}-${monthIndex}-${index}`} className="min-h-[64px] sm:min-h-[76px]" />;
              }

              const isToday = cell.date === todayKey;
              const isSelected = cell.date === selectedDate;
              const hasData = cell.bets > 0;
              let tone = 'border-[#27272A] bg-[#121214]';
              if (hasData && cell.hasSettled && cell.profit > 0) {
                tone = 'border-primary/30 bg-primary/5';
              } else if (hasData && cell.hasSettled && cell.profit < 0) {
                tone = 'border-destructive/30 bg-destructive/5';
              } else if (hasData && cell.pending > 0) {
                tone = 'border-accent/40 bg-accent/5';
              }

              return (
                <button
                  key={cell.date}
                  type="button"
                  data-testid={`calendar-day-${cell.day}`}
                  onClick={() => setSelectedDate(cell.date)}
                  onKeyDown={(event) => handleCellKeyDown(event, cell.date)}
                  className={`min-h-[64px] sm:min-h-[76px] text-left border rounded-lg p-1.5 sm:p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tone} ${
                    isSelected ? 'ring-2 ring-primary' : ''
                  } ${isToday && !isSelected ? 'ring-1 ring-white/30' : ''}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-[11px] text-text-secondary">{cell.day}</span>
                    {isToday ? <span className="text-[9px] text-text-muted">i dag</span> : null}
                  </div>
                  {hasData ? (
                    <>
                      <div className={`text-xs sm:text-sm font-mono font-bold mt-1 ${signedClass(cell.profit)}`}>
                        {cell.hasSettled
                          ? `${cell.profit > 0 ? '+' : ''}${formatCurrency(cell.profit, currency, 0)}`
                          : 'Åpen'}
                      </div>
                      <div className="text-[10px] text-text-muted">
                        {cell.bets} spill{cell.pending > 0 ? ` · ${cell.pending} åpne` : ''}
                      </div>
                    </>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className={`lg:col-span-4 ${cardClass} p-6`} data-testid="calendar-day-panel">
          <p className="text-[11px] uppercase tracking-wide text-text-muted mb-1">Valgt dag</p>
          <h2 className="text-base font-bold capitalize">{formatDayHeading(selectedDate)}</h2>
          <p className={`text-sm font-mono font-bold mt-1 ${signedClass(selectedDay.profit)}`}>
            {selectedDay.profit > 0 ? '+' : ''}
            {formatCurrency(selectedDay.profit, currency)}
            <span className="text-text-muted font-sans font-normal">
              {' '}
              · {selectedDay.count || selectedDay.bets.length} spill
              {selectedDay.won || selectedDay.lost ? ` · ${selectedDay.won}W–${selectedDay.lost}L` : ''}
              {selectedDay.pending ? ` · ${selectedDay.pending} åpne` : ''}
            </span>
          </p>

          {selectedDay.bets.length === 0 ? (
            <p className="text-sm text-text-muted py-10 text-center">Ingen spill denne dagen.</p>
          ) : (
            <div className="mt-4 divide-y divide-[#27272A]">
              {selectedDay.bets.map((bet) => (
                <button
                  key={bet.bet_id}
                  type="button"
                  data-testid={`calendar-bet-${bet.bet_id}`}
                  tabIndex={0}
                  aria-label={`Vis detaljer for ${bet.game}`}
                  onClick={() => openBetDetails(bet)}
                  onKeyDown={(event) => handleRowKeyDown(event, bet)}
                  className="w-full text-left py-3 flex items-start justify-between gap-3 hover:bg-white/5 rounded-md px-1 -mx-1 transition-colors focus-visible:outline-none focus-visible:bg-white/10"
                >
                  <div className="min-w-0">
                    <p className="text-sm truncate">{bet.game}</p>
                    <p className="text-[11px] text-text-muted truncate">
                      {[bet.sport, bet.odds ? Number(bet.odds).toFixed(2) : null].filter(Boolean).join(' · ')}
                    </p>
                    <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[11px] ${statusClass(bet.status)}`}>
                      {STATUS_LABELS[bet.status] || bet.status}
                    </span>
                  </div>
                  <span className={`shrink-0 text-sm font-mono font-bold ${signedClass(bet.result)}`}>
                    {bet.status === 'pending'
                      ? '—'
                      : `${bet.result > 0 ? '+' : ''}${formatCurrency(bet.result, currency, 0)}`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={`${cardClass} p-6`}>
        <h2 className="text-base font-bold mb-4">Ukesoppsummering</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {model.weeks.map((week, index) => (
            <div
              key={`uke-${index + 1}`}
              className={`border rounded-lg p-3 ${
                week.bets === 0
                  ? 'border-[#27272A] bg-[#121214]'
                  : week.profit >= 0
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-destructive/30 bg-destructive/5'
              }`}
            >
              <div className="text-xs text-text-muted mb-1">Uke {index + 1}</div>
              {week.bets === 0 ? (
                <div className="text-sm text-text-muted">—</div>
              ) : (
                <>
                  <div className={`text-base font-mono font-bold ${signedClass(week.profit)}`}>
                    {week.profit > 0 ? '+' : ''}
                    {formatCurrency(week.profit, currency)}
                  </div>
                  <div className="text-[11px] text-text-muted">{week.bets} spill</div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <BetDetailsDialog
        bet={detailBet}
        open={Boolean(detailBet)}
        onOpenChange={(open) => {
          if (!open) setDetailBet(null);
        }}
        currency={currency}
      />
    </div>
  );
}
