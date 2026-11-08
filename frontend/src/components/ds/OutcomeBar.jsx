import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

/**
 * Distribution of outcomes as one stacked bar with an exact legend below.
 * Items: { key, name, value, color }. `linkFor(item)` makes legend rows navigable.
 */
export default function OutcomeBar({ items, linkFor, testId, className }) {
  const total = items.reduce((sum, item) => sum + (item.value || 0), 0);
  const visible = items.filter((item) => item.value > 0);
  const summary = visible.map((item) => `${item.name} ${item.value}`).join(', ');

  return (
    <div className={className} data-testid={testId}>
      <div
        className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-elevated"
        role="img"
        aria-label={total ? `Fordeling: ${summary}` : 'Ingen spill i utvalget'}
      >
        {visible.map((item) => (
          <span
            key={item.key}
            className="h-full first:rounded-l-full last:rounded-r-full transition-[flex-grow] duration-500 ease-out"
            style={{ flexGrow: item.value, flexBasis: 0, backgroundColor: item.color }}
          />
        ))}
      </div>
      <ul className="mt-4 space-y-0.5">
        {items.map((item) => {
          const pct = total ? (item.value / total) * 100 : 0;
          const content = (
            <>
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ backgroundColor: item.color }} />
                <span className="truncate text-[13px] text-text-secondary group-hover:text-text-primary">
                  {item.name}
                </span>
              </span>
              <span className="flex items-baseline gap-3 figure">
                <span className="w-12 text-right text-xs text-text-muted">
                  {pct.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} %
                </span>
                <span className="w-8 text-right text-[13px] font-medium text-text-primary">{item.value}</span>
              </span>
            </>
          );
          const rowClass = cn(
            'group flex items-center justify-between gap-3 rounded-md px-2 py-1.5 -mx-2',
            item.value === 0 && 'opacity-50'
          );
          return (
            <li key={item.key}>
              {linkFor ? (
                <Link to={linkFor(item)} className={cn(rowClass, 'transition-colors hover:bg-elevated/60')}>
                  {content}
                </Link>
              ) : (
                <div className={rowClass}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
