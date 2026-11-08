const assert = require('node:assert/strict');
const { before, test } = require('node:test');

let tone;

before(async () => {
  tone = await import('./tone.js');
});

test('toneOf separates gains, losses and flat values', () => {
  assert.equal(tone.toneOf(5), 'pos');
  assert.equal(tone.toneOf(-0.5), 'neg');
  assert.equal(tone.toneOf(0), 'flat');
  assert.equal(tone.toneOf('x'), 'flat');
});

test('heatLevel uses a square-root scale capped at 1', () => {
  assert.equal(tone.heatLevel(0, 100), 0);
  assert.equal(tone.heatLevel(25, 100), 0.5);
  assert.equal(tone.heatLevel(-100, 100), 1);
  assert.equal(tone.heatLevel(400, 100), 1);
  assert.equal(tone.heatLevel(10, 0), 0);
});

test('heatStyle tints gains and losses with their own color', () => {
  assert.equal(tone.heatStyle(0, 100), undefined);
  assert.match(tone.heatStyle(100, 100).backgroundColor, /var\(--primary\) \/ 0\.340/);
  assert.match(tone.heatStyle(-100, 100).backgroundColor, /var\(--destructive\)/);
});

test('withDrawdown measures the distance from the running peak', () => {
  const rows = tone.withDrawdown([{ cumulative_pl: 100 }, { cumulative_pl: 40 }, { cumulative_pl: 150 }]);
  assert.deepEqual(
    rows.map((row) => [row.peak, row.drawdown]),
    [
      [100, 0],
      [100, -60],
      [150, 0],
    ]
  );
});

test('curveSummary reports peak, trough and the deepest drawdown', () => {
  const summary = tone.curveSummary([{ cumulative_pl: -20 }, { cumulative_pl: 80 }, { cumulative_pl: 30 }]);
  assert.deepEqual(summary, { last: 30, peak: 80, trough: -20, drawdown: -50, maxDrawdown: -50 });
  assert.equal(tone.curveSummary([]).last, 0);
});

test('isoWeek follows ISO 8601 numbering', () => {
  assert.equal(tone.isoWeek('2026-01-01'), 1);
  assert.equal(tone.isoWeek('2026-11-07'), 45);
  assert.equal(tone.isoWeek('2027-01-01'), 53);
});
