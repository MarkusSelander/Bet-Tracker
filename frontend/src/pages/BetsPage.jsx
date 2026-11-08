import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  Inbox,
  LayoutGrid,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import BetSummary from '../components/BetSummary';
import BetTicketDialog from '../components/BetTicketDialog';
import BookmakerLogo from '../components/BookmakerLogo';
import { Metric, MetricRail } from '../components/ds/Metric';
import Money from '../components/ds/Money';
import { EmptyState, Kbd } from '../components/ds/Section';
import Segmented from '../components/ds/Segmented';
import StatusBadge from '../components/ds/StatusBadge';
import PageHeader from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import {
  computeActiveKpis,
  formatBetDate,
  getBetSports,
  getSelectionSummary,
  nextSortState,
  sortBets,
  sortTooltip,
  statusDotClass,
} from '../lib/betsDisplay';
import { formatLegKickoff, toCreatePayload, toUpdatePayload } from '../lib/betTicket';
import { fetchWithTimeout } from '../lib/fetch';
import { ODDS_RANGES, filterBets, parseFilters, toBetsApiSearch, toSearch } from '../lib/filters';
import { STATUS_LABELS, TICKET_TYPE_LABELS, formatCurrency } from '../lib/format';
import { useBets } from '../lib/queries';
import { invalidateTrackerData } from '../lib/queryClient';
import { cn } from '../lib/utils';

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

const VIEW_OPTIONS = [
  { value: 'list', label: '', icon: List, ariaLabel: 'Listevisning', testId: 'view-list' },
  { value: 'grid', label: '', icon: LayoutGrid, ariaLabel: 'Rutenettvisning', testId: 'view-grid' },
];

const filterTriggerClass =
  'h-9 w-auto min-w-[124px] max-w-[220px] shrink-0 data-[active=true]:border-primary/40 data-[active=true]:bg-primary/[0.06] data-[active=true]:text-text-primary text-text-secondary';

function uniqueValues(rows, key, extra) {
  const values = new Set(rows.map((row) => row[key]).filter(Boolean));
  if (extra) values.add(extra);
  return [...values].sort();
}

function statusAmount(bet) {
  const raw = Number(bet.result);
  if (bet.status === 'lost') return -Math.abs(Number.isFinite(raw) ? raw : Number(bet.stake) || 0);
  return Number.isFinite(raw) ? raw : 0;
}

function betLegs(bet) {
  return Array.isArray(bet?.legs) ? bet.legs.filter(Boolean) : [];
}

function SortHeader({ column, sortKey, sortDir, onSort }) {
  const active = sortKey === column.key;
  const tooltip = sortTooltip(sortKey, sortDir, column.key);
  return (
    <th
      scope="col"
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('whitespace-nowrap px-3 py-2.5', column.align === 'right' ? 'text-right' : 'text-left')}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onSort(column.key)}
            className={cn(
              'eyebrow inline-flex items-center gap-1 rounded-sm transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70',
              column.align === 'right' && 'flex-row-reverse',
              active && 'text-text-primary'
            )}
          >
            {column.label}
            {active && sortDir === 'asc' ? (
              <ChevronUp className="h-3 w-3 text-primary" />
            ) : active && sortDir === 'desc' ? (
              <ChevronDown className="h-3 w-3 text-primary" />
            ) : (
              <ChevronsUpDown className="h-3 w-3 opacity-40" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </th>
  );
}

