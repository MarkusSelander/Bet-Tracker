import { Pencil, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { PRODUCT_LABELS, STATUS_LABELS, TICKET_TYPE_LABELS, formatCurrency, statusClass } from '../lib/format';

function isPresent(value) {
  return value !== null && value !== undefined && value !== '';
}

function formatClock(time) {
  if (!time) return '';
  return String(time).slice(0, 5);
}

function formatPlacedAt(date, time) {
  if (!isPresent(date) && !isPresent(time)) return null;
  return [date, formatClock(time)].filter(Boolean).join(' ');
}

function formatExpectedDate(value) {
  if (!isPresent(value)) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString('nb-NO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function missingComboLegs(bet) {
  const comboLike = Number(bet?.total_matches) > 1 || ['combo', 'system', 'betbuilder'].includes(bet?.ticket_type);
  if (!comboLike) return false;
  const stored = Array.isArray(bet?.legs) ? bet.legs.length : 0;
  const expected = Number(bet?.total_matches) || 0;
  if (expected > 1) return stored < expected;
  return stored < 2;
}

function DetailRow({ label, children }) {
  if (!isPresent(children) && children !== 0) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-white/5">
      <dt className="text-xs text-text-secondary shrink-0 pt-0.5">{label}</dt>
      <dd className="text-sm text-right break-words min-w-0">{children}</dd>
    </div>
  );
}

export default function BetDetailsDialog({ bet, open, onOpenChange, currency = 'NOK', onEdit, onDelete }) {
  const handleOpenChange = (nextOpen) => {
    onOpenChange?.(nextOpen);
  };

  return (
    <Dialog open={Boolean(open && bet)} onOpenChange={handleOpenChange}>
      {bet ? (
        <DialogContent
          data-testid="bet-details-dialog"
          className="bg-[#18181B] border-[#27272A] text-white w-[calc(100%-2rem)] sm:w-full max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <div className="flex items-start justify-between gap-3 pr-6">
              <div className="min-w-0">
                <DialogTitle className="text-left leading-snug">{bet.game}</DialogTitle>
                {isPresent(bet.bet) ? (
                  <DialogDescription className="text-left text-text-secondary mt-1">{bet.bet}</DialogDescription>
                ) : (
                  <DialogDescription className="sr-only">Spilldetaljer</DialogDescription>
                )}
              </div>
              {isPresent(bet.status) ? (
                <span className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-medium ${statusClass(bet.status)}`}>
                  {STATUS_LABELS[bet.status] || bet.status}
                </span>
              ) : null}
            </div>
          </DialogHeader>

          {missingComboLegs(bet) ? (
            <p className="text-xs text-text-muted bg-white/5 border border-white/10 rounded-md px-3 py-2">
              Kun første utvalg er lagret. Synk på nytt fra Coolbet for å hente øvrige bein.
            </p>
          ) : null}

          {Array.isArray(bet.legs) && bet.legs.length > 0 ? (
            <div className="space-y-2" data-testid="bet-details-legs">
              <p className="text-xs text-text-secondary">Utvalg</p>
              {bet.legs.map((leg, index) => (
                <div
                  key={`${leg.match || 'leg'}-${index}`}
                  className="rounded-md border border-white/10 bg-white/5 px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium leading-snug">{leg.match || `Bein ${index + 1}`}</p>
                    {leg.status ? (
                      <span className={`shrink-0 px-1.5 py-0.5 rounded text-[11px] ${statusClass(leg.status)}`}>
                        {STATUS_LABELS[leg.status] || leg.status}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    {[
                      leg.sport,
                      leg.league,
                      [leg.market, leg.outcome].filter(Boolean).join(' · '),
                      leg.odds ? Number(leg.odds).toFixed(2) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          <dl className="space-y-0">
            <DetailRow label="Liga">{bet.league}</DetailRow>
            <DetailRow label="Sport">{bet.sport}</DetailRow>
            <DetailRow label="Type">
              {isPresent(bet.ticket_type) ? TICKET_TYPE_LABELS[bet.ticket_type] || bet.ticket_type : null}
            </DetailRow>
            <DetailRow label="Produkt">
              {isPresent(bet.product) ? PRODUCT_LABELS[bet.product] || bet.product : null}
            </DetailRow>
            <DetailRow label="Kamper">{isPresent(bet.total_matches) ? bet.total_matches : null}</DetailRow>
            <DetailRow label="Innsats">{formatCurrency(bet.stake, currency)}</DetailRow>
            <DetailRow label="Odds">
              {isPresent(bet.odds) || bet.odds === 0 ? Number(bet.odds).toFixed(2) : null}
            </DetailRow>
            <DetailRow label="Status">{STATUS_LABELS[bet.status] || bet.status}</DetailRow>
            <DetailRow label="Resultat">
              <span className={bet.result >= 0 ? 'text-primary font-medium' : 'text-destructive font-medium'}>
                {bet.result >= 0 ? '+' : ''}
                {formatCurrency(bet.result, currency)}
              </span>
            </DetailRow>
            <DetailRow label="Bookmaker">{bet.bookie}</DetailRow>
            <DetailRow label="Dato">{formatPlacedAt(bet.date, bet.time)}</DetailRow>
            <DetailRow label="Forventet oppgjør">{formatExpectedDate(bet.expected_result_date)}</DetailRow>
            <DetailRow label="Cashout">
              {isPresent(bet.cashout_amount) ? formatCurrency(bet.cashout_amount, currency) : null}
            </DetailRow>
            <DetailRow label="Kupong-ID">{isPresent(bet.display_id) ? bet.display_id : null}</DetailRow>
            <DetailRow label="Kilde-ID">{bet.source_id}</DetailRow>
            <DetailRow label="Notater">{bet.notes}</DetailRow>
            <DetailRow label="Tipster">{bet.tipster}</DetailRow>
          </dl>

          {onEdit || onDelete ? (
            <div className="flex justify-end gap-2 pt-2">
              {onEdit ? (
                <Button
                  type="button"
                  variant="secondary"
                  data-testid="bet-details-edit"
                  onClick={() => onEdit(bet)}
                  className="bg-white/5 hover:bg-white/10 border border-white/10"
                >
                  <Pencil className="w-4 h-4" />
                  Rediger
                </Button>
              ) : null}
              {onDelete ? (
                <Button
                  type="button"
                  variant="secondary"
                  data-testid="bet-details-delete"
                  onClick={() => onDelete(bet)}
                  className="bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20"
                >
                  <Trash2 className="w-4 h-4" />
                  Slett
                </Button>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
