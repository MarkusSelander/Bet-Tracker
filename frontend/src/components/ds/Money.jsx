import { formatMoneyParts } from '../../lib/format';
import { cn } from '../../lib/utils';

const TONE_CLASS = {
  '+': 'text-primary',
  '−': 'text-destructive',
  '': 'text-text-primary',
};

/**
 * Typeset amount: the sign and decimals step back, the integer carries the weight,
 * and the unit sits small beside it. `signed` shows "+" on gains; losses always show "−".
 */
export default function Money({
  value,
  currency = 'NOK',
  digits = 2,
  signed = false,
  tone = 'auto',
  className,
  unitClassName,
  fractionClassName,
}) {
  const parts = formatMoneyParts(value, currency, digits);
  if (!parts) return <span className={cn('figure text-text-muted', className)}>–</span>;
  const sign = parts.sign === '−' || signed ? parts.sign : '';
  const toneClass = tone === 'auto' ? TONE_CLASS[signed ? parts.sign : ''] : tone === 'none' ? '' : tone;

  return (
    <span className={cn('figure whitespace-nowrap', toneClass, className)}>
      {sign ? <span className="mr-[0.06em] font-normal opacity-85">{sign}</span> : null}
      <span>{parts.integer}</span>
      {parts.fraction ? <span className={cn('opacity-55', fractionClassName)}>{parts.fraction}</span> : null}
      <span className={cn('ml-[0.28em] text-[0.78em] font-medium text-text-secondary', unitClassName)}>
        {parts.unit}
      </span>
    </span>
  );
}
