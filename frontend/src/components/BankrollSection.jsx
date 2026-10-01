import { Trash2, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BANKROLL_TYPE_LABELS, formatCurrency } from '../lib/format';
import { fetchJson, queryClient, queryKeys } from '../lib/queryClient';
import { useBankroll } from '../lib/queries';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

const TYPES = [
  { value: 'deposit', label: 'Innskudd' },
  { value: 'withdrawal', label: 'Uttak' },
  { value: 'set', label: 'Sett saldo' },
];

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function emptyForm() {
  return { type: 'deposit', amount: '', date: todayKey(), note: '' };
}

export default function BankrollSection({ currency = 'NOK' }) {
  const { data, isPending } = useBankroll();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const movements = Array.isArray(data?.movements) ? data.movements : [];
  const balance = data?.balance || 0;

  useEffect(() => {
    if (window.location.hash !== '#bankroll') return;
    document.getElementById('bankroll')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const patchForm = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Skriv inn et beløp større enn 0');
      return;
    }
    setSaving(true);
    try {
      const summary = await fetchJson('/api/bankroll/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.type,
          amount,
          date: form.date,
          note: form.note,
        }),
      });
      queryClient.setQueryData(queryKeys.bankroll, summary);
      setForm(emptyForm());
      toast.success(
        form.type === 'set'
          ? 'Saldo oppdatert'
          : form.type === 'withdrawal'
            ? 'Uttak registrert'
            : 'Innskudd registrert'
      );
    } catch (error) {
      toast.error(error.message || 'Kunne ikke lagre');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (movementId) => {
    if (!window.confirm('Slette denne bevegelsen?')) return;
    try {
      const summary = await fetchJson(`/api/bankroll/movements/${encodeURIComponent(movementId)}`, {
        method: 'DELETE',
      });
      queryClient.setQueryData(queryKeys.bankroll, summary);
      toast.success('Bevegelse slettet');
    } catch (error) {
      toast.error(error.message || 'Kunne ikke slette');
    }
  };

  return (
    <div id="bankroll" className="scroll-mt-16 bg-[#18181B] border border-[#27272A] rounded-lg p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Bankroll
          </h2>
          <p className="text-sm text-text-muted mt-1">Manuell saldo. Spillresultat endrer den ikke automatisk.</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-text-secondary">På konto</p>
          <p className="text-2xl font-bold font-mono" data-testid="bankroll-balance">
            {isPending ? '…' : formatCurrency(balance, currency)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-lg bg-black/20 p-3">
          <p className="text-xs text-text-secondary">Innskudd</p>
          <p className="font-mono font-medium text-primary">{formatCurrency(data?.deposited || 0, currency)}</p>
        </div>
        <div className="rounded-lg bg-black/20 p-3">
          <p className="text-xs text-text-secondary">Uttak</p>
          <p className="font-mono font-medium text-destructive">{formatCurrency(data?.withdrawn || 0, currency)}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 mb-6" data-testid="bankroll-form">
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => patchForm({ type: item.value })}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                form.type === item.value
                  ? 'bg-primary text-black font-medium'
                  : 'bg-white/5 text-text-secondary hover:bg-white/10'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="bankroll-amount">{form.type === 'set' ? 'Ny saldo' : 'Beløp'}</Label>
            <Input
              id="bankroll-amount"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(event) => patchForm({ amount: event.target.value })}
              className="bg-black/20 border-white/10 mt-1"
              required
            />
          </div>
          <div>
            <Label htmlFor="bankroll-date">Dato</Label>
            <Input
              id="bankroll-date"
              type="date"
              value={form.date}
              onChange={(event) => patchForm({ date: event.target.value })}
              className="bg-black/20 border-white/10 mt-1"
            />
          </div>
          <div>
            <Label htmlFor="bankroll-note">Notat</Label>
            <Input
              id="bankroll-note"
              value={form.note}
              onChange={(event) => patchForm({ note: event.target.value })}
              placeholder="Valgfritt"
              className="bg-black/20 border-white/10 mt-1"
            />
          </div>
        </div>
        <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 text-black font-bold">
          {saving ? 'Lagrer...' : 'Registrer'}
        </Button>
      </form>

      {movements.length === 0 ? (
        <p className="text-sm text-text-muted">Ingen bevegelser ennå. Sett saldo eller registrer første innskudd.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#27272A] text-left text-xs text-text-secondary">
                <th className="py-2 pr-3 font-medium">Dato</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Notat</th>
                <th className="py-2 pr-3 font-medium text-right">Beløp</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {movements.map((row) => (
                <tr key={row.movement_id} className="border-b border-[#27272A]/50">
                  <td className="py-2 pr-3 text-sm font-mono whitespace-nowrap">{row.date}</td>
                  <td className="py-2 pr-3 text-sm">{BANKROLL_TYPE_LABELS[row.type] || row.type}</td>
                  <td className="py-2 pr-3 text-sm text-text-secondary">{row.note || '—'}</td>
                  <td
                    className={`py-2 pr-3 text-sm font-mono text-right ${
                      row.type === 'withdrawal' ? 'text-destructive' : 'text-primary'
                    }`}
                  >
                    {row.type === 'withdrawal' ? '−' : '+'}
                    {formatCurrency(row.amount, currency)}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      aria-label="Slett bevegelse"
                      onClick={() => handleDelete(row.movement_id)}
                      className="p-1 text-text-muted hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
