import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

/**
 * Metrics share one hairline grid instead of floating as separate cards:
 * the 1px gap over a hairline background draws the dividers in every layout.
 */
const SPAN_RESET = {
  sm: 'sm:[&>*:last-child:nth-child(odd)]:col-span-1',
  lg: 'lg:[&>*:last-child:nth-child(odd)]:col-span-1',
};

export function MetricRail({ children, className, columns = 'lg:grid-cols-5', wideFrom = 'lg' }) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-hairline bg-hairline',
        '[&>*:last-child:nth-child(odd)]:col-span-2',
        columns,
        SPAN_RESET[wideFrom],
        className
      )}
    >
      {children}
    </div>
  );
}

export function Metric({ label, value, hint, to, onClick, testId, ariaLabel, children, className }) {
  const interactive = Boolean(to || onClick);
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="eyebrow">{label}</span>
        {interactive ? (
          <ArrowUpRight
            className="h-3.5 w-3.5 text-text-muted opacity-0 -translate-x-0.5 translate-y-0.5 transition-all duration-200 ease-out group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 group-focus-visible:opacity-100"
            aria-hidden="true"
          />
        ) : null}
      </span>
      <span className="mt-2.5 block font-heading text-[22px] font-semibold leading-none tracking-tight figure">
        {value}
      </span>
      {hint ? <span className="mt-2 block truncate text-xs text-text-muted">{hint}</span> : null}
      {children}
    </>
  );
  const base = cn(
    'group relative block min-w-0 bg-surface px-4 py-4 sm:px-5 text-left',
    interactive &&
      'transition-colors duration-150 hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none',
    className
  );

  if (to) {
    return (
      <Link to={to} className={base} data-testid={testId} aria-label={ariaLabel}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(base, 'w-full')}
        data-testid={testId}
        aria-label={ariaLabel}
      >
        {body}
      </button>
    );
  }
  return (
    <div className={base} data-testid={testId}>
      {body}
    </div>
  );
}

/** Two-part ratio bar, e.g. won vs. lost. */
export function SplitBar({ left, right, leftClass = 'bg-primary', rightClass = 'bg-destructive', label }) {
  const total = (left || 0) + (right || 0);
  const pct = total > 0 ? (left / total) * 100 : 0;
  return (
    <span className="mt-3 flex h-1 w-full overflow-hidden rounded-full bg-elevated" role="img" aria-label={label}>
      {total > 0 ? (
        <>
          <span
            className={cn('h-full transition-[width] duration-500 ease-out', leftClass)}
            style={{ width: `${pct}%` }}
          />
          <span className={cn('h-full flex-1 opacity-80', rightClass)} />
        </>
      ) : null}
    </span>
  );
}

/** Diverging meter around zero, e.g. ROI. */
export function ZeroMeter({ value, max = 25, label }) {
  const n = Number(value) || 0;
  const pct = Math.min(1, Math.abs(n) / max) * 50;
  return (
    <span className="relative mt-3 block h-1 w-full rounded-full bg-elevated" role="img" aria-label={label}>
      <span className="absolute left-1/2 top-[-3px] h-[10px] w-px bg-text-muted/60" aria-hidden="true" />
      {n !== 0 ? (
        <span
          className={cn(
            'absolute top-0 h-full rounded-full transition-[width] duration-500 ease-out',
            n > 0 ? 'left-1/2 bg-primary' : 'right-1/2 bg-destructive'
          )}
          style={{ width: `${pct}%` }}
        />
      ) : null}
    </span>
  );
}
