import { ArrowUpRight, FileDown, Landmark, Target, TrendingDown, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import DailyResultChart from '../components/DailyResultChart';
import DailyTurnoverChart from '../components/DailyTurnoverChart';
import { SplitBar, ZeroMeter } from '../components/ds/Metric';
import Money from '../components/ds/Money';
import OutcomeBar from '../components/ds/OutcomeBar';
import { Panel, SectionHeader, TextLink } from '../components/ds/Section';
import Segmented from '../components/ds/Segmented';
import PageHeader from '../components/PageHeader';
import PerformanceChart, { PerformanceLegend } from '../components/PerformanceChart';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { betsPath, calendarPath, chartQuery, parseFilters, pickInsight, toSearch } from '../lib/filters';
import { formatCurrency, formatPercent } from '../lib/format';
import { useAnalyticsSummary } from '../lib/queries';
import { STATUS_COLORS } from '../lib/theme';
import { curveSummary, maxAbs } from '../lib/tone';
import { cn } from '../lib/utils';

const PERIODS = [
  { value: '7', label: '7 d' },
  { value: '30', label: '30 d' },
  { value: '90', label: '90 d' },
  { value: '365', label: 'År' },
  { value: 'all', label: 'Alle' },
  { value: 'custom', label: 'Periode' },
];
const PERIOD_TITLES = {
  7: '7 dager',
  30: '30 dager',
  90: '90 dager',
  365: 'siste år',
  all: 'hele perioden',
  custom: 'valgt periode',
};
const CHART_TYPES = [
  { value: 'line', label: 'Linje' },
  { value: 'bar', label: 'Søyle' },
];
const BREAKDOWNS = [
  { value: 'sport', label: 'Sport', key: 'sports', empty: 'Ingen sportdata', filter: 'sport' },
  { value: 'league', label: 'Liga', key: 'leagues', empty: 'Ingen ligadata', filter: 'league' },
  { value: 'odds', label: 'Odds', key: 'odds_range', empty: 'Ingen oddsdata', filter: 'oddsRange' },
  { value: 'bookie', label: 'Bookie', key: 'bookmakers', empty: 'Ingen bookiedata', filter: 'bookie' },
  { value: 'tipster', label: 'Tipster', key: 'tipsters', empty: 'Ingen tipsterdata', filter: 'tipster' },
  { value: 'type', label: 'Type', key: 'ticket_types', empty: 'Ingen typedata', filter: 'ticketType' },
];

function signedClass(value) {
  if (value > 0) return 'text-primary';
  if (value < 0) return 'text-destructive';
  return '';
}

function periodLabel(filters) {
  if (filters.period === 'custom' && (filters.from || filters.to)) {
    return `${filters.from || '…'} – ${filters.to || '…'}`;
  }
  return PERIOD_TITLES[filters.period || 'all'];
}

function uniqueNames(rows, extra) {
  const names = new Set();
  (rows || []).forEach((row) => {
    if (typeof row === 'string' && row) names.add(row);
    else if (row?.name) names.add(row.name);
  });
  if (extra) names.add(extra);
  return [...names].sort();
}

function asRows(value) {
  return Array.isArray(value) ? value : [];
}

function KpiRow({ label, to, testId, value, hint, children }) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className="group block px-5 py-4 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="eyebrow">{label}</span>
        <span className="font-heading text-[19px] font-semibold leading-none tracking-tight figure">{value}</span>
      </span>
      {hint ? (
        <span className="mt-1.5 flex items-center justify-between gap-3 text-[11px] text-text-muted">
          {hint}
          <ArrowUpRight
            className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            aria-hidden="true"
          />
        </span>
      ) : null}
      {children}
    </Link>
  );
}

function Insight({ to, icon: Icon, label, name, value, tone, testId }) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className="group flex min-w-0 items-center gap-3 rounded-lg border border-hairline bg-surface px-3.5 py-2.5 transition-colors hover:border-border hover:bg-surface-2"
    >
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
          tone === 'neg' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
        )}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="eyebrow block">{label}</span>
        <span className="mt-0.5 flex items-baseline gap-2 text-[13px]">
          <span className="truncate font-medium text-text-primary">{name}</span>
          {value}
        </span>
      </span>
    </Link>
  );
}

