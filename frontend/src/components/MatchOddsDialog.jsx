import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

const MARKET_LABELS = {
  '1x2': 'Kampresultat',
  over_under: 'Over/under',
  btts: 'Begge lag scorer',
};

export default function MatchOddsDialog({ match, markets, missing, open, onOpenChange, loading }) {
  if (!match) return null;
  const title = `${match.home_team_name || ''} – ${match.away_team_name || ''}`.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="match-odds-dialog"
        className="bg-[#18181B] border-[#27272A] text-white w-[calc(100%-2rem)] sm:w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{title || 'Kamp'}</DialogTitle>
          <DialogDescription>
            {[match.league, match.event_date, String(match.event_time || '').slice(0, 5)].filter(Boolean).join(' · ')}
          </DialogDescription>
        </DialogHeader>
        {loading ? <p className="text-sm text-text-muted">Henter odds…</p> : null}
        {!loading && missing ? (
          <p className="text-sm text-text-muted">Odds ble ikke funnet hos Coolbet for denne kampen.</p>
        ) : null}
        {!loading && !missing && Array.isArray(markets) ? (
          <div className="space-y-3">
            {markets.map((market) => (
              <div key={market.key} className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-xs text-text-secondary mb-1">
                  {MARKET_LABELS[market.key] || market.name}
                  {market.line ? ` ${market.line}` : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(market.outcomes || []).map((outcome) => (
                    <span key={outcome.name} className="text-sm font-mono">
                      {outcome.name} {Number(outcome.odds).toFixed(2)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
