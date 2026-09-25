import { Download, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import PageHeader from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useAuth } from '../contexts/AuthContext';
import { fetchWithTimeout } from '../lib/fetch';
import { formatCurrency } from '../lib/format';
import { useBankroll, useUsdRate } from '../lib/queries';
import { invalidateTrackerData } from '../lib/queryClient';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function SettingsPage() {
  const { user } = useOutletContext();
  const { updateUser } = useAuth();
  const { data: bankroll } = useBankroll();
  const { data: fx } = useUsdRate();
  const [currency, setCurrency] = useState(user?.currency || 'NOK');
  const [startingBankroll, setStartingBankroll] = useState('');
  const [unitSize, setUnitSize] = useState('');
  const [savingBankroll, setSavingBankroll] = useState(false);
  const [moveAmount, setMoveAmount] = useState('');
  const [savingMove, setSavingMove] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingCoolbet, setImportingCoolbet] = useState(false);
  const fileInputRef = useRef(null);
  const coolbetInputRef = useRef(null);

  useEffect(() => {
    if (!bankroll?.configured) return;
    setStartingBankroll(bankroll.baseline != null ? String(bankroll.baseline) : '');
    setUnitSize(bankroll.unit_size ? String(bankroll.unit_size) : '');
  }, [bankroll]);

  const handleBankrollSave = async (event) => {
    event.preventDefault();
    setSavingBankroll(true);
    try {
      const response = await fetchWithTimeout(`${BACKEND_URL}/api/auth/bankroll`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          cash_balance: Number(String(startingBankroll).replace(',', '.')),
          unit_size: Number(String(unitSize).replace(',', '.')),
        }),
      });
      if (!response.ok) throw new Error('Failed to update bankroll');
      await invalidateTrackerData();
      toast.success('Bankroll oppdatert');
    } catch (error) {
      console.error('Error updating bankroll:', error);
      toast.error('Saldo og enhet må være større enn 0');
    } finally {
      setSavingBankroll(false);
    }
  };

  const submitMove = async (type) => {
    const value = Number(String(moveAmount).replace(',', '.'));
    if (!(value > 0)) {
      toast.error('Skriv inn et beløp større enn 0');
      return;
    }
    setSavingMove(true);
    try {
      const response = await fetchWithTimeout(`${BACKEND_URL}/api/bankroll/moves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type, amount: value }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || 'Kunne ikke lagre');
      }
      setMoveAmount('');
      await invalidateTrackerData();
      toast.success(type === 'deposit' ? 'Innskudd lagt til' : 'Uttak lagt til');
    } catch (error) {
      toast.error(error.message || 'Kunne ikke lagre');
    } finally {
      setSavingMove(false);
    }
  };

  const handleCurrencyChange = async (newCurrency) => {
    try {
      const response = await fetchWithTimeout(`${BACKEND_URL}/api/auth/currency`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currency: newCurrency }),
      });

      if (!response.ok) throw new Error('Failed to update currency');

      setCurrency(newCurrency);
      updateUser({ currency: newCurrency });
      toast.success('Valuta oppdatert');
    } catch (error) {
      console.error('Error updating currency:', error);
      toast.error('Kunne ikke oppdatere valuta');
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetchWithTimeout(`${BACKEND_URL}/api/bets/export`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to export bets');

      const data = await response.json();
      const blob = new Blob([data.csv_data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bets_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Spill eksportert');
    } catch (error) {
      console.error('Error exporting bets:', error);
      toast.error('Kunne ikke eksportere spill');
    }
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImporting(true);

    // Read file as text to preserve original format
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const csvData = e.target.result;

        const response = await fetchWithTimeout(`${BACKEND_URL}/api/bets/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ csv_data: csvData }),
        });

        if (!response.ok) throw new Error('Failed to import bets');

        const result = await response.json();
        toast.success(`Importert ${result.imported} spill`);
        await invalidateTrackerData();
      } catch (error) {
        console.error('Error importing bets:', error);
        toast.error('Kunne ikke importere spill');
      } finally {
        setImporting(false);
      }
    };

    reader.onerror = () => {
      console.error('Error reading file');
      toast.error('Kunne ikke lese CSV-fil');
      setImporting(false);
    };

    reader.readAsText(file);
  };

  const handleCoolbetImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImportingCoolbet(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const tickets = Array.isArray(parsed) ? parsed : parsed.tickets;

        if (!Array.isArray(tickets) || tickets.length === 0) {
          throw new Error('JSON must be an array of tickets');
        }

        const response = await fetchWithTimeout(`${BACKEND_URL}/api/bets/import/coolbet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ tickets }),
        });

        if (!response.ok) throw new Error('Failed to import Coolbet bets');

        const result = await response.json();
        toast.success(`Coolbet: ${result.imported} new, ${result.updated} updated, ${result.skipped} skipped`);
        await invalidateTrackerData();
      } catch (error) {
        console.error('Error importing Coolbet bets:', error);
        toast.error(error.message || 'Kunne ikke importere Coolbet JSON');
      } finally {
        setImportingCoolbet(false);
        event.target.value = '';
      }
    };

    reader.onerror = () => {
      toast.error('Kunne ikke lese JSON-fil');
      setImportingCoolbet(false);
    };

    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Innstillinger" subtitle="Bankroll, valuta og data" testId="settings-title" />

      <form
        onSubmit={handleBankrollSave}
        className="bg-[#18181B] border border-[#27272A] rounded-lg p-6"
        data-testid="bankroll-settings"
      >
        <h2 className="text-xl font-bold mb-1">Bankroll</h2>
        <p className="text-sm text-text-secondary mb-4">
          Utgangspunkt er banken før spillene i appen. Linjen på oversikten er dette pluss resultater, minus åpne
          innsatser, pluss innskudd og minus uttak.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
          <div>
            <Label htmlFor="starting-bankroll">Utgangspunkt</Label>
            <Input
              id="starting-bankroll"
              inputMode="decimal"
              value={startingBankroll}
              onChange={(event) => setStartingBankroll(event.target.value)}
              placeholder="15301"
              className="bg-black/20 border-white/10 mt-2"
              data-testid="starting-bankroll-input"
            />
          </div>
          <div>
            <Label htmlFor="unit-size">1 enhet</Label>
            <Input
              id="unit-size"
              inputMode="decimal"
              value={unitSize}
              onChange={(event) => setUnitSize(event.target.value)}
              placeholder="500"
              className="bg-black/20 border-white/10 mt-2"
              data-testid="unit-size-input"
            />
          </div>
        </div>
        <Button
          type="submit"
          disabled={savingBankroll}
          className="mt-4 bg-primary hover:bg-primary/90 text-black font-bold"
          data-testid="save-bankroll-btn"
        >
          {savingBankroll ? 'Lagrer...' : 'Lagre bankroll'}
        </Button>
        {bankroll?.configured ? (
          <div className="mt-6 pt-4 border-t border-[#27272A]">
            <h3 className="font-medium mb-3">Innskudd og uttak</h3>
            <div className="flex flex-col sm:flex-row gap-2 max-w-lg">
              <Input
                inputMode="decimal"
                value={moveAmount}
                onChange={(event) => setMoveAmount(event.target.value)}
                placeholder="Beløp i kroner"
                className="bg-black/20 border-white/10 sm:max-w-[180px]"
                data-testid="bankroll-move-amount"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.preventDefault();
                }}
              />
              <Button
                type="button"
                disabled={savingMove}
                onClick={() => submitMove('deposit')}
                className="bg-primary hover:bg-primary/90 text-black font-bold"
                data-testid="bankroll-deposit"
              >
                Innskudd
              </Button>
              <Button
                type="button"
                disabled={savingMove}
                onClick={() => submitMove('withdrawal')}
                className="bg-white/5 hover:bg-white/10 border border-white/10"
                data-testid="bankroll-withdrawal"
              >
                Uttak
              </Button>
            </div>
            {bankroll.moves?.some((move) => move.type !== 'set') ? (
              <ul className="mt-4 max-w-lg space-y-1.5">
                {bankroll.moves
                  .filter((move) => move.type !== 'set')
                  .map((move) => (
                    <li
                      key={move.id || `${move.type}-${move.at}`}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-text-secondary">
                        {move.type === 'deposit' ? 'Innskudd' : 'Uttak'}
                        {move.at ? ` · ${String(move.at).slice(0, 10)}` : ''}
                      </span>
                      <span className={`font-mono ${move.type === 'deposit' ? 'text-primary' : ''}`}>
                        {move.type === 'withdrawal' ? '−' : '+'}
                        {formatCurrency(move.amount, currency)}
                      </span>
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </form>

      {/* Currency Settings */}
      <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Valuta</h2>
        <div className="max-w-xs">
          <Label htmlFor="currency">Visningsvaluta</Label>
          <Select value={currency} onValueChange={handleCurrencyChange}>
            <SelectTrigger id="currency" className="bg-black/20 border-white/10 mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NOK">NOK (kr)</SelectItem>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="UNITS">Units (U)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-text-muted mt-2">
            {currency === 'USD' && fx?.nok_per_usd
              ? `1 $ = ${Number(fx.nok_per_usd).toLocaleString('nb-NO')} kr. Kursen oppdateres daglig.`
              : currency === 'UNITS'
                ? 'Beløp deles på enhetsstørrelsen, som lagres i kroner.'
                : 'Beløpene vises i kroner, slik de er lagret fra Coolbet.'}
          </p>
        </div>
      </div>

      {/* Import/Export */}
      <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Data</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Eksporter spill</h3>
            <p className="text-sm text-text-secondary mb-3">Last ned alle spill som CSV</p>
            <Button
              data-testid="export-btn"
              onClick={handleExport}
              className="bg-white/5 hover:bg-white/10 border border-white/10"
            >
              <Download className="w-4 h-4 mr-2" />
              Eksporter CSV
            </Button>
          </div>

          <div className="pt-4 border-t border-[#27272A]">
            <h3 className="font-medium mb-2">Importer spill</h3>
            <p className="text-sm text-text-secondary mb-3">
              CSV med semikolon. Kolonner: DATE, TIME, GAME, BET, ODDS, STAKE, STATUS, RESULT, TIPSTER, SPORT, BOOKIE
            </p>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImport} className="hidden" />
            <Button
              data-testid="import-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="bg-primary hover:bg-primary/90 text-black font-bold"
            >
              <Upload className="w-4 h-4 mr-2" />
              {importing ? 'Importerer...' : 'Importer CSV'}
            </Button>
          </div>

          <div className="pt-4 border-t border-[#27272A]">
            <h3 className="font-medium mb-2">Importer Coolbet</h3>
            <p className="text-sm text-text-secondary mb-3">
              Last opp <span className="font-mono text-text-primary">coolbet_bets.json</span> fra{' '}
              <span className="font-mono text-text-primary">sync.py</span>. Eksisterende kuponger oppdateres på
              Coolbet-id. For automatisk synk: last den utpakkede Chrome-utvidelsen fra mappen{' '}
              <span className="font-mono text-text-primary">extension/</span> (se{' '}
              <span className="font-mono text-text-primary">extension/README.md</span>).
            </p>
            <input
              ref={coolbetInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleCoolbetImport}
              className="hidden"
            />
            <Button
              data-testid="import-coolbet-btn"
              onClick={() => coolbetInputRef.current?.click()}
              disabled={importingCoolbet}
              className="bg-primary hover:bg-primary/90 text-black font-bold"
            >
              <Upload className="w-4 h-4 mr-2" />
              {importingCoolbet ? 'Importerer...' : 'Importer Coolbet JSON'}
            </Button>
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Konto</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
            <span className="text-text-secondary">Navn</span>
            <span className="font-medium">{user?.name}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
            <span className="text-text-secondary">E-post</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
            <span className="text-text-secondary">Valuta</span>
            <span className="font-medium">{currency}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
