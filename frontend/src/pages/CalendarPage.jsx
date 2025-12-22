import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Button } from '../components/ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const formatCurrency = (value, currency) => {
  if (currency === 'UNITS') return `${value.toFixed(0)} U`;
  if (currency === 'NOK') return `${value.toFixed(0)} kr`;
  return `$${value.toFixed(0)}`;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function CalendarPage() {
  const { user } = useOutletContext();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState({});
  const currency = user?.currency || 'USD';

  const fetchCalendarData = async () => {
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;

      const response = await fetch(`${BACKEND_URL}/api/analytics/calendar?year=${year}&month=${month}`, {
        credentials: 'include',
      });

      const data = await response.json();
      // Convert array to object keyed by date
      const dataObj = {};
      data.forEach((item) => {
        dataObj[item.date] = item;
      });
      setCalendarData(dataObj);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    }
  };

  useEffect(() => {
    fetchCalendarData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        day,
        date: dateStr,
        data: calendarData[dateStr],
      });
    }

    return days;
  };

  const getWeeklyStats = () => {
    const days = getDaysInMonth();
    const weeks = [];
    let currentWeek = [];

    days.forEach((day, index) => {
      currentWeek.push(day);

      if ((index + 1) % 7 === 0 || index === days.length - 1) {
        const weekProfit = currentWeek.reduce((sum, d) => {
          if (d?.data) {
            return sum + d.data.profit_loss;
          }
          return sum;
        }, 0);

        const weekBets = currentWeek.reduce((sum, d) => {
          if (d?.data) {
            return sum + d.data.bets;
          }
          return sum;
        }, 0);

        weeks.push({
          days: currentWeek.length,
          profit: weekProfit,
          bets: weekBets,
        });
        currentWeek = [];
      }
    });

    return weeks;
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const monthlyTotal = Object.values(calendarData).reduce((sum, day) => sum + day.profit_loss, 0);
  const monthlyBets = Object.values(calendarData).reduce((sum, day) => sum + day.bets, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2" data-testid="calendar-title">
          Calendar
        </h1>
        <p className="text-text-secondary">View your betting performance by day</p>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between bg-[#18181B] border border-[#27272A] rounded-lg p-4">
        <Button
          data-testid="prev-month-btn"
          variant="secondary"
          size="sm"
          onClick={previousMonth}
          className="bg-white/5 hover:bg-white/10"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <div className="text-center">
          <h2 className="text-2xl font-bold">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <div className="flex items-center space-x-6 mt-2">
            <div className="text-sm">
              <span className="text-text-muted">Monthly Total: </span>
              <span className={`font-mono font-bold ${monthlyTotal >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {monthlyTotal >= 0 ? '+' : ''}
                {formatCurrency(monthlyTotal, currency)}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-text-muted">Total Bets: </span>
              <span className="font-mono font-bold">{monthlyBets}</span>
            </div>
          </div>
        </div>

        <Button
          data-testid="next-month-btn"
          variant="secondary"
          size="sm"
          onClick={nextMonth}
          className="bg-white/5 hover:bg-white/10"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-6">
        <div className="grid grid-cols-7 gap-2 mb-2">
          {DAYS.map((day) => (
            <div key={day} className="text-center text-sm font-medium text-text-secondary py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {/* eslint-disable-next-line react/no-array-index-key */}
          {getDaysInMonth().map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="aspect-square" />;
            }

            const hasData = day.data;
            const profitLoss = hasData ? day.data.profit_loss : 0;
            const bets = hasData ? day.data.bets : 0;
            const won = hasData ? day.data.won : 0;
            const lost = hasData ? day.data.lost : 0;
            const isPositive = profitLoss >= 0;

            return (
              <div
                key={day.date}
                data-testid={`calendar-day-${day.day}`}
                className={`calendar-day aspect-square border rounded-lg p-2 transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer ${
                  !hasData
                    ? 'border-[#27272A] bg-[#18181B]'
                    : isPositive
                      ? 'border-primary/30 bg-primary/5 hover:border-primary/50'
                      : 'border-destructive/30 bg-destructive/5 hover:border-destructive/50'
                }`}
                style={{
                  color: hasData ? (isPositive ? '#10B981' : '#EF4444') : undefined,
                }}
              >
                <div className="h-full flex flex-col">
                  <div className="text-xs font-medium text-text-secondary mb-1">{day.day}</div>
                  {hasData && (
                    <div className="flex-1 flex flex-col justify-center space-y-1">
                      <div
                        className={`text-sm font-mono font-bold ${isPositive ? 'text-primary' : 'text-destructive'}`}
                      >
                        {isPositive ? '+' : ''}
                        {formatCurrency(profitLoss, currency)}
                      </div>
                      <div className="text-xs text-text-muted">
                        {bets} bet{bets !== 1 ? 's' : ''}
                      </div>
                      <div className="text-xs text-text-muted">
                        {won}W-{lost}L
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weekly Summary */}
      <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Weekly Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* eslint-disable-next-line react/no-array-index-key */}
          {getWeeklyStats().map((week, index) => (
            <div
              key={index}
              className={`border rounded-lg p-4 ${
                week.profit >= 0 ? 'border-primary/30 bg-primary/5' : 'border-destructive/30 bg-destructive/5'
              }`}
            >
              <div className="text-sm text-text-muted mb-2">Week {index + 1}</div>
              <div
                className={`text-xl font-mono font-bold mb-1 ${week.profit >= 0 ? 'text-primary' : 'text-destructive'}`}
              >
                {week.profit >= 0 ? '+' : ''}
                {formatCurrency(week.profit, currency)}
              </div>
              <div className="text-xs text-text-muted">{week.bets} bets</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
