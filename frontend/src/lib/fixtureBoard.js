export function focusTeamName(matches) {
  const counts = new Map();
  for (const match of matches) {
    for (const name of [match.home, match.away]) {
      if (!name) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  let best = '';
  let bestCount = -1;
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

export function withFocus(match, focus) {
  const atHome = match.home === focus;
  return {
    ...match,
    focus,
    opponent: atHome ? match.away : match.home,
    opponentColor: atHome ? match.awayColor : match.homeColor,
    side: atHome ? 'Hjemme' : 'Borte',
  };
}

export function nextFixture(matches, now = new Date()) {
  const nowMs = now.getTime();
  const sorted = [...matches].sort((a, b) => a.start.localeCompare(b.start));
  return sorted.find((match) => new Date(match.start).getTime() >= nowMs) || sorted[0] || null;
}

export function tournamentOptions(matches) {
  const counts = new Map();
  for (const match of matches) {
    counts.set(match.tournament, (counts.get(match.tournament) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'nb'));
}

export function groupByMonth(matches) {
  const groups = new Map();
  const sorted = [...matches].sort((a, b) => a.start.localeCompare(b.start));
  for (const match of sorted) {
    const date = new Date(match.start);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const raw = date.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' });
    const label = raw.charAt(0).toUpperCase() + raw.slice(1);
    if (!groups.has(key)) groups.set(key, { key, label, matches: [] });
    groups.get(key).matches.push(match);
  }
  return [...groups.values()];
}

export function daysUntil(iso, now = new Date()) {
  const start = new Date(iso);
  const today = new Date(now);
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((start.getTime() - today.getTime()) / 86_400_000);
}

export function roundLabel(match) {
  if (match.roundName) return match.roundName;
  if (match.round) return `Runde ${match.round}`;
  return '';
}

export function sideCounts(matches, focus) {
  return matches.reduce(
    (counts, match) => {
      if (match.home === focus) counts.home += 1;
      else if (match.away === focus) counts.away += 1;
      return counts;
    },
    { home: 0, away: 0 }
  );
}
