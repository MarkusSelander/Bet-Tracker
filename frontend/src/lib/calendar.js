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

function emptyStats() {
  return {
    profit: 0,
    count: 0,
    won: 0,
    lost: 0,
    pending: 0,
    stake: 0,
    settledStake: 0,
    hasSettled: false,
  };
}

function emptyDay() {
  return { ...emptyStats(), bets: [] };
}

function yearRange(year) {
  return { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` };
}

function addBetToStats(stats, bet) {
  stats.count += 1;
  const { status } = bet;
  const result = Number(bet.result) || 0;
  const stake = Number(bet.stake) || 0;
  stats.stake += stake;
  if (status === 'won') stats.won += 1;
  if (status === 'lost') stats.lost += 1;
  if (status === 'pending') stats.pending += 1;
  if (SETTLED.has(status)) {
    stats.hasSettled = true;
    stats.settledStake += stake;
    stats.profit += result;
  }
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
    addBetToStats(day, bet);
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

function rates(stats) {
  const decided = stats.won + stats.lost;
  return {
    winRate: decided > 0 ? (stats.won / decided) * 100 : 0,
    roi: stats.settledStake > 0 ? (stats.profit / stats.settledStake) * 100 : 0,
  };
}

function buildYearModel(year, bets) {
  const { dateFrom, dateTo } = yearRange(year);
  const months = Array.from({ length: 12 }, (_, monthIndex) => ({
    ...monthRange(year, monthIndex),
    monthIndex,
    month: `${year}-${pad(monthIndex + 1)}`,
    ...emptyStats(),
  }));
  const totals = emptyStats();

  (bets || []).forEach((bet) => {
    const date = bet?.date;
    if (!date || date < dateFrom || date > dateTo) return;
    const monthIndex = Number(date.slice(5, 7)) - 1;
    const month = months[monthIndex];
    if (!month) return;
    addBetToStats(month, bet);
    addBetToStats(totals, bet);
  });

  const cells = months.map((month) => ({ ...month, ...rates(month) }));

  let bestMonth = null;
  let worstMonth = null;
  cells.forEach((cell) => {
    if (!cell.hasSettled) return;
    const entry = { month: cell.month, monthIndex: cell.monthIndex, profit: cell.profit };
    if (!bestMonth || entry.profit > bestMonth.profit) bestMonth = entry;
    if (!worstMonth || entry.profit < worstMonth.profit) worstMonth = entry;
  });

  return {
    dateFrom,
    dateTo,
    months: cells,
    kpis: {
      profit: totals.profit,
      bets: totals.count,
      stake: totals.stake,
      settledStake: totals.settledStake,
      ...rates(totals),
      bestMonth,
      worstMonth,
    },
  };
}

const CALENDAR_VIEW_KEY = 'calendarView';
const CALENDAR_VIEWS = ['day', 'month'];

function readCalendarView(storage = globalThis.localStorage) {
  try {
    const value = storage?.getItem(CALENDAR_VIEW_KEY);
    return CALENDAR_VIEWS.includes(value) ? value : 'day';
  } catch {
    return 'day';
  }
}

function saveCalendarView(view, storage = globalThis.localStorage) {
  try {
    storage?.setItem(CALENDAR_VIEW_KEY, view);
  } catch {
    // Private mode or blocked storage: the choice simply isn't remembered.
  }
}

export {
  SETTLED,
  CALENDAR_VIEWS,
  localDateKey,
  monthRange,
  yearRange,
  buildCalendarModel,
  buildYearModel,
  readCalendarView,
  saveCalendarView,
};
