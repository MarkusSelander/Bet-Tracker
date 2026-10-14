const { before, test } = require('node:test');
const assert = require('node:assert/strict');

let buildCalendarModel;
let buildYearModel;
let monthRange;
let yearRange;
let readCalendarView;
let saveCalendarView;

before(async () => {
  ({ buildCalendarModel, buildYearModel, monthRange, yearRange, readCalendarView, saveCalendarView } =
    await import('./calendar.js'));
});

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    data,
  };
}

test('monthRange is inclusive for the whole month', () => {
  assert.deepEqual(monthRange(2026, 8), { dateFrom: '2026-09-01', dateTo: '2026-09-30' });
  assert.deepEqual(monthRange(2026, 1), { dateFrom: '2026-02-01', dateTo: '2026-02-28' });
});

test('buildCalendarModel groups bets, KPIs and Monday-first blanks', () => {
  const bets = [
    { date: '2026-09-01', status: 'won', result: 100, stake: 50, game: 'A' },
    { date: '2026-09-01', status: 'lost', result: -50, stake: 50, game: 'B' },
    { date: '2026-09-02', status: 'pending', result: 0, stake: 200, game: 'C' },
    { date: '2026-09-03', status: 'won', result: 400, stake: 100, game: 'D' },
  ];

  const model = buildCalendarModel(2026, 8, bets);

  assert.equal(model.cells[0].empty, true);
  const first = model.cells.find((cell) => cell.date === '2026-09-01');
  assert.equal(first.profit, 50);
  assert.equal(first.bets, 2);
  assert.equal(first.won, 1);
  assert.equal(first.lost, 1);
  assert.equal(first.pending, 0);

  const pendingDay = model.cells.find((cell) => cell.date === '2026-09-02');
  assert.equal(pendingDay.pending, 1);
  assert.equal(pendingDay.profit, 0);

  assert.equal(model.kpis.bets, 4);
  assert.equal(model.kpis.profit, 450);
  assert.equal(model.kpis.winRate, (2 / 3) * 100);
  assert.equal(model.kpis.roi, (450 / 200) * 100);
  assert.equal(model.kpis.bestDay.date, '2026-09-03');
  assert.equal(model.kpis.bestDay.profit, 400);
  assert.equal(model.kpis.worstDay.date, '2026-09-01');
  assert.equal(model.kpis.worstDay.profit, 50);

  assert.equal(model.byDate['2026-09-01'].bets.length, 2);
  assert.ok(model.weeks.length >= 4);
});

test('yearRange covers the whole calendar year', () => {
  assert.deepEqual(yearRange(2026), { dateFrom: '2026-01-01', dateTo: '2026-12-31' });
});

test('buildYearModel aggregates per month with the same settled rules as the day view', () => {
  const bets = [
    { date: '2026-01-05', status: 'won', result: 100, stake: 100 },
    { date: '2026-01-20', status: 'lost', result: -50, stake: 50 },
    { date: '2026-01-21', status: 'pending', result: 0, stake: 200 },
    { date: '2026-03-01', status: 'push', result: 0, stake: 80 },
    { date: '2026-03-31', status: 'cashed', result: -20, stake: 40 },
    { date: '2026-12-31', status: 'lost', result: -300, stake: 300 },
    { date: '2025-12-31', status: 'won', result: 999, stake: 1 },
    { date: '2027-01-01', status: 'won', result: 999, stake: 1 },
    { status: 'won', result: 999, stake: 1 },
  ];

  const model = buildYearModel(2026, bets);

  assert.equal(model.months.length, 12);
  assert.equal(model.dateFrom, '2026-01-01');
  assert.equal(model.dateTo, '2026-12-31');

  const jan = model.months[0];
  assert.equal(jan.month, '2026-01');
  assert.equal(jan.dateFrom, '2026-01-01');
  assert.equal(jan.dateTo, '2026-01-31');
  assert.equal(jan.count, 3);
  assert.equal(jan.won, 1);
  assert.equal(jan.lost, 1);
  assert.equal(jan.pending, 1);
  assert.equal(jan.profit, 50);
  assert.equal(jan.stake, 350);
  assert.equal(jan.settledStake, 150);
  assert.equal(jan.hasSettled, true);
  assert.equal(jan.winRate, 50);
  assert.equal(jan.roi, (50 / 150) * 100);

  const feb = model.months[1];
  assert.equal(feb.count, 0);
  assert.equal(feb.hasSettled, false);
  assert.equal(feb.roi, 0);
  assert.equal(feb.winRate, 0);
  assert.equal(feb.dateTo, '2026-02-28');

  const mar = model.months[2];
  assert.equal(mar.count, 2);
  assert.equal(mar.profit, -20);
  assert.equal(mar.settledStake, 120);
  assert.equal(mar.winRate, 0);

  assert.equal(model.kpis.bets, 6);
  assert.equal(model.kpis.profit, -270);
  assert.equal(model.kpis.stake, 770);
  assert.equal(model.kpis.settledStake, 570);
  assert.equal(model.kpis.winRate, (1 / 3) * 100);
  assert.equal(model.kpis.roi, (-270 / 570) * 100);
  assert.deepEqual(model.kpis.bestMonth, { month: '2026-01', monthIndex: 0, profit: 50 });
  assert.deepEqual(model.kpis.worstMonth, { month: '2026-12', monthIndex: 11, profit: -300 });
});

test('buildYearModel handles an empty year', () => {
  const model = buildYearModel(2026, null);
  assert.equal(model.kpis.bets, 0);
  assert.equal(model.kpis.bestMonth, null);
  assert.equal(model.kpis.worstMonth, null);
  assert.ok(model.months.every((month) => month.count === 0 && !month.hasSettled));
});

test('calendar view preference falls back to day and persists valid choices', () => {
  assert.equal(readCalendarView(memoryStorage()), 'day');
  assert.equal(readCalendarView(memoryStorage({ calendarView: 'week' })), 'day');
  assert.equal(readCalendarView(memoryStorage({ calendarView: 'month' })), 'month');
  assert.equal(readCalendarView(undefined), 'day');

  const storage = memoryStorage();
  saveCalendarView('month', storage);
  assert.equal(storage.data.calendarView, 'month');
  assert.equal(readCalendarView(storage), 'month');

  const throwing = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  };
  assert.equal(readCalendarView(throwing), 'day');
  assert.doesNotThrow(() => saveCalendarView('month', throwing));
});
