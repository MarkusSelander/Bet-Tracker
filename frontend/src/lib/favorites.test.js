const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildFavoriteFeed, favoritesStatus, formatKickoff } = require('./favorites');

test('favoritesStatus says live search and feed are disconnected', () => {
  const status = favoritesStatus();
  assert.equal(status.liveSource, false);
  assert.match(status.subtitle, /ingen live datakilde/i);
  assert.match(status.emptyHint, /datakilde/i);
});

test('buildFavoriteFeed groups by date then league and keeps 1x2', () => {
  const grouped = {
    '2026-09-07': [
      {
        fixture_id: '2',
        event_date: '2026-09-07',
        event_time: '17:00:00',
        league: 'Premier League',
        home_team_name: 'Arsenal',
        away_team_name: 'Chelsea',
        odds_1x2: { home: 1.95, draw: 3.5, away: 3.8 },
      },
    ],
    '2026-09-06': [
      {
        fixture_id: '1',
        event_date: '2026-09-06',
        event_time: '18:00:00',
        league: 'Eliteserien',
        home_team_name: 'Brann',
        away_team_name: 'Viking',
        odds_1x2: { home: 1.85, draw: 3.4, away: 4.2 },
      },
      {
        fixture_id: '3',
        event_date: '2026-09-06',
        event_time: '20:00:00',
        league: 'Eliteserien',
        home_team_name: 'Rosenborg',
        away_team_name: 'Molde',
        odds_1x2: null,
        coolbet_event_id: null,
      },
    ],
  };

  const feed = buildFavoriteFeed(grouped);
  assert.equal(feed[0].date, '2026-09-06');
  assert.equal(feed[0].leagues[0].name, 'Eliteserien');
  assert.equal(feed[0].leagues[0].matches.length, 2);
  assert.equal(feed[0].leagues[0].matches[0].odds_1x2.home, 1.85);
  assert.equal(feed[1].leagues[0].name, 'Premier League');
});

test('formatKickoff slices to HH:MM', () => {
  assert.equal(formatKickoff('18:00:00'), '18:00');
  assert.equal(formatKickoff(null), '');
});

test('buildFavoriteFeed treats empty payload as empty list', () => {
  assert.deepEqual(buildFavoriteFeed({}), []);
  assert.deepEqual(buildFavoriteFeed(null), []);
});
