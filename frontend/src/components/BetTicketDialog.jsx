import { Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  defaultCreateValues,
  dialogTitle,
  formatExpectedDate,
  formatLegKickoff,
  missingComboLegs,
  potentialReturn,
  shouldShowDetailField,
  shouldUseTicketLayout,
  stakeAffix,
  submitLabel,
  ticketLegCount,
  ticketViewLegs,
  valuesFromBet,
  visibleFooterActions,
} from '../lib/betTicket';
import { PRODUCT_LABELS, STATUS_LABELS, TICKET_TYPE_LABELS, formatCurrency, statusClass } from '../lib/format';
import BookmakerLogo from './BookmakerLogo';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';

const FIELD = 'bg-black/20 border-white/10';

const STATUS_ORDER = ['pending', 'won', 'lost', 'push', 'cashed'];

const TICKET_CHROME_KEYS = new Set(['ticket_type', 'total_matches', 'cashout_amount', 'display_id']);

function Field({ id, label, children }) {
  return (
    <div className="min-w-0">
      <Label htmlFor={id} className="text-xs text-text-secondary mb-1.5 block">
        {label}
      </Label>
      {children}
    </div>
  );
}

function displayValue(key, values, currency) {
  const value = values?.[key];
  if (key === 'ticket_type') return TICKET_TYPE_LABELS[value] || value;
  if (key === 'product') return PRODUCT_LABELS[value] || value;
  if (key === 'status') return STATUS_LABELS[value] || value;
  if (key === 'expected_result_date') return formatExpectedDate(value);
  if (key === 'cashout_amount') return formatCurrency(value, currency);
  if (key === 'result') {
    const amount = formatCurrency(value, currency);
    return value >= 0 ? `+${amount}` : amount;
  }
  return value;
}

function formatOdds(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || value === '' || value == null) return null;
  return number.toFixed(2);
}

function ticketTypeLabel(type) {
  return String(TICKET_TYPE_LABELS[type] || type || 'Spill').toUpperCase();
}

