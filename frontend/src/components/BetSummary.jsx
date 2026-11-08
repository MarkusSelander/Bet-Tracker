import { getMatchSummary, getSelectionSummary } from '../lib/betsDisplay';
import { cn } from '../lib/utils';

/** Match title with combo prefix and leg count, optionally followed by the selection. */
export default function BetSummary({ bet, showSelection = true, className }) {
  const match = getMatchSummary(bet);
  const selection = getSelectionSummary(bet);
  return (
    <div className={cn('min-w-0', className)}>
      <p className="flex min-w-0 items-center gap-1.5 text-[13px] leading-snug text-text-primary">
        {match.prefix ? (
          <span className="shrink-0 rounded border border-hairline bg-sunken px-1 py-px font-mono text-[9.5px] uppercase tracking-wider text-text-secondary">
            {match.prefix}
          </span>
        ) : null}
        <span className="truncate">{match.primary || bet.game || '—'}</span>
        {match.extraCount > 0 ? (
          <span className="shrink-0 text-[11px] text-text-muted figure">+{match.extraCount}</span>
        ) : null}
      </p>
      {showSelection ? (
        <p className="mt-0.5 truncate text-xs text-text-muted">
          {selection.primary || bet.bet || '—'}
          {selection.extraCount > 0 ? ' og mer' : ''}
        </p>
      ) : null}
    </div>
  );
}
