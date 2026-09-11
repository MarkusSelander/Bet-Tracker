const sportTabs = [
  { id: 'favorites', label: 'Favoritter' },
  { id: 'soccer', label: 'Fotball' },
  { id: 'tennis', label: 'Tennis' },
  { id: 'basketball', label: 'Basketball' },
  { id: 'icehockey', label: 'Hockey' },
  { id: 'golf', label: 'Golf' },
];

const MATCH_FILTERS = [
  { id: 'all', label: 'Alle' },
  { id: 'live', label: 'Live' },
  { id: 'odds', label: 'Odds' },
  { id: 'finished', label: 'Ferdig' },
  { id: 'scheduled', label: 'Program' },
];

function groupByLeague(matches) {
  const groups = [];
  const index = new Map();
  for (const match of matches || []) {
    const key = match.sport_key || 'other';
    if (!index.has(key)) {
      const group = {
        sport_key: key,
        title: match.sport_title || key,
        matches: [],
      };
      index.set(key, group);
      groups.push(group);
    }
    index.get(key).matches.push(match);
  }
  return groups;
}

function formatKickoff(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

function marketHeading(key) {
  if (key === 'h2h') return '1X2';
  if (key === 'totals') return 'Over/under';
  if (key === 'btts') return 'Begge lag scorer';
  return key;
}

export { MATCH_FILTERS, formatKickoff, groupByLeague, marketHeading, sportTabs };
