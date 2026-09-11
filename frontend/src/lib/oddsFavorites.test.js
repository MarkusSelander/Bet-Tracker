const assert = require('node:assert/strict');
const { before, test } = require('node:test');

let groupByLeague;
let sportTabs;

before(async () => {
  ({ groupByLeague, sportTabs } = await import('./oddsFavorites.js'));
});

test('groupByLeague keeps league order and match order', () => {
  const groups = groupByLeague([
    { id: '1', sport_key: 'soccer_epl', sport_title: 'EPL', home_team: 'Arsenal', away_team: 'Chelsea' },
    { id: '2', sport_key: 'soccer_epl', sport_title: 'EPL', home_team: 'City', away_team: 'Liverpool' },
    { id: '3', sport_key: 'soccer_norway_eliteserien', sport_title: 'Eliteserien', home_team: 'Brann', away_team: 'Molde' },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].sport_key, 'soccer_epl');
  assert.deepEqual(groups[0].matches.map((row) => row.id), ['1', '2']);
  assert.equal(groups[1].title, 'Eliteserien');
});

test('groupByLeague is empty for no matches', () => {
  assert.deepEqual(groupByLeague([]), []);
});

test('sportTabs starts with Favoritter', () => {
  assert.equal(sportTabs[0].id, 'favorites');
  assert.equal(sportTabs[1].id, 'soccer');
});
