import { Calendar, FileDown, TrendingDown, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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
import { Calendar as CalendarComponent } from '../components/ui/calendar';
import { Label } from '../components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { exportAnalyticsToPDF } from '../utils/pdfExport';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const formatCurrency = (value, currency) => {
  if (currency === 'UNITS') return `${value.toFixed(2)} U`;
  if (currency === 'NOK') return `${value.toFixed(2)} kr`;
  return `$${value.toFixed(2)}`;
};

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('no-NO', { day: 'numeric', month: 'short' });
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

  // Period selection
  const [periodType, setPeriodType] = useState('preset'); // 'preset' or 'custom'
  const [presetPeriod, setPresetPeriod] = useState('30');
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);

  const [selectedSport, setSelectedSport] = useState('all');
  const currency = user?.currency || 'USD';

  // Get available sports from sportStats
  const availableSports = sportStats.map((s) => s.name).filter(Boolean);

  // Preset period options
  const presetPeriods = [
    { value: '7', label: 'Last 7 days' },
    { value: '30', label: 'Last 30 days' },
    { value: '90', label: 'Last 90 days' },
    { value: '180', label: 'Last 6 months' },
    { value: '365', label: 'This year' },
    { value: '-1', label: 'All time' },
  ];

  // Get current period label
  const getCurrentPeriodLabel = () => {
    if (periodType === 'preset') {
      const period = presetPeriods.find((p) => p.value === presetPeriod);
      return period?.label || 'Last 30 days';
    }
    if (customStartDate && customEndDate) {
      return `${customStartDate.toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })} - ${customEndDate.toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return 'Select dates';
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Build query parameters
        const params = new URLSearchParams();

        if (periodType === 'preset') {
          params.append('days', presetPeriod);
        } else if (customStartDate && customEndDate) {
          params.append('start_date', customStartDate.toISOString().split('T')[0]);
          params.append('end_date', customEndDate.toISOString().split('T')[0]);
        }

        if (selectedSport !== 'all') {
          params.append('sport', selectedSport);
        }

        const queryString = params.toString();

        const [statsRes, chartRes, bookieRes, tipsterRes, sportRes, oddsRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/analytics/stats?${queryString}`, {
            credentials: 'include',
          }),
          fetch(`${BACKEND_URL}/api/analytics/chart?${queryString}`, {
            credentials: 'include',
          }),
          fetch(`${BACKEND_URL}/api/analytics/bookmakers?${queryString}`, {
            credentials: 'include',
          }),
          fetch(`${BACKEND_URL}/api/analytics/tipsters?${queryString}`, {
            credentials: 'include',
          }),
          fetch(`${BACKEND_URL}/api/analytics/sports?${queryString}`, {
            credentials: 'include',
          }),
          fetch(`${BACKEND_URL}/api/analytics/odds-range?${queryString}`, {
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
  }, [presetPeriod, periodType, customStartDate, customEndDate, selectedSport]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-16 h-16 border-4 rounded-full border-primary border-t-transparent animate-spin"></div>
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
    <div className="pb-8 space-y-8">
      {/* Header with gradient */}
      <div className="relative p-8 overflow-hidden border rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border-primary/30">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="mb-3 text-5xl font-bold text-transparent bg-gradient-to-r from-white to-white/60 bg-clip-text">
              Analytics Dashboard
            </h1>
            <p className="text-lg text-text-secondary">Advanced insights for {getCurrentPeriodLabel()}</p>
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
            className="font-bold text-black transition-all duration-300 shadow-lg bg-primary hover:bg-primary/90 shadow-primary/30 hover:shadow-primary/50"
          >
            <FileDown className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Enhanced Filters Section */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Period Type Selector */}
        <div className="bg-gradient-to-br from-[#18181B] to-[#0F0F10] border border-[#27272A] rounded-xl p-5 shadow-xl">
          <Label className="block mb-3 text-sm font-semibold text-white">Period Type</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPeriodType('preset')}
              className={`py-2.5 px-4 rounded-lg font-medium transition-all duration-200 ${
                periodType === 'preset'
                  ? 'bg-primary text-black shadow-lg shadow-primary/30'
                  : 'bg-[#27272A] text-text-secondary hover:bg-[#3A3A3F]'
              }`}
            >
              Preset
            </button>
            <button
              onClick={() => setPeriodType('custom')}
              className={`py-2.5 px-4 rounded-lg font-medium transition-all duration-200 ${
                periodType === 'custom'
                  ? 'bg-primary text-black shadow-lg shadow-primary/30'
                  : 'bg-[#27272A] text-text-secondary hover:bg-[#3A3A3F]'
              }`}
            >
              Custom
            </button>
          </div>
        </div>

        {/* Period Selector */}
        {periodType === 'preset' ? (
          <div className="bg-gradient-to-br from-[#18181B] to-[#0F0F10] border border-[#27272A] rounded-xl p-5 shadow-xl">
            <Label className="block mb-3 text-sm font-semibold text-white">Select Period</Label>
            <Select value={presetPeriod} onValueChange={setPresetPeriod}>
              <SelectTrigger className="bg-[#27272A] border-[#3A3A3F] hover:bg-[#3A3A3F] transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {presetPeriods.map((period) => (
                  <SelectItem key={period.value} value={period.value}>
                    {period.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-[#18181B] to-[#0F0F10] border border-[#27272A] rounded-xl p-5 shadow-xl">
            <Label className="block mb-3 text-sm font-semibold text-white">Custom Date Range</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal bg-[#27272A] border-[#3A3A3F] hover:bg-[#3A3A3F]"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  {customStartDate && customEndDate
                    ? `${customStartDate.toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })} - ${customEndDate.toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })}`
                    : 'Select dates'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-4 space-y-4">
                  <div>
                    <Label className="block mb-2 text-xs text-text-secondary">Start Date</Label>
                    <CalendarComponent
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      disabled={(date) => date > new Date() || (customEndDate && date > customEndDate)}
                    />
                  </div>
                  <div>
                    <Label className="block mb-2 text-xs text-text-secondary">End Date</Label>
                    <CalendarComponent
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      disabled={(date) => date > new Date() || (customStartDate && date < customStartDate)}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Sport Filter */}
        <div className="bg-gradient-to-br from-[#18181B] to-[#0F0F10] border border-[#27272A] rounded-xl p-5 shadow-xl">
          <Label className="block mb-3 text-sm font-semibold text-white">Sport Filter</Label>
          <Select value={selectedSport} onValueChange={setSelectedSport}>
            <SelectTrigger className="bg-[#27272A] border-[#3A3A3F] hover:bg-[#3A3A3F] transition-colors">
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
      </div>

      {/* Key Performance Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Profit/Loss */}
        <div className="group relative overflow-hidden bg-gradient-to-br from-[#18181B] to-[#0F0F10] border border-[#27272A] rounded-xl p-4 shadow-xl hover:shadow-2xl hover:border-primary/50 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-primary/5 blur-3xl"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-text-secondary">Period Result</p>
              {stats?.total_profit_loss >= 0 ? (
                <TrendingUp className="w-4 h-4 text-primary" />
              ) : (
                <TrendingDown className="w-4 h-4 text-destructive" />
              )}
            </div>
            <p
              className={`text-2xl font-bold font-mono mb-1 ${
                stats?.total_profit_loss >= 0 ? 'text-primary' : 'text-destructive'
              }`}
            >
              {stats?.total_profit_loss >= 0 ? '+' : ''}
              {formatCurrency(stats?.total_profit_loss || 0, currency)}
            </p>
            <p className="text-xs text-text-muted">
              ROI: {stats?.roi >= 0 ? '+' : ''}
              {(stats?.roi || 0).toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Win Rate */}
        <div className="group relative overflow-hidden bg-gradient-to-br from-[#18181B] to-[#0F0F10] border border-[#27272A] rounded-xl p-4 shadow-xl hover:shadow-2xl hover:border-primary/50 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-primary/5 blur-3xl"></div>
          <div className="relative">
            <p className="mb-2 text-xs font-medium text-text-secondary">Win Rate</p>
            <div className="flex items-baseline gap-2 mb-2">
              <p className="font-mono text-2xl font-bold text-primary">{(stats?.win_rate || 0).toFixed(1)}%</p>
            </div>
            <div className="w-full bg-[#27272A] rounded-full h-2 overflow-hidden">
              <div
                className="h-2 transition-all duration-500 rounded-full bg-gradient-to-r from-primary to-primary/80"
                style={{ width: `${Math.min(stats?.win_rate || 0, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Total Bets */}
        <div className="group relative overflow-hidden bg-gradient-to-br from-[#18181B] to-[#0F0F10] border border-[#27272A] rounded-xl p-4 shadow-xl hover:shadow-2xl hover:border-primary/50 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-accent/5 blur-3xl"></div>
          <div className="relative">
            <p className="mb-2 text-xs font-medium text-text-secondary">Total Bets</p>
            <p className="mb-1 font-mono text-2xl font-bold">{stats?.total_bets || 0}</p>
            <div className="flex gap-2 text-xs">
              <span className="text-primary">{stats?.won_count || 0}W</span>
              <span className="text-destructive">{stats?.lost_count || 0}L</span>
              <span className="text-text-muted">{stats?.push_count || 0}P</span>
              <span className="text-accent">{stats?.pending_count || 0} Pending</span>
            </div>
          </div>
        </div>

        {/* Current Streak */}
        <div className="group relative overflow-hidden bg-gradient-to-br from-[#18181B] to-[#0F0F10] border border-[#27272A] rounded-xl p-4 shadow-xl hover:shadow-2xl hover:border-primary/50 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-primary/5 blur-3xl"></div>
          <div className="relative">
            <p className="mb-2 text-xs font-medium text-text-secondary">Current Streak</p>
            <p
              className={`text-2xl font-bold font-mono mb-1 ${
                stats?.current_streak_type === 'won'
                  ? 'text-primary'
                  : stats?.current_streak_type === 'lost'
                    ? 'text-destructive'
                    : 'text-white'
              }`}
            >
              {stats?.current_streak || 0}
              {stats?.current_streak_type ? (stats.current_streak_type === 'won' ? 'W' : 'L') : ''}
            </p>
            <p className="text-xs text-text-muted">
              Best: {stats?.best_win_streak || 0}W · Worst: {stats?.worst_loss_streak || 0}L
            </p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Chart - Takes 2 columns */}
        <div className="lg:col-span-2 bg-gradient-to-br from-[#18181B] to-[#0F0F10] border border-[#27272A] rounded-2xl p-6 shadow-xl">
          <h2 className="flex items-center mb-6 text-xl font-bold">
            <span className="w-1 h-6 mr-3 rounded-full bg-gradient-to-b from-primary to-accent"></span>
            Cumulative Performance
          </h2>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorPLPositive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPLNegative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#71717A"
                style={{ fontSize: '11px', fontFamily: 'JetBrains Mono' }}
                tickFormatter={formatDate}
                tickLine={false}
                axisLine={{ stroke: '#27272A' }}
              />
              <YAxis
                stroke="#71717A"
                style={{ fontSize: '11px', fontFamily: 'JetBrains Mono' }}
                tickLine={false}
                axisLine={{ stroke: '#27272A' }}
              />
              <Tooltip
                cursor={{ stroke: '#10B981', strokeWidth: 1, strokeDasharray: '5 5' }}
                contentStyle={{
                  backgroundColor: 'rgba(24, 24, 27, 0.95)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '12px',
                  fontFamily: 'JetBrains Mono',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                }}
                formatter={(value) => [formatCurrency(value, currency), 'Cumulative P/L']}
                labelFormatter={(label) => `Date: ${label}`}
                labelStyle={{ color: '#A1A1AA', marginBottom: '4px' }}
              />
              {/* Positive area */}
              <Area
                type="monotone"
                dataKey="cumulative_pl"
                stroke="#10B981"
                strokeWidth={3}
                fill="url(#colorPLPositive)"
                name="Cumulative P/L"
                dot={false}
                activeDot={{ r: 6, fill: '#10B981', stroke: '#18181B', strokeWidth: 2 }}
                isAnimationActive={true}
              />
              {/* Overlay for negative values */}
              <Area
                type="monotone"
                dataKey={(data) => (data.cumulative_pl < 0 ? data.cumulative_pl : null)}
                stroke="#EF4444"
                strokeWidth={3}
                fill="url(#colorPLNegative)"
                name="Loss"
                dot={false}
                activeDot={{ r: 6, fill: '#EF4444', stroke: '#18181B', strokeWidth: 2 }}
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Outcome Distribution */}
        <div className="bg-gradient-to-br from-[#18181B] to-[#0F0F10] border border-[#27272A] rounded-2xl p-6 shadow-xl">
          <h2 className="flex items-center mb-6 text-xl font-bold">
            <span className="w-1 h-6 mr-3 rounded-full bg-gradient-to-b from-primary to-accent"></span>
            Outcome Distribution
          </h2>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="45%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0.2)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(24, 24, 27, 0.95)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '12px',
                  fontFamily: 'JetBrains Mono',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                }}
                formatter={(value, name) => [value, name]}
              />
              <Legend
                verticalAlign="bottom"
                height={50}
                iconType="circle"
                wrapperStyle={{
                  paddingTop: '20px',
                  fontSize: '13px',
                  fontFamily: 'JetBrains Mono',
                }}
                formatter={(value, entry) => (
                  <span className="text-sm font-medium">
                    {value}: <span className="font-bold">{entry.payload.value}</span>
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily Performance */}
      <div className="bg-gradient-to-br from-[#18181B] to-[#0F0F10] border border-[#27272A] rounded-2xl p-6 shadow-xl">
        <h2 className="flex items-center mb-6 text-xl font-bold">
          <span className="w-1 h-6 mr-3 rounded-full bg-gradient-to-b from-accent to-primary"></span>
          Daily Performance
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData.slice(-30)} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="colorGreen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={1} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
              </linearGradient>
              <linearGradient id="colorRed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#EF4444" stopOpacity={1} />
                <stop offset="100%" stopColor="#DC2626" stopOpacity={0.8} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#71717A"
              style={{ fontSize: '11px', fontFamily: 'JetBrains Mono' }}
              tickFormatter={formatDate}
              tickLine={false}
              axisLine={{ stroke: '#27272A' }}
            />
            <YAxis
              stroke="#71717A"
              style={{ fontSize: '11px', fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={{ stroke: '#27272A' }}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
              contentStyle={{
                backgroundColor: 'rgba(24, 24, 27, 0.95)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '12px',
                fontFamily: 'JetBrains Mono',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              }}
              formatter={(value) => [formatCurrency(value, currency), 'Daily P/L']}
              labelStyle={{ color: '#A1A1AA', marginBottom: '4px' }}
            />
            <Bar dataKey="daily_pl" radius={[8, 8, 0, 0]} maxBarSize={50}>
              {chartData.slice(-30).map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.daily_pl >= 0 ? 'url(#colorGreen)' : 'url(#colorRed)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Turnover Chart */}
      <div className="bg-gradient-to-br from-[#18181B] to-[#0F0F10] border border-[#27272A] rounded-2xl p-6 shadow-xl">
        <h2 className="flex items-center mb-6 text-xl font-bold">
          <span className="w-1 h-6 mr-3 rounded-full bg-gradient-to-b from-accent to-primary"></span>
          Cumulative Turnover
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="colorTurnover" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#71717A"
              style={{ fontSize: '11px', fontFamily: 'JetBrains Mono' }}
              tickFormatter={formatDate}
              tickLine={false}
              axisLine={{ stroke: '#27272A' }}
            />
            <YAxis
              stroke="#71717A"
              style={{ fontSize: '11px', fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={{ stroke: '#27272A' }}
            />
            <Tooltip
              cursor={{ stroke: '#3B82F6', strokeWidth: 1, strokeDasharray: '5 5' }}
              contentStyle={{
                backgroundColor: 'rgba(24, 24, 27, 0.95)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '12px',
                fontFamily: 'JetBrains Mono',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              }}
              formatter={(value) => [formatCurrency(value, currency), 'Total Stake']}
              labelFormatter={(label) => `Date: ${label}`}
              labelStyle={{ color: '#A1A1AA', marginBottom: '4px' }}
            />
            <Area
              type="monotone"
              dataKey="cumulative_stake"
              stroke="#3B82F6"
              strokeWidth={3}
              fill="url(#colorTurnover)"
              name="Cumulative Stake"
              dot={false}
              activeDot={{ r: 6, fill: '#3B82F6', stroke: '#18181B', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Performance Tables */}
      <div className="grid grid-cols-1 gap-6">
        {/* Sport Performance */}
        <div className="bg-gradient-to-br from-[#18181B] to-[#0F0F10] border border-[#27272A] rounded-2xl p-6 shadow-xl">
          <h2 className="flex items-center mb-6 text-xl font-bold">
            <span className="w-1 h-6 mr-3 rounded-full bg-primary"></span>
            Performance by Sport
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#27272A]">
                  <th className="px-4 py-4 text-sm font-semibold text-left text-text-secondary">Sport</th>
                  <th className="px-4 py-4 text-sm font-semibold text-right text-text-secondary">Bets</th>
                  <th className="px-4 py-4 text-sm font-semibold text-right text-text-secondary">Win Rate</th>
                  <th className="px-4 py-4 text-sm font-semibold text-right text-text-secondary">Stake</th>
                  <th className="px-4 py-4 text-sm font-semibold text-right text-text-secondary">Result</th>
                  <th className="px-4 py-4 text-sm font-semibold text-right text-text-secondary">ROI</th>
                </tr>
              </thead>
              <tbody>
                {sportStats.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-text-muted">
                      No sport data for selected period
                    </td>
                  </tr>
                ) : (
                  sportStats.map((sport, index) => (
                    <tr key={index} className="border-b border-[#27272A]/50 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-4 text-sm font-medium">{sport.name}</td>
                      <td className="px-4 py-4 font-mono text-sm text-right">{sport.bets}</td>
                      <td className="px-4 py-4 font-mono text-sm text-right">
                        <span className={sport.win_rate >= 50 ? 'text-primary' : 'text-text-secondary'}>
                          {sport.win_rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-4 font-mono text-sm text-right">
                        {formatCurrency(sport.stake, currency)}
                      </td>
                      <td
                        className={`py-4 px-4 text-sm font-mono font-bold text-right ${
                          sport.profit_loss >= 0 ? 'text-primary' : 'text-destructive'
                        }`}
                      >
                        {sport.profit_loss >= 0 ? '+' : ''}
                        {formatCurrency(sport.profit_loss, currency)}
                      </td>
                      <td
                        className={`py-4 px-4 text-sm font-mono font-bold text-right ${
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

        {/* Bookmaker Performance */}
        <div className="bg-gradient-to-br from-[#18181B] to-[#0F0F10] border border-[#27272A] rounded-2xl p-6 shadow-xl">
          <h2 className="flex items-center mb-6 text-xl font-bold">
            <span className="w-1 h-6 mr-3 rounded-full bg-accent"></span>
            Bookmaker Performance
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#27272A]">
                  <th className="px-4 py-4 text-sm font-semibold text-left text-text-secondary">Bookmaker</th>
                  <th className="px-4 py-4 text-sm font-semibold text-right text-text-secondary">Bets</th>
                  <th className="px-4 py-4 text-sm font-semibold text-right text-text-secondary">Win Rate</th>
                  <th className="px-4 py-4 text-sm font-semibold text-right text-text-secondary">Stake</th>
                  <th className="px-4 py-4 text-sm font-semibold text-right text-text-secondary">Result</th>
                  <th className="px-4 py-4 text-sm font-semibold text-right text-text-secondary">ROI</th>
                </tr>
              </thead>
              <tbody>
                {bookieStats.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-text-muted">
                      No bookmaker data for selected period
                    </td>
                  </tr>
                ) : (
                  bookieStats
                    .sort((a, b) => b.profit_loss - a.profit_loss)
                    .map((bm, index) => (
                      <tr key={index} className="border-b border-[#27272A]/50 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-4 text-sm font-medium">{bm.name}</td>
                        <td className="px-4 py-4 font-mono text-sm text-right">{bm.bets}</td>
                        <td className="px-4 py-4 font-mono text-sm text-right">
                          <span className={bm.win_rate >= 50 ? 'text-primary' : 'text-text-secondary'}>
                            {bm.win_rate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-4 font-mono text-sm text-right">{formatCurrency(bm.stake, currency)}</td>
                        <td
                          className={`py-4 px-4 text-sm font-mono font-bold text-right ${
                            bm.profit_loss >= 0 ? 'text-primary' : 'text-destructive'
                          }`}
                        >
                          {bm.profit_loss >= 0 ? '+' : ''}
                          {formatCurrency(bm.profit_loss, currency)}
                        </td>
                        <td
                          className={`py-4 px-4 text-sm font-mono font-bold text-right ${
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
        <div className="bg-gradient-to-br from-[#18181B] to-[#0F0F10] border border-[#27272A] rounded-2xl p-6 shadow-xl">
          <h2 className="flex items-center mb-6 text-xl font-bold">
            <span className="w-1 h-6 mr-3 rounded-full bg-primary"></span>
            Tipster Performance
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#27272A]">
                  <th className="px-4 py-4 text-sm font-semibold text-left text-text-secondary">Tipster</th>
                  <th className="px-4 py-4 text-sm font-semibold text-right text-text-secondary">Bets</th>
                  <th className="px-4 py-4 text-sm font-semibold text-right text-text-secondary">Win Rate</th>
                  <th className="px-4 py-4 text-sm font-semibold text-right text-text-secondary">Stake</th>
                  <th className="px-4 py-4 text-sm font-semibold text-right text-text-secondary">Result</th>
                  <th className="px-4 py-4 text-sm font-semibold text-right text-text-secondary">ROI</th>
                </tr>
              </thead>
              <tbody>
                {tipsterStats.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-text-muted">
                      No tipster data for selected period
                    </td>
                  </tr>
                ) : (
                  tipsterStats
                    .sort((a, b) => b.profit_loss - a.profit_loss)
                    .map((tip, index) => (
                      <tr key={index} className="border-b border-[#27272A]/50 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-4 text-sm font-medium">{tip.name}</td>
                        <td className="px-4 py-4 font-mono text-sm text-right">{tip.bets}</td>
                        <td className="px-4 py-4 font-mono text-sm text-right">
                          <span className={tip.win_rate >= 50 ? 'text-primary' : 'text-text-secondary'}>
                            {tip.win_rate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-4 font-mono text-sm text-right">
                          {formatCurrency(tip.stake, currency)}
                        </td>
                        <td
                          className={`py-4 px-4 text-sm font-mono font-bold text-right ${
                            tip.profit_loss >= 0 ? 'text-primary' : 'text-destructive'
                          }`}
                        >
                          {tip.profit_loss >= 0 ? '+' : ''}
                          {formatCurrency(tip.profit_loss, currency)}
                        </td>
                        <td
                          className={`py-4 px-4 text-sm font-mono font-bold text-right ${
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

        {/* Odds Range Performance */}
        <div className="bg-gradient-to-br from-[#18181B] to-[#0F0F10] border border-[#27272A] rounded-2xl p-6 shadow-xl">
          <h2 className="flex items-center mb-6 text-xl font-bold">
            <span className="w-1 h-6 mr-3 rounded-full bg-accent"></span>
            Performance by Odds Range
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#27272A]">
                  <th className="px-4 py-4 text-sm font-semibold text-left text-text-secondary">Range</th>
                  <th className="px-4 py-4 text-sm font-semibold text-right text-text-secondary">Bets</th>
                  <th className="px-4 py-4 text-sm font-semibold text-right text-text-secondary">Win Rate</th>
                  <th className="px-4 py-4 text-sm font-semibold text-right text-text-secondary">Stake</th>
                  <th className="px-4 py-4 text-sm font-semibold text-right text-text-secondary">Result</th>
                  <th className="px-4 py-4 text-sm font-semibold text-right text-text-secondary">ROI</th>
                </tr>
              </thead>
              <tbody>
                {oddsRangeStats.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-text-muted">
                      No odds range data for selected period
                    </td>
                  </tr>
                ) : (
                  oddsRangeStats.map((range, index) => (
                    <tr key={index} className="border-b border-[#27272A]/50 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-4 text-sm font-medium">{range.name}</td>
                      <td className="px-4 py-4 font-mono text-sm text-right">{range.bets}</td>
                      <td className="px-4 py-4 font-mono text-sm text-right">
                        <span className={range.win_rate >= 50 ? 'text-primary' : 'text-text-secondary'}>
                          {range.win_rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-4 font-mono text-sm text-right">
                        {formatCurrency(range.stake, currency)}
                      </td>
                      <td
                        className={`py-4 px-4 text-sm font-mono font-bold text-right ${
                          range.profit_loss >= 0 ? 'text-primary' : 'text-destructive'
                        }`}
                      >
                        {range.profit_loss >= 0 ? '+' : ''}
                        {formatCurrency(range.profit_loss, currency)}
                      </td>
                      <td
                        className={`py-4 px-4 text-sm font-mono font-bold text-right ${
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
    </div>
  );
}
