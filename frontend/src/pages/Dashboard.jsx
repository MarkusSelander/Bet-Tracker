import { Clock, FileDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  Area,
  AreaChart,
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
import BetDetailsDialog from '../components/BetDetailsDialog';
import PageHeader from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { STATUS_LABELS, formatCurrency, statusClass } from '../lib/format';
import { exportDashboardToPDF } from '../utils/pdfExport';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const cardClass = 'bg-[#18181B] border border-[#27272A] rounded-xl p-4';

export default function Dashboard() {
  const { user } = useOutletContext();
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [recentBets, setRecentBets] = useState([]);
  const [pendingBets, setPendingBets] = useState([]);
  const [detailBet, setDetailBet] = useState(null);
  const [loading, setLoading] = useState(true);
  const currency = user?.currency || 'NOK';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, chartRes, recentBetsRes, pendingRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/analytics/stats`, { credentials: 'include' }),
          fetch(`${BACKEND_URL}/api/analytics/chart?days=30`, { credentials: 'include' }),
          fetch(`${BACKEND_URL}/api/bets/recent?limit=8`, { credentials: 'include' }),
          fetch(`${BACKEND_URL}/api/bets?status=pending`, { credentials: 'include' }),
        ]);

        setStats(statsRes.ok ? await statsRes.json() : null);
        const chartJson = chartRes.ok ? await chartRes.json() : [];
        setChartData(Array.isArray(chartJson) ? chartJson : []);
        const recentJson = recentBetsRes.ok ? await recentBetsRes.json() : [];
        setRecentBets(Array.isArray(recentJson) ? recentJson : []);
        const pendingJson = pendingRes.ok ? await pendingRes.json() : [];
        setPendingBets(Array.isArray(pendingJson) ? pendingJson : []);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Kunne ikke laste oversikt');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[#18181B] border border-[#27272A] rounded-lg p-6 h-28 shimmer" />
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
  ];
  const pl = stats?.total_profit_loss || 0;
  const pendingStake = pendingBets.reduce((sum, bet) => sum + (bet.stake || 0), 0);

  const openBetDetails = (bet) => setDetailBet(bet);

  const handleRowKeyDown = (event, bet) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openBetDetails(bet);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Oversikt"
        subtitle="Siste 30 dager og åpne spill"
        testId="dashboard-title"
        action={
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await exportDashboardToPDF(stats, chartData, recentBets, currency);
                toast.success('PDF eksportert');
              } catch (error) {
                console.error('PDF export error:', error);
                toast.error('Kunne ikke eksportere PDF');
              }
            }}
            className="bg-white/5 hover:bg-white/10 border border-white/10"
            data-testid="export-pdf-btn"
          >
            <FileDown className="w-4 h-4 mr-2" />
            PDF
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className={cardClass} data-testid="total-bets-card">
          <p className="text-xs text-text-secondary mb-1">Spill totalt</p>
          <p className="text-2xl font-bold font-mono">{stats?.total_bets || 0}</p>
        </div>
        <div className={cardClass} data-testid="roi-card">
          <p className="text-xs text-text-secondary mb-1">ROI</p>
          <p className={`text-2xl font-bold font-mono ${(stats?.roi || 0) >= 0 ? 'text-primary' : 'text-destructive'}`}>
            {(stats?.roi || 0).toFixed(1)}%
          </p>
        </div>
        <div className={cardClass} data-testid="profit-loss-card">
          <p className="text-xs text-text-secondary mb-1">Resultat</p>
          <p className={`text-2xl font-bold font-mono ${pl >= 0 ? 'text-primary' : 'text-destructive'}`}>
            {pl >= 0 ? '+' : ''}
            {formatCurrency(pl, currency)}
          </p>
        </div>
        <div className={cardClass} data-testid="win-rate-card">
          <p className="text-xs text-text-secondary mb-1">Treffprosent</p>
          <p className="text-2xl font-bold font-mono">{(stats?.win_rate || 0).toFixed(1)}%</p>
        </div>
        <div className={`${cardClass} col-span-2 lg:col-span-1`} data-testid="streak-card">
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
        </div>
      </div>

      {pendingBets.length > 0 ? (
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent" />
              Åpne spill
            </h2>
            <p className="text-sm text-text-secondary">
              {pendingBets.length} stk · {formatCurrency(pendingStake, currency)} eksponert
            </p>
          </div>
          <div className="space-y-2">
            {pendingBets.slice(0, 6).map((bet) => (
              <div
                key={bet.bet_id}
                role="button"
                tabIndex={0}
                data-testid={`pending-bet-${bet.bet_id}`}
                aria-label={`Vis detaljer for ${bet.game}`}
                onClick={() => openBetDetails(bet)}
                onKeyDown={(event) => handleRowKeyDown(event, bet)}
                className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/5 rounded-md px-1 -mx-1 transition-colors focus-visible:outline-none focus-visible:bg-white/10"
              >
                <div className="min-w-0">
                  <p className="text-sm truncate">{bet.game}</p>
                  <p className="text-xs text-text-secondary truncate">{bet.bet}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-mono">{formatCurrency(bet.stake, currency)}</p>
                  <p className="text-xs text-text-muted">{bet.odds?.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={`lg:col-span-8 ${cardClass} p-6`}>
          <h2 className="text-base font-bold mb-4">Utvikling siste 30 dager</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
              <XAxis dataKey="date" stroke="#71717A" style={{ fontSize: '11px' }} />
              <YAxis stroke="#71717A" style={{ fontSize: '11px' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181B', border: '1px solid #27272A', borderRadius: '8px' }}
                formatter={(value) => formatCurrency(value, currency)}
              />
              <Area
                type="monotone"
                dataKey="cumulative_pl"
                stroke="#10B981"
                strokeWidth={2}
                fill="#10B98122"
                name="P/L"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className={`lg:col-span-4 ${cardClass} p-6`}>
          <h2 className="text-base font-bold mb-4">Fordeling</h2>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value">
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
        </div>
      </div>

      <div className={`${cardClass} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">Siste spill</h2>
          <Link to="/bets" className="text-sm text-primary hover:underline">
            Se alle
          </Link>
        </div>
        {recentBets.length === 0 ? (
          <p className="text-sm text-text-muted py-8 text-center">
            Ingen spill ennå. Legg inn ditt første fra Spill-siden.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#27272A] text-left text-xs text-text-secondary">
                  <th className="py-2 pr-3 font-medium">Dato</th>
                  <th className="py-2 pr-3 font-medium">Kamp</th>
                  <th className="py-2 pr-3 font-medium text-right">Odds</th>
                  <th className="py-2 pr-3 font-medium text-right">Innsats</th>
                  <th className="py-2 pr-3 font-medium text-center">Status</th>
                  <th className="py-2 font-medium text-right">Resultat</th>
                </tr>
              </thead>
              <tbody>
                {recentBets.map((bet) => (
                  <tr
                    key={bet.bet_id}
                    data-testid={`recent-bet-${bet.bet_id}`}
                    tabIndex={0}
                    aria-label={`Vis detaljer for ${bet.game}`}
                    onClick={() => openBetDetails(bet)}
                    onKeyDown={(event) => handleRowKeyDown(event, bet)}
                    className="border-b border-[#27272A]/50 cursor-pointer hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:bg-white/10"
                  >
                    <td className="py-2 pr-3 text-sm font-mono whitespace-nowrap">{bet.date}</td>
                    <td className="py-2 pr-3 text-sm max-w-[220px] truncate">{bet.game}</td>
                    <td className="py-2 pr-3 text-sm font-mono text-right">{bet.odds.toFixed(2)}</td>
                    <td className="py-2 pr-3 text-sm font-mono text-right">{formatCurrency(bet.stake, currency)}</td>
                    <td className="py-2 pr-3 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] ${statusClass(bet.status)}`}>
                        {STATUS_LABELS[bet.status] || bet.status}
                      </span>
                    </td>
                    <td
                      className={`py-2 text-sm font-mono text-right ${bet.result >= 0 ? 'text-primary' : 'text-destructive'}`}
                    >
                      {bet.result >= 0 ? '+' : ''}
                      {formatCurrency(bet.result, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BetDetailsDialog
        bet={detailBet}
        open={Boolean(detailBet)}
        onOpenChange={(open) => {
          if (!open) setDetailBet(null);
        }}
        currency={currency}
      />
    </div>
  );
}
