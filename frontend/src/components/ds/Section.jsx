import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

export function SectionHeader({ eyebrow, title, description, action, className, id }) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-4 gap-y-2', className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
        <h2 id={id} className="text-[15px] font-semibold leading-tight text-text-primary">
          {title}
        </h2>
        {description ? <p className="mt-1 text-xs text-text-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function Panel({ as: Component = 'section', className, children, ...props }) {
  return (
    <Component className={cn('panel', className)} {...props}>
      {children}
    </Component>
  );
}

export function TextLink({ to, children, className, ...props }) {
  return (
    <Link
      to={to}
      className={cn(
        'group inline-flex items-center gap-1 rounded-sm text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary',
        className
      )}
      {...props}
    >
      {children}
      <ArrowRight
        className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {Icon ? (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-hairline bg-sunken text-text-muted">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
        </div>
      ) : null}
      <p className="text-sm font-medium text-text-primary">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-xs text-text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Kbd({ children }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-sunken px-1 font-mono text-[10px] text-text-muted">
      {children}
    </kbd>
  );
}
