import { statusDotClass } from '../../lib/betsDisplay';
import { STATUS_LABELS, statusClass } from '../../lib/format';
import { cn } from '../../lib/utils';

export default function StatusBadge({ status, children, size = 'md', className }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-medium',
        size === 'sm' ? 'px-1.5 py-px text-[10.5px]' : 'px-2 py-0.5 text-[11px]',
        statusClass(status),
        className
      )}
    >
      <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
        {status === 'pending' && size !== 'sm' ? (
          <span className={cn('absolute inset-0 rounded-full opacity-60 animate-ping', statusDotClass(status))} />
        ) : null}
        <span className={cn('relative h-1.5 w-1.5 rounded-full', statusDotClass(status))} />
      </span>
      {children ?? STATUS_LABELS[status] ?? status}
    </span>
  );
}
