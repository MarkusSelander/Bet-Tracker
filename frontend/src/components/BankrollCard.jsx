import { Link } from 'react-router-dom';
import { formatCurrency } from '../lib/format';
import { useBankroll } from '../lib/queries';

function displayAmount(value, currency, unitSize) {
  if (value == null) return '—';
  if (currency === 'UNITS' && unitSize > 0) {
    return `${(Number(value) / unitSize).toFixed(2)} u`;
  }
  return formatCurrency(value, currency);
}

function Metric({ label, value, hint, tone }) {
  const toneClass = tone === 'down' ? 'text-destructive' : tone === 'up' ? 'text-primary' : '';
  return (
    <div>
      <p className="text-[11px] text-text-muted mb-0.5">{label}</p>
      <p className={`text-sm font-mono font-medium ${toneClass}`}>{value}</p>
      {hint ? <p className="text-[11px] text-text-muted mt-0.5">{hint}</p> : null}
    </div>
  );
}

export default function BankrollCard({ currency = 'NOK' }) {
  const { data, isPending, isError } = useBankroll();

  if (isPending) {
    return (
      <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-4" data-testid="bankroll-card">
        <p className="text-sm text-text-muted">Laster bankroll…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-4" data-testid="bankroll-card">
        <p className="text-sm text-text-muted">Kunne ikke laste bankroll</p>
      </div>
    );
  }

  if (!data?.configured) {
    return (
      <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-4" data-testid="bankroll-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Bankroll</h2>
            <p className="text-xs text-text-muted mt-1">
              Sett startbank og hvor mye 1 enhet er, så drawdown regnes fra toppen.
            </p>
          </div>
          <Link to="/settings" className="text-sm text-primary hover:underline shrink-0">
            Sett opp
          </Link>
        </div>
      </div>
    );
  }

  const unitSize = data.unit_size;
  const change = data.change_pct || 0;
  const money = (value) => displayAmount(value, currency, unitSize);

  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-4" data-testid="bankroll-card">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-bold">Bankroll</h2>
          <p className="text-xs text-text-muted mt-1">Hele historikken, ikke perioden i filteret</p>
        </div>
        <Link to="/settings" className="text-sm text-primary hover:underline shrink-0">
          Endre
        </Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric
          label="Nå"
          value={money(data.current)}
          hint={`${change >= 0 ? '+' : ''}${change.toFixed(1)}% fra start · ${Number(data.current_units).toFixed(1)} u`}
          tone={change >= 0 ? 'up' : 'down'}
        />
        <Metric label="Topp" value={money(data.peak)} hint={`Start ${money(data.starting_bankroll)}`} />
        <Metric
          label="Max drawdown"
          value={money(data.max_drawdown)}
          hint={`${Number(data.max_drawdown_pct || 0).toFixed(1)}% fra en topp`}
          tone={data.max_drawdown > 0 ? 'down' : undefined}
        />
        <Metric
          label="Tilgjengelig"
          value={money(data.available)}
          hint={
            data.pending_stake > 0
              ? `${money(data.pending_stake)} åpent · nå ${money(data.current_drawdown)} under topp`
              : `1 u = ${money(unitSize)}`
          }
          tone={data.available < 0 ? 'down' : undefined}
        />
      </div>
    </div>
  );
}
