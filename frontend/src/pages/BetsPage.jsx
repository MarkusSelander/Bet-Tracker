import { ChevronLeft, ChevronRight, Filter, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const formatCurrency = (value, currency) => {
  if (currency === 'UNITS') return `${value.toFixed(2)} U`;
  if (currency === 'NOK') return `${value.toFixed(2)} kr`;
  return `$${value.toFixed(2)}`;
};

export default function BetsPage() {
  const { user } = useOutletContext();
  const [bets, setBets] = useState([]);
  const [filteredBets, setFilteredBets] = useState([]);
  const [bookmakers, setBookmakers] = useState([]);
  const [tipsters, setTipsters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBet, setEditingBet] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    bookie: '',
    tipster: '',
    sport: '',
    dateFrom: '',
    dateTo: '',
  });
  const [datePreset, setDatePreset] = useState('all');
  const currency = user?.currency || 'USD';

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 8),
    game: '',
    bet: '',
    stake: '',
    odds: '',
    status: 'pending',
    bookie: '',
    tipster: '',
    sport: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
    setCurrentPage(1); // Reset to first page when filters change
  }, [bets, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      const [betsRes, bookmakersRes, tipstersRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/bets`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/bookmakers`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/tipsters`, { credentials: 'include' }),
      ]);

      const betsData = await betsRes.json();
      const bookmakersData = await bookmakersRes.json();
      const tipstersData = await tipstersRes.json();

      setBets(betsData);
      setBookmakers(bookmakersData);
      setTipsters(tipstersData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load bets');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...bets];

    if (filters.dateFrom) {
      filtered = filtered.filter((bet) => bet.date >= filters.dateFrom);
    }
    if (filters.dateTo) {
      filtered = filtered.filter((bet) => bet.date <= filters.dateTo);
    }
    if (filters.status) {
      filtered = filtered.filter((bet) => bet.status === filters.status);
    }
    if (filters.bookie) {
      filtered = filtered.filter((bet) => bet.bookie === filters.bookie);
    }
    if (filters.tipster) {
      filtered = filtered.filter((bet) => bet.tipster === filters.tipster);
    }
    if (filters.sport) {
      filtered = filtered.filter((bet) => bet.sport === filters.sport);
    }

    setFilteredBets(filtered);
  };

  const handleDatePreset = (preset) => {
    setDatePreset(preset);
    const today = new Date();
    let dateFrom = '';
    let dateTo = today.toISOString().split('T')[0];

    switch (preset) {
      case 'today': {
        dateFrom = dateTo;
        break;
      }
      case 'week': {
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        dateFrom = weekAgo.toISOString().split('T')[0];
        break;
      }
      case 'month': {
        const monthAgo = new Date(today);
        monthAgo.setMonth(today.getMonth() - 1);
        dateFrom = monthAgo.toISOString().split('T')[0];
        break;
      }
      case 'custom':
        return;
      default:
        dateFrom = '';
        dateTo = '';
    }

    setFilters({ ...filters, dateFrom, dateTo });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingBet) {
        const response = await fetch(`${BACKEND_URL}/api/bets/${editingBet.bet_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(formData),
        });

        if (!response.ok) throw new Error('Failed to update bet');
        toast.success('Bet updated successfully');
      } else {
        const response = await fetch(`${BACKEND_URL}/api/bets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ...formData,
            stake: parseFloat(formData.stake),
            odds: parseFloat(formData.odds),
          }),
        });

        if (!response.ok) throw new Error('Failed to create bet');
        toast.success('Bet added successfully');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving bet:', error);
      toast.error('Failed to save bet');
    }
  };

  const handleEdit = (bet) => {
    setEditingBet(bet);
    setFormData({
      date: bet.date,
      time: bet.time || '',
      game: bet.game,
      bet: bet.bet,
      stake: bet.stake.toString(),
      odds: bet.odds.toString(),
      status: bet.status,
      bookie: bet.bookie || '',
      tipster: bet.tipster || '',
      sport: bet.sport || '',
      notes: bet.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (betId) => {
    if (!window.confirm('Are you sure you want to delete this bet?')) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/bets/${betId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to delete bet');
      toast.success('Bet deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Error deleting bet:', error);
      toast.error('Failed to delete bet');
    }
  };

  const resetForm = () => {
    setEditingBet(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 8),
      game: '',
      bet: '',
      stake: '',
      odds: '',
      status: 'pending',
      bookie: '',
      tipster: '',
      sport: '',
      notes: '',
    });
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredBets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentBets = filteredBets.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2" data-testid="bets-title">
            Bets
          </h1>
          <p className="text-text-secondary">Manage your betting history</p>
        </div>

        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button
              data-testid="add-bet-btn"
              className="btn-primary-enhanced bg-primary hover:bg-primary/90 text-black font-bold shadow-[0_0_15px_rgba(16,185,129,0.4)]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Bet
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#18181B] border-[#27272A] text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingBet ? 'Edit Bet' : 'Add New Bet'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="input-enhanced bg-black/20 border-white/10"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger className="bg-black/20 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="won">Won</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                      <SelectItem value="push">Push</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="game">Game</Label>
                  <Input
                    id="game"
                    value={formData.game}
                    onChange={(e) => setFormData({ ...formData, game: e.target.value })}
                    placeholder="e.g., Manchester United vs Liverpool"
                    className="input-enhanced bg-black/20 border-white/10"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="time">Time (Optional)</Label>
                  <Input
                    id="time"
                    type="time"
                    step="1"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="input-enhanced bg-black/20 border-white/10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="bet">Bet</Label>
                <Input
                  id="bet"
                  value={formData.bet}
                  onChange={(e) => setFormData({ ...formData, bet: e.target.value })}
                  placeholder="e.g., Manchester United to win"
                  className="bg-black/20 border-white/10"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="stake">Stake</Label>
                  <Input
                    id="stake"
                    type="number"
                    step="0.01"
                    value={formData.stake}
                    onChange={(e) => setFormData({ ...formData, stake: e.target.value })}
                    placeholder="100"
                    className="bg-black/20 border-white/10"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="odds">Odds</Label>
                  <Input
                    id="odds"
                    type="number"
                    step="0.01"
                    value={formData.odds}
                    onChange={(e) => setFormData({ ...formData, odds: e.target.value })}
                    placeholder="2.50"
                    className="bg-black/20 border-white/10"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bookie">Bookie (Optional)</Label>
                  <Input
                    id="bookie"
                    value={formData.bookie}
                    onChange={(e) => setFormData({ ...formData, bookie: e.target.value })}
                    placeholder="Bet365"
                    className="bg-black/20 border-white/10"
                  />
                </div>
                <div>
                  <Label htmlFor="sport">Sport (Optional)</Label>
                  <Input
                    id="sport"
                    value={formData.sport}
                    onChange={(e) => setFormData({ ...formData, sport: e.target.value })}
                    placeholder="Football"
                    className="bg-black/20 border-white/10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add notes about this bet..."
                  className="w-full min-h-[80px] bg-black/20 border border-white/10 rounded-md p-2 text-white resize-y"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="tipster">Tipster (Optional)</Label>
                <Input
                  id="tipster"
                  value={formData.tipster}
                  onChange={(e) => setFormData({ ...formData, tipster: e.target.value })}
                  placeholder="John Doe"
                  className="bg-black/20 border-white/10"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="secondary" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-black font-bold">
                  {editingBet ? 'Update' : 'Add'} Bet
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="glass-panel border border-[#27272A] rounded-lg p-4 space-y-4">
        <div className="flex items-center space-x-4">
          <Filter className="w-5 h-5 text-text-secondary" />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={datePreset === 'all' ? 'default' : 'secondary'}
              onClick={() => handleDatePreset('all')}
              className={datePreset === 'all' ? 'bg-primary text-black' : 'bg-white/5'}
            >
              All Time
            </Button>
            <Button
              size="sm"
              variant={datePreset === 'today' ? 'default' : 'secondary'}
              onClick={() => handleDatePreset('today')}
              className={datePreset === 'today' ? 'bg-primary text-black' : 'bg-white/5'}
            >
              Today
            </Button>
            <Button
              size="sm"
              variant={datePreset === 'week' ? 'default' : 'secondary'}
              onClick={() => handleDatePreset('week')}
              className={datePreset === 'week' ? 'bg-primary text-black' : 'bg-white/5'}
            >
              This Week
            </Button>
            <Button
              size="sm"
              variant={datePreset === 'month' ? 'default' : 'secondary'}
              onClick={() => handleDatePreset('month')}
              className={datePreset === 'month' ? 'bg-primary text-black' : 'bg-white/5'}
            >
              This Month
            </Button>
            <Button
              size="sm"
              variant={datePreset === 'custom' ? 'default' : 'secondary'}
              onClick={() => handleDatePreset('custom')}
              className={datePreset === 'custom' ? 'bg-primary text-black' : 'bg-white/5'}
            >
              Custom Range
            </Button>
          </div>
        </div>

        {datePreset === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dateFrom" className="text-sm text-text-secondary mb-2 block">
                From Date
              </Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="input-enhanced bg-black/20 border-white/10"
              />
            </div>
            <div>
              <Label htmlFor="dateTo" className="text-sm text-text-secondary mb-2 block">
                To Date
              </Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="input-enhanced bg-black/20 border-white/10"
              />
            </div>
          </div>
        )}

        <div className="flex items-center space-x-4">
          <span className="text-sm text-text-secondary">Filter by:</span>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
              <SelectTrigger className="bg-black/20 border-white/10">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">All Statuses</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
                <SelectItem value="push">Push</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.bookie} onValueChange={(value) => setFilters({ ...filters, bookie: value })}>
              <SelectTrigger className="bg-black/20 border-white/10">
                <SelectValue placeholder="Filter by Bookie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">All Bookies</SelectItem>
                {bookmakers.map((bm) => (
                  <SelectItem key={bm.bookmaker_id} value={bm.name}>
                    {bm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.sport} onValueChange={(value) => setFilters({ ...filters, sport: value })}>
              <SelectTrigger className="bg-black/20 border-white/10">
                <SelectValue placeholder="Filter by Sport" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">All Sports</SelectItem>
                <SelectItem value="Football">Football</SelectItem>
                <SelectItem value="Basketball">Basketball</SelectItem>
                <SelectItem value="Tennis">Tennis</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.tipster} onValueChange={(value) => setFilters({ ...filters, tipster: value })}>
              <SelectTrigger className="bg-black/20 border-white/10">
                <SelectValue placeholder="Filter by Tipster" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">All Tipsters</SelectItem>
                {tipsters.map((tip) => (
                  <SelectItem key={tip.tipster_id} value={tip.name}>
                    {tip.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Bets Table */}
      <div className="glass-panel border border-[#27272A] rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full enhanced-table">
            <thead>
              <tr className="border-b border-[#27272A] bg-black/20">
                <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary whitespace-nowrap">
                  Date
                </th>
                <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary whitespace-nowrap max-w-[150px]">
                  Game
                </th>
                <th className="text-left py-2 px-3 text-[1  1px] font-medium text-text-secondary whitespace-nowrap max-w-[200px]">
                  Bet
                </th>
                <th className="text-right py-2 px-3 text-[11px] font-medium text-text-secondary whitespace-nowrap">
                  Odds
                </th>
                <th className="text-right py-2 px-3 text-[11px] font-medium text-text-secondary whitespace-nowrap">
                  Stake
                </th>
                <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary whitespace-nowrap">
                  Sport
                </th>
                <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary whitespace-nowrap">
                  Bookie
                </th>
                <th className="text-center py-2 px-3 text-[11px] font-medium text-text-secondary whitespace-nowrap">
                  Status
                </th>
                <th className="text-right py-2 px-3 text-[11px] font-medium text-text-secondary whitespace-nowrap">
                  Result
                </th>
                <th className="text-center py-2 px-3 text-[11px] font-medium text-text-secondary whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredBets.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-12 text-text-muted">
                    No bets found
                  </td>
                </tr>
              ) : (
                currentBets.map((bet) => (
                  <tr key={bet.bet_id} className="border-b border-[#27272A] hover:bg-white/5 transition-colors">
                    <td className="py-2 px-3 text-[11px] font-mono whitespace-nowrap">
                      {bet.date.split('-').slice(1).reverse().join('/')} {bet.time ? bet.time.slice(0, 5) : ''}
                    </td>
                    <td className="py-2 px-3 text-[11px] whitespace-nowrap max-w-[150px] truncate">{bet.game}</td>
                    <td className="py-2 px-3 text-[11px] text-text-secondary whitespace-nowrap max-w-[200px] truncate">
                      {bet.bet}
                    </td>
                    <td className="py-2 px-3 text-[11px] font-mono text-right whitespace-nowrap">
                      {bet.odds.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-[11px] font-mono text-right whitespace-nowrap">
                      {formatCurrency(bet.stake, currency)}
                    </td>
                    <td className="py-2 px-3 text-[11px] text-text-secondary whitespace-nowrap">{bet.sport || '-'}</td>
                    <td className="py-2 px-3 text-[11px] text-text-secondary whitespace-nowrap">{bet.bookie || '-'}</td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <span
                        className={`badge-enhanced px-1.5 py-0.5 rounded text-[9px] font-medium ${
                          bet.status === 'won'
                            ? 'bg-primary/10 text-primary'
                            : bet.status === 'lost'
                              ? 'bg-destructive/10 text-destructive'
                              : bet.status === 'push'
                                ? 'bg-white/10 text-text-secondary'
                                : 'bg-accent/10 text-accent'
                        }`}
                      >
                        {bet.status.charAt(0).toUpperCase() + bet.status.slice(1)}
                      </span>
                    </td>
                    <td
                      className={`py-2 px-3 text-[11px] font-mono font-bold text-right whitespace-nowrap ${
                        bet.result >= 0 ? 'text-primary' : 'text-destructive'
                      }`}
                    >
                      {bet.result >= 0 ? '+' : ''}
                      {formatCurrency(bet.result, currency)}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          data-testid={`edit-bet-${bet.bet_id}`}
                          onClick={() => handleEdit(bet)}
                          className="p-2 hover:bg-white/10 rounded transition-colors"
                        >
                          <Pencil className="w-4 h-4 text-accent" />
                        </button>
                        <button
                          data-testid={`delete-bet-${bet.bet_id}`}
                          onClick={() => handleDelete(bet.bet_id)}
                          className="p-2 hover:bg-white/10 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredBets.length > 0 && (
          <div className="border-t border-[#27272A] px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-text-secondary">
                Showing <span className="font-medium text-white">{startIndex + 1}</span> to{' '}
                <span className="font-medium text-white">{Math.min(endIndex, filteredBets.length)}</span> of{' '}
                <span className="font-medium text-white">{filteredBets.length}</span> bets
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="bg-black/20 border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>

                <div className="flex items-center space-x-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    // Show first page, last page, current page, and pages around current
                    const showPage =
                      page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1);

                    const showEllipsisBefore = page === currentPage - 2 && currentPage > 3;
                    const showEllipsisAfter = page === currentPage + 2 && currentPage < totalPages - 2;

                    if (showEllipsisBefore || showEllipsisAfter) {
                      return (
                        <span key={page} className="px-2 text-text-muted">
                          ...
                        </span>
                      );
                    }

                    if (!showPage) return null;

                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handlePageChange(page)}
                        className={
                          currentPage === page
                            ? 'bg-primary text-black hover:bg-primary/90 min-w-[40px]'
                            : 'bg-black/20 border-white/10 hover:bg-white/10 min-w-[40px]'
                        }
                      >
                        {page}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="bg-black/20 border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