function TicketLegRow({ leg, index }) {
  const meta = [formatLegKickoff(leg.start_time), leg.league, leg.sport].filter(Boolean).join(' · ');
  const odds = formatOdds(leg.odds);
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-3">
      {meta ? <p className="text-[11px] text-text-muted">{meta}</p> : null}
      <p className="text-sm font-semibold leading-snug mt-1">{leg.match || `Bein ${index + 1}`}</p>
      {leg.market ? <p className="text-xs text-text-secondary mt-0.5">{leg.market}</p> : null}
      <div className="flex items-center justify-between gap-3 mt-2">
        <div className="flex items-center gap-2 min-w-0">
          {odds ? (
            <span className="shrink-0 rounded-md bg-white/10 px-2 py-0.5 text-sm font-medium tabular-nums">{odds}</span>
          ) : null}
          {leg.outcome ? <span className="text-sm truncate">{leg.outcome}</span> : null}
        </div>
        {leg.status ? (
          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[11px] ${statusClass(leg.status)}`}>
            {STATUS_LABELS[leg.status] || leg.status}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function TicketView({ bet, currency }) {
  const type = bet.ticket_type;
  const count = ticketLegCount(bet);
  const odds = formatOdds(bet.odds);
  const payout = potentialReturn(bet);
  const legs = ticketViewLegs(bet);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="rounded-full border border-white/20 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide">
            {ticketTypeLabel(type)}
          </span>
          {count > 1 ? (
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] tabular-nums font-medium">[{count}]</span>
          ) : null}
          <BookmakerLogo name={bet.bookie} />
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-medium ${statusClass(bet.status)}`}>
          {STATUS_LABELS[bet.status] || bet.status}
        </span>
      </div>

      {bet.display_id != null && bet.display_id !== '' ? (
        <p className="text-[11px] text-text-muted">#{bet.display_id}</p>
      ) : null}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div>
          <p className="text-[11px] text-text-muted mb-1">Totalodds</p>
          <p className="text-xl sm:text-3xl font-semibold tabular-nums leading-tight">{odds || '—'}</p>
        </div>
        <div>
          <p className="text-[11px] text-text-muted mb-1">Innsats</p>
          <p className="text-xl sm:text-3xl font-semibold tabular-nums leading-tight">
            {formatCurrency(bet.stake, currency)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-text-muted mb-1">Mulig gevinst</p>
          <p className="text-xl sm:text-3xl font-semibold tabular-nums leading-tight text-primary">
            {formatCurrency(payout, currency)}
          </p>
        </div>
      </div>

      {bet.cashout_amount ? (
        <div className="rounded-md bg-amber-400 text-black px-3 py-2 text-sm font-semibold flex items-center justify-between">
          <span>Cashout</span>
          <span className="tabular-nums">{formatCurrency(bet.cashout_amount, currency)}</span>
        </div>
      ) : null}

      {missingComboLegs(bet) ? (
        <p className="text-xs text-text-muted bg-white/5 border border-white/10 rounded-md px-3 py-2">
          Kun første utvalg er lagret. Synk på nytt fra Coolbet for å hente øvrige bein.
        </p>
      ) : null}

      {legs.length > 0 ? (
        <div className="space-y-2" data-testid="bet-details-legs">
          {legs.map((leg, index) => (
            <TicketLegRow key={`${leg.match || 'leg'}-${index}`} leg={leg} index={index} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function BetTicketDialog({
  open,
  mode = 'view',
  bet,
  currency = 'NOK',
  onOpenChange,
  onRequestEdit,
  onDelete,
  onSubmit,
}) {
  const readOnly = mode === 'view';
  const ticketLayout = shouldUseTicketLayout(mode, bet);
  const title = dialogTitle(mode);
  const actions = visibleFooterActions({ mode, onEdit: onRequestEdit, onDelete });
  const [values, setValues] = useState(() => (open && mode !== 'create' ? valuesFromBet(bet) : defaultCreateValues()));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [resetKey, setResetKey] = useState({ open, mode, bet });

  if (open !== resetKey.open || mode !== resetKey.mode || bet !== resetKey.bet) {
    setResetKey({ open, mode, bet });
    if (!open) {
      setDetailsOpen(false);
    } else if (mode === 'create') {
      setValues(defaultCreateValues());
    } else {
      setValues(valuesFromBet(bet));
    }
  }

  const detailValues = useMemo(() => ({ ...bet, ...values }), [bet, values]);

  const handleOpenChange = (nextOpen) => {
    onOpenChange?.(nextOpen);
  };

  const patch = (key, value) => setValues((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    if (readOnly) return;
    onSubmit?.(values);
  };

  const show = Boolean(open && (mode === 'create' || bet));
  const affix = stakeAffix(currency);
  const extraDetailKeys = [
    ['league', 'Liga'],
    ['ticket_type', 'Type'],
    ['product', 'Produkt'],
    ['total_matches', 'Kamper'],
    ['result', 'Resultat'],
    ['expected_result_date', 'Forventet oppgjør'],
    ['cashout_amount', 'Cashout'],
    ['display_id', 'Kupong-ID'],
    ['source_id', 'Kilde-ID'],
  ].filter(([key]) => !(ticketLayout && TICKET_CHROME_KEYS.has(key)));

  const footer = (
    <div className="flex flex-wrap justify-end gap-2 pt-2">
      {actions.includes('edit') ? (
        <Button
          type="button"
          variant="secondary"
          data-testid="bet-details-edit"
          onClick={() => onRequestEdit?.(bet)}
          className="bg-white/5 hover:bg-white/10 border border-white/10"
        >
          <Pencil className="w-4 h-4" />
          Rediger
        </Button>
      ) : null}
      {actions.includes('delete') ? (
        <Button
          type="button"
          variant="secondary"
          data-testid="bet-details-delete"
          onClick={() => onDelete?.(bet)}
          className="bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20"
        >
          <Trash2 className="w-4 h-4" />
          Slett
        </Button>
      ) : null}
      {actions.includes('submit') ? (
        <Button type="submit" className="bg-primary hover:bg-primary/90 text-black font-bold">
          {submitLabel(mode)}
        </Button>
      ) : null}
      {actions.includes('details') ? (
        <Button
          type="button"
          variant="secondary"
          data-testid="bet-ticket-details-toggle"
          onClick={() => setDetailsOpen((openDetails) => !openDetails)}
          className="bg-white/5 hover:bg-white/10 border border-white/10"
        >
          Detaljer
        </Button>
      ) : null}
    </div>
  );

  const detailsPanel = detailsOpen ? (
    <div className="space-y-3 pt-1" data-testid="bet-ticket-details-panel">
      {shouldShowDetailField('date', { mode, values: detailValues }) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field id="ticket-date" label="Dato">
            <Input
              id="ticket-date"
              type="date"
              value={values.date}
              onChange={(e) => patch('date', e.target.value)}
              readOnly={readOnly}
              required={!readOnly}
              className={FIELD}
            />
          </Field>
          {shouldShowDetailField('time', { mode, values: detailValues }) ? (
            <Field id="ticket-time" label="Tid">
              <Input
                id="ticket-time"
                type="time"
                step="1"
                value={values.time}
                onChange={(e) => patch('time', e.target.value)}
                readOnly={readOnly}
                className={FIELD}
              />
            </Field>
          ) : null}
        </div>
      ) : null}

      {shouldShowDetailField('notes', { mode, values: detailValues }) ? (
        <Field id="ticket-notes" label="Notater">
          <Textarea
            id="ticket-notes"
            value={values.notes}
            onChange={(e) => patch('notes', e.target.value)}
            readOnly={readOnly}
            placeholder="Notater om spillet..."
            className={`${FIELD} min-h-[80px]`}
          />
        </Field>
      ) : null}

      {extraDetailKeys.map(([key, label]) =>
        shouldShowDetailField(key, { mode, values: detailValues }) ? (
          <div key={key} className="flex items-start justify-between gap-4 py-2 border-b border-white/5">
            <dt className="text-xs text-text-secondary shrink-0 pt-0.5">{label}</dt>
            <dd
              className={`text-sm text-right break-words min-w-0 ${
                key === 'result'
                  ? detailValues.result >= 0
                    ? 'text-primary font-medium'
                    : 'text-destructive font-medium'
                  : ''
              }`}
            >
              {displayValue(key, detailValues, currency)}
            </dd>
          </div>
        ) : null
      )}

      {!ticketLayout && missingComboLegs(bet) ? (
        <p className="text-xs text-text-muted bg-white/5 border border-white/10 rounded-md px-3 py-2">
          Kun første utvalg er lagret. Synk på nytt fra Coolbet for å hente øvrige bein.
        </p>
      ) : null}

      {!ticketLayout && shouldShowDetailField('legs', { mode, values: detailValues }) ? (
        <div className="space-y-2" data-testid="bet-details-legs">
          <p className="text-xs text-text-secondary">Utvalg</p>
          {detailValues.legs.map((leg, index) => (
            <TicketLegRow key={`${leg.match || 'leg'}-${index}`} leg={leg} index={index} />
          ))}
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <Dialog open={show} onOpenChange={handleOpenChange}>
      {show ? (
        <DialogContent
          data-testid="bet-details-dialog"
          className="bg-[#18181B] border-[#27272A] text-white w-[calc(100%-2rem)] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle className="sr-only">{title}</DialogTitle>
            <DialogDescription className="sr-only">{title}</DialogDescription>
          </DialogHeader>

          {ticketLayout ? (
            <div className="space-y-3">
              <TicketView bet={detailValues} currency={currency} />
              {detailsPanel}
              {footer}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_180px] gap-3">
                <Field id="ticket-game" label="Kamp">
                  <Input
                    id="ticket-game"
                    data-testid="ticket-game"
                    value={values.game}
                    onChange={(e) => patch('game', e.target.value)}
                    readOnly={readOnly}
                    required={!readOnly}
                    placeholder="f.eks. Manchester United vs Liverpool"
                    className={FIELD}
                  />
                </Field>
                <Field id="ticket-status" label="Status">
                  <Select value={values.status} onValueChange={(value) => patch('status', value)} disabled={readOnly}>
                    <SelectTrigger id="ticket-status" data-testid="ticket-status" className={FIELD}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_ORDER.map((status) => (
                        <SelectItem key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_140px_120px] gap-3">
                <Field id="ticket-bet" label="Utvalg">
                  <Input
                    id="ticket-bet"
                    data-testid="ticket-bet"
                    value={values.bet}
                    onChange={(e) => patch('bet', e.target.value)}
                    readOnly={readOnly}
                    required={!readOnly}
                    placeholder="f.eks. Manchester United vinner"
                    className={FIELD}
                  />
                </Field>
                <Field id="ticket-stake" label="Innsats">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">
                      {affix}
                    </span>
                    <Input
                      id="ticket-stake"
                      data-testid="ticket-stake"
                      type={readOnly ? 'text' : 'number'}
                      step="0.01"
                      value={values.stake}
                      onChange={(e) => patch('stake', e.target.value)}
                      readOnly={readOnly}
                      required={!readOnly}
                      placeholder="100"
                      className={`${FIELD} pl-8`}
                    />
                  </div>
                </Field>
                <Field id="ticket-odds" label="Odds">
                  <Input
                    id="ticket-odds"
                    data-testid="ticket-odds"
                    type={readOnly ? 'text' : 'number'}
                    step="0.01"
                    value={readOnly && values.odds !== '' ? Number(values.odds).toFixed(2) : values.odds}
                    onChange={(e) => patch('odds', e.target.value)}
                    readOnly={readOnly}
                    required={!readOnly}
                    placeholder="2.50"
                    className={FIELD}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field id="ticket-sport" label="Sport">
                  <Input
                    id="ticket-sport"
                    data-testid="ticket-sport"
                    value={values.sport}
                    onChange={(e) => patch('sport', e.target.value)}
                    readOnly={readOnly}
                    placeholder="Fotball"
                    className={FIELD}
                  />
                </Field>
                <Field id="ticket-tipster" label="Tipster">
                  <Input
                    id="ticket-tipster"
                    data-testid="ticket-tipster"
                    value={values.tipster}
                    onChange={(e) => patch('tipster', e.target.value)}
                    readOnly={readOnly}
                    placeholder="Valgfritt"
                    className={FIELD}
                  />
                </Field>
                <Field id="ticket-bookie" label="Bookmaker">
                  {readOnly ? (
                    <div className="h-9 flex items-center">
                      <BookmakerLogo name={values.bookie} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        id="ticket-bookie"
                        data-testid="ticket-bookie"
                        value={values.bookie}
                        onChange={(e) => patch('bookie', e.target.value)}
                        placeholder="Bet365"
                        className={FIELD}
                      />
                      <BookmakerLogo name={values.bookie} />
                    </div>
                  )}
                </Field>
              </div>

              {detailsPanel}
              {footer}
            </form>
          )}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
