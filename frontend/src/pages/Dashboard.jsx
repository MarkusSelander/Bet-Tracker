import { FileDown, Hourglass, Inbox } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import BetSummary from '../components/BetSummary';
import BetTicketDialog from '../components/BetTicketDialog';
import { formatShortDate } from '../components/ds/ChartTooltip';
import Delta from '../components/ds/Delta';
import HeatStrip from '../components/ds/HeatStrip';
import { Metric, MetricRail, SplitBar, ZeroMeter } from '../components/ds/Metric';
import Money from '../components/ds/Money';
import OutcomeBar from '../components/ds/OutcomeBar';
import { EmptyState, Panel, SectionHeader, TextLink } from '../components/ds/Section';
import StatusBadge from '../components/ds/StatusBadge';
import PageHeader from '../components/PageHeader';
import PerformanceChart, { PerformanceLegend } from '../components/PerformanceChart';
import { Button } from '../components/ui/button';
import { computeActiveKpis, formatBetDate, getMatchSummary } from '../lib/betsDisplay';
import { missingComboLegs } from '../lib/betTicket';
import { localDateKey } from '../lib/calendar';
import { analyticsPath, betsPath, calendarPath, periodToRange } from '../lib/filters';
import { formatCurrency, formatPercent } from '../lib/format';
import { useBet, useDashboard, usePreviousDashboardSummary } from '../lib/queries';
import { STATUS_COLORS } from '../lib/theme';
import { curveSummary, delta } from '../lib/tone';

const PENDING_PREVIEW = 6;

function formatPoints(value) {
  return `${value.toLocaleString('nb-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pp`;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Laster oversikt">
      <div className="space-y-2">
        <div className="skeleton h-3 w-40" />
        <div className="skeleton h-7 w-36" />
      </div>
      <div className="panel space-y-6 p-6">
        <div className="skeleton h-12 w-64" />
        <div className="skeleton h-[280px] w-full" />
        <div className="skeleton h-7 w-full" />
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-[104px] rounded-none" />
        ))}
      </div>
    </div>
  );
}

