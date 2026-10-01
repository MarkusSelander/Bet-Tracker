import { Link } from 'react-router-dom';
import { formatCurrency } from '../lib/format';
import { useBankroll } from '../lib/queries';

export default function BankrollCard({ currency = 'NOK' }) {
  const { data, isPending, isError } = useBankroll();

  if (isPending || isError) return null;

  if (!data?.configured) {
    return (
      <Link
        to="/settings#bankroll"
        className="flex items-center justify-between rounded-lg border border-[#27272A] bg-[#18181B] px-4 py-2 text-sm text-text-secondary hover:text-white"
        data-testid="bankroll-card"
      >
        <span>På konto</span>
        <span className="text-primary">Sett saldo</span>
      </Link>
    );
  }

  return (
    <Link
      to="/settings#bankroll"
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-[#27272A] bg-[#18181B] px-4 py-3 hover:border-white/20 transition-colors"
      data-testid="bankroll-card"
    >
      <div>
        <p className="text-xs text-text-secondary">På konto</p>
        <p
          className={`text-lg font-mono font-semibold ${data.current < 0 ? 'text-destructive' : 'text-text-primary'}`}
          data-testid="bankroll-now"
        >
          {formatCurrency(data.current, currency)}
          {data.current_units != null ? (
            <span className="text-sm font-normal text-text-muted"> · {Number(data.current_units).toFixed(1)} u</span>
          ) : null}
        </p>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <div>
          <p className="text-xs text-text-secondary">Innskudd</p>
          <p className="font-mono text-primary">{formatCurrency(data.deposited || 0, currency)}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Uttak</p>
          <p className="font-mono text-destructive">{formatCurrency(data.withdrawn || 0, currency)}</p>
        </div>
        <span className="text-sm text-primary self-end">Registrer →</span>
      </div>
    </Link>
  );
}
