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

  return (
    <Link
      to="/settings"
      className="flex items-center justify-between gap-3 rounded-lg border border-[#27272A] bg-[#18181B] px-4 py-2"
      data-testid="bankroll-card"
    >
      <span className="text-sm text-text-secondary">Bankroll</span>
      <span
        className={`text-sm font-mono ${data.current < 0 ? 'text-destructive' : 'text-text-primary'}`}
        data-testid="bankroll-now"
      >
        {formatCurrency(data.current, currency)}
        {data.current_units != null ? (
          <span className="text-text-muted"> · {Number(data.current_units).toFixed(1)} u</span>
        ) : null}
      </span>
    </Link>
  );
}
