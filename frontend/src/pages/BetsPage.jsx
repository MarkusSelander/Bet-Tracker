import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  LayoutGrid,
  Layers,
  List,
  ListChecks,
  Plus,
  Search,
  TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import BetDetailsDialog from '../components/BetDetailsDialog';
import BookmakerLogo from '../components/BookmakerLogo';
import PageHeader from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import {
  computeActiveKpis,
  formatBetDate,
  formatStatusLine,
  getBetSports,
  getMatchSummary,
  getSelectionSummary,
  nextSortState,
  sortBets,
  sortTooltip,
  statusDotClass,
  statusTextClass,
} from '../lib/betsDisplay';
import { fetchWithTimeout } from '../lib/fetch';
import { ODDS_RANGES, filterBets, parseFilters, toBetsApiSearch, toSearch } from '../lib/filters';
import { STATUS_LABELS, TICKET_TYPE_LABELS, formatCurrency } from '../lib/format';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const PERIODS = [
  { value: 'all', label: 'Alle' },
  { value: '7', label: '7 d' },
  { value: '30', label: '30 d' },
  { value: '90', label: '90 d' },
  { value: '365', label: 'År' },
  { value: 'custom', label: 'Periode' },
];

const SORT_COLUMNS = [
  { key: 'date', label: 'Dato', align: 'left' },
  { key: 'sport', label: 'Sport', align: 'left' },
  { key: 'match', label: 'Kamp', align: 'left' },
  { key: 'selection', label: 'Utvalg', align: 'left' },
  { key: 'bookie', label: 'Bookmakere', align: 'left' },
  { key: 'stake', label: 'Innsats', align: 'right' },
  { key: 'odds', label: 'Odds', align: 'right' },
  { key: 'status', label: 'Status', align: 'right' },
];

const filterTriggerClass =
  'h-10 w-auto min-w-[148px] max-w-[220px] shrink-0 rounded-xl border-white/10 bg-[#12151c] text-sm text-text-secondary hover:bg-white/5 hover:text-white';

function uniqueValues(rows, key, extra) {
  const values = new Set(rows.map((row) => row[key]).filter(Boolean));
  if (extra) values.add(extra);
  return [...values].sort();
}

