import { Link } from 'react-router-dom';
import { formatCurrency } from '../lib/format';
import { useBankroll } from '../lib/queries';

export default function BankrollCard({ currency = 'NOK' }) {
  const { data, isPending, isError } = useBankroll();

  if (isPending || isError) return null;

  if (!data?.configured) {
    return (
      <Link
        to="/settings"
        className="flex items-center justify-between rounded-lg border border-[#27272A] bg-[#18181B] px-4 py-2 text-sm text-text-secondary hover:text-white"
        data-testid="bankroll-card"
      >
        <span>Bankroll</span>
        <span className="text-primary">Sett saldo</span>
      </Link>
    );
  }

  const change = data.current - (data.baseline || 0);

  return (
    <Link
      to="/settings"
      className="flex items-center justify-between gap-3 rounded-lg border border-[#27272A] bg-[#18181B] px-4 py-3"
      data-testid="bankroll-card"
    >
      <div className="flex flex-col">
        <span className="text-xs text-text-secondary mb-0.5">Bankroll</span>
        <span className="text-base font-mono text-text-primary" data-testid="bankroll-now">
          {formatCurrency(data.current, currency)}
          {data.current_units != null ? (
            <span className="text-text-muted text-sm"> · {Number(data.current_units).toFixed(1)} u</span>
          ) : null}
        </span>
      </div>
      <div className="text-right">
        <span className="text-xs text-text-secondary block">Endring</span>
        <span className={`text-base font-mono ${change >= 0 ? 'text-primary' : 'text-destructive'}`}>
          {change >= 0 ? '+' : ''}
          {formatCurrency(change, currency)}
        </span>
      </div>
    </Link>
  );
}
