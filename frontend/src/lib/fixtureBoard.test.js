const assert = require('node:assert/strict');
const test = require('node:test');

let focusTeamName;
let withFocus;
let nextFixture;
let tournamentOptions;
let groupByMonth;
let daysUntil;
let sideCounts;

test.before(async () => {
  ({ focusTeamName, withFocus, nextFixture, tournamentOptions, groupByMonth, daysUntil, sideCounts } =
    await import('./fixtureBoard.js'));
});

const matches = [
  {
    id: 1,
    start: '2026-10-13T19:00:00+00:00',
    home: 'Arsenal',
    away: 'Lille',
    homeColor: '#cc0000',
    awayColor: '#df0000',
    tournament: 'UEFA Champions League',
  },
  {
    id: 2,
    start: '2026-10-18T15:30:00+00:00',
    home: 'Nottingham Forest',
    away: 'Arsenal',
    homeColor: '#cc0000',
    awayColor: '#cc0000',
    tournament: 'Premier League',
  },
  {
    id: 3,
    start: '2026-11-04T20:00:00+00:00',
    home: 'Arsenal',
    away: 'Everton',
    tournament: 'Premier League',
  },
];

test('focus team is the side that appears most', () => {
  assert.equal(focusTeamName(matches), 'Arsenal');
});

test('withFocus marks home and away from the focus team', () => {
  const home = withFocus(matches[0], 'Arsenal');
  const away = withFocus(matches[1], 'Arsenal');
  assert.equal(home.opponent, 'Lille');
  assert.equal(home.side, 'Hjemme');
  assert.equal(away.opponent, 'Nottingham Forest');
  assert.equal(away.side, 'Borte');
});

test('next fixture skips matches that already started', () => {
  const next = nextFixture(matches, new Date('2026-10-14T00:00:00Z'));
  assert.equal(next.id, 2);
});

test('tournaments are ordered by how many matches they have', () => {
  assert.deepEqual(tournamentOptions(matches), [
    ['Premier League', 2],
    ['UEFA Champions League', 1],
  ]);
});

test('months stay in kickoff order', () => {
  const groups = groupByMonth(matches.map((match) => withFocus(match, 'Arsenal')));
  assert.deepEqual(
    groups.map((group) => group.matches.map((match) => match.id)),
    [[1, 2], [3]]
  );
});

test('days until counts whole local days', () => {
  assert.equal(daysUntil('2026-10-13T19:00:00+00:00', new Date('2026-10-11T08:00:00+00:00')), 2);
});

test('side counts split home and away for the focus team', () => {
  assert.deepEqual(sideCounts(matches, 'Arsenal'), { home: 2, away: 1 });
});
