import { FileDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
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
];
const PERIOD_TITLES = {
  7: '7 dager',
  30: '30 dager',
  90: '90 dager',
  365: 'siste år',
  all: 'hele perioden',
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

function BreakdownTable({ title, nameHeader, rows, empty, currency }) {
  const sorted = [...rows].sort((a, b) => (b.profit_loss || 0) - (a.profit_loss || 0));

  return (
    <div className={`${cardClass} p-6`}>
      <h2 className="text-base font-bold mb-4">{title}</h2>
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
                  <td className="py-2.5 pr-3 text-sm font-medium">{row.name}</td>
                  <td className="py-2.5 pr-3 text-sm font-mono text-right">{row.bets}</td>
                  <td className="py-2.5 pr-3 text-sm font-mono text-right">{row.win_rate.toFixed(1)}%</td>
                  <td className="py-2.5 pr-3 text-sm font-mono text-right">{formatCurrency(row.stake, currency)}</td>
                  <td className={`py-2.5 pr-3 text-sm font-mono text-right ${signedClass(row.profit_loss)}`}>
                    {row.profit_loss >= 0 ? '+' : ''}
                    {formatCurrency(row.profit_loss, currency)}
                  </td>
                  <td className={`py-2.5 text-sm font-mono text-right ${signedClass(row.roi)}`}>
                    {row.roi >= 0 ? '+' : ''}
                    {row.roi.toFixed(1)}%
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
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [sportStats, setSportStats] = useState([]);
  const [oddsRangeStats, setOddsRangeStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('90');
  const [selectedSport, setSelectedSport] = useState('all');
  const [chartType, setChartType] = useState('line');
  const currency = user?.currency || 'NOK';

  const availableSports = sportStats.map((s) => s.name).filter(Boolean);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const daysParam = dateRange === 'custom' ? 365 : dateRange;
        const sportParam = selectedSport !== 'all' ? `&sport=${selectedSport}` : '';

        const [statsRes, chartRes, sportRes, oddsRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/analytics/stats?sport=${selectedSport}`, {
            credentials: 'include',
          }),
          fetch(`${BACKEND_URL}/api/analytics/chart?days=${daysParam}${sportParam}`, {
            credentials: 'include',
          }),
          fetch(`${BACKEND_URL}/api/analytics/sports`, {
            credentials: 'include',
          }),
          fetch(`${BACKEND_URL}/api/analytics/odds-range`, {
            credentials: 'include',
          }),
        ]);

        const statsData = await statsRes.json();
        const chartDataRes = await chartRes.json();
        const sportData = await sportRes.json();
        const oddsData = await oddsRes.json();

        setStats(statsData);
        setChartData(Array.isArray(chartDataRes) ? chartDataRes : []);
        setSportStats(Array.isArray(sportData) ? sportData : []);
        setOddsRangeStats(Array.isArray(oddsData) ? oddsData : []);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Kunne ikke laste analyse');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange, selectedSport]);

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
  const visibleSports =
    selectedSport === 'all' ? sportStats : sportStats.filter((sport) => sport.name === selectedSport);

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
                  sportStats: visibleSports,
                  oddsRangeStats,
                  periodLabel: PERIOD_TITLES[dateRange],
                  sportLabel: selectedSport === 'all' ? 'Alle sporter' : selectedSport,
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

      <div className={`${cardClass} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((period) => (
            <button
              key={period.value}
              type="button"
              onClick={() => setDateRange(period.value)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                dateRange === period.value
                  ? 'bg-primary text-black font-medium'
                  : 'bg-white/5 text-text-secondary hover:bg-white/10'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedSport} onValueChange={setSelectedSport}>
            <SelectTrigger className="w-[180px] bg-black/20 border-white/10 h-9">
              <SelectValue />
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
          <p className="text-sm text-text-secondary whitespace-nowrap">
            <span className="font-mono font-medium text-white">{stats?.total_bets || 0}</span> spill
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className={cardClass}>
          <p className="text-xs text-text-secondary mb-1">Resultat</p>
          <p className={`text-2xl font-bold font-mono ${signedClass(pl)}`}>
            {pl >= 0 ? '+' : ''}
            {formatCurrency(pl, currency)}
          </p>
        </div>
        <div className={cardClass}>
          <p className="text-xs text-text-secondary mb-1">ROI</p>
          <p className={`text-2xl font-bold font-mono ${signedClass(stats?.roi || 0)}`}>
            {(stats?.roi || 0).toFixed(1)}%
          </p>
        </div>
        <div className={cardClass}>
          <p className="text-xs text-text-secondary mb-1">Treffprosent</p>
          <p className="text-2xl font-bold font-mono">{(stats?.win_rate || 0).toFixed(1)}%</p>
        </div>
        <div className={cardClass}>
          <p className="text-xs text-text-secondary mb-1">Snittinnsats</p>
          <p className="text-2xl font-bold font-mono">{formatCurrency(avgStake, currency)}</p>
        </div>
        <div className={`${cardClass} col-span-2 lg:col-span-1`}>
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={`lg:col-span-8 ${cardClass} p-6`}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-base font-bold">Akkumulert resultat · {PERIOD_TITLES[dateRange]}</h2>
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
              <AreaChart data={chartData}>
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
              <BarChart data={chartData}>
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
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm text-text-secondary">{item.name}</span>
                    </div>
                    <span className="text-sm font-mono">{item.value}</span>
                  </div>
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
          <BarChart data={dailyData}>
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

      <BreakdownTable
        title="Per sport"
        nameHeader="Sport"
        rows={visibleSports}
        empty="Ingen sportdata"
        currency={currency}
      />
      <BreakdownTable
        title="Per oddsintervall"
        nameHeader="Odds"
        rows={oddsRangeStats}
        empty="Ingen oddsdata"
        currency={currency}
      />
    </div>
  );
}
