import { Download, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function SettingsPage() {
  const { user } = useOutletContext();
  const [currency, setCurrency] = useState(user?.currency || 'USD');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

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
      toast.success('Currency updated successfully');
      window.location.reload();
    } catch (error) {
      console.error('Error updating currency:', error);
      toast.error('Failed to update currency');
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

      toast.success('Bets exported successfully');
    } catch (error) {
      console.error('Error exporting bets:', error);
      toast.error('Failed to export bets');
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
        toast.success(`Successfully imported ${result.imported} bets`);
        window.location.reload();
      } catch (error) {
        console.error('Error importing bets:', error);
        toast.error('Failed to import bets');
      } finally {
        setImporting(false);
      }
    };

    reader.onerror = () => {
      console.error('Error reading file');
      toast.error('Failed to read CSV file');
      setImporting(false);
    };

    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2" data-testid="settings-title">
          Settings
        </h1>
        <p className="text-text-secondary">Manage your preferences and data</p>
      </div>

      {/* Currency Settings */}
      <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Currency Preference</h2>
        <div className="max-w-xs">
          <Label htmlFor="currency">Display Currency</Label>
          <Select value={currency} onValueChange={handleCurrencyChange}>
            <SelectTrigger id="currency" className="bg-black/20 border-white/10 mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="NOK">NOK (kr)</SelectItem>
              <SelectItem value="UNITS">Units (U)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-text-muted mt-2">This will affect how amounts are displayed throughout the app</p>
        </div>
      </div>

      {/* Import/Export */}
      <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Data Management</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Export Bets</h3>
            <p className="text-sm text-text-secondary mb-3">Download all your bets as a CSV file</p>
            <Button
              data-testid="export-btn"
              onClick={handleExport}
              className="bg-white/5 hover:bg-white/10 border border-white/10"
            >
              <Download className="w-4 h-4 mr-2" />
              Export to CSV
            </Button>
          </div>

          <div className="pt-4 border-t border-[#27272A]">
            <h3 className="font-medium mb-2">Import Bets</h3>
            <p className="text-sm text-text-secondary mb-3">
              Import bets from a semicolon-delimited CSV file. Required columns: DATE, TIME, GAME, BET, ODDS, STAKE,
              STATUS, RESULT, TIPSTER, SPORT, BOOKIE
            </p>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImport} className="hidden" />
            <Button
              data-testid="import-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="btn-primary-enhanced bg-primary hover:bg-primary/90 text-black font-bold shadow-[0_0_15px_rgba(16,185,129,0.4)]"
            >
              <Upload className="w-4 h-4 mr-2" />
              {importing ? 'Importing...' : 'Import from CSV'}
            </Button>
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Account Information</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
            <span className="text-text-secondary">Name</span>
            <span className="font-medium">{user?.name}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
            <span className="text-text-secondary">Email</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
            <span className="text-text-secondary">Currency</span>
            <span className="font-medium">{currency}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
