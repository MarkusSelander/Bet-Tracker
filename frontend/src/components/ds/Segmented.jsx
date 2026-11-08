import { useRef } from 'react';
import { cn } from '../../lib/utils';

/**
 * Segmented control with roving focus: Tab enters once, arrow keys move between options.
 * Options: { value, label, icon?, testId?, ariaLabel? }.
 */
export default function Segmented({ options, value, onChange, label, size = 'md', className, testId }) {
  const refs = useRef([]);
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );

  const move = (event, index) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next = null;
    if (event.key in keys) next = (index + keys[event.key] + options.length) % options.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = options.length - 1;
    if (next == null) return;
    event.preventDefault();
    refs.current[next]?.focus();
    onChange(options[next].value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-testid={testId}
      className={cn('inline-flex items-center rounded-lg border border-hairline bg-sunken p-0.5', className)}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.ariaLabel}
            tabIndex={index === activeIndex ? 0 : -1}
            data-testid={option.testId}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => move(event, index)}
            className={cn(
              'relative inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
              active
                ? 'bg-elevated text-text-primary shadow-[0_1px_0_0_rgb(255_255_255/0.04)_inset,0_1px_2px_rgb(0_0_0/0.4)]'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
