import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { betsPath } from '../lib/filters';
import { formatCurrency } from '../lib/format';
import { Button } from './ui/button';

const cardClass = 'bg-[#18181B] border border-[#27272A] rounded-xl p-4';

function signedClass(value) {
  if (value > 0) return 'text-primary';
  if (value < 0) return 'text-destructive';
  return 'text-text-secondary';
}

function signedAmount(value, currency, digits) {
  return `${value > 0 ? '+' : ''}${formatCurrency(value, currency, digits)}`;
}

function monthTone(cell) {
  if (cell.count === 0) return 'border-[#27272A] bg-[#121214]';
  if (cell.hasSettled && cell.profit > 0) return 'border-primary/30 bg-primary/5';
  if (cell.hasSettled && cell.profit < 0) return 'border-destructive/30 bg-destructive/5';
  if (cell.pending > 0) return 'border-accent/40 bg-accent/5';
  return 'border-[#27272A] bg-[#121214]';
}

export default function CalendarYearView({ year, model, months, currentMonth, currency, onYearChange, onSelectMonth }) {
  const { kpis } = model;
  const monthLabel = (entry) => {
    const name = months[entry.monthIndex].slice(0, 3);
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Link
          to={betsPath({ from: model.dateFrom, to: model.dateTo })}
          className={cardClass}
          data-testid="calendar-year-profit-card"
        >
          <p className="text-xs text-text-secondary mb-1">Resultat {year}</p>
          <p className={`text-2xl font-bold font-mono ${signedClass(kpis.profit)}`}>
            {signedAmount(kpis.profit, currency)}
          </p>
        </Link>
        <Link
          to={betsPath({ from: model.dateFrom, to: model.dateTo })}
          className={cardClass}
          data-testid="calendar-year-bets-card"
        >
          <p className="text-xs text-text-secondary mb-1">Spill</p>
          <p className="text-2xl font-bold font-mono">{kpis.bets}</p>
          <p className="text-[11px] text-text-muted truncate">Innsats {formatCurrency(kpis.stake, currency, 0)}</p>
        </Link>
        <div className={cardClass} data-testid="calendar-year-winrate-card">
          <p className="text-xs text-text-secondary mb-1">Treff</p>
          <p className="text-2xl font-bold font-mono">{kpis.winRate.toFixed(1)}%</p>
        </div>
        <div className={cardClass} data-testid="calendar-year-roi-card">
          <p className="text-xs text-text-secondary mb-1">ROI</p>
          <p className={`text-2xl font-bold font-mono ${signedClass(kpis.roi)}`}>{kpis.roi.toFixed(1)}%</p>
        </div>
        <div className={`${cardClass} col-span-2 lg:col-span-1`} data-testid="calendar-year-highlights-card">
          <p className="text-xs text-text-secondary mb-1">Beste / verste måned</p>
          <p className="text-sm font-mono font-bold text-primary truncate">
            {kpis.bestMonth ? `${monthLabel(kpis.bestMonth)} ${signedAmount(kpis.bestMonth.profit, currency, 0)}` : '—'}
          </p>
          <p
            className={`text-sm font-mono font-bold truncate ${
              kpis.worstMonth ? signedClass(kpis.worstMonth.profit) : 'text-text-muted'
            }`}
          >
            {kpis.worstMonth
              ? `${monthLabel(kpis.worstMonth)} ${signedAmount(kpis.worstMonth.profit, currency, 0)}`
              : '—'}
          </p>
        </div>
      </div>

      <div className={`${cardClass} p-4 sm:p-6`}>
        <div className="flex items-center justify-between mb-4">
          <Button
            data-testid="prev-year-btn"
            variant="secondary"
            size="sm"
            onClick={() => onYearChange(-1)}
            className="bg-white/5 hover:bg-white/10"
            aria-label="Forrige år"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg sm:text-xl font-bold">{year}</h2>
          <Button
            data-testid="next-year-btn"
            variant="secondary"
            size="sm"
            onClick={() => onYearChange(1)}
            className="bg-white/5 hover:bg-white/10"
            aria-label="Neste år"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
          {model.months.map((cell) => {
            const isCurrent = cell.month === currentMonth;
            const hasData = cell.count > 0;
            return (
              <button
                key={cell.month}
                type="button"
                data-testid={`calendar-month-${cell.monthIndex + 1}`}
                onClick={() => onSelectMonth(cell)}
                aria-label={`Vis ${months[cell.monthIndex]} ${year} per dag`}
                className={`min-h-[120px] flex flex-col text-left border rounded-lg p-3 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${monthTone(
                  cell
                )} ${isCurrent ? 'ring-1 ring-white/30' : ''}`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="text-sm font-medium capitalize">{months[cell.monthIndex]}</span>
                  {isCurrent ? <span className="text-[10px] text-text-muted">denne mnd</span> : null}
                </div>
                {hasData ? (
                  <>
                    <div className={`text-base sm:text-lg font-mono font-bold mt-1 ${signedClass(cell.profit)}`}>
                      {cell.hasSettled ? signedAmount(cell.profit, currency, 0) : 'Åpen'}
                    </div>
                    <div className="text-[11px] text-text-muted">
                      {cell.count} spill{cell.pending > 0 ? ` · ${cell.pending} åpne` : ''}
                    </div>
                    <div className="text-[11px] text-text-muted truncate">
                      Innsats {formatCurrency(cell.stake, currency, 0)}
                    </div>
                    {cell.hasSettled ? (
                      <div className="text-[11px] font-mono mt-1 flex flex-wrap gap-x-2">
                        <span className={signedClass(cell.roi)}>ROI {cell.roi.toFixed(1)}%</span>
                        {cell.won + cell.lost > 0 ? (
                          <span className="text-text-secondary">Treff {cell.winRate.toFixed(0)}%</span>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="text-sm text-text-muted mt-2">—</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
