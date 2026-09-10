function favoritesStatus() {
  return {
    liveSource: true,
    subtitle: 'Kommende kamper for lag og spillere',
    emptyHint: 'Søk opp lag eller spillere du vil følge.',
  };
}

function formatKickoff(time) {
  if (!time) return '';
  return String(time).slice(0, 5);
}

function buildFavoriteFeed(grouped) {
  if (!grouped || typeof grouped !== 'object') return [];
  const dates = Object.keys(grouped).sort();
  return dates.map((date) => {
    const matches = Array.isArray(grouped[date]) ? grouped[date] : [];
    const byLeague = {};
    for (const match of matches) {
      const league = match.league || 'Ukjent liga';
      if (!byLeague[league]) byLeague[league] = [];
      byLeague[league].push(match);
    }
    const leagues = Object.keys(byLeague)
      .sort()
      .map((name) => {
        const leagueMatches = byLeague[name].slice();
        leagueMatches.sort((a, b) => String(a.event_time || '').localeCompare(String(b.event_time || '')));
        return { name, matches: leagueMatches };
      });
    return { date, leagues };
  });
}

function filterFeedBySport(feed, sport) {
  if (!sport || sport === 'all') return feed || [];
  return (feed || [])
    .map((day) => ({
      ...day,
      leagues: (day.leagues || [])
        .map((league) => ({
          ...league,
          matches: (league.matches || []).filter((match) => (match.sport || '') === sport),
        }))
        .filter((league) => league.matches.length > 0),
    }))
    .filter((day) => day.leagues.length > 0);
}

export { favoritesStatus, formatKickoff, buildFavoriteFeed, filterFeedBySport };
