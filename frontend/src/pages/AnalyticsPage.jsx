import { FileDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { formatCurrency } from '../lib/format';
import { exportAnalyticsToPDF } from '../utils/pdfExport';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

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
        // Determine days parameter
        const daysParam = dateRange === 'custom' ? 365 : dateRange;

        // Build sport filter
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
        setChartData(chartDataRes);
        setSportStats(sportData);
        setOddsRangeStats(oddsData);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Kunne ikke laste analyse');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange, selectedSport]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const pieData = [
    { name: 'Vunnet', value: stats?.won_count || 0, color: '#10B981' },
    { name: 'Tapt', value: stats?.lost_count || 0, color: '#EF4444' },
    { name: 'Push', value: stats?.push_count || 0, color: '#A1A1AA' },
    { name: 'Cashout', value: stats?.cashed_count || 0, color: '#F59E0B' },
    { name: 'Åpne', value: stats?.pending_count || 0, color: '#3B82F6' },
  ];

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
                await exportAnalyticsToPDF(stats, currency);
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

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-[#18181B] border border-[#27272A] rounded-lg p-4">
        {/* Date Range Filter */}
        <div>
          <Label className="text-xs text-text-secondary mb-2 block">Periode</Label>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Siste 7 dager</SelectItem>
              <SelectItem value="30">Siste 30 dager</SelectItem>
              <SelectItem value="90">Siste 90 dager</SelectItem>
              <SelectItem value="365">Siste år</SelectItem>
              <SelectItem value="all">Alle</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sport Filter */}
        <div>
          <Label className="text-xs text-text-secondary mb-2 block">Sport</Label>
          <Select value={selectedSport} onValueChange={setSelectedSport}>
            <SelectTrigger>
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
        </div>

        {/* Chart Type Toggle */}
        <div>
          <Label className="text-xs text-text-secondary mb-2 block">Diagram</Label>
          <Select value={chartType} onValueChange={setChartType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="line">Linje</SelectItem>
              <SelectItem value="bar">Søyle</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quick Stats Display */}
        <div className="flex flex-col justify-center">
          <p className="text-xs text-text-secondary">Viser</p>
          <p className="text-lg font-bold text-primary">{stats?.total_bets || 0} spill</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-6">
          <p className="text-text-secondary text-sm mb-2">Snittinnsats</p>
          <p className="text-3xl font-bold font-mono">
            {formatCurrency((stats?.total_stake || 0) / (stats?.total_bets || 1), currency)}
          </p>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-6">
          <p className="text-text-secondary text-sm mb-2">Treffprosent</p>
          <p className="text-3xl font-bold font-mono text-primary">{(stats?.win_rate || 0).toFixed(1)}%</p>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-6">
          <p className="text-text-secondary text-sm mb-2">Streak nå</p>
          <p
            className={`text-3xl font-bold font-mono ${
              stats?.current_streak_type === 'won'
                ? 'text-primary'
                : stats?.current_streak_type === 'lost'
                  ? 'text-destructive'
                  : 'text-white'
            }`}
          >
            {stats?.current_streak || 0}{' '}
            {stats?.current_streak_type ? (stats.current_streak_type === 'won' ? 'W' : 'L') : '-'}
          </p>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-6">
          <p className="text-text-secondary text-sm mb-2">Beste streak</p>
          <p className="text-3xl font-bold font-mono text-primary">{stats?.best_win_streak || 0}W</p>
          <p className="text-xs text-text-muted mt-1">Verst: {stats?.worst_loss_streak || 0}T</p>
        </div>
      </div>

      {/* Cumulative P/L Chart */}
      <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-6">
          Akkumulert P/L
          {dateRange === '7' && ' (7 dager)'}
          {dateRange === '30' && ' (30 dager)'}
          {dateRange === '90' && ' (90 dager)'}
          {dateRange === '365' && ' (siste år)'}
          {dateRange === 'all' && ' (alle)'}
        </h2>
        <ResponsiveContainer width="100%" height={400}>
          {chartType === 'line' ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
              <XAxis dataKey="date" stroke="#A1A1AA" style={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }} />
              <YAxis stroke="#A1A1AA" style={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181B',
                  border: '1px solid #10B981',
                  borderRadius: '8px',
                  fontFamily: 'JetBrains Mono',
                }}
                formatter={(value) => formatCurrency(value, currency)}
              />
              <Line
                type="monotone"
                dataKey="cumulative_pl"
                stroke="#10B981"
                strokeWidth={3}
                dot={false}
                name="Akkumulert P/L"
              />
            </LineChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
              <XAxis dataKey="date" stroke="#A1A1AA" style={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }} />
              <YAxis stroke="#A1A1AA" style={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181B',
                  border: '1px solid #10B981',
                  borderRadius: '8px',
                  fontFamily: 'JetBrains Mono',
                }}
                formatter={(value) => formatCurrency(value, currency)}
              />
              <Bar dataKey="cumulative_pl" name="Akkumulert P/L">
                {chartData.map((entry) => (
                  <Cell key={entry.date} fill={entry.cumulative_pl >= 0 ? '#10B981' : '#EF4444'} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Daily P/L Bar Chart */}
      <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-6">Daglig resultat</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData.slice(-30)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
            <XAxis dataKey="date" stroke="#A1A1AA" style={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }} />
            <YAxis stroke="#A1A1AA" style={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181B',
                border: '1px solid #10B981',
                borderRadius: '8px',
                fontFamily: 'JetBrains Mono',
              }}
              formatter={(value) => formatCurrency(value, currency)}
            />
            <Bar dataKey="daily_pl" fill="#10B981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Outcome Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-6">
          <h2 className="text-xl font-bold mb-6">Utfallsfordeling</h2>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-6">
          <h2 className="text-xl font-bold mb-6">Nøkkeltall</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
              <span className="text-text-secondary">Spill totalt</span>
              <span className="font-mono font-bold">{stats?.total_bets || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
              <span className="text-text-secondary">Vunnet</span>
              <span className="font-mono font-bold text-primary">{stats?.won_count || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
              <span className="text-text-secondary">Tapt</span>
              <span className="font-mono font-bold text-destructive">{stats?.lost_count || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
              <span className="text-text-secondary">Push</span>
              <span className="font-mono font-bold text-text-muted">{stats?.push_count || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
              <span className="text-text-secondary">Åpne</span>
              <span className="font-mono font-bold text-accent">{stats?.pending_count || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sport Performance */}
      <div className="glass-panel border border-[#27272A] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-6 flex items-center">
          <span className="w-1 h-6 bg-primary rounded-full mr-3"></span>
          Resultat per sport
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full enhanced-table">
            <thead>
              <tr className="border-b border-[#27272A]">
                <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Sport</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Spill</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Treff %</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Innsats</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Resultat</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">ROI</th>
              </tr>
            </thead>
            <tbody>
              {sportStats.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-text-muted">
                    Ingen sportdata
                  </td>
                </tr>
              ) : (
                sportStats.map((sport) => (
                  <tr key={sport.name} className="border-b border-[#27272A] hover:bg-white/5">
                    <td className="py-3 px-4 text-sm font-medium">{sport.name}</td>
                    <td className="py-3 px-4 text-sm font-mono text-right">{sport.bets}</td>
                    <td className="py-3 px-4 text-sm font-mono text-right">
                      <span className={sport.win_rate >= 50 ? 'text-primary' : 'text-text-secondary'}>
                        {sport.win_rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm font-mono text-right">{formatCurrency(sport.stake, currency)}</td>
                    <td
                      className={`py-3 px-4 text-sm font-mono font-bold text-right ${
                        sport.profit_loss >= 0 ? 'text-primary' : 'text-destructive'
                      }`}
                    >
                      {sport.profit_loss >= 0 ? '+' : ''}
                      {formatCurrency(sport.profit_loss, currency)}
                    </td>
                    <td
                      className={`py-3 px-4 text-sm font-mono font-bold text-right ${
                        sport.roi >= 0 ? 'text-primary' : 'text-destructive'
                      }`}
                    >
                      {sport.roi >= 0 ? '+' : ''}
                      {sport.roi.toFixed(2)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Odds Range Analysis */}
      <div className="glass-panel border border-[#27272A] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-6 flex items-center">
          <span className="w-1 h-6 bg-accent rounded-full mr-3"></span>
          Resultat per oddsintervall
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full enhanced-table">
            <thead>
              <tr className="border-b border-[#27272A]">
                <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Oddsintervall</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Spill</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Treff %</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Innsats</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Resultat</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">ROI</th>
              </tr>
            </thead>
            <tbody>
              {oddsRangeStats.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-text-muted">
                    Ingen oddsdata
                  </td>
                </tr>
              ) : (
                oddsRangeStats.map((range) => (
                  <tr key={range.name} className="border-b border-[#27272A] hover:bg-white/5">
                    <td className="py-3 px-4 text-sm font-medium">{range.name}</td>
                    <td className="py-3 px-4 text-sm font-mono text-right">{range.bets}</td>
                    <td className="py-3 px-4 text-sm font-mono text-right">
                      <span className={range.win_rate >= 50 ? 'text-primary' : 'text-text-secondary'}>
                        {range.win_rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm font-mono text-right">{formatCurrency(range.stake, currency)}</td>
                    <td
                      className={`py-3 px-4 text-sm font-mono font-bold text-right ${
                        range.profit_loss >= 0 ? 'text-primary' : 'text-destructive'
                      }`}
                    >
                      {range.profit_loss >= 0 ? '+' : ''}
                      {formatCurrency(range.profit_loss, currency)}
                    </td>
                    <td
                      className={`py-3 px-4 text-sm font-mono font-bold text-right ${
                        range.roi >= 0 ? 'text-primary' : 'text-destructive'
                      }`}
                    >
                      {range.roi >= 0 ? '+' : ''}
                      {range.roi.toFixed(2)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
