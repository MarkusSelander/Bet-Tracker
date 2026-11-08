import { cn } from '../lib/utils';

/** Bet-Tracker mark: a stepped equity line closing on its latest point. */
export default function BrandMark({ className }) {
  return (
    <span
      className={cn(
        'relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10',
        className
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
        <path
          d="M2.5 14.5 L6.5 10.5 L9.5 12.5 L14 6.5"
          stroke="rgb(var(--primary))"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M2.5 17.5 H17.5" stroke="rgb(var(--primary) / 0.35)" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="16" cy="4.5" r="2" fill="rgb(var(--primary))" />
      </svg>
    </span>
  );
}
