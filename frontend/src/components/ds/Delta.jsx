import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Change against a comparison period. `format` renders the absolute value;
 * the arrow and color carry the direction.
 */
export default function Delta({ value, format, context, className }) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const n = Number(value);
  const rounded = Math.abs(n) < 1e-9 ? 0 : n;
  const Icon = rounded > 0 ? ArrowUpRight : rounded < 0 ? ArrowDownRight : ArrowRight;
  const tone =
    rounded > 0
      ? 'text-primary bg-primary/10'
      : rounded < 0
        ? 'text-destructive bg-destructive/10'
        : 'text-text-secondary bg-elevated';
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '±';

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', className)}>
      <span className={cn('inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium figure', tone)}>
        <Icon className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
        {sign}
        {format(Math.abs(rounded))}
      </span>
      {context ? <span className="text-text-muted">{context}</span> : null}
    </span>
  );
}
