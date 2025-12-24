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
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { exportAnalyticsToPDF } from '../utils/pdfExport';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const formatCurrency = (value, currency) => {
  if (currency === 'UNITS') return `${value.toFixed(2)} U`;
  if (currency === 'NOK') return `${value.toFixed(2)} kr`;
  return `$${value.toFixed(2)}`;
};

export default function AnalyticsPage() {
  const { user } = useOutletContext();
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [bookieStats, setBookieStats] = useState([]);
  const [tipsterStats, setTipsterStats] = useState([]);
  const [sportStats, setSportStats] = useState([]);
  const [oddsRangeStats, setOddsRangeStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('90');
  const [selectedSport, setSelectedSport] = useState('all');
  const [chartType, setChartType] = useState('line'); // 'line' or 'bar'
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const currency = user?.currency || 'USD';

  // Get available sports from sportStats
  const availableSports = sportStats.map((s) => s.sport).filter(Boolean);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Determine days parameter
        let daysParam = dateRange === 'custom' ? 365 : dateRange;

        // Build sport filter
        const sportParam = selectedSport !== 'all' ? `&sport=${selectedSport}` : '';

        const [statsRes, chartRes, bookieRes, tipsterRes, sportRes, oddsRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/analytics/stats?sport=${selectedSport}`, {
            credentials: 'include',
          }),
          fetch(`${BACKEND_URL}/api/analytics/chart?days=${daysParam}${sportParam}`, {
            credentials: 'include',
          }),
          fetch(`${BACKEND_URL}/api/analytics/bookmakers`, {
            credentials: 'include',
          }),
          fetch(`${BACKEND_URL}/api/analytics/tipsters`, {
            credentials: 'include',
          }),
          fetch(`${BACKEND_URL}/api/analytics/sports`, {
            credentials: 'include',
          }),
          fetch(`${BACKEND_URL}/api/analytics/odds-range`, {
            credentials: 'include',
          }),
        ]);

        const statsData = statsRes.ok ? await statsRes.json() : null;
        const chartDataRes = chartRes.ok ? await chartRes.json() : null;
        const bookieData = bookieRes.ok ? await bookieRes.json() : null;
        const tipsterData = tipsterRes.ok ? await tipsterRes.json() : null;
        const sportData = sportRes.ok ? await sportRes.json() : null;
        const oddsData = oddsRes.ok ? await oddsRes.json() : null;

        setStats(statsData);
        setChartData(Array.isArray(chartDataRes) ? chartDataRes : []);
        setBookieStats(Array.isArray(bookieData) ? bookieData : []);
        setTipsterStats(Array.isArray(tipsterData) ? tipsterData : []);
        setSportStats(Array.isArray(sportData) ? sportData : []);
        setOddsRangeStats(Array.isArray(oddsData) ? oddsData : []);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load analytics data');
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
    { name: 'Won', value: stats?.won_count || 0, color: '#10B981' },
    { name: 'Lost', value: stats?.lost_count || 0, color: '#EF4444' },
    { name: 'Push', value: stats?.push_count || 0, color: '#A1A1AA' },
    { name: 'Pending', value: stats?.pending_count || 0, color: '#3B82F6' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2" data-testid="analytics-title">
            Analytics
          </h1>
          <p className="text-text-secondary">Detailed insights into your betting performance</p>
        </div>
        <Button
          onClick={async () => {
            try {
              await exportAnalyticsToPDF(stats, bookieStats, tipsterStats, currency);
              toast.success('Analytics PDF exported successfully');
            } catch (error) {
              console.error('PDF export error:', error);
              toast.error('Failed to export PDF');
            }
          }}
          className="btn-primary-enhanced bg-primary hover:bg-primary/90 text-black font-bold shadow-[0_0_15px_rgba(16,185,129,0.4)]"
          data-testid="export-analytics-pdf-btn"
        >
          <FileDown className="w-4 h-4 mr-2" />
          Export PDF
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-[#18181B] border border-[#27272A] rounded-lg p-4">
        {/* Date Range Filter */}
        <div>
          <Label className="text-xs text-text-secondary mb-2 block">Date Range</Label>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
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
              <SelectItem value="all">All Sports</SelectItem>
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
          <Label className="text-xs text-text-secondary mb-2 block">Chart Type</Label>
          <Select value={chartType} onValueChange={setChartType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="line">Line Chart</SelectItem>
              <SelectItem value="bar">Bar Chart</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quick Stats Display */}
        <div className="flex flex-col justify-center">
          <p className="text-xs text-text-secondary">Showing</p>
          <p className="text-lg font-bold text-primary">{stats?.total_bets || 0} bets</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-6">
          <p className="text-text-secondary text-sm mb-2">Average Stake</p>
          <p className="text-3xl font-bold font-mono">
            {formatCurrency((stats?.total_stake || 0) / (stats?.total_bets || 1), currency)}
          </p>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-6">
          <p className="text-text-secondary text-sm mb-2">Win Rate</p>
          <p className="text-3xl font-bold font-mono text-primary">{(stats?.win_rate || 0).toFixed(1)}%</p>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-6">
          <p className="text-text-secondary text-sm mb-2">Current Streak</p>
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
          <p className="text-text-secondary text-sm mb-2">Best Streak</p>
          <p className="text-3xl font-bold font-mono text-primary">{stats?.best_win_streak || 0}W</p>
          <p className="text-xs text-text-muted mt-1">Worst: {stats?.worst_loss_streak || 0}L</p>
        </div>
      </div>

      {/* Cumulative P/L Chart */}
      <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-6">
          Cumulative Profit/Loss
          {dateRange === '7' && ' (Last 7 days)'}
          {dateRange === '30' && ' (Last 30 days)'}
          {dateRange === '90' && ' (Last 90 days)'}
          {dateRange === '365' && ' (Last year)'}
          {dateRange === 'all' && ' (All time)'}
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
                name="Cumulative P/L"
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
              <Bar dataKey="cumulative_pl" name="Cumulative P/L">
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.cumulative_pl >= 0 ? '#10B981' : '#EF4444'} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Daily P/L Bar Chart */}
      <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-6">Daily Profit/Loss</h2>
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
          <h2 className="text-xl font-bold mb-6">Outcome Distribution</h2>
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
                  {/* eslint-disable-next-line react/no-array-index-key */}
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-6">
          <h2 className="text-xl font-bold mb-6">Statistics Breakdown</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
              <span className="text-text-secondary">Total Bets</span>
              <span className="font-mono font-bold">{stats?.total_bets || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
              <span className="text-text-secondary">Won Bets</span>
              <span className="font-mono font-bold text-primary">{stats?.won_count || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
              <span className="text-text-secondary">Lost Bets</span>
              <span className="font-mono font-bold text-destructive">{stats?.lost_count || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
              <span className="text-text-secondary">Push Bets</span>
              <span className="font-mono font-bold text-text-muted">{stats?.push_count || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
              <span className="text-text-secondary">Pending Bets</span>
              <span className="font-mono font-bold text-accent">{stats?.pending_count || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sport Performance */}
      <div className="glass-panel border border-[#27272A] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-6 flex items-center">
          <span className="w-1 h-6 bg-primary rounded-full mr-3"></span>
          Performance by Sport
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full enhanced-table">
            <thead>
              <tr className="border-b border-[#27272A]">
                <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Sport</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Total Bets</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Win Rate</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Total Stake</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Result</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">ROI</th>
              </tr>
            </thead>
            <tbody>
              {sportStats.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-text-muted">
                    No sport data available
                  </td>
                </tr>
              ) : (
                // eslint-disable-next-line react/no-array-index-key
                sportStats.map((sport, index) => (
                  <tr key={index} className="border-b border-[#27272A] hover:bg-white/5">
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
          Performance by Odds Range
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full enhanced-table">
            <thead>
              <tr className="border-b border-[#27272A]">
                <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Odds Range</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Total Bets</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Win Rate</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Total Stake</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Result</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">ROI</th>
              </tr>
            </thead>
            <tbody>
              {oddsRangeStats.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-text-muted">
                    No odds range data available
                  </td>
                </tr>
              ) : (
                // eslint-disable-next-line react/no-array-index-key
                oddsRangeStats.map((range, index) => (
                  <tr key={index} className="border-b border-[#27272A] hover:bg-white/5">
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

      {/* Bookie Performance */}
      <div className="glass-panel border border-[#27272A] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-6 flex items-center">
          <span className="w-1 h-6 bg-accent rounded-full mr-3"></span>
          Bookie Performance
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full enhanced-table">
            <thead>
              <tr className="border-b border-[#27272A]">
                <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Bookie</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Total Bets</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Win Rate</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Total Stake</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Result</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">ROI</th>
              </tr>
            </thead>
            <tbody>
              {bookieStats.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-text-muted">
                    No bookie data available
                  </td>
                </tr>
              ) : (
                bookieStats
                  .sort((a, b) => b.profit_loss - a.profit_loss)
                  // eslint-disable-next-line react/no-array-index-key
                  .map((bm, index) => (
                    <tr key={index} className="border-b border-[#27272A] hover:bg-white/5">
                      <td className="py-3 px-4 text-sm font-medium">{bm.name}</td>
                      <td className="py-3 px-4 text-sm font-mono text-right">{bm.bets}</td>
                      <td className="py-3 px-4 text-sm font-mono text-right">
                        <span className={bm.win_rate >= 50 ? 'text-primary' : 'text-text-secondary'}>
                          {bm.win_rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm font-mono text-right">{formatCurrency(bm.stake, currency)}</td>
                      <td
                        className={`py-3 px-4 text-sm font-mono font-bold text-right ${
                          bm.profit_loss >= 0 ? 'text-primary' : 'text-destructive'
                        }`}
                      >
                        {bm.profit_loss >= 0 ? '+' : ''}
                        {formatCurrency(bm.profit_loss, currency)}
                      </td>
                      <td
                        className={`py-3 px-4 text-sm font-mono font-bold text-right ${
                          bm.roi >= 0 ? 'text-primary' : 'text-destructive'
                        }`}
                      >
                        {bm.roi >= 0 ? '+' : ''}
                        {bm.roi.toFixed(2)}%
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tipster Performance */}
      <div className="glass-panel border border-[#27272A] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-6 flex items-center">
          <span className="w-1 h-6 bg-primary rounded-full mr-3"></span>
          Tipster Performance
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full enhanced-table">
            <thead>
              <tr className="border-b border-[#27272A]">
                <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Tipster</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Total Bets</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Win Rate</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Total Stake</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Result</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">ROI</th>
              </tr>
            </thead>
            <tbody>
              {tipsterStats.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-text-muted">
                    No tipster data available
                  </td>
                </tr>
              ) : (
                tipsterStats
                  .sort((a, b) => b.profit_loss - a.profit_loss)
                  // eslint-disable-next-line react/no-array-index-key
                  .map((tip, index) => (
                    <tr key={index} className="border-b border-[#27272A] hover:bg-white/5">
                      <td className="py-3 px-4 text-sm font-medium">{tip.name}</td>
                      <td className="py-3 px-4 text-sm font-mono text-right">{tip.bets}</td>
                      <td className="py-3 px-4 text-sm font-mono text-right">
                        <span className={tip.win_rate >= 50 ? 'text-primary' : 'text-text-secondary'}>
                          {tip.win_rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm font-mono text-right">{formatCurrency(tip.stake, currency)}</td>
                      <td
                        className={`py-3 px-4 text-sm font-mono font-bold text-right ${
                          tip.profit_loss >= 0 ? 'text-primary' : 'text-destructive'
                        }`}
                      >
                        {tip.profit_loss >= 0 ? '+' : ''}
                        {formatCurrency(tip.profit_loss, currency)}
                      </td>
                      <td
                        className={`py-3 px-4 text-sm font-mono font-bold text-right ${
                          tip.roi >= 0 ? 'text-primary' : 'text-destructive'
                        }`}
                      >
                        {tip.roi >= 0 ? '+' : ''}
                        {tip.roi.toFixed(2)}%
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