function ExposurePanel({ bets, currency, onOpen }) {
  const kpis = computeActiveKpis(bets);
  const payout = kpis.stake + kpis.potential;
  const ordered = useMemo(() => [...bets].sort((a, b) => (Number(b.stake) || 0) - (Number(a.stake) || 0)), [bets]);
  const largest = ordered[0];
  const largestShare = kpis.stake > 0 && largest ? ((Number(largest.stake) || 0) / kpis.stake) * 100 : 0;

  return (
    <Panel aria-labelledby="exposure-title" className="flex flex-col">
      <div className="p-5 pb-4">
        <SectionHeader
          id="exposure-title"
          eyebrow="Eksponering"
          title="Åpne spill"
          action={
            <TextLink to={betsPath({ status: 'pending' })} data-testid="dashboard-pending-link">
              {kpis.count} åpne
            </TextLink>
          }
        />
      </div>

      {bets.length === 0 ? (
        <EmptyState
          icon={Hourglass}
          title="Ingen åpne spill"
          description="Når du har spill som venter på oppgjør, ser du innsats og mulig utbetaling her."
          className="py-10"
        />
      ) : (
        <>
          <dl className="grid grid-cols-3 border-y border-hairline">
            <div className="px-5 py-3.5">
              <dt className="eyebrow">I spill</dt>
              <dd className="mt-1.5 text-[17px] font-semibold font-heading">
                <Money value={kpis.stake} currency={currency} digits={0} />
              </dd>
            </div>
            <div className="border-l border-hairline px-5 py-3.5">
              <dt className="eyebrow">Mulig utbetaling</dt>
              <dd className="mt-1.5 text-[17px] font-semibold font-heading">
                <Money value={payout} currency={currency} digits={0} />
              </dd>
            </div>
            <div className="border-l border-hairline px-5 py-3.5">
              <dt className="eyebrow">Mulig gevinst</dt>
              <dd className="mt-1.5 text-[17px] font-semibold font-heading">
                <Money value={kpis.potential} currency={currency} digits={0} signed />
              </dd>
            </div>
          </dl>

          <div className="px-5 pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="eyebrow">Fordeling av innsats</span>
              {ordered.length > 1 ? (
                <span className="text-[11px] text-text-muted figure">
                  Største spill {largestShare.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} %
                </span>
              ) : null}
            </div>
            <div
              className="mt-2 flex h-1.5 gap-[2px] overflow-hidden rounded-full"
              role="img"
              aria-label={`Innsatsen er fordelt på ${ordered.length} åpne spill`}
            >
              {ordered.map((bet, index) => (
                <span
                  key={bet.bet_id}
                  className="h-full bg-accent first:rounded-l-full last:rounded-r-full"
                  style={{
                    flexGrow: Number(bet.stake) || 0,
                    flexBasis: 0,
                    opacity: Math.max(0.28, 1 - index * 0.12),
                  }}
                />
              ))}
            </div>
          </div>

          <ul className="mt-3 flex-1 divide-y divide-hairline">
            {ordered.slice(0, PENDING_PREVIEW).map((bet) => (
              <li key={bet.bet_id}>
                <button
                  type="button"
                  data-testid={`pending-bet-${bet.bet_id}`}
                  aria-label={`Vis detaljer for ${getMatchSummary(bet).primary || bet.game}`}
                  onClick={() => onOpen(bet)}
                  className="interactive-row grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3 text-left"
                >
                  <BetSummary bet={bet} />
                  <div className="text-right">
                    <p className="text-[13px] font-medium figure">
                      <Money value={bet.stake} currency={currency} digits={0} />
                      <span className="mx-1.5 text-text-muted">@</span>
                      <span className="text-text-secondary">{Number(bet.odds || 0).toFixed(2)}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-text-muted figure">
                      til {formatCurrency((Number(bet.stake) || 0) * (Number(bet.odds) || 0), currency, 0)}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {ordered.length > PENDING_PREVIEW ? (
            <div className="border-t border-hairline px-5 py-3">
              <TextLink to={betsPath({ status: 'pending' })}>
                {ordered.length - PENDING_PREVIEW} flere åpne spill
              </TextLink>
            </div>
          ) : null}
        </>
      )}
    </Panel>
  );
}

function RecentBets({ bets, currency, onOpen, onKeyDown }) {
  return (
    <Panel aria-labelledby="recent-title" className="overflow-hidden">
      <div className="p-5 pb-3">
        <SectionHeader
          id="recent-title"
          eyebrow="Logg"
          title="Siste spill"
          action={<TextLink to={betsPath({ period: '30' })}>Se alle</TextLink>}
        />
      </div>
      {bets.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Ingen spill ennå"
          description="Legg inn ditt første spill fra Spill-siden, eller synk fra Coolbet."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-y border-hairline bg-sunken/60">
                <th scope="col" className="eyebrow px-5 py-2 font-medium">
                  Dato
                </th>
                <th scope="col" className="eyebrow px-3 py-2 font-medium">
                  Kamp
                </th>
                <th scope="col" className="eyebrow px-3 py-2 text-right font-medium">
                  Odds
                </th>
                <th scope="col" className="eyebrow px-3 py-2 text-right font-medium">
                  Innsats
                </th>
                <th scope="col" className="eyebrow px-3 py-2 font-medium">
                  Status
                </th>
                <th scope="col" className="eyebrow px-5 py-2 text-right font-medium">
                  Resultat
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {bets.map((bet) => (
                <tr
                  key={bet.bet_id}
                  data-testid={`recent-bet-${bet.bet_id}`}
                  tabIndex={0}
                  aria-label={`Vis detaljer for ${getMatchSummary(bet).primary || bet.game}`}
                  onClick={() => onOpen(bet)}
                  onKeyDown={(event) => onKeyDown(event, bet)}
                  className="interactive-row"
                >
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-text-secondary figure">
                    {formatBetDate(bet.date, bet.time)}
                  </td>
                  <td className="max-w-[260px] px-3 py-3">
                    <BetSummary bet={bet} showSelection={false} />
                  </td>
                  <td className="px-3 py-3 text-right text-[13px] text-text-secondary figure">
                    {Number(bet.odds || 0).toFixed(2)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-[13px]">
                    <Money value={bet.stake} currency={currency} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={bet.status} size="sm" />
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right text-[13px] font-medium">
                    {bet.status === 'pending' ? (
                      <span className="text-text-muted">—</span>
                    ) : (
                      <Money value={bet.result} currency={currency} signed />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export default function Dashboard() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const [detailBet, setDetailBet] = useState(null);
  const currency = user?.currency || 'NOK';
  const { data: dashboard, isPending: dashboardPending, isError: dashboardError } = useDashboard();
  const { data: previous } = usePreviousDashboardSummary();
  const summary = dashboard?.summary;
  const recentBets = dashboard?.recent ?? [];
  const pendingBets = dashboard?.pending ?? [];
  const needsFullBet = Boolean(detailBet) && missingComboLegs(detailBet);
  const { data: fullDetailBet } = useBet(detailBet?.bet_id, { enabled: needsFullBet });
  const dialogBet = fullDetailBet || detailBet;
  const stats = summary?.stats || null;
  const prevStats = previous?.stats && !Array.isArray(previous.stats) ? previous.stats : null;
  const chartData = useMemo(() => (Array.isArray(summary?.chart) ? summary.chart : []), [summary]);
  const curve = useMemo(() => curveSummary(chartData), [chartData]);
  const todayKey = localDateKey();
  const window30 = periodToRange('30');

  useEffect(() => {
    if (dashboardError && !summary) toast.error('Kunne ikke laste oversikt');
  }, [dashboardError, summary]);

  if (dashboardPending && !dashboard) return <DashboardSkeleton />;

  const pl = stats?.total_profit_loss || 0;
  const roi = stats?.roi || 0;
  const winRate = stats?.win_rate || 0;
  const totalStake = stats?.total_stake || 0;
  const settled =
    (stats?.won_count || 0) + (stats?.lost_count || 0) + (stats?.push_count || 0) + (stats?.cashed_count || 0);
  const streakType = stats?.current_streak_type;
  const outcomes = [
    { key: 'won', name: 'Vunnet', value: stats?.won_count || 0, color: STATUS_COLORS.won },
    { key: 'lost', name: 'Tapt', value: stats?.lost_count || 0, color: STATUS_COLORS.lost },
    { key: 'push', name: 'Push', value: stats?.push_count || 0, color: STATUS_COLORS.push },
    { key: 'cashed', name: 'Cashout', value: stats?.cashed_count || 0, color: STATUS_COLORS.cashed },
    { key: 'pending', name: 'Åpne', value: stats?.pending_count || 0, color: STATUS_COLORS.pending },
  ];
  const vsPrevious = 'mot forrige 30 dager';

  const openBetDetails = (bet) => setDetailBet(bet);
  const handleRowKeyDown = (event, bet) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openBetDetails(bet);
    }
  };

  const exportPdf = async () => {
    try {
      const { exportDashboardToPDF } = await import('../utils/pdfExport');
      await exportDashboardToPDF(stats, chartData, recentBets, currency, {
        pendingBets,
        userName: user?.name,
      });
      toast.success('PDF eksportert');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Kunne ikke eksportere PDF');
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Siste 30 dager · ${formatShortDate(window30.from)} – i dag`}
        title="Oversikt"
        subtitle="Resultatkurve, nøkkeltall og åpne spill"
        testId="dashboard-title"
        action={
          <Button variant="secondary" size="sm" onClick={exportPdf} data-testid="export-pdf-btn">
            <FileDown />
            Eksporter PDF
          </Button>
        }
      />

      <Panel aria-labelledby="hero-title" className="overflow-hidden">
        <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p id="hero-title" className="eyebrow">
              Resultat · 30 dager
            </p>
            <Link
              to={analyticsPath({ period: '30' })}
              data-testid="profit-loss-card"
              className="mt-3 inline-block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              aria-label={`Resultat siste 30 dager. Åpne analyse.`}
            >
              <Money
                value={pl}
                currency={currency}
                signed
                className="font-heading text-[44px] font-semibold leading-none tracking-[-0.04em] sm:text-[56px]"
                unitClassName="ml-2 text-[0.34em] tracking-normal"
                fractionClassName="text-[0.55em] tracking-normal"
              />
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Delta
                value={prevStats ? delta(pl, prevStats.total_profit_loss || 0) : null}
                format={(value) => formatCurrency(value, currency, 0)}
                context={vsPrevious}
              />
              <span className="text-xs text-text-muted figure">
                ROI {formatPercent(roi, 1, { signed: true })} på {formatCurrency(totalStake, currency, 0)} oppgjort
              </span>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-x-6 gap-y-1 sm:gap-x-10">
            <div>
              <dt className="eyebrow">Topp</dt>
              <dd className="mt-1.5 text-[15px] font-semibold">
                <Money value={curve.peak} currency={currency} digits={0} signed />
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Bunn</dt>
              <dd className="mt-1.5 text-[15px] font-semibold">
                <Money value={curve.trough} currency={currency} digits={0} signed />
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Fra toppen</dt>
              <dd className="mt-1.5 text-[15px] font-semibold">
                {curve.drawdown < 0 ? (
                  <Money value={curve.drawdown} currency={currency} digits={0} signed />
                ) : (
                  <span className="text-primary">På topp</span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="px-2 sm:px-3">
          <PerformanceChart
            data={chartData}
            currency={currency}
            height={300}
            testId="dashboard-chart"
            onDateSelect={(date) => navigate(calendarPath({ date, month: String(date).slice(0, 7) }))}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4 pt-3 sm:px-6">
          <PerformanceLegend showDrawdown={curve.maxDrawdown < 0} />
          <TextLink to={analyticsPath({ period: '30' })} data-testid="dashboard-chart-link">
            Se analyse
          </TextLink>
        </div>
        <div className="border-t border-hairline bg-sunken/40 px-5 py-4 sm:px-6">
          <HeatStrip from={window30.from} to={window30.to} rows={chartData} currency={currency} todayKey={todayKey} />
        </div>
      </Panel>

      <MetricRail>
        <Metric
          label="ROI"
          to={analyticsPath({ period: '30' })}
          testId="roi-card"
          value={
            <span className={roi > 0 ? 'text-primary' : roi < 0 ? 'text-destructive' : ''}>
              {formatPercent(roi, 1, { signed: true })}
            </span>
          }
          hint={
            <Delta
              value={prevStats ? delta(roi, prevStats.roi || 0) : null}
              format={formatPoints}
              context="mot forrige"
            />
          }
        >
          <ZeroMeter value={roi} max={25} label={`ROI ${formatPercent(roi)}`} />
        </Metric>
        <Metric
          label="Treffprosent"
          to={analyticsPath({ period: '30' })}
          testId="win-rate-card"
          value={formatPercent(winRate)}
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
        </Metric>
        <Metric
          label="Spill totalt"
          to={analyticsPath({ period: '30' })}
          testId="total-bets-card"
          value={stats?.total_bets || 0}
          hint={`${settled} oppgjort · ${stats?.pending_count || 0} åpne`}
        />
        <Metric
          label="Omsatt"
          to={betsPath({ period: '30' })}
          value={<Money value={totalStake} currency={currency} digits={0} />}
          hint={
            settled ? `Snitt ${formatCurrency(totalStake / settled, currency, 0)} per spill` : 'Ingen oppgjorte spill'
          }
        />
        <Metric
          label="Streak"
          to={analyticsPath({ period: '30' })}
          testId="streak-card"
          value={
            <span className={streakType === 'won' ? 'text-primary' : streakType === 'lost' ? 'text-destructive' : ''}>
              {stats?.current_streak || 0}
              <span className="ml-1 text-[0.6em] font-medium text-text-secondary">
                {streakType === 'won' ? 'V' : streakType === 'lost' ? 'T' : ''}
              </span>
            </span>
          }
          hint={`Beste ${stats?.best_win_streak || 0} V · verste ${stats?.worst_loss_streak || 0} T`}
        />
      </MetricRail>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <RecentBets bets={recentBets} currency={currency} onOpen={openBetDetails} onKeyDown={handleRowKeyDown} />
        </div>
        <div className="space-y-6 xl:col-span-5">
          <ExposurePanel bets={pendingBets} currency={currency} onOpen={openBetDetails} />
          <Panel aria-labelledby="outcome-title" className="p-5">
            <SectionHeader
              id="outcome-title"
              eyebrow="Fordeling"
              title="Utfall siste 30 dager"
              action={<span className="text-xs text-text-muted figure">{stats?.total_bets || 0} spill</span>}
            />
            <OutcomeBar
              className="mt-4"
              items={outcomes}
              linkFor={(item) => betsPath({ period: '30', status: item.key })}
              testId="dashboard-outcomes"
            />
          </Panel>
        </div>
      </div>

      <BetTicketDialog
        bet={dialogBet}
        mode="view"
        open={Boolean(detailBet)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDetailBet(null);
        }}
        currency={currency}
      />
    </div>
  );
}
