import { BarChart, FileDown, Receipt, TrendingDown, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
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
import { exportDashboardToPDF } from '../utils/pdfExport';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const formatCurrency = (value, currency) => {
  if (currency === 'UNITS') return `${value.toFixed(2)} U`;
  if (currency === 'NOK') return `${value.toFixed(2)} kr`;
  return `$${value.toFixed(2)}`;
};

export default function Dashboard() {
  const { user } = useOutletContext();
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [recentBets, setRecentBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const currency = user?.currency || 'USD';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, chartRes, recentBetsRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/analytics/stats`, {
            credentials: 'include',
          }),
          fetch(`${BACKEND_URL}/api/analytics/chart?days=30`, {
            credentials: 'include',
          }),
          fetch(`${BACKEND_URL}/api/bets/recent?limit=10`, { credentials: 'include' }),
        ]);

        const statsData = await statsRes.json();
        const chartDataRes = await chartRes.json();
        const recentBetsData = await recentBetsRes.json();

        setStats(statsData);
        setChartData(chartDataRes);
        setRecentBets(recentBetsData);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* eslint-disable-next-line react/no-array-index-key */}
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#18181B] border border-[#27272A] rounded-lg p-6 h-32 shimmer"></div>
          ))}
        </div>
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
          <h1 className="text-2xl font-bold mb-1" data-testid="dashboard-title">
            Dashboard
          </h1>
          <p className="text-xs text-text-secondary">Track your betting performance and statistics</p>
        </div>
        <Button
          onClick={async () => {
            try {
              await exportDashboardToPDF(stats, chartData, recentBets, currency);
              toast.success('PDF exported successfully');
            } catch (error) {
              console.error('PDF export error:', error);
              toast.error('Failed to export PDF');
            }
          }}
          className="btn-primary-enhanced bg-primary hover:bg-primary/90 text-black font-bold shadow-[0_0_15px_rgba(16,185,129,0.4)]"
          data-testid="export-pdf-btn"
        >
          <FileDown className="w-4 h-4 mr-2" />
          Export PDF
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div
          className="stat-card stagger-item bg-[#18181B] border border-[#27272A] rounded-lg p-6"
          data-testid="total-bets-card"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center transition-transform hover:scale-110">
              <Receipt className="w-5 h-5 text-accent" strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-text-secondary text-[9px] uppercase tracking-wider mb-1 font-mono">Total Bets</p>
          <p className="text-2xl font-bold font-mono stat-number">{stats?.total_bets || 0}</p>
        </div>

        <div
          className="stat-card stagger-item bg-[#18181B] border border-[#27272A] rounded-lg p-6"
          data-testid="roi-card"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center transition-transform hover:scale-110">
              <BarChart className="w-5 h-5 text-primary" strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-text-secondary text-[9px] uppercase tracking-wider mb-1 font-mono">Total ROI</p>
          <p
            className={`text-2xl font-bold font-mono stat-number ${
              (stats?.roi || 0) >= 0 ? 'text-primary' : 'text-destructive'
            }`}
          >
            {(stats?.roi || 0).toFixed(2)}%
          </p>
        </div>

        <div
          className={`stat-card stagger-item rounded-lg p-6 ${
            (stats?.total_profit_loss || 0) >= 0 ? 'profit-card profit-highlight' : 'loss-card'
          }`}
          data-testid="profit-loss-card"
        >
          <div className="flex items-center justify-between mb-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-transform hover:scale-110 ${
                (stats?.total_profit_loss || 0) >= 0 ? 'bg-primary/10' : 'bg-destructive/10'
              }`}
            >
              {(stats?.total_profit_loss || 0) >= 0 ? (
                <TrendingUp className="w-5 h-5 text-primary" strokeWidth={1.5} />
              ) : (
                <TrendingDown className="w-5 h-5 text-destructive" strokeWidth={1.5} />
              )}
            </div>
          </div>
          <p className="text-text-secondary text-[9px] uppercase tracking-wider mb-1 font-mono">Total Result</p>
          <p
            className={`text-2xl font-bold font-mono stat-number ${
              (stats?.total_profit_loss || 0) >= 0 ? 'text-primary' : 'text-destructive'
            }`}
          >
            {(stats?.total_profit_loss || 0) >= 0 ? '+' : ''}
            {formatCurrency(stats?.total_profit_loss || 0, currency)}
          </p>
        </div>

        <div
          className="stat-card stagger-item bg-[#18181B] border border-[#27272A] rounded-lg p-6"
          data-testid="win-rate-card"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center transition-transform hover:scale-110">
              <BarChart className="w-5 h-5 text-accent" strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-text-secondary text-[9px] uppercase tracking-wider mb-1 font-mono">Win Rate</p>
          <p className="text-2xl font-bold font-mono stat-number">{(stats?.win_rate || 0).toFixed(1)}%</p>
        </div>

        <div
          className={`stat-card stagger-item rounded-lg p-6 ${
            stats?.current_streak_type === 'won'
              ? 'bg-primary/5 border border-primary/30'
              : stats?.current_streak_type === 'lost'
                ? 'bg-destructive/5 border border-destructive/30'
                : 'bg-[#18181B] border border-[#27272A]'
          }`}
          data-testid="streak-card"
        >
          <div className="flex items-center justify-between mb-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-transform hover:scale-110 ${
                stats?.current_streak_type === 'won'
                  ? 'bg-primary/10'
                  : stats?.current_streak_type === 'lost'
                    ? 'bg-destructive/10'
                    : 'bg-white/10'
              }`}
            >
              {stats?.current_streak_type === 'won' ? (
                <TrendingUp className="w-5 h-5 text-primary" strokeWidth={1.5} />
              ) : stats?.current_streak_type === 'lost' ? (
                <TrendingDown className="w-5 h-5 text-destructive" strokeWidth={1.5} />
              ) : (
                <BarChart className="w-5 h-5 text-white" strokeWidth={1.5} />
              )}
            </div>
          </div>
          <p className="text-text-secondary text-[9px] uppercase tracking-wider mb-1 font-mono">Current Streak</p>
          <p
            className={`text-2xl font-bold font-mono stat-number ${
              stats?.current_streak_type === 'won'
                ? 'text-primary'
                : stats?.current_streak_type === 'lost'
                  ? 'text-destructive'
                  : 'text-white'
            }`}
          >
            {stats?.current_streak || 0}{' '}
            <span className="text-sm">
              {stats?.current_streak_type ? (stats.current_streak_type === 'won' ? 'W' : 'L') : '-'}
            </span>
          </p>
          <p className="text-[9px] text-text-muted mt-1">
            Best: {stats?.best_win_streak || 0}W | Worst: {stats?.worst_loss_streak || 0}L
          </p>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#18181B]/50 border border-[#27272A] rounded-lg p-3">
          <p className="text-text-secondary text-[9px] mb-1">Average Stake</p>
          <p className="text-lg font-bold font-mono">
            {formatCurrency((stats?.total_stake || 0) / (stats?.total_bets || 1), currency)}
          </p>
        </div>
        <div className="bg-[#18181B]/50 border border-[#27272A] rounded-lg p-3">
          <p className="text-text-secondary text-[9px] mb-1">Average Odds</p>
          <p className="text-lg font-bold font-mono">
            {stats?.total_bets > 0
              ? (recentBets.reduce((sum, bet) => sum + bet.odds, 0) / Math.min(recentBets.length, 10)).toFixed(2)
              : '0.00'}
          </p>
        </div>
        <div className="bg-[#18181B]/50 border border-[#27272A] rounded-lg p-3">
          <p className="text-text-secondary text-[9px] mb-1">Profit per Bet</p>
          <p
            className={`text-lg font-bold font-mono ${
              (stats?.total_profit_loss || 0) / (stats?.total_bets || 1) >= 0 ? 'text-primary' : 'text-destructive'
            }`}
          >
            {formatCurrency((stats?.total_profit_loss || 0) / (stats?.total_bets || 1), currency)}
          </p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* P/L Chart */}
        <div className="lg:col-span-8 chart-container bg-[#18181B] border border-[#27272A] rounded-lg smooth-appear">
          <h2 className="text-base font-bold mb-3 flex items-center">
            <span className="w-1 h-4 bg-primary rounded-full mr-3"></span>
            Profit/Loss (Last 30 days)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
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
              <Line type="monotone" dataKey="daily_pl" stroke="#3B82F6" strokeWidth={2} dot={false} name="Daily P/L" />
              <Line
                type="monotone"
                dataKey="cumulative_pl"
                stroke="#10B981"
                strokeWidth={3}
                dot={false}
                name="Cumulative P/L"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Outcome Summary */}
        <div className="lg:col-span-4 glass-panel border border-[#27272A] rounded-lg p-6 smooth-appear">
          <h2 className="text-base font-bold mb-3 flex items-center">
            <span className="w-1 h-4 bg-accent rounded-full mr-3"></span>
            Outcome Summary
          </h2>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
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
          <div className="space-y-2 mt-4">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-[10px] text-text-secondary">{item.name}</span>
                </div>
                <span className="text-[10px] font-mono font-bold">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Bets */}
      <div className="glass-panel border border-[#27272A] rounded-lg p-6 smooth-appear">
        <h2 className="text-base font-bold mb-3 flex items-center">
          <span className="w-1 h-4 bg-accent rounded-full mr-3"></span>
          Recent Bets
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full enhanced-table">
            <thead>
              <tr className="border-b border-[#27272A]">
                <th className="text-left py-2 px-3 text-[10px] font-medium text-text-secondary">Date</th>
                <th className="text-left py-2 px-3 text-[10px] font-medium text-text-secondary">Game</th>
                <th className="text-left py-2 px-3 text-[10px] font-medium text-text-secondary">Bet</th>
                <th className="text-right py-2 px-3 text-[10px] font-medium text-text-secondary">Odds</th>
                <th className="text-right py-2 px-3 text-[10px] font-medium text-text-secondary">Stake</th>
                <th className="text-center py-2 px-3 text-[10px] font-medium text-text-secondary">Status</th>
                <th className="text-right py-2 px-3 text-[10px] font-medium text-text-secondary">Result</th>
              </tr>
            </thead>
            <tbody>
              {recentBets.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-text-muted">
                    <div className="flex flex-col items-center">
                      <img
                        src="https://images.unsplash.com/photo-1765130729366-b54d7b2c8ea2?crop=entropy&cs=srgb&fm=jpg&q=85"
                        alt="No bets"
                        className="w-48 h-32 object-cover rounded-lg mb-4 opacity-50"
                      />
                      <p className="text-xs">No bets found. Add your first bet!</p>
                    </div>
                  </td>
                </tr>
              ) : (
                recentBets.map((bet) => (
                  <tr key={bet.bet_id} className="border-b border-[#27272A] hover:bg-white/5 transition-colors">
                    <td className="py-2 px-3 text-[10px] font-mono">{bet.date}</td>
                    <td className="py-2 px-3 text-[10px]">{bet.game}</td>
                    <td className="py-2 px-3 text-[10px] text-text-secondary">{bet.bet}</td>
                    <td className="py-2 px-3 text-[10px] font-mono text-right">{bet.odds.toFixed(2)}</td>
                    <td className="py-2 px-3 text-[10px] font-mono text-right">
                      {formatCurrency(bet.stake, currency)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`badge-enhanced px-1.5 py-0.5 rounded text-[8px] font-medium ${
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
                      className={`py-2 px-3 text-[10px] font-mono font-bold text-right ${
                        bet.result >= 0 ? 'text-primary' : 'text-destructive'
                      }`}
                    >
                      {bet.result >= 0 ? '+' : ''}
                      {formatCurrency(bet.result, currency)}
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
