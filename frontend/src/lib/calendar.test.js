const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildCalendarModel, monthRange } = require('./calendar');

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
  assert.equal(model.kpis.winRate, 2 / 3 * 100);
  assert.equal(model.kpis.roi, 450 / 200 * 100);
  assert.equal(model.kpis.bestDay.date, '2026-09-03');
  assert.equal(model.kpis.bestDay.profit, 400);
  assert.equal(model.kpis.worstDay.date, '2026-09-01');
  assert.equal(model.kpis.worstDay.profit, 50);

  assert.equal(model.byDate['2026-09-01'].bets.length, 2);
  assert.ok(model.weeks.length >= 4);
});
