import { Download, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import PageHeader from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function SettingsPage() {
  const { user } = useOutletContext();
  const [currency, setCurrency] = useState(user?.currency || 'NOK');
  const [importing, setImporting] = useState(false);
  const [importingCoolbet, setImportingCoolbet] = useState(false);
  const fileInputRef = useRef(null);
  const coolbetInputRef = useRef(null);

  const handleCurrencyChange = async (newCurrency) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/currency`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currency: newCurrency }),
      });

      if (!response.ok) throw new Error('Failed to update currency');

      setCurrency(newCurrency);
      toast.success('Valuta oppdatert');
      window.location.reload();
    } catch (error) {
      console.error('Error updating currency:', error);
      toast.error('Kunne ikke oppdatere valuta');
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/bets/export`, {
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

        const response = await fetch(`${BACKEND_URL}/api/bets/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ csv_data: csvData }),
        });

        if (!response.ok) throw new Error('Failed to import bets');

        const result = await response.json();
        toast.success(`Importert ${result.imported} spill`);
        window.location.reload();
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

        const response = await fetch(`${BACKEND_URL}/api/bets/import/coolbet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ tickets }),
        });

        if (!response.ok) throw new Error('Failed to import Coolbet bets');

        const result = await response.json();
        toast.success(`Coolbet: ${result.imported} new, ${result.updated} updated, ${result.skipped} skipped`);
        window.location.reload();
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
      <PageHeader title="Innstillinger" subtitle="Valuta og data" testId="settings-title" />

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
          <p className="text-sm text-text-muted mt-2">Gjelder beløp i hele appen</p>
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
