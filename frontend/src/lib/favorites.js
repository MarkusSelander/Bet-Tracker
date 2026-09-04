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
      .map((name) => ({
        name,
        matches: byLeague[name].slice().sort((a, b) => String(a.event_time || '').localeCompare(String(b.event_time || ''))),
      }));
    return { date, leagues };
  });
}

exports.__esModule = true;
exports.formatKickoff = formatKickoff;
exports.buildFavoriteFeed = buildFavoriteFeed;