function SportCell({ bet }) {
  const sports = getBetSports(bet);
  const extra = Math.max(0, sports.length - 1);
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="truncate text-[13px] text-text-secondary">{sports[0] || '—'}</span>
      {extra > 0 ? (
        <span className="shrink-0 rounded-full bg-elevated px-1.5 py-px text-[10px] font-semibold text-text-secondary figure">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

function SelectionCell({ bet }) {
  const summary = getSelectionSummary(bet);
  return (
    <div className="min-w-0 max-w-[220px] text-[13px] text-text-secondary" title={summary.primary}>
      <span className="inline-block max-w-full truncate align-bottom">{summary.primary || '—'}</span>
      {summary.extraCount > 0 ? <span className="text-text-muted"> og mer</span> : null}
    </div>
  );
}

function StatusCell({ bet, currency }) {
  const pending = bet.status === 'pending';
  const push = bet.status === 'push';
  return (
    <div className="flex items-center justify-end gap-2.5">
      {pending ? (
        <span className="text-xs text-text-muted figure">
          til {formatCurrency((Number(bet.stake) || 0) * (Number(bet.odds) || 0), currency, 0)}
        </span>
      ) : push ? null : (
        <span className="text-[13px] font-medium">
          <Money value={statusAmount(bet)} currency={currency} signed />
        </span>
      )}
      <StatusBadge status={bet.status} size="sm" />
    </div>
  );
}

function LegsDetail({ bet, id }) {
  const legs = betLegs(bet);
  return (
    <div id={id} className="animate-fade-in border-l-2 border-hairline py-1 pl-4">
      <ol className="divide-y divide-hairline">
        {legs.map((leg, index) => {
          const meta = [formatLegKickoff(leg.start_time), leg.league, leg.sport].filter(Boolean).join(' · ');
          const odds = Number(leg.odds);
          return (
            <li
              // eslint-disable-next-line react/no-array-index-key
              key={`${leg.match || 'leg'}-${index}`}
              className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto_auto] items-center gap-3 py-2"
            >
              <span className="font-mono text-[10.5px] text-text-muted figure">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] text-text-primary">{leg.match || `Bein ${index + 1}`}</p>
                <p className="truncate text-xs text-text-muted">
                  {[leg.market, leg.outcome].filter(Boolean).join(' · ') || '—'}
                  {meta ? <span className="hidden sm:inline"> · {meta}</span> : null}
                </p>
              </div>
              <span className="text-[13px] text-text-secondary figure">
                {Number.isFinite(odds) && odds > 0 ? odds.toFixed(2) : ''}
              </span>
              {leg.status ? <StatusBadge status={leg.status} size="sm" /> : <span />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function BetCard({ bet, currency, onOpen, onKeyDown }) {
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`bet-card-${bet.bet_id}`}
      aria-label={`Vis detaljer for ${bet.game}`}
      onClick={() => onOpen(bet)}
      onKeyDown={(event) => onKeyDown(event, bet)}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-hairline bg-surface p-4 text-left transition-colors duration-150 hover:border-border hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70"
    >
      <span
        className={cn('absolute inset-x-0 top-0 h-[2px] opacity-70', statusDotClass(bet.status))}
        aria-hidden="true"
      />
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs text-text-muted figure">{formatBetDate(bet.date, bet.time)}</span>
        <StatusBadge status={bet.status} size="sm" />
      </div>
      <div className="mt-3">
        <SportCell bet={bet} />
        <BetSummary bet={bet} className="mt-1" />
      </div>
      <div className="mt-4 flex items-end justify-between gap-3 border-t border-hairline pt-3">
        <BookmakerLogo name={bet.bookie} />
        <div className="text-right">
          <p className="text-[13px] font-medium figure">
            <Money value={bet.stake} currency={currency} />
            <span className="mx-1.5 text-text-muted">@</span>
            <span className="text-text-secondary">{Number(bet.odds || 0).toFixed(2)}</span>
          </p>
          {bet.status !== 'pending' && bet.status !== 'push' ? (
            <p className="mt-0.5 text-xs">
              <Money value={statusAmount(bet)} currency={currency} signed />
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ value, placeholder, allLabel, options, onChange, testId, renderLabel, icon: Icon }) {
  const active = Boolean(value);
  return (
    <Select value={value || 'all'} onValueChange={(next) => onChange(next === 'all' ? '' : next)}>
      <SelectTrigger className={filterTriggerClass} data-testid={testId} data-active={active}>
        <span className="flex min-w-0 items-center gap-2">
          {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" /> : null}
          <SelectValue>{active ? renderLabel?.(value) || value : placeholder}</SelectValue>
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value ?? option} value={option.value ?? option}>
            {option.label ?? option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LedgerSkeleton() {
  return (
    <div className="panel overflow-hidden" aria-busy="true" aria-label="Laster spill">
      <div className="h-10 border-b border-hairline bg-sunken/60" />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-6 border-b border-hairline px-5 py-4">
          <div className="skeleton h-3 w-16" />
          <div className="skeleton h-3 w-14" />
          <div className="skeleton h-3 flex-1" />
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-5 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default function BetsPage() {
  const { user } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseFilters(searchParams);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketMode, setTicketMode] = useState('view');
  const [ticketBet, setTicketBet] = useState(null);
  const [view, setView] = useState('list');
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [showMoreFilters, setShowMoreFilters] = useState(
    Boolean(filters.tipster || filters.league || filters.ticketType || filters.oddsRange)
  );
  const [expanded, setExpanded] = useState(() => new Set());
  const searchRef = useRef(null);
  const currency = user?.currency || 'NOK';
  const period = filters.period || 'all';
  const apiSearch = toBetsApiSearch(filters);
  const { data: bets = [], isPending, isError, isFetching } = useBets(apiSearch);
  const [searchInput, setSearchInput] = useState(filters.q);
  const filteredBets = useMemo(() => filterBets(bets, filters), [bets, filters]);
  const sortedBets = useMemo(() => sortBets(filteredBets, sortKey, sortDir), [filteredBets, sortKey, sortDir]);
  const kpis = useMemo(() => computeActiveKpis(bets), [bets]);
  const totals = useMemo(
    () =>
      filteredBets.reduce(
        (acc, bet) => {
          acc.stake += Number(bet.stake) || 0;
          if (bet.status !== 'pending') acc.result += Number(bet.result) || 0;
          return acc;
        },
        { stake: 0, result: 0 }
      ),
    [filteredBets]
  );
  const availableSports = useMemo(() => uniqueValues(bets, 'sport', filters.sport), [bets, filters.sport]);
  const availableBookies = useMemo(() => uniqueValues(bets, 'bookie', filters.bookie), [bets, filters.bookie]);
  const availableTipsters = useMemo(() => uniqueValues(bets, 'tipster', filters.tipster), [bets, filters.tipster]);
  const availableLeagues = useMemo(() => uniqueValues(bets, 'league', filters.league), [bets, filters.league]);
  const availableTypes = [
    ...new Set(
      [...Object.keys(TICKET_TYPE_LABELS), ...bets.map((bet) => bet.ticket_type), filters.ticketType].filter(Boolean)
    ),
  ].sort();

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  const patchFilters = (patch) => {
    const next = { ...filters, ...patch };
    if (patch.period && patch.period !== 'custom') {
      next.from = '';
      next.to = '';
    }
    setSearchParams(toSearch(next), { replace: true });
    setCurrentPage(1);
  };

  const fetchData = useCallback(() => invalidateTrackerData(), []);

  useEffect(() => {
    setSearchInput(filters.q);
  }, [filters.q]);

  useEffect(() => {
    if (searchInput === filters.q) return undefined;
    const timer = setTimeout(() => {
      setSearchParams(
        (prev) => {
          const current = parseFilters(prev);
          return toSearch({ ...current, q: searchInput });
        },
        { replace: true }
      );
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput, filters.q, setSearchParams]);

  useEffect(() => {
    if (isError) toast.error('Kunne ikke laste spill');
  }, [isError]);

  useEffect(() => {
    setCurrentPage(1);
  }, [apiSearch, filters.q, sortKey, sortDir]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) return;
      if (document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const closeTicket = () => {
    setTicketOpen(false);
    setTicketBet(null);
    setTicketMode('view');
  };

  const openBetDetails = (bet) => {
    setTicketBet(bet);
    setTicketMode('view');
    setTicketOpen(true);
  };

  const openCreateDialog = () => {
    setTicketBet(null);
    setTicketMode('create');
    setTicketOpen(true);
  };

  const handleSubmit = async (values) => {
    try {
      if (ticketMode === 'edit' && ticketBet) {
        const response = await fetchWithTimeout(`${BACKEND_URL}/api/bets/${ticketBet.bet_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(toUpdatePayload(values)),
        });
        if (!response.ok) throw new Error('Kunne ikke oppdatere spill');
        toast.success('Spill oppdatert');
      } else {
        const response = await fetchWithTimeout(`${BACKEND_URL}/api/bets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(toCreatePayload(values)),
        });
        if (!response.ok) throw new Error('Kunne ikke opprette spill');
        toast.success('Spill lagt til');
      }
      closeTicket();
      await fetchData();
    } catch (error) {
      console.error('Error saving bet:', error);
      toast.error('Kunne ikke lagre spill');
    }
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
      await fetchData();
      return true;
    } catch (error) {
      console.error('Error deleting bet:', error);
      toast.error('Kunne ikke slette spill');
      return false;
    }
  };

  const handleRowKeyDown = (event, bet) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openBetDetails(bet);
    }
  };

  const handleSort = (key) => {
    const next = nextSortState(sortKey, sortDir, key);
    setSortKey(next.key);
    setSortDir(next.dir);
  };

  const toggleExpanded = (betId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(betId)) next.delete(betId);
      else next.add(betId);
      return next;
    });
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
  const moreCount = [filters.tipster, filters.league, filters.ticketType, filters.oddsRange].filter(Boolean).length;

  const periodChipValue = period === 'custom' ? `${filters.from || '…'} – ${filters.to || '…'}` : periodLabel;
  const chips = [
    { key: 'period', label: 'Periode', on: period && period !== 'all', value: periodChipValue },
    { key: 'status', label: 'Status', on: filters.status, value: STATUS_LABELS[filters.status] || filters.status },
    { key: 'sport', label: 'Sport', on: filters.sport, value: filters.sport },
    { key: 'bookie', label: 'Bookmaker', on: filters.bookie, value: filters.bookie },
    { key: 'tipster', label: 'Tipster', on: filters.tipster, value: filters.tipster },
    { key: 'league', label: 'Liga', on: filters.league, value: filters.league },
    {
      key: 'ticketType',
      label: 'Type',
      on: filters.ticketType,
      value: TICKET_TYPE_LABELS[filters.ticketType] || filters.ticketType,
    },
    { key: 'oddsRange', label: 'Odds', on: filters.oddsRange, value: filters.oddsRange },
    { key: 'q', label: 'Søk', on: filters.q, value: `«${filters.q}»` },
  ]
    .filter((chip) => chip.on)
    .map((chip) => ({ ...chip, clear: chip.key === 'period' ? { period: '', from: '', to: '' } : { [chip.key]: '' } }));

  const clearChip = (chip) => {
    if (chip.key === 'q') setSearchInput('');
    patchFilters(chip.clear);
  };

  const clearAll = () => {
    setSearchInput('');
    setSearchParams('', { replace: true });
    setCurrentPage(1);
  };

  const columnCount = SORT_COLUMNS.length + 1;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Spillogg"
        title="Spill"
        subtitle="Søk, filtrer og rediger kupongene dine"
        testId="bets-title"
        action={
          <Button data-testid="add-bet-btn" onClick={openCreateDialog}>
            <Plus />
            Nytt spill
          </Button>
        }
      />

      <div data-testid="bets-kpis">
        <MetricRail columns="sm:grid-cols-3" wideFrom="sm">
          <Metric
            label="Aktive spill"
            testId="kpi-active-bets"
            onClick={() => patchFilters({ status: 'pending' })}
            ariaLabel={`${kpis.count} aktive spill. Vis åpne spill.`}
            value={kpis.count}
            hint="Venter på oppgjør"
          />
          <Metric
            label="Aktiv innsats"
            testId="kpi-active-stake"
            onClick={() => patchFilters({ status: 'pending' })}
            value={<Money value={kpis.stake} currency={currency} />}
            hint="Total innsats i åpne spill"
          />
          <Metric
            label="Potensiell gevinst"
            testId="kpi-potential"
            onClick={() => patchFilters({ status: 'pending' })}
            value={<Money value={kpis.potential} currency={currency} signed />}
            hint={`Utbetaling ${formatCurrency(kpis.stake + kpis.potential, currency, 0)} om alle går inn`}
          />
        </MetricRail>
      </div>

      <section aria-label="Filtre" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <Input
              ref={searchRef}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Søk kamp, marked, sport…"
              aria-label="Søk i spill"
              className="h-9 pl-8 pr-9"
              data-testid="bets-search"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
              <Kbd>/</Kbd>
            </span>
          </div>

          <FilterSelect
            value={period && period !== 'all' ? period : ''}
            placeholder="Dato"
            allLabel="Alle datoer"
            icon={CalendarDays}
            options={PERIODS.filter((item) => item.value !== 'all')}
            onChange={(value) => patchFilters(value ? { period: value } : { period: '', from: '', to: '' })}
            testId="filter-date"
            renderLabel={() => periodLabel}
          />
          <FilterSelect
            value={filters.status}
            placeholder="Status"
            allLabel="Alle statuser"
            options={['won', 'lost', 'push', 'pending', 'cashed'].map((value) => ({
              value,
              label: STATUS_LABELS[value],
            }))}
            onChange={(value) => patchFilters({ status: value })}
            testId="filter-status"
            renderLabel={(value) => STATUS_LABELS[value] || value}
          />
          <FilterSelect
            value={filters.sport}
            placeholder="Sport"
            allLabel="Alle sporter"
            options={availableSports}
            onChange={(value) => patchFilters({ sport: value })}
            testId="filter-sport"
          />
          <FilterSelect
            value={filters.bookie}
            placeholder="Bookmaker"
            allLabel="Alle bookier"
            options={availableBookies}
            onChange={(value) => patchFilters({ bookie: value })}
            testId="filter-bookie"
          />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowMoreFilters(!showMoreFilters)}
            aria-expanded={showMoreFilters}
            aria-controls="more-filters"
            className="h-9"
          >
            <SlidersHorizontal className="!size-3.5" />
            {showMoreFilters ? 'Færre filtre' : 'Flere filtre'}
            {moreCount ? (
              <span className="rounded-full bg-primary/15 px-1.5 text-[10.5px] font-semibold text-primary figure">
                {moreCount}
              </span>
            ) : null}
          </Button>

          <div className="ml-auto flex items-center gap-2">
            <Segmented label="Visning" size="sm" options={VIEW_OPTIONS} value={view} onChange={setView} />
          </div>
        </div>

        {showMoreFilters ? (
          <div id="more-filters" className="flex animate-fade-in flex-wrap items-center gap-2">
            <FilterSelect
              value={filters.tipster}
              placeholder="Tags og tipstere"
              allLabel="Alle tipstere"
              options={availableTipsters}
              onChange={(value) => patchFilters({ tipster: value })}
              testId="filter-tipster"
            />
            <FilterSelect
              value={filters.league}
              placeholder="Liga"
              allLabel="Alle ligaer"
              options={availableLeagues}
              onChange={(value) => patchFilters({ league: value })}
            />
            <FilterSelect
              value={filters.ticketType}
              placeholder="Type"
              allLabel="Alle typer"
              options={availableTypes.map((type) => ({ value: type, label: TICKET_TYPE_LABELS[type] || type }))}
              onChange={(value) => patchFilters({ ticketType: value })}
              renderLabel={(value) => TICKET_TYPE_LABELS[value] || value}
            />
            <FilterSelect
              value={filters.oddsRange}
              placeholder="Odds"
              allLabel="Alle odds"
              options={ODDS_RANGES}
              onChange={(value) => patchFilters({ oddsRange: value })}
            />
          </div>
        ) : null}

        {period === 'custom' ? (
          <div className="grid max-w-xl animate-fade-in grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="dateFrom" className="eyebrow mb-1.5 block">
                Fra dato
              </Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.from}
                onChange={(e) => patchFilters({ period: 'custom', from: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="dateTo" className="eyebrow mb-1.5 block">
                Til dato
              </Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.to}
                onChange={(e) => patchFilters({ period: 'custom', to: e.target.value })}
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline pt-3">
          {chips.length ? (
            <ul className="flex flex-wrap items-center gap-1.5" aria-label="Aktive filtre">
              {chips.map((chip) => (
                <li key={chip.key}>
                  <button
                    type="button"
                    onClick={() => clearChip(chip)}
                    aria-label={`Fjern filter ${chip.label}: ${chip.value}`}
                    className="group inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface-2 pl-2 pr-1.5 text-xs transition-colors hover:border-text-muted/50 hover:bg-elevated"
                  >
                    <span className="text-text-muted">{chip.label}</span>
                    <span className="font-medium text-text-primary">{chip.value}</span>
                    <X className="h-3 w-3 text-text-muted group-hover:text-text-primary" />
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={clearAll}
                  className="h-7 rounded-md px-2 text-xs text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
                >
                  Nullstill
                </button>
              </li>
            </ul>
          ) : (
            <span className="text-xs text-text-muted">Ingen filtre aktive</span>
          )}
          <p
            className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted figure"
            aria-live="polite"
          >
            <span>
              <span className="font-medium text-text-primary">{sortedBets.length}</span> spill
              {isFetching ? (
                <span className="ml-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              ) : null}
            </span>
            <span>
              Innsats <Money value={totals.stake} currency={currency} digits={0} className="text-text-secondary" />
            </span>
            <span>
              Resultat <Money value={totals.result} currency={currency} digits={0} signed />
            </span>
          </p>
        </div>
      </section>

      {isPending && bets.length === 0 ? (
        <LedgerSkeleton />
      ) : view === 'grid' ? (
        <div>
          {sortedBets.length === 0 ? (
            <div className="panel">
              <EmptyState icon={Inbox} title="Ingen spill treffer filtrene" description="Prøv å fjerne et filter." />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <TooltipProvider delayDuration={300}>
              <table className="w-full min-w-[1000px]">
                <thead>
                  <tr className="border-b border-hairline bg-sunken/60">
                    <th scope="col" className="w-10 pl-4">
                      <span className="sr-only">Bein</span>
                    </th>
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
                      <td colSpan={columnCount}>
                        <EmptyState
                          icon={Inbox}
                          title="Ingen spill treffer filtrene"
                          description="Prøv å fjerne et filter, eller legg inn et nytt spill."
                        />
                      </td>
                    </tr>
                  ) : (
                    currentBets.map((bet) => {
                      const legs = betLegs(bet);
                      const expandable = legs.length > 1;
                      const isOpen = expandable && expanded.has(bet.bet_id);
                      const detailId = `legs-${bet.bet_id}`;
                      return (
                        <Fragment key={bet.bet_id}>
                          <tr
                            data-testid={`bet-row-${bet.bet_id}`}
                            tabIndex={0}
                            aria-label={`Vis detaljer for ${bet.game}`}
                            onClick={() => openBetDetails(bet)}
                            onKeyDown={(event) => handleRowKeyDown(event, bet)}
                            className={cn(
                              'interactive-row border-b border-hairline',
                              isOpen && 'border-b-transparent bg-elevated/30'
                            )}
                          >
                            <td className="relative w-10 py-2.5 pl-4">
                              <span
                                className={cn(
                                  'absolute inset-y-0 left-0 w-[2px] opacity-70',
                                  statusDotClass(bet.status)
                                )}
                                aria-hidden="true"
                              />
                              {expandable ? (
                                <button
                                  type="button"
                                  aria-expanded={isOpen}
                                  aria-controls={detailId}
                                  aria-label={`${isOpen ? 'Skjul' : 'Vis'} ${legs.length} bein`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleExpanded(bet.bet_id);
                                  }}
                                  className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70"
                                >
                                  <ChevronRight
                                    className={cn(
                                      'h-3.5 w-3.5 transition-transform duration-200 ease-out',
                                      isOpen && 'rotate-90'
                                    )}
                                  />
                                </button>
                              ) : null}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-xs text-text-secondary figure">
                              {formatBetDate(bet.date, bet.time)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5">
                              <SportCell bet={bet} />
                            </td>
                            <td className="px-3 py-2.5">
                              <BetSummary bet={bet} showSelection={false} className="max-w-[260px]" />
                            </td>
                            <td className="px-3 py-2.5">
                              <SelectionCell bet={bet} />
                            </td>
                            <td className="px-3 py-2.5">
                              <BookmakerLogo name={bet.bookie} />
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right text-[13px]">
                              <Money value={bet.stake} currency={currency} />
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right text-[13px] text-text-secondary figure">
                              {Number(bet.odds || 0).toFixed(2)}
                            </td>
                            <td className="whitespace-nowrap py-2.5 pl-3 pr-5">
                              <StatusCell bet={bet} currency={currency} />
                            </td>
                          </tr>
                          {isOpen ? (
                            <tr className="border-b border-hairline bg-elevated/30">
                              <td />
                              <td colSpan={columnCount - 1} className="pb-3 pr-5">
                                <LegsDetail bet={bet} id={detailId} />
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </TooltipProvider>
          </div>
        </div>
      )}

      {sortedBets.length > 0 ? (
        <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Sider">
          <p className="text-xs text-text-muted figure">
            Viser <span className="font-medium text-text-primary">{startIndex + 1}</span>–
            <span className="font-medium text-text-primary">{Math.min(endIndex, sortedBets.length)}</span> av{' '}
            <span className="font-medium text-text-primary">{sortedBets.length}</span> spill
          </p>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="Forrige side"
            >
              <ChevronLeft />
              <span className="hidden sm:inline">Forrige</span>
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              const showPage =
                page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1);
              const showEllipsisBefore = page === currentPage - 2 && currentPage > 3;
              const showEllipsisAfter = page === currentPage + 2 && currentPage < totalPages - 2;

              if (showEllipsisBefore || showEllipsisAfter) {
                return (
                  <span key={page} className="px-1.5 text-xs text-text-muted">
                    …
                  </span>
                );
              }

              if (!showPage) return null;

              const active = currentPage === page;
              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => handlePageChange(page)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'h-8 min-w-8 rounded-md px-2 text-xs font-medium transition-colors figure focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70',
                    active
                      ? 'bg-elevated text-text-primary shadow-[inset_0_0_0_1px_rgb(var(--border))]'
                      : 'text-text-secondary hover:bg-elevated/60 hover:text-text-primary'
                  )}
                >
                  {page}
                </button>
              );
            })}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label="Neste side"
            >
              <span className="hidden sm:inline">Neste</span>
              <ChevronRight />
            </Button>
          </div>
        </nav>
      ) : null}

      <BetTicketDialog
        open={ticketOpen}
        mode={ticketMode}
        bet={ticketBet}
        currency={currency}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeTicket();
        }}
        onRequestEdit={() => setTicketMode('edit')}
        onDelete={async (bet) => {
          const deleted = await handleDelete(bet.bet_id);
          if (deleted) closeTicket();
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
