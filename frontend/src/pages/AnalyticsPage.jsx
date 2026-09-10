import { FileDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import PageHeader from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  betsPath,
  calendarPath,
  chartQuery,
  parseFilters,
  pickInsight,
  pieStatus,
  toAnalyticsApiSearch,
  toSearch,
} from '../lib/filters';
import { formatCurrency } from '../lib/format';
import { exportAnalyticsToPDF } from '../utils/pdfExport';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const cardClass = 'bg-[#18181B] border border-[#27272A] rounded-xl p-4';
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
const tooltipStyle = {
  backgroundColor: '#18181B',
  border: '1px solid #27272A',
  borderRadius: '8px',
  fontSize: '12px',
};

function signedClass(value) {
  if (value > 0) return 'text-primary';
  if (value < 0) return 'text-destructive';
  return '';
}

function apiUrl(path, qs) {
  return qs ? `${BACKEND_URL}${path}?${qs}` : `${BACKEND_URL}${path}`;
}

async function readJson(response, fallback) {
  if (!response.ok) return fallback;
  const data = await response.json();
  return data == null ? fallback : data;
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
    if (row?.name) names.add(row.name);
  });
  if (extra) names.add(extra);
  return [...names].sort();
}

function BreakdownTable({ title, nameHeader, rows, empty, currency, rowTo }) {
  const sorted = [...rows].sort((a, b) => (b.profit_loss || 0) - (a.profit_loss || 0));

  return (
    <div className={`${cardClass} p-6`}>
      {title ? <h2 className="text-base font-bold mb-4">{title}</h2> : null}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#27272A] text-left text-xs text-text-secondary">
              <th className="py-2 pr-3 font-medium">{nameHeader}</th>
              <th className="py-2 pr-3 font-medium text-right">Spill</th>
              <th className="py-2 pr-3 font-medium text-right">Treff %</th>
              <th className="py-2 pr-3 font-medium text-right">Innsats</th>
              <th className="py-2 pr-3 font-medium text-right">Resultat</th>
              <th className="py-2 font-medium text-right">ROI</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-8 text-sm text-text-muted">
                  {empty}
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr key={row.name} className="border-b border-[#27272A]/50">
                  <td className="py-2.5 pr-3 text-sm font-medium">
                    {rowTo ? (
                      <Link to={rowTo(row)} className="text-primary hover:underline">
                        {row.name}
                      </Link>
                    ) : (
                      row.name
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-sm font-mono text-right">{row.bets}</td>
                  <td className="py-2.5 pr-3 text-sm font-mono text-right">{(row.win_rate || 0).toFixed(1)}%</td>
                  <td className="py-2.5 pr-3 text-sm font-mono text-right">{formatCurrency(row.stake, currency)}</td>
                  <td className={`py-2.5 pr-3 text-sm font-mono text-right ${signedClass(row.profit_loss)}`}>
                    {row.profit_loss >= 0 ? '+' : ''}
                    {formatCurrency(row.profit_loss, currency)}
                  </td>
                  <td className={`py-2.5 text-sm font-mono text-right ${signedClass(row.roi)}`}>
                    {row.roi >= 0 ? '+' : ''}
                    {(row.roi || 0).toFixed(1)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseFilters(searchParams);
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [sportStats, setSportStats] = useState([]);
  const [leagueStats, setLeagueStats] = useState([]);
  const [oddsRangeStats, setOddsRangeStats] = useState([]);
  const [bookieStats, setBookieStats] = useState([]);
  const [tipsterStats, setTipsterStats] = useState([]);
  const [ticketTypeStats, setTicketTypeStats] = useState([]);
  const [sportOptions, setSportOptions] = useState([]);
  const [bookieOptions, setBookieOptions] = useState([]);
  const [tipsterOptions, setTipsterOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState('line');
  const currency = user?.currency || 'NOK';
  const period = filters.period || 'all';
  const dataQs = toAnalyticsApiSearch(filters);
  const chartQs = chartQuery(filters);
  const optionQs = toAnalyticsApiSearch({ period: filters.period, from: filters.from, to: filters.to });
  const spillPath = betsPath(filters);
  const settledPath = betsPath(filters);
  const streakPath = betsPath({ ...filters, period: '', from: '', to: '' });

  const patchFilters = (patch) => {
    const next = { ...filters, ...patch };
    if (patch.period && patch.period !== 'custom') {
      next.from = '';
      next.to = '';
    }
    setSearchParams(toSearch(next), { replace: true });
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!BACKEND_URL) {
        toast.error('Backend-URL mangler');
        setLoading(false);
        return;
      }

      try {
        const [
          statsRes,
          chartRes,
          sportRes,
          leagueRes,
          oddsRes,
          bookieRes,
          tipsterRes,
          typeRes,
          sportOptRes,
          bookieOptRes,
          tipsterOptRes,
        ] = await Promise.all([
          fetch(apiUrl('/api/analytics/stats', dataQs), { credentials: 'include' }),
          fetch(apiUrl('/api/analytics/chart', chartQs), { credentials: 'include' }),
          fetch(apiUrl('/api/analytics/sports', dataQs), { credentials: 'include' }),
          fetch(apiUrl('/api/analytics/leagues', dataQs), { credentials: 'include' }),
          fetch(apiUrl('/api/analytics/odds-range', dataQs), { credentials: 'include' }),
          fetch(apiUrl('/api/analytics/bookmakers', dataQs), { credentials: 'include' }),
          fetch(apiUrl('/api/analytics/tipsters', dataQs), { credentials: 'include' }),
          fetch(apiUrl('/api/analytics/ticket-types', dataQs), { credentials: 'include' }),
          fetch(apiUrl('/api/analytics/sports', optionQs), { credentials: 'include' }),
          fetch(apiUrl('/api/analytics/bookmakers', optionQs), { credentials: 'include' }),
          fetch(apiUrl('/api/analytics/tipsters', optionQs), { credentials: 'include' }),
        ]);

        const statsData = await readJson(statsRes, null);
        const chartDataRes = await readJson(chartRes, []);
        const sportData = await readJson(sportRes, []);
        const leagueData = await readJson(leagueRes, []);
        const oddsData = await readJson(oddsRes, []);
        const bookieData = await readJson(bookieRes, []);
        const tipsterData = await readJson(tipsterRes, []);
        const typeData = await readJson(typeRes, []);
        const sportOptData = await readJson(sportOptRes, []);
        const bookieOptData = await readJson(bookieOptRes, []);
        const tipsterOptData = await readJson(tipsterOptRes, []);

        setStats(statsData && !Array.isArray(statsData) ? statsData : null);
        setChartData(Array.isArray(chartDataRes) ? chartDataRes : []);
        setSportStats(Array.isArray(sportData) ? sportData : []);
        setLeagueStats(Array.isArray(leagueData) ? leagueData : []);
        setOddsRangeStats(Array.isArray(oddsData) ? oddsData : []);
        setBookieStats(Array.isArray(bookieData) ? bookieData : []);
        setTipsterStats(Array.isArray(tipsterData) ? tipsterData : []);
        setTicketTypeStats(Array.isArray(typeData) ? typeData : []);
        setSportOptions(uniqueNames(sportOptData, filters.sport));
        setBookieOptions(uniqueNames(bookieOptData, filters.bookie));
        setTipsterOptions(uniqueNames(tipsterOptData, filters.tipster));
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Kunne ikke laste analyse');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dataQs, chartQs, optionQs, filters.sport, filters.bookie, filters.tipster]);

  const goToChartDate = (state) => {
    const date = state?.activeLabel || state?.activePayload?.[0]?.payload?.date;
    if (!date) return;
    navigate(calendarPath({ date, month: String(date).slice(0, 7) }));
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-[#18181B] border border-[#27272A] rounded-xl h-20 shimmer" />
        ))}
      </div>
    );
  }

  const pieData = [
    { name: 'Vunnet', value: stats?.won_count || 0, color: '#10B981' },
    { name: 'Tapt', value: stats?.lost_count || 0, color: '#EF4444' },
    { name: 'Push', value: stats?.push_count || 0, color: '#A1A1AA' },
    { name: 'Cashout', value: stats?.cashed_count || 0, color: '#F59E0B' },
    { name: 'Åpne', value: stats?.pending_count || 0, color: '#3B82F6' },
  ].filter((item) => item.value > 0);
  const pl = stats?.total_profit_loss || 0;
  const avgStake = (stats?.total_stake || 0) / (stats?.total_bets || 1);
  const dailyData = chartData.length > 40 ? chartData.slice(-40) : chartData;
  const bestSport = pickInsight(sportStats, 'best');
  const worstOdds = pickInsight(oddsRangeStats, 'worst');
  const bestBookie = pickInsight(bookieStats, 'best');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analyse"
        subtitle="Resultat fordelt på tid, sport og odds"
        testId="analytics-title"
        action={
          <Button
            variant="secondary"
            onClick={async () => {
              try {
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
            }}
            className="bg-white/5 hover:bg-white/10 border border-white/10"
            data-testid="export-analytics-pdf-btn"
          >
            <FileDown className="w-4 h-4 mr-2" />
            PDF
          </Button>
        }
      />

      <div className={`${cardClass} flex flex-col gap-3`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {PERIODS.map((item) => (
              <button
                key={item.value}
                type="button"
                data-testid={`analytics-period-${item.value}`}
                onClick={() => patchFilters({ period: item.value === 'all' ? '' : item.value })}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  period === item.value
                    ? 'bg-primary text-black font-medium'
                    : 'bg-white/5 text-text-secondary hover:bg-white/10'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-text-secondary whitespace-nowrap">
              <Link
                to={spillPath}
                className="font-mono font-medium text-white hover:text-primary"
                data-testid="analytics-bets-count"
              >
                {stats?.total_bets || 0}
              </Link>{' '}
              spill
            </p>
            <Link
              to={spillPath}
              className="text-sm text-primary hover:underline whitespace-nowrap"
              data-testid="analytics-view-bets"
            >
              Vis spill →
            </Link>
          </div>
        </div>

        {period === 'custom' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              type="date"
              value={filters.from}
              onChange={(event) => patchFilters({ period: 'custom', from: event.target.value })}
              className="bg-black/20 border-white/10 h-9"
              aria-label="Fra dato"
            />
            <Input
              type="date"
              value={filters.to}
              onChange={(event) => patchFilters({ period: 'custom', to: event.target.value })}
              className="bg-black/20 border-white/10 h-9"
              aria-label="Til dato"
            />
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            value={filters.sport || 'all'}
            onValueChange={(value) => patchFilters({ sport: value === 'all' ? '' : value })}
          >
            <SelectTrigger className="bg-black/20 border-white/10 h-9" data-testid="analytics-sport-filter">
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
            <SelectTrigger className="bg-black/20 border-white/10 h-9" data-testid="analytics-bookie-filter">
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
            <SelectTrigger className="bg-black/20 border-white/10 h-9" data-testid="analytics-tipster-filter">
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
        </div>
      </div>

      {bestSport || worstOdds || bestBookie ? (
        <div className="flex flex-wrap gap-2">
          {bestSport ? (
            <Link
              to={betsPath({ ...filters, sport: bestSport.name })}
              className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm hover:bg-primary/20"
              data-testid="insight-best-sport"
            >
              Beste sport: {bestSport.name}
            </Link>
          ) : null}
          {worstOdds ? (
            <Link
              to={betsPath({ ...filters, oddsRange: worstOdds.name })}
              className="px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-sm hover:bg-destructive/20"
              data-testid="insight-worst-odds"
            >
              Svakeste odds: {worstOdds.name}
            </Link>
          ) : null}
          {bestBookie ? (
            <Link
              to={betsPath({ ...filters, bookie: bestBookie.name })}
              className="px-3 py-1.5 rounded-full bg-white/5 text-sm hover:bg-white/10"
              data-testid="insight-best-bookie"
            >
              Beste bookie: {bestBookie.name}
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Link
          to={settledPath}
          className={`${cardClass} hover:border-white/20 transition-colors`}
          data-testid="analytics-kpi-result"
        >
          <p className="text-xs text-text-secondary mb-1">Resultat</p>
          <p className={`text-2xl font-bold font-mono ${signedClass(pl)}`}>
            {pl >= 0 ? '+' : ''}
            {formatCurrency(pl, currency)}
          </p>
        </Link>
        <Link
          to={settledPath}
          className={`${cardClass} hover:border-white/20 transition-colors`}
          data-testid="analytics-kpi-roi"
        >
          <p className="text-xs text-text-secondary mb-1">ROI</p>
          <p className={`text-2xl font-bold font-mono ${signedClass(stats?.roi || 0)}`}>
            {(stats?.roi || 0).toFixed(1)}%
          </p>
        </Link>
        <Link
          to={settledPath}
          className={`${cardClass} hover:border-white/20 transition-colors`}
          data-testid="analytics-kpi-winrate"
        >
          <p className="text-xs text-text-secondary mb-1">Treffprosent</p>
          <p className="text-2xl font-bold font-mono">{(stats?.win_rate || 0).toFixed(1)}%</p>
        </Link>
        <Link
          to={settledPath}
          className={`${cardClass} hover:border-white/20 transition-colors`}
          data-testid="analytics-kpi-avg-stake"
        >
          <p className="text-xs text-text-secondary mb-1">Snittinnsats</p>
          <p className="text-2xl font-bold font-mono">{formatCurrency(avgStake, currency)}</p>
        </Link>
        <Link
          to={streakPath}
          className={`${cardClass} col-span-2 lg:col-span-1 hover:border-white/20 transition-colors`}
          data-testid="analytics-kpi-streak"
        >
          <p className="text-xs text-text-secondary mb-1">Streak</p>
          <p
            className={`text-2xl font-bold font-mono ${
              stats?.current_streak_type === 'won'
                ? 'text-primary'
                : stats?.current_streak_type === 'lost'
                  ? 'text-destructive'
                  : ''
            }`}
          >
            {stats?.current_streak || 0}
            {stats?.current_streak_type === 'won' ? ' V' : stats?.current_streak_type === 'lost' ? ' T' : ''}
          </p>
          <p className="text-[11px] text-text-muted mt-1">
            Beste {stats?.best_win_streak || 0}V · Verst {stats?.worst_loss_streak || 0}T
          </p>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={`lg:col-span-8 ${cardClass} p-6`}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-base font-bold">Akkumulert resultat · {periodLabel(filters)}</h2>
            <div className="flex rounded-lg border border-[#27272A] overflow-hidden shrink-0">
              <button
                type="button"
                onClick={() => setChartType('line')}
                className={`px-3 py-1 text-xs ${chartType === 'line' ? 'bg-white/10 text-white' : 'text-text-secondary'}`}
              >
                Linje
              </button>
              <button
                type="button"
                onClick={() => setChartType('bar')}
                className={`px-3 py-1 text-xs ${chartType === 'bar' ? 'bg-white/10 text-white' : 'text-text-secondary'}`}
              >
                Søyle
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            {chartType === 'line' ? (
              <AreaChart data={chartData} onClick={goToChartDate} style={{ cursor: 'pointer' }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                <XAxis dataKey="date" stroke="#71717A" style={{ fontSize: '11px' }} />
                <YAxis stroke="#71717A" style={{ fontSize: '11px' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(value, currency)} />
                <Area
                  type="monotone"
                  dataKey="cumulative_pl"
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="#10B98122"
                  name="P/L"
                />
              </AreaChart>
            ) : (
              <BarChart data={chartData} onClick={goToChartDate} style={{ cursor: 'pointer' }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                <XAxis dataKey="date" stroke="#71717A" style={{ fontSize: '11px' }} />
                <YAxis stroke="#71717A" style={{ fontSize: '11px' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(value, currency)} />
                <Bar dataKey="cumulative_pl" name="P/L" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.date} fill={entry.cumulative_pl >= 0 ? '#10B981' : '#EF4444'} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className={`lg:col-span-4 ${cardClass} p-6`}>
          <h2 className="text-base font-bold mb-4">Fordeling</h2>
          {pieData.length === 0 ? (
            <p className="text-sm text-text-muted py-12 text-center">Ingen oppgjorte spill i utvalget</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                    style={{ cursor: 'pointer' }}
                    onClick={(entry) => {
                      const status = pieStatus(entry?.name);
                      if (status) navigate(betsPath({ ...filters, status }));
                    }}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {pieData.map((item) => (
                  <Link
                    key={item.name}
                    to={betsPath({ ...filters, status: pieStatus(item.name) })}
                    className="flex items-center justify-between hover:bg-white/5 rounded-md px-1 -mx-1"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm text-text-secondary">{item.name}</span>
                    </div>
                    <span className="text-sm font-mono">{item.value}</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className={`${cardClass} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">Daglig resultat</h2>
          {chartData.length > 40 ? <p className="text-xs text-text-muted">Siste 40 dager med aktivitet</p> : null}
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dailyData} onClick={goToChartDate} style={{ cursor: 'pointer' }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
            <XAxis dataKey="date" stroke="#71717A" style={{ fontSize: '11px' }} />
            <YAxis stroke="#71717A" style={{ fontSize: '11px' }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(value, currency)} />
            <Bar dataKey="daily_pl" name="P/L" radius={[3, 3, 0, 0]}>
              {dailyData.map((entry) => (
                <Cell key={entry.date} fill={entry.daily_pl >= 0 ? '#10B981' : '#EF4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <Tabs defaultValue="sport">
        <TabsList className="bg-white/5 h-auto flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="sport" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
            Sport
          </TabsTrigger>
          <TabsTrigger value="league" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
            Liga
          </TabsTrigger>
          <TabsTrigger value="odds" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
            Odds
          </TabsTrigger>
          <TabsTrigger value="bookie" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
            Bookie
          </TabsTrigger>
          <TabsTrigger value="tipster" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
            Tipster
          </TabsTrigger>
          <TabsTrigger value="type" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
            Type
          </TabsTrigger>
        </TabsList>
        <TabsContent value="sport">
          <BreakdownTable
            nameHeader="Sport"
            rows={sportStats}
            empty="Ingen sportdata"
            currency={currency}
            rowTo={(row) => betsPath({ ...filters, sport: row.name })}
          />
        </TabsContent>
        <TabsContent value="league">
          <BreakdownTable
            nameHeader="Liga"
            rows={leagueStats}
            empty="Ingen ligadata"
            currency={currency}
            rowTo={(row) => betsPath({ ...filters, league: row.name })}
          />
        </TabsContent>
        <TabsContent value="odds">
          <BreakdownTable
            nameHeader="Odds"
            rows={oddsRangeStats}
            empty="Ingen oddsdata"
            currency={currency}
            rowTo={(row) => betsPath({ ...filters, oddsRange: row.name })}
          />
        </TabsContent>
        <TabsContent value="bookie">
          <BreakdownTable
            nameHeader="Bookie"
            rows={bookieStats}
            empty="Ingen bookiedata"
            currency={currency}
            rowTo={(row) => betsPath({ ...filters, bookie: row.name })}
          />
        </TabsContent>
        <TabsContent value="tipster">
          <BreakdownTable
            nameHeader="Tipster"
            rows={tipsterStats}
            empty="Ingen tipsterdata"
            currency={currency}
            rowTo={(row) => betsPath({ ...filters, tipster: row.name })}
          />
        </TabsContent>
        <TabsContent value="type">
          <BreakdownTable
            nameHeader="Type"
            rows={ticketTypeStats}
            empty="Ingen typedata"
            currency={currency}
            rowTo={(row) => betsPath({ ...filters, ticketType: row.name })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
