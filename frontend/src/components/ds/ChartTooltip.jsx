import { cn } from '../../lib/utils';

export function formatLongDate(isoDate) {
  if (!isoDate) return '';
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatShortDate(isoDate) {
  if (!isoDate) return '';
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }).replace(/\.$/, '');
}

/** Shared frame for Recharts tooltips. Rows: { label, value, className?, divider? }. */
export function ChartTooltipFrame({ title, rows, footer }) {
  return (
    <div className="min-w-[200px] rounded-lg border border-border bg-popover/95 px-3 py-2.5 shadow-popover">
      {title ? <p className="mb-2 text-[11px] font-medium capitalize text-text-secondary">{title}</p> : null}
      <dl className="space-y-1">
        {rows.filter(Boolean).map((row) => (
          <div
            key={row.label}
            className={cn(
              'flex items-baseline justify-between gap-6',
              row.divider && 'mt-1.5 border-t border-hairline pt-1.5'
            )}
          >
            <dt className="text-xs text-text-muted">{row.label}</dt>
            <dd className={cn('text-xs font-medium figure text-text-primary', row.className)}>{row.value}</dd>
          </div>
        ))}
      </dl>
      {footer ? <p className="mt-2 text-[10.5px] text-text-muted">{footer}</p> : null}
    </div>
  );
}
