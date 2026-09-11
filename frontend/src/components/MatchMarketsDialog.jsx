import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { formatKickoff, marketHeading } from '../lib/oddsFavorites';

function formatPrice(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return '—';
  return number.toFixed(2);
}

function outcomeLabel(market, outcome) {
  if (market.key === 'totals' && outcome.point != null) {
    return `${outcome.name} ${outcome.point}`;
  }
  return outcome.name;
}

function scoreLine(match) {
  if (!Array.isArray(match?.scores) || match.scores.length === 0) return null;
  return match.scores.map((row) => `${row.name} ${row.score ?? ''}`.trim()).join(' · ');
}

export default function MatchMarketsDialog({ match, markets, open, onOpenChange, loading, error }) {
  const heading = match ? `${match.home_team} – ${match.away_team}` : 'Kampkort';
  const kickoff = formatKickoff(match?.commence_time);
  const score = scoreLine(match);
  const rows = Array.isArray(markets) ? markets : [];
  const empty = !loading && !error && rows.length === 0;

  return (
    <Dialog open={Boolean(open && match)} onOpenChange={onOpenChange}>
      {match ? (
        <DialogContent
          data-testid="match-markets-dialog"
          className="bg-[#18181B] border-[#27272A] text-white w-[calc(100%-2rem)] sm:w-full max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle className="text-left leading-snug">{heading}</DialogTitle>
            <DialogDescription className="text-left text-text-secondary">
              {[match.sport_title, kickoff, score].filter(Boolean).join(' · ') || 'Kampmarkeder'}
            </DialogDescription>
          </DialogHeader>

          {loading ? <p className="text-sm text-text-secondary">Henter odds…</p> : null}
          {error ? (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {error}
            </p>
          ) : null}
          {empty ? <p className="text-sm text-text-secondary">Odds ble ikke funnet</p> : null}

          <div className="space-y-4">
            {rows.map((market) => (
              <section key={market.key}>
                <h3 className="text-xs uppercase tracking-wide text-text-secondary mb-2">
                  {marketHeading(market.key)}
                </h3>
                <div className="grid gap-2">
                  {(market.outcomes || []).map((outcome) => (
                    <div
                      key={`${market.key}-${outcome.name}-${outcome.point ?? ''}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2"
                    >
                      <span className="text-sm">{outcomeLabel(market, outcome)}</span>
                      <span className="text-right">
                        <span className="text-sm font-medium tabular-nums">{formatPrice(outcome.price)}</span>
                        {outcome.bookmaker ? (
                          <span className="block text-[11px] text-text-muted">{outcome.bookmaker}</span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