function BreakdownTable({ nameHeader, rows, empty, currency, rowTo }) {
  const sorted = [...rows].sort((a, b) => (b.profit_loss || 0) - (a.profit_loss || 0));
  const roiMax = Math.max(10, maxAbs(sorted.map((row) => row.roi)));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px]">
        <thead>
          <tr className="border-b border-hairline bg-sunken/60 text-left">
            <th scope="col" className="eyebrow px-5 py-2.5 font-medium">
              {nameHeader}
            </th>
            <th scope="col" className="eyebrow px-3 py-2.5 text-right font-medium">
              Spill
            </th>
            <th scope="col" className="eyebrow px-3 py-2.5 text-right font-medium">
              Treff %
            </th>
            <th scope="col" className="eyebrow px-3 py-2.5 text-right font-medium">
              Innsats
            </th>
            <th scope="col" className="eyebrow px-3 py-2.5 text-right font-medium">
              Resultat
            </th>
            <th scope="col" className="eyebrow w-[30%] px-5 py-2.5 font-medium">
              ROI
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {sorted.length === 0 ? (
            <tr>
              <td colSpan="6" className="py-12 text-center text-[13px] text-text-muted">
                {empty}
              </td>
            </tr>
          ) : (
            sorted.map((row) => {
              const roi = row.roi || 0;
              const width = Math.min(1, Math.abs(roi) / roiMax) * 50;
              return (
                <tr key={row.name} className="transition-colors hover:bg-elevated/40">
                  <td className="px-5 py-2.5 text-[13px] font-medium">
                    {rowTo ? (
                      <Link
                        to={rowTo(row)}
                        className="rounded-sm text-text-primary underline-offset-4 hover:text-primary hover:underline"
                      >
                        {row.name}
                      </Link>
                    ) : (
                      row.name
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[13px] text-text-secondary figure">{row.bets}</td>
                  <td className="px-3 py-2.5 text-right text-[13px] text-text-secondary figure">
                    {formatPercent(row.win_rate || 0)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-[13px]">
                    <Money value={row.stake} currency={currency} digits={0} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-[13px] font-medium">
                    <Money value={row.profit_loss} currency={currency} signed />
                  </td>
                  <td className="px-5 py-2.5">
                    <span className="flex items-center gap-3">
                      <span className="relative h-1.5 flex-1 rounded-full bg-elevated" aria-hidden="true">
                        <span className="absolute left-1/2 top-[-2px] h-[10px] w-px bg-text-muted/50" />
                        <span
                          className={cn(
                            'absolute top-0 h-full rounded-full',
                            roi >= 0 ? 'left-1/2 bg-primary' : 'right-1/2 bg-destructive'
                          )}
                          style={{ width: `${width}%` }}
                        />
                      </span>
                      <span className={cn('w-16 text-right text-[13px] font-medium figure', signedClass(roi))}>
                        {formatPercent(roi, 1, { signed: true })}
                      </span>
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Laster analyse">
      <div className="space-y-2">
        <div className="skeleton h-3 w-32" />
        <div className="skeleton h-7 w-32" />
      </div>
      <div className="skeleton h-12 w-full rounded-xl" />
      <div className="skeleton h-[460px] w-full rounded-xl" />
    </div>
  );
}

export default function AnalyticsPage() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseFilters(searchParams);
  const [chartType, setChartType] = useState('line');
  const currency = user?.currency || 'NOK';
  const period = filters.period || 'all';
  const summarySearch = chartQuery(filters);
  const { data: summary, isPending, isError, isFetching } = useAnalyticsSummary(summarySearch);
  const stats = summary?.stats && !Array.isArray(summary.stats) ? summary.stats : null;
  const chartData = useMemo(() => asRows(summary?.chart), [summary]);
  const curve = useMemo(() => curveSummary(chartData), [chartData]);
  const sportStats = asRows(summary?.sports);
  const leagueStats = asRows(summary?.leagues);
  const oddsRangeStats = asRows(summary?.odds_range);
  const bookieStats = asRows(summary?.bookmakers);
  const tipsterStats = asRows(summary?.tipsters);
  const ticketTypeStats = asRows(summary?.ticket_types);
  const sportOptions = uniqueNames(summary?.sport_options, filters.sport);
  const bookieOptions = uniqueNames(summary?.bookie_options, filters.bookie);
  const tipsterOptions = uniqueNames(summary?.tipster_options, filters.tipster);
  const spillPath = betsPath(filters);
  const settledPath = betsPath(filters);
  const streakPath = betsPath({ ...filters, period: '', from: '', to: '' });

  useEffect(() => {
    if (isError && !summary) toast.error('Kunne ikke laste analyse');
  }, [isError, summary]);

  const patchFilters = (patch) => {
    const next = { ...filters, ...patch };
    if (patch.period && patch.period !== 'custom') {
      next.from = '';
      next.to = '';
    }
    setSearchParams(toSearch(next), { replace: true });
  };

  const goToDate = (date) => {
    if (!date) return;
    navigate(calendarPath({ date, month: String(date).slice(0, 7) }));
  };

  if (isPending && !summary) return <AnalyticsSkeleton />;

  const outcomes = [
    { key: 'won', name: 'Vunnet', value: stats?.won_count || 0, color: STATUS_COLORS.won },
    { key: 'lost', name: 'Tapt', value: stats?.lost_count || 0, color: STATUS_COLORS.lost },
    { key: 'push', name: 'Push', value: stats?.push_count || 0, color: STATUS_COLORS.push },
    { key: 'cashed', name: 'Cashout', value: stats?.cashed_count || 0, color: STATUS_COLORS.cashed },
    { key: 'pending', name: 'Åpne', value: stats?.pending_count || 0, color: STATUS_COLORS.pending },
  ];
  const pl = stats?.total_profit_loss || 0;
  const roi = stats?.roi || 0;
  const avgStake = (stats?.total_stake || 0) / (stats?.total_bets || 1);
  const dailyData = chartData.length > 40 ? chartData.slice(-40) : chartData;
  const bestSport = pickInsight(sportStats, 'best');
  const worstOdds = pickInsight(oddsRangeStats, 'worst');
  const bestBookie = pickInsight(bookieStats, 'best');
  const streakType = stats?.current_streak_type;
  const breakdownRows = {
    sports: sportStats,
    leagues: leagueStats,
    odds_range: oddsRangeStats,
    bookmakers: bookieStats,
    tipsters: tipsterStats,
    ticket_types: ticketTypeStats,
  };

  const exportPdf = async () => {
    try {
      const { exportAnalyticsToPDF } = await import('../utils/pdfExport');
      await exportAnalyticsToPDF(stats, currency, {
        chartData,
        sportStats,
        leagueStats,
        oddsRangeStats,
        bookieStats,
        tipsterStats,
        ticketTypeStats,
        periodLabel: periodLabel(filters),
        sportLabel: filters.sport || 'Alle sporter',
        userName: user?.name,
      });
      toast.success('PDF eksportert');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Kunne ikke eksportere PDF');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Analyse · ${periodLabel(filters)}`}
        title="Analyse"
        subtitle="Resultat fordelt på tid, sport og odds"
        testId="analytics-title"
        action={
          <Button variant="secondary" size="sm" onClick={exportPdf} data-testid="export-analytics-pdf-btn">
            <FileDown />
            Eksporter PDF
          </Button>
        }
      />

      <section
        aria-label="Filtre"
        className="z-20 -mx-4 space-y-3 border-y border-hairline bg-background px-4 py-3 sm:-mx-6 sm:px-6 lg:sticky lg:top-0 lg:-mx-10 lg:px-10"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Periode"
            options={PERIODS.map((item) => ({ ...item, testId: `analytics-period-${item.value}` }))}
            value={period}
            onChange={(value) => patchFilters({ period: value === 'all' ? '' : value })}
          />
          <span className="mx-1 hidden h-5 w-px bg-hairline md:block" aria-hidden="true" />
          <Select
            value={filters.sport || 'all'}
            onValueChange={(value) => patchFilters({ sport: value === 'all' ? '' : value })}
          >
            <SelectTrigger
              className="h-9 w-auto min-w-[136px] data-[active=true]:border-primary/40 data-[active=true]:bg-primary/[0.06]"
              data-active={Boolean(filters.sport)}
              data-testid="analytics-sport-filter"
            >
              <SelectValue placeholder="Sport" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle sporter</SelectItem>
              {sportOptions.map((sport) => (
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
            <SelectTrigger
              className="h-9 w-auto min-w-[136px] data-[active=true]:border-primary/40 data-[active=true]:bg-primary/[0.06]"
              data-active={Boolean(filters.bookie)}
              data-testid="analytics-bookie-filter"
            >
              <SelectValue placeholder="Bookie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle bookier</SelectItem>
              {bookieOptions.map((bookie) => (
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
            <SelectTrigger
              className="h-9 w-auto min-w-[136px] data-[active=true]:border-primary/40 data-[active=true]:bg-primary/[0.06]"
              data-active={Boolean(filters.tipster)}
              data-testid="analytics-tipster-filter"
            >
              <SelectValue placeholder="Tipster" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle tipstere</SelectItem>
              {tipsterOptions.map((tipster) => (
                <SelectItem key={tipster} value={tipster}>
                  {tipster}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-4">
            <p className="text-[13px] text-text-secondary" aria-live="polite">
              {isFetching ? (
                <span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent align-middle" />
              ) : null}
              <Link
                to={spillPath}
                className="font-medium text-text-primary figure hover:text-primary"
                data-testid="analytics-bets-count"
              >
                {stats?.total_bets || 0}
              </Link>{' '}
              spill
            </p>
            <TextLink to={spillPath} data-testid="analytics-view-bets">
              Vis spill
            </TextLink>
          </div>
        </div>

        {period === 'custom' ? (
          <div className="grid max-w-xl animate-fade-in grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              type="date"
              value={filters.from}
              onChange={(event) => patchFilters({ period: 'custom', from: event.target.value })}
              aria-label="Fra dato"
            />
            <Input
              type="date"
              value={filters.to}
              onChange={(event) => patchFilters({ period: 'custom', to: event.target.value })}
              aria-label="Til dato"
            />
          </div>
        ) : null}
      </section>

      {bestSport || worstOdds || bestBookie ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {bestSport ? (
            <Insight
              to={betsPath({ ...filters, sport: bestSport.name })}
              testId="insight-best-sport"
              icon={Trophy}
              label="Beste sport"
              name={bestSport.name}
              value={<Money value={bestSport.profit_loss} currency={currency} digits={0} signed className="text-xs" />}
            />
          ) : null}
          {worstOdds ? (
            <Insight
              to={betsPath({ ...filters, oddsRange: worstOdds.name })}
              testId="insight-worst-odds"
              icon={TrendingDown}
              tone="neg"
              label="Svakeste odds"
              name={worstOdds.name}
              value={<Money value={worstOdds.profit_loss} currency={currency} digits={0} signed className="text-xs" />}
            />
          ) : null}
          {bestBookie ? (
            <Insight
              to={betsPath({ ...filters, bookie: bestBookie.name })}
              testId="insight-best-bookie"
              icon={Landmark}
              label="Beste bookie"
              name={bestBookie.name}
              value={<Money value={bestBookie.profit_loss} currency={currency} digits={0} signed className="text-xs" />}
            />
          ) : null}
        </div>
      ) : null}

      <Panel aria-labelledby="curve-title" className="grid overflow-hidden lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
            <div className="min-w-0">
              <p id="curve-title" className="eyebrow">
                Akkumulert resultat · {periodLabel(filters)}
              </p>
              <Link
                to={settledPath}
                data-testid="analytics-kpi-result"
                className="mt-3 inline-block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <Money
                  value={pl}
                  currency={currency}
                  signed
                  className="font-heading text-[40px] font-semibold leading-none tracking-[-0.04em] sm:text-[48px]"
                  unitClassName="ml-2 text-[0.36em] tracking-normal"
                  fractionClassName="text-[0.55em] tracking-normal"
                />
              </Link>
              <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                <div className="flex items-baseline gap-2">
                  <dt className="text-text-muted">Topp</dt>
                  <dd className="font-medium">
                    <Money value={curve.peak} currency={currency} digits={0} signed />
                  </dd>
                </div>
                <div className="flex items-baseline gap-2">
                  <dt className="text-text-muted">Bunn</dt>
                  <dd className="font-medium">
                    <Money value={curve.trough} currency={currency} digits={0} signed />
                  </dd>
                </div>
                <div className="flex items-baseline gap-2">
                  <dt className="text-text-muted">Største fall fra topp</dt>
                  <dd className="font-medium">
                    <Money value={curve.maxDrawdown} currency={currency} digits={0} signed />
                  </dd>
                </div>
              </dl>
            </div>
            <Segmented label="Graftype" size="sm" options={CHART_TYPES} value={chartType} onChange={setChartType} />
          </div>

          <div className="px-2 sm:px-3">
            <PerformanceChart
              data={chartData}
              currency={currency}
              mode={chartType}
              height={320}
              onDateSelect={goToDate}
              testId="analytics-performance-chart"
              emptyText="Ingen spill i utvalget"
            />
          </div>
          <div className="px-5 pb-5 pt-3 sm:px-6">
            {chartType === 'line' ? (
              <PerformanceLegend showDrawdown={curve.maxDrawdown < 0} />
            ) : (
              <p className="text-[11px] text-text-muted">Akkumulert resultat per dag med spill</p>
            )}
          </div>
        </div>

        <div className="flex flex-col border-t border-hairline lg:col-span-4 lg:border-l lg:border-t-0">
          <div className="divide-y divide-hairline">
            <KpiRow
              label="ROI"
              to={settledPath}
              testId="analytics-kpi-roi"
              value={<span className={signedClass(roi)}>{formatPercent(roi, 1, { signed: true })}</span>}
              hint={`på ${formatCurrency(stats?.total_stake || 0, currency, 0)} oppgjort`}
            >
              <ZeroMeter value={roi} label={`ROI ${formatPercent(roi)}`} />
            </KpiRow>
            <KpiRow
              label="Treffprosent"
              to={settledPath}
              testId="analytics-kpi-winrate"
              value={formatPercent(stats?.win_rate || 0)}
              hint={
                <span className="figure">
                  <span className="text-primary">{stats?.won_count || 0} V</span> ·{' '}
                  <span className="text-destructive">{stats?.lost_count || 0} T</span>
                </span>
              }
            >
              <SplitBar
                left={stats?.won_count || 0}
                right={stats?.lost_count || 0}
                label={`${stats?.won_count || 0} vunnet og ${stats?.lost_count || 0} tapt`}
              />
            </KpiRow>
            <KpiRow
              label="Snittinnsats"
              to={settledPath}
              testId="analytics-kpi-avg-stake"
              value={<Money value={avgStake} currency={currency} />}
              hint={`${stats?.total_bets || 0} spill i utvalget`}
            />
            <KpiRow
              label="Streak"
              to={streakPath}
              testId="analytics-kpi-streak"
              value={
                <span
                  className={streakType === 'won' ? 'text-primary' : streakType === 'lost' ? 'text-destructive' : ''}
                >
                  {stats?.current_streak || 0}
                  <span className="ml-1 text-[0.65em] font-medium text-text-secondary">
                    {streakType === 'won' ? 'V' : streakType === 'lost' ? 'T' : ''}
                  </span>
                </span>
              }
              hint={`Beste ${stats?.best_win_streak || 0} V · verst ${stats?.worst_loss_streak || 0} T`}
            />
          </div>
          <div className="mt-auto border-t border-hairline p-5">
            <div className="mb-3 flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
              <span className="eyebrow">Utfall</span>
            </div>
            <OutcomeBar items={outcomes} linkFor={(item) => betsPath({ ...filters, status: item.key })} />
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DailyResultChart
          data={dailyData}
          currency={currency}
          truncated={chartData.length > 40}
          onDateSelect={goToDate}
        />
        <DailyTurnoverChart
          data={dailyData}
          currency={currency}
          truncated={chartData.length > 40}
          onDateSelect={goToDate}
        />
      </div>

      <section aria-labelledby="breakdown-title" className="space-y-3">
        <Tabs defaultValue="sport">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeader
              id="breakdown-title"
              eyebrow="Fordeling"
              title="Hvor kommer resultatet fra?"
              description="Sortert etter resultat. Klikk et navn for å se spillene."
            />
            <TabsList className="h-auto flex-wrap justify-start">
              {BREAKDOWNS.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {BREAKDOWNS.map((item) => (
            <TabsContent key={item.value} value={item.value}>
              <Panel as="div" className="overflow-hidden">
                <BreakdownTable
                  nameHeader={item.label}
                  rows={breakdownRows[item.key]}
                  empty={item.empty}
                  currency={currency}
                  rowTo={(row) => betsPath({ ...filters, [item.filter]: row.name })}
                />
              </Panel>
            </TabsContent>
          ))}
        </Tabs>
      </section>
    </div>
  );
}
