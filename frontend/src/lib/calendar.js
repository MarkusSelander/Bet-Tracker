const SETTLED = new Set(['won', 'lost', 'push', 'cashed']);

function pad(value) {
  return String(value).padStart(2, '0');
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthRange(year, monthIndex) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return {
    dateFrom: `${year}-${pad(monthIndex + 1)}-01`,
    dateTo: `${year}-${pad(monthIndex + 1)}-${pad(lastDay)}`,
  };
}

function emptyDay() {
  return {
    profit: 0,
    count: 0,
    won: 0,
    lost: 0,
    pending: 0,
    settledStake: 0,
    hasSettled: false,
    bets: [],
  };
}

function buildCalendarModel(year, monthIndex, bets) {
  const { dateFrom, dateTo } = monthRange(year, monthIndex);
  const byDate = {};

  (bets || []).forEach((bet) => {
    const date = bet?.date;
    if (!date || date < dateFrom || date > dateTo) return;
    if (!byDate[date]) byDate[date] = emptyDay();
    const day = byDate[date];
    day.bets.push(bet);
    day.count += 1;
    const status = bet.status;
    const result = Number(bet.result) || 0;
    const stake = Number(bet.stake) || 0;
    if (status === 'won') day.won += 1;
    if (status === 'lost') day.lost += 1;
    if (status === 'pending') day.pending += 1;
    if (SETTLED.has(status)) {
      day.hasSettled = true;
      day.settledStake += stake;
      day.profit += result;
    }
  });

  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ empty: true, date: null, day: null });
  }

  for (let dayNum = 1; dayNum <= daysInMonth; dayNum += 1) {
    const date = `${year}-${pad(monthIndex + 1)}-${pad(dayNum)}`;
    const stats = byDate[date] || emptyDay();
    if (!byDate[date]) byDate[date] = stats;
    cells.push({
      empty: false,
      day: dayNum,
      date,
      profit: stats.profit,
      bets: stats.count,
      won: stats.won,
      lost: stats.lost,
      pending: stats.pending,
      hasSettled: stats.hasSettled,
    });
  }

  const settledDays = Object.entries(byDate)
    .filter(([, stats]) => stats.hasSettled)
    .map(([date, stats]) => ({ date, profit: stats.profit }));

  let bestDay = null;
  let worstDay = null;
  settledDays.forEach((entry) => {
    if (!bestDay || entry.profit > bestDay.profit) bestDay = entry;
    if (!worstDay || entry.profit < worstDay.profit) worstDay = entry;
  });

  let won = 0;
  let lost = 0;
  let count = 0;
  let profit = 0;
  let settledStake = 0;
  Object.values(byDate).forEach((stats) => {
    count += stats.count;
    won += stats.won;
    lost += stats.lost;
    profit += stats.profit;
    settledStake += stats.settledStake;
  });
  const decided = won + lost;

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    const slice = cells.slice(i, i + 7);
    weeks.push({
      profit: slice.reduce((sum, cell) => sum + (cell.empty ? 0 : cell.profit), 0),
      bets: slice.reduce((sum, cell) => sum + (cell.empty ? 0 : cell.bets), 0),
    });
  }

  return {
    dateFrom,
    dateTo,
    cells,
    weeks,
    byDate,
    kpis: {
      profit,
      bets: count,
      winRate: decided > 0 ? (won / decided) * 100 : 0,
      roi: settledStake > 0 ? (profit / settledStake) * 100 : 0,
      bestDay,
      worstDay,
    },
  };
}

exports.__esModule = true;
exports.SETTLED = SETTLED;
exports.localDateKey = localDateKey;
exports.monthRange = monthRange;
exports.buildCalendarModel = buildCalendarModel;
