const assert = require('node:assert/strict');
const { before, test } = require('node:test');

let formatBetDate;
let getMatchSummary;
let getSelectionSummary;
let getBetSports;
let computeActiveKpis;
let sortBets;
let nextSortState;
let formatStatusLine;
let potentialProfit;

before(async () => {
  ({
    formatBetDate,
    getMatchSummary,
    getSelectionSummary,
    getBetSports,
    computeActiveKpis,
    sortBets,
    nextSortState,
    formatStatusLine,
    potentialProfit,
  } = await import('./betsDisplay.js'));
});

test('formatBetDate uses compact Norwegian date and time', () => {
  assert.equal(formatBetDate('2026-06-09', '19:35:00'), '9. jun 19:35');
  assert.equal(formatBetDate('2026-01-01'), '1. jan');
});

test('getMatchSummary prefixes combos and counts extra fixtures', () => {
  const summary = getMatchSummary({
    ticket_type: 'combo',
    total_matches: 2,
    game: 'Santos FC - Sport Victoria (+1)',
    legs: [{ match: 'Santos FC - Sport Victoria' }, { match: 'Brann - Viking' }],
  });
  assert.equal(summary.isCombo, true);
  assert.equal(summary.prefix, 'Kombi');
  assert.equal(summary.primary, 'Santos FC - Sport Victoria');
  assert.equal(summary.extraCount, 1);
});

test('getSelectionSummary shows first outcome and remaining count', () => {
  const summary = getSelectionSummary({
    bet: 'Match Result · Santos',
    total_matches: 2,
    legs: [
      { outcome: 'Santos eller uavgjort' },
      { outcome: 'Brann' },
    ],
  });
  assert.equal(summary.primary, 'Santos eller uavgjort');
  assert.equal(summary.extraCount, 1);
});

test('getBetSports collects unique sports for the +N pill', () => {
  const sports = getBetSports({
    sport: 'Football',
    legs: [{ sport: 'Football' }, { sport: 'Tennis' }],
  });
  assert.deepEqual(sports, ['Football', 'Tennis']);
});

test('computeActiveKpis sums pending stake and potential profit', () => {
  const kpis = computeActiveKpis([
    { status: 'pending', stake: 2, odds: 1.85 },
    { status: 'pending', stake: 10, odds: 2 },
    { status: 'won', stake: 50, odds: 2 },
  ]);
  assert.equal(kpis.count, 2);
  assert.equal(kpis.stake, 12);
  assert.equal(kpis.potential, 2 * 0.85 + 10);
});

test('potentialProfit never goes negative', () => {
  assert.equal(potentialProfit({ stake: 10, odds: 0.5 }), 0);
});

test('sortBets orders by date and toggles through nextSortState', () => {
  const rows = [
    { date: '2026-06-09', time: '19:35:00', game: 'B' },
    { date: '2026-06-10', time: '10:00:00', game: 'A' },
  ];
  const desc = sortBets(rows, 'date', 'desc');
  assert.equal(desc[0].date, '2026-06-10');
  assert.deepEqual(nextSortState('date', 'desc', 'match'), { key: 'match', dir: 'asc' });
  assert.deepEqual(nextSortState('match', 'asc', 'match'), { key: 'match', dir: 'desc' });
  assert.deepEqual(nextSortState('date', 'desc', 'date'), { key: 'date', dir: 'asc' });
  assert.deepEqual(nextSortState('match', 'desc', 'match'), { key: 'date', dir: 'desc' });
});

test('formatStatusLine includes result for settled bets', () => {
  assert.equal(formatStatusLine({ status: 'won', result: 1.7 }, 'USD'), 'Vunnet $1.70');
  assert.equal(formatStatusLine({ status: 'lost', result: -2, stake: 2 }, 'USD'), 'Tapt $2.00');
  assert.equal(formatStatusLine({ status: 'pending' }, 'USD'), 'Åpen');
});