function SortHeader({ column, sortKey, sortDir, onSort }) {
  const active = sortKey === column.key;
  const tooltip = sortTooltip(sortKey, sortDir, column.key);
  return (
    <th
      className={`py-3 px-3 text-[12px] font-medium text-text-secondary whitespace-nowrap ${column.align === 'right' ? 'text-right' : 'text-left'}`}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onSort(column.key)}
            className={`inline-flex items-center gap-1.5 hover:text-white transition-colors ${
              column.align === 'right' ? 'flex-row-reverse' : ''
            } ${active ? 'text-white' : ''}`}
          >
            {column.label}
            {active && sortDir === 'asc' ? (
              <ChevronUp className="w-3.5 h-3.5 opacity-70" />
            ) : active && sortDir === 'desc' ? (
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            ) : (
              <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent className="bg-[#1c1f26] text-white border border-white/10 text-xs">{tooltip}</TooltipContent>
      </Tooltip>
    </th>
  );
}

function SportCell({ bet }) {
  const sports = getBetSports(bet);
  const extra = Math.max(0, sports.length - 1);
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-[13px] text-white/90 truncate">{sports[0] || '—'}</span>
      {extra > 0 ? (
        <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

function MatchCell({ bet }) {
  const summary = getMatchSummary(bet);
  return (
    <div className="min-w-0 max-w-[240px]" title={summary.primary}>
      {summary.prefix ? <div className="text-[12px] text-white/90">{summary.prefix}:</div> : null}
      <div className="text-[13px] text-white truncate">{summary.primary || '—'}</div>
      {summary.extraCount > 0 ? <div className="text-[12px] text-accent">og {summary.extraCount} mer</div> : null}
    </div>
  );
}

function SelectionCell({ bet }) {
  const summary = getSelectionSummary(bet);
  return (
    <div className="min-w-0 max-w-[220px] text-[13px] text-white/80" title={summary.primary}>
      <span className="truncate inline-block max-w-full align-bottom">{summary.primary || '—'}</span>
      {summary.extraCount > 0 ? <span className="text-white/55"> og mer</span> : null}
    </div>
  );
}

function StatusCell({ bet, currency }) {
  return (
    <div className={`flex items-center justify-end gap-2 text-[13px] font-medium ${statusTextClass(bet.status)}`}>
      <span className="whitespace-nowrap">{formatStatusLine(bet, currency)}</span>
      <span className={`w-2 h-2 rounded-full shrink-0 ${statusDotClass(bet.status)}`} />
    </div>
  );
}

function BetCard({ bet, currency, onOpen, onKeyDown }) {
  const summary = getMatchSummary(bet);
  const selection = getSelectionSummary(bet);
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`bet-card-${bet.bet_id}`}
      aria-label={`Vis detaljer for ${bet.game}`}
      onClick={() => onOpen(bet)}
      onKeyDown={(event) => onKeyDown(event, bet)}
      className="rounded-2xl border border-white/8 bg-[#12151c] p-4 text-left cursor-pointer hover:bg-white/[0.04] hover:border-white/15 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="text-[13px] font-medium text-primary">{formatBetDate(bet.date, bet.time)}</span>
        <StatusCell bet={bet} currency={currency} />
      </div>
      <SportCell bet={bet} />
      <div className="mt-2">
        {summary.prefix ? <p className="text-[12px] text-white/80">{summary.prefix}:</p> : null}
        <p className="text-sm text-white truncate">{summary.primary || '—'}</p>
        {summary.extraCount > 0 ? <p className="text-[12px] text-accent">og {summary.extraCount} mer</p> : null}
      </div>
      <p className="mt-1 text-[13px] text-white/70 truncate">
        {selection.primary || '—'}
        {selection.extraCount > 0 ? ' og mer' : ''}
      </p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <BookmakerLogo name={bet.bookie} />
        <div className="text-right text-[13px] font-mono text-white/80">
          <div>{formatCurrency(bet.stake, currency)}</div>
          <div className="text-text-secondary">{Number(bet.odds || 0).toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}

export default function BetsPage() {
  const { user } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseFilters(searchParams);
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBet, setEditingBet] = useState(null);
  const [detailBet, setDetailBet] = useState(null);
  const [view, setView] = useState('list');
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const currency = user?.currency || 'NOK';
  const period = filters.period || 'all';
  const apiSearch = toBetsApiSearch(filters);
  const filteredBets = useMemo(() => filterBets(bets, filters), [bets, filters]);
  const sortedBets = useMemo(() => sortBets(filteredBets, sortKey, sortDir), [filteredBets, sortKey, sortDir]);
  const kpis = useMemo(() => computeActiveKpis(bets), [bets]);
  const availableSports = uniqueValues(bets, 'sport', filters.sport);
  const availableBookies = uniqueValues(bets, 'bookie', filters.bookie);
  const availableTipsters = uniqueValues(bets, 'tipster', filters.tipster);
  const availableLeagues = uniqueValues(bets, 'league', filters.league);
  const availableTypes = [
    ...new Set(
      [...Object.keys(TICKET_TYPE_LABELS), ...bets.map((bet) => bet.ticket_type), filters.ticketType].filter(Boolean)
    ),
  ].sort();

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

  const patchFilters = (patch) => {
    const next = { ...filters, ...patch };
    if (patch.period && patch.period !== 'custom') {
      next.from = '';
      next.to = '';
    }
    setSearchParams(toSearch(next), { replace: true });
    setCurrentPage(1);
  };

  const fetchData = useCallback(async () => {
    try {
      const query = apiSearch ? `?${apiSearch}` : '';
      const betsRes = await fetchWithTimeout(`${BACKEND_URL}/api/bets${query}`, { credentials: 'include' });
      const betsData = await betsRes.json();
      setBets(Array.isArray(betsData) ? betsData : []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Kunne ikke laste spill');
    } finally {
      setLoading(false);
    }
  }, [apiSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [apiSearch, filters.q, sortKey, sortDir]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingBet) {
        const response = await fetchWithTimeout(`${BACKEND_URL}/api/bets/${editingBet.bet_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(formData),
        });

        if (!response.ok) throw new Error('Kunne ikke oppdatere spill');
        toast.success('Spill oppdatert');
      } else {
        const response = await fetchWithTimeout(`${BACKEND_URL}/api/bets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ...formData,
            stake: parseFloat(formData.stake),
            odds: parseFloat(formData.odds),
          }),
        });

        if (!response.ok) throw new Error('Kunne ikke opprette spill');
        toast.success('Spill lagt til');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving bet:', error);
      toast.error('Kunne ikke lagre spill');
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
    if (!window.confirm('Slette dette spillet?')) return false;

    try {
      const response = await fetchWithTimeout(`${BACKEND_URL}/api/bets/${betId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Kunne ikke slette spill');
      toast.success('Spill slettet');
      fetchData();
      return true;
    } catch (error) {
      console.error('Error deleting bet:', error);
      toast.error('Kunne ikke slette spill');
      return false;
    }
  };

  const openBetDetails = (bet) => setDetailBet(bet);

  const handleRowKeyDown = (event, bet) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openBetDetails(bet);
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

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleSort = (key) => {
    const next = nextSortState(sortKey, sortDir, key);
    setSortKey(next.key);
    setSortDir(next.dir);
  };

  const totalPages = Math.max(1, Math.ceil(sortedBets.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentBets = sortedBets.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const periodLabel = PERIODS.find((item) => item.value === (period || 'all'))?.label || 'Dato';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Spill" subtitle="Søk, filtrer og rediger kupongene dine" testId="bets-title" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="bets-kpis">
        <button
          type="button"
          data-testid="kpi-active-bets"
          onClick={() => patchFilters({ status: 'pending' })}
          className="flex items-center gap-4 rounded-2xl border border-white/5 bg-[#12151c] px-5 py-4 text-left hover:border-white/10 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <ListChecks className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[22px] leading-none font-semibold tracking-tight">{kpis.count}</p>
            <p className="text-xs text-text-secondary mt-1.5">Aktive spill</p>
          </div>
        </button>
        <button
          type="button"
          data-testid="kpi-active-stake"
          onClick={() => patchFilters({ status: 'pending' })}
          className="flex items-center gap-4 rounded-2xl border border-white/5 bg-[#12151c] px-5 py-4 text-left hover:border-white/10 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[22px] leading-none font-semibold tracking-tight">
              {formatCurrency(kpis.stake, currency)}
            </p>
            <p className="text-xs text-text-secondary mt-1.5">Total aktiv innsats</p>
          </div>
        </button>
        <button
          type="button"
          data-testid="kpi-potential"
          onClick={() => patchFilters({ status: 'pending' })}
          className="flex items-center gap-4 rounded-2xl border border-white/5 bg-[#12151c] px-5 py-4 text-left hover:border-white/10 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[22px] leading-none font-semibold tracking-tight">
              {formatCurrency(kpis.potential, currency)}
            </p>
            <p className="text-xs text-text-secondary mt-1.5">Potensiell gevinst</p>
          </div>
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={period || 'all'}
            onValueChange={(value) => patchFilters({ period: value === 'all' ? '' : value })}
          >
            <SelectTrigger className={filterTriggerClass} data-testid="filter-date">
              <span className="flex items-center gap-2 min-w-0">
                <CalendarDays className="w-4 h-4 opacity-60 shrink-0" />
                <SelectValue>{period && period !== 'all' ? periodLabel : 'Dato'}</SelectValue>
              </span>
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.status || 'all'}
            onValueChange={(value) => patchFilters({ status: value === 'all' ? '' : value })}
          >
            <SelectTrigger className={filterTriggerClass} data-testid="filter-status">
              <SelectValue>{filters.status ? STATUS_LABELS[filters.status] || filters.status : 'Status'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle statuser</SelectItem>
              <SelectItem value="won">Vunnet</SelectItem>
              <SelectItem value="lost">Tapt</SelectItem>
              <SelectItem value="push">Push</SelectItem>
              <SelectItem value="pending">Åpen</SelectItem>
              <SelectItem value="cashed">Cashout</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.sport || 'all'}
            onValueChange={(value) => patchFilters({ sport: value === 'all' ? '' : value })}
          >
            <SelectTrigger className={filterTriggerClass} data-testid="filter-sport">
              <SelectValue>{filters.sport || 'Sport'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle sporter</SelectItem>
              {availableSports.map((sport) => (
                <SelectItem key={sport} value={sport}>
                  {sport}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.bookie || 'all'}
            onValueChange={(value) => patchFilters({ bookie: value === 'all' ? '' : value })}
          >
            <SelectTrigger className={filterTriggerClass} data-testid="filter-bookie">
              <SelectValue>{filters.bookie || 'Bookmaker'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle bookier</SelectItem>
              {availableBookies.map((bookie) => (
                <SelectItem key={bookie} value={bookie}>
                  {bookie}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.tipster || 'all'}
            onValueChange={(value) => patchFilters({ tipster: value === 'all' ? '' : value })}
          >
            <SelectTrigger className={`${filterTriggerClass} min-w-[168px]`} data-testid="filter-tipster">
              <SelectValue>{filters.tipster || 'Tags og tipstere'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle tipstere</SelectItem>
              {availableTipsters.map((tipster) => (
                <SelectItem key={tipster} value={tipster}>
                  {tipster}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-white/10 p-0.5 bg-[#12151c]">
              <button
                type="button"
                aria-label="Rutenettvisning"
                data-testid="view-grid"
                onClick={() => setView('grid')}
                className={`p-2 rounded-md transition-colors ${
                  view === 'grid' ? 'bg-white/10 text-white' : 'text-text-muted hover:text-white'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Listevisning"
                data-testid="view-list"
                onClick={() => setView('list')}
                className={`p-2 rounded-md transition-colors ${
                  view === 'list' ? 'bg-white/10 text-white' : 'text-text-muted hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <Button
              data-testid="add-bet-btn"
              onClick={openCreateDialog}
              className="h-10 rounded-xl bg-accent hover:bg-accent/90 text-white font-semibold px-5"
            >
              <Plus className="w-4 h-4" />
              Nytt spill
            </Button>
          </div>
        </div>

        {period === 'custom' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dateFrom" className="text-sm text-text-secondary mb-2 block">
                Fra dato
              </Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.from}
                onChange={(e) => patchFilters({ period: 'custom', from: e.target.value })}
                className="input-enhanced bg-[#12151c] border-white/10 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="dateTo" className="text-sm text-text-secondary mb-2 block">
                Til dato
              </Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.to}
                onChange={(e) => patchFilters({ period: 'custom', to: e.target.value })}
                className="input-enhanced bg-[#12151c] border-white/10 rounded-xl"
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] w-full sm:w-auto sm:flex-1 sm:max-w-md">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={filters.q}
              onChange={(e) => patchFilters({ q: e.target.value })}
              placeholder="Søk kamp, marked, sport..."
              className="pl-9 h-10 bg-[#12151c] border-white/10 rounded-xl"
            />
          </div>
          <Select
            value={filters.league || 'all'}
            onValueChange={(value) => patchFilters({ league: value === 'all' ? '' : value })}
          >
            <SelectTrigger className={filterTriggerClass}>
              <SelectValue>{filters.league || 'Liga'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle ligaer</SelectItem>
              {availableLeagues.map((league) => (
                <SelectItem key={league} value={league}>
                  {league}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.ticketType || 'all'}
            onValueChange={(value) => patchFilters({ ticketType: value === 'all' ? '' : value })}
          >
            <SelectTrigger className={filterTriggerClass}>
              <SelectValue>
                {filters.ticketType ? TICKET_TYPE_LABELS[filters.ticketType] || filters.ticketType : 'Type'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle typer</SelectItem>
              {availableTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {TICKET_TYPE_LABELS[type] || type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.oddsRange || 'all'}
            onValueChange={(value) => patchFilters({ oddsRange: value === 'all' ? '' : value })}
          >
            <SelectTrigger className={filterTriggerClass}>
              <SelectValue>{filters.oddsRange || 'Odds'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle odds</SelectItem>
              {ODDS_RANGES.map((range) => (
                <SelectItem key={range} value={range}>
                  {range}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {view === 'grid' ? (
        <div>
          {sortedBets.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-[#12151c] py-16 text-center text-text-muted">
              Ingen spill treffer filtrene
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {currentBets.map((bet) => (
                <BetCard
                  key={bet.bet_id}
                  bet={bet}
                  currency={currency}
                  onOpen={openBetDetails}
                  onKeyDown={handleRowKeyDown}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/5 bg-[#0e1117]/80 overflow-hidden">
          <div className="overflow-x-auto">
            <TooltipProvider delayDuration={250}>
              <table className="w-full min-w-[960px]">
                <thead>
                  <tr className="border-b border-white/5">
                    {SORT_COLUMNS.map((column) => (
                      <SortHeader
                        key={column.key}
                        column={column}
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedBets.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-16 text-text-muted">
                        Ingen spill treffer filtrene
                      </td>
                    </tr>
                  ) : (
                    currentBets.map((bet) => (
                      <tr
                        key={bet.bet_id}
                        data-testid={`bet-row-${bet.bet_id}`}
                        tabIndex={0}
                        aria-label={`Vis detaljer for ${bet.game}`}
                        onClick={() => openBetDetails(bet)}
                        onKeyDown={(event) => handleRowKeyDown(event, bet)}
                        className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors cursor-pointer focus-visible:outline-none focus-visible:bg-white/5"
                      >
                        <td className="py-3.5 px-3 text-[13px] font-medium text-primary whitespace-nowrap">
                          {formatBetDate(bet.date, bet.time)}
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <SportCell bet={bet} />
                        </td>
                        <td className="py-3.5 px-3">
                          <MatchCell bet={bet} />
                        </td>
                        <td className="py-3.5 px-3">
                          <SelectionCell bet={bet} />
                        </td>
                        <td className="py-3.5 px-3">
                          <BookmakerLogo name={bet.bookie} />
                        </td>
                        <td className="py-3.5 px-3 text-[13px] text-white/90 text-right whitespace-nowrap">
                          {formatCurrency(bet.stake, currency)}
                        </td>
                        <td className="py-3.5 px-3 text-[13px] text-white/90 text-right whitespace-nowrap">
                          {Number(bet.odds || 0).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <StatusCell bet={bet} currency={currency} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </TooltipProvider>
          </div>
        </div>
      )}

      {sortedBets.length > 0 ? (
        <div className="px-1 py-1">
          <div className="flex items-center justify-between">
            <div className="text-sm text-text-secondary">
              Viser <span className="font-medium text-white">{startIndex + 1}</span>–
              <span className="font-medium text-white">{Math.min(endIndex, sortedBets.length)}</span> av{' '}
              <span className="font-medium text-white">{sortedBets.length}</span> spill
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
                Forrige
              </Button>

              <div className="flex items-center space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
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
                Neste
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="bg-[#18181B] border-[#27272A] text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingBet ? 'Rediger spill' : 'Nytt spill'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Dato</Label>
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
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger className="bg-black/20 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="won">Vunnet</SelectItem>
                    <SelectItem value="lost">Tapt</SelectItem>
                    <SelectItem value="push">Push</SelectItem>
                    <SelectItem value="pending">Åpen</SelectItem>
                    <SelectItem value="cashed">Cashout</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="game">Kamp</Label>
                <Input
                  id="game"
                  value={formData.game}
                  onChange={(e) => setFormData({ ...formData, game: e.target.value })}
                  placeholder="f.eks. Manchester United vs Liverpool"
                  className="input-enhanced bg-black/20 border-white/10"
                  required
                />
              </div>
              <div>
                <Label htmlFor="time">Tid (valgfritt)</Label>
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
              <Label htmlFor="bet">Marked</Label>
              <Input
                id="bet"
                value={formData.bet}
                onChange={(e) => setFormData({ ...formData, bet: e.target.value })}
                placeholder="f.eks. Manchester United vinner"
                className="bg-black/20 border-white/10"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="stake">Innsats</Label>
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
                <Label htmlFor="bookie">Bookmaker (valgfritt)</Label>
                <Input
                  id="bookie"
                  value={formData.bookie}
                  onChange={(e) => setFormData({ ...formData, bookie: e.target.value })}
                  placeholder="Bet365"
                  className="bg-black/20 border-white/10"
                />
              </div>
              <div>
                <Label htmlFor="sport">Sport (valgfritt)</Label>
                <Input
                  id="sport"
                  value={formData.sport}
                  onChange={(e) => setFormData({ ...formData, sport: e.target.value })}
                  placeholder="Fotball"
                  className="bg-black/20 border-white/10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notater (valgfritt)</Label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notater om spillet..."
                className="w-full min-h-[80px] bg-black/20 border border-white/10 rounded-md p-2 text-white resize-y"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="tipster">Tipster (valgfritt)</Label>
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
                Avbryt
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-black font-bold">
                {editingBet ? 'Oppdater' : 'Legg til'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <BetDetailsDialog
        bet={detailBet}
        open={Boolean(detailBet)}
        onOpenChange={(open) => {
          if (!open) setDetailBet(null);
        }}
        currency={currency}
        onEdit={(bet) => {
          setDetailBet(null);
          handleEdit(bet);
        }}
        onDelete={async (bet) => {
          const deleted = await handleDelete(bet.bet_id);
          if (deleted) setDetailBet(null);
        }}
      />
    </div>
  );
}
