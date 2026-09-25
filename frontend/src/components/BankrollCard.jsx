import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { formatCurrency } from '../lib/format';
import { useBankroll } from '../lib/queries';
import { fetchJson, invalidateTrackerData } from '../lib/queryClient';
import { Button } from './ui/button';
import { Input } from './ui/input';

const MOVE_LABELS = {
  set: 'Saldo satt',
  deposit: 'Innskudd',
  withdrawal: 'Uttak',
};

function parseAmount(value) {
  const amount = Number(String(value).replace(',', '.'));
  return Number.isFinite(amount) ? amount : NaN;
}

export default function BankrollCard({ currency = 'NOK' }) {
  const { data, isPending, isError } = useBankroll();
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const submitMove = async (type) => {
    const value = parseAmount(amount);
    if (!(value > 0)) {
      toast.error('Skriv inn et beløp større enn 0');
      return;
    }
    setSaving(true);
    try {
      await fetchJson('/api/bankroll/moves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, amount: value }),
      });
      setAmount('');
      await invalidateTrackerData();
      toast.success(type === 'deposit' ? 'Innskudd lagt til' : 'Uttak lagt til');
    } catch (error) {
      toast.error(error.message || 'Kunne ikke lagre');
    } finally {
      setSaving(false);
    }
  };

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
            <p className="text-xs text-text-muted mt-1">Sett saldoen du har inne nå, og hvor mye 1 enhet er.</p>
          </div>
          <Link to="/settings" className="text-sm text-primary hover:underline shrink-0">
            Sett opp
          </Link>
        </div>
      </div>
    );
  }

  const money = (value) => formatCurrency(value, currency);

  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-4" data-testid="bankroll-card">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-bold">Bankroll</h2>
          <p className="text-xs text-text-muted mt-1">Det du har inne nå</p>
        </div>
        <Link to="/settings" className="text-sm text-primary hover:underline shrink-0">
          Endre saldo
        </Link>
      </div>
      <p
        className={`text-3xl font-bold font-mono ${data.current < 0 ? 'text-destructive' : ''}`}
        data-testid="bankroll-now"
      >
        {money(data.current)}
      </p>
      <p className="text-xs text-text-muted mt-1">
        {data.current_units != null ? `${Number(data.current_units).toFixed(1)} u` : null}
        {data.unit_size ? ` · 1 u = ${money(data.unit_size)}` : null}
      </p>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <p className="text-[11px] text-text-muted mb-0.5">Innskudd</p>
          <p className="text-sm font-mono text-primary">{money(data.deposited)}</p>
        </div>
        <div>
          <p className="text-[11px] text-text-muted mb-0.5">Uttak</p>
          <p className="text-sm font-mono">{money(data.withdrawn)}</p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mt-4">
        <Input
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Beløp"
          className="bg-black/20 border-white/10 sm:max-w-[160px]"
          data-testid="bankroll-move-amount"
        />
        <Button
          type="button"
          disabled={saving}
          onClick={() => submitMove('deposit')}
          className="bg-primary hover:bg-primary/90 text-black font-bold"
          data-testid="bankroll-deposit"
        >
          Innskudd
        </Button>
        <Button
          type="button"
          disabled={saving}
          onClick={() => submitMove('withdrawal')}
          className="bg-white/5 hover:bg-white/10 border border-white/10"
          data-testid="bankroll-withdrawal"
        >
          Uttak
        </Button>
      </div>
      {data.moves?.length ? (
        <ul className="mt-4 space-y-1.5">
          {data.moves
            .filter((move) => move.type !== 'set')
            .map((move) => (
              <li key={move.id || `${move.type}-${move.at}`} className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">
                  {MOVE_LABELS[move.type] || move.type}
                  {move.at ? ` · ${String(move.at).slice(0, 10)}` : ''}
                </span>
                <span className={`font-mono ${move.type === 'deposit' ? 'text-primary' : ''}`}>
                  {move.type === 'withdrawal' ? '−' : '+'}
                  {money(move.amount)}
                </span>
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
