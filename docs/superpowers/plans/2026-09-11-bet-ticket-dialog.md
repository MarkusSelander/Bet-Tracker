# Kupongdialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Én `BetTicketDialog` for visning, nytt spill og redigering, med kjernegrid som i referansen og resten bak Detaljer.

**Architecture:** Ren visnings-/moduslogikk i `frontend/src/lib/betTicket.js` (feltlister, footer-knapper, create-defaults, payloads). UI i `BetTicketDialog.jsx`. `BetsPage` eier én dialog-instans med modus; Oversikt og Kalender bruker bare `view`. Ingen backend-endring.

**Tech Stack:** React (CRA), Tailwind, shadcn Dialog/Input/Select/Button, `BookmakerLogo`, node:test, sonner toast.

**Spec:** `docs/superpowers/specs/2026-09-11-bet-ticket-dialog-design.md`

---

## File structure

| File | Responsibility |
|------|----------------|
| `frontend/src/lib/betTicket.js` | Feltlister, modus, footer, defaults, payloads, formattering |
| `frontend/src/lib/betTicket.test.js` | node:test for all logikk over |
| `frontend/src/components/BetTicketDialog.jsx` | Felles dialog: grid, Detaljer, view/create/edit |
| `frontend/src/pages/BetsPage.jsx` | Én dialog-instans; fjern innebygd create/edit-skjema |
| `frontend/src/pages/Dashboard.jsx` | Bytt til `BetTicketDialog` i `view` uten edit/delete |
| `frontend/src/pages/CalendarPage.jsx` | Samme som Dashboard |
| `frontend/src/components/BetDetailsDialog.jsx` | Slettes når ingen importerer den |

Ikke i v1: Single/Multiple-faner, bookmaker-logo-rad, tags, lock-bet, nye API-felt, Rediger/Slett på Oversikt/Kalender.

---

### Task 1: Feltlister og skrivbare detaljfelt

**Files:**
- Create: `frontend/src/lib/betTicket.js`
- Test: `frontend/src/lib/betTicket.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/betTicket.test.js`:

```javascript
const assert = require('node:assert/strict');
const { before, test } = require('node:test');

let CORE_FIELDS;
let DETAIL_FIELDS;
let isDetailFieldWritable;

before(async () => {
  ({ CORE_FIELDS, DETAIL_FIELDS, isDetailFieldWritable } = await import('./betTicket.js'));
});

test('CORE_FIELDS lists the visible grid keys', () => {
  assert.deepEqual(CORE_FIELDS, ['game', 'status', 'bet', 'stake', 'odds', 'sport', 'tipster', 'bookie']);
});

test('DETAIL_FIELDS lists extra keys behind Detaljer', () => {
  assert.deepEqual(DETAIL_FIELDS, [
    'date',
    'time',
    'notes',
    'league',
    'ticket_type',
    'product',
    'total_matches',
    'result',
    'expected_result_date',
    'cashout_amount',
    'display_id',
    'source_id',
    'legs',
  ]);
});

test('only date, time and notes are writable behind Detaljer', () => {
  assert.equal(isDetailFieldWritable('date'), true);
  assert.equal(isDetailFieldWritable('time'), true);
  assert.equal(isDetailFieldWritable('notes'), true);
  assert.equal(isDetailFieldWritable('league'), false);
  assert.equal(isDetailFieldWritable('legs'), false);
  assert.equal(isDetailFieldWritable('game'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/markusselander/Desktop/App/frontend && node --test src/lib/betTicket.test.js`

Expected: FAIL with `Cannot find module` / `ERR_MODULE_NOT_FOUND` for `./betTicket.js`.

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/lib/betTicket.js`:

```javascript
export const CORE_FIELDS = ['game', 'status', 'bet', 'stake', 'odds', 'sport', 'tipster', 'bookie'];

export const DETAIL_FIELDS = [
  'date',
  'time',
  'notes',
  'league',
  'ticket_type',
  'product',
  'total_matches',
  'result',
  'expected_result_date',
  'cashout_amount',
  'display_id',
  'source_id',
  'legs',
];

const WRITABLE_DETAIL_FIELDS = ['date', 'time', 'notes'];

export function isDetailFieldWritable(key) {
  return WRITABLE_DETAIL_FIELDS.includes(key);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/markusselander/Desktop/App/frontend && node --test src/lib/betTicket.test.js`

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/betTicket.js frontend/src/lib/betTicket.test.js
git commit -m "$(cat <<'EOF'
Trekk ut kjerne- og detaljfelt for kupongdialogen.

EOF
)"
```

---

### Task 2: Defaults, visning av detaljfelt og create-payload

**Files:**
- Modify: `frontend/src/lib/betTicket.js`
- Test: `frontend/src/lib/betTicket.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/lib/betTicket.test.js` (extend the `before`-import):

```javascript
let defaultCreateValues;
let valuesFromBet;
let shouldShowDetailField;
let toCreatePayload;
let toUpdatePayload;
let stakeAffix;

before(async () => {
  ({
    CORE_FIELDS,
    DETAIL_FIELDS,
    isDetailFieldWritable,
    defaultCreateValues,
    valuesFromBet,
    shouldShowDetailField,
    toCreatePayload,
    toUpdatePayload,
    stakeAffix,
  } = await import('./betTicket.js'));
});

test('defaultCreateValues uses local date and pending status', () => {
  const values = defaultCreateValues(new Date(2026, 8, 11, 15, 50, 0));
  assert.equal(values.date, '2026-09-11');
  assert.equal(values.time, '15:50:00');
  assert.equal(values.status, 'pending');
  assert.equal(values.game, '');
  assert.equal(values.bet, '');
  assert.equal(values.stake, '');
  assert.equal(values.odds, '');
});

test('valuesFromBet copies writable fields as strings', () => {
  const values = valuesFromBet({
    date: '2026-09-08',
    time: '15:50:00',
    game: 'FC Porto - Manchester City',
    bet: 'Match Result (1X2) - Manchester City',
    stake: 1500,
    odds: 6.72,
    status: 'lost',
    bookie: 'Coolbet',
    sport: 'Football',
    league: 'UEFA Champions League',
    result: -1500,
  });
  assert.equal(values.game, 'FC Porto - Manchester City');
  assert.equal(values.stake, '1500');
  assert.equal(values.odds, '6.72');
  assert.equal(values.league, 'UEFA Champions League');
  assert.equal(values.result, -1500);
});

test('shouldShowDetailField shows writable extras in create even when empty', () => {
  const values = defaultCreateValues(new Date(2026, 8, 11));
  assert.equal(shouldShowDetailField('date', { mode: 'create', values }), true);
  assert.equal(shouldShowDetailField('notes', { mode: 'create', values }), true);
  assert.equal(shouldShowDetailField('league', { mode: 'create', values }), false);
});

test('shouldShowDetailField hides empty extras in view and keeps zero result', () => {
  const values = { notes: '', league: 'Eliteserien', result: 0, legs: [] };
  assert.equal(shouldShowDetailField('notes', { mode: 'view', values }), false);
  assert.equal(shouldShowDetailField('league', { mode: 'view', values }), true);
  assert.equal(shouldShowDetailField('result', { mode: 'view', values }), true);
  assert.equal(shouldShowDetailField('legs', { mode: 'view', values }), false);
});

test('toCreatePayload parses stake and odds', () => {
  const payload = toCreatePayload({
    date: '2026-09-11',
    time: '15:50:00',
    game: 'Brann - Viking',
    bet: 'Brann',
    stake: '100',
    odds: '1.90',
    status: 'pending',
    bookie: 'Coolbet',
    tipster: '',
    sport: 'Football',
    notes: '',
  });
  assert.equal(payload.stake, 100);
  assert.equal(payload.odds, 1.9);
  assert.equal(payload.game, 'Brann - Viking');
  assert.equal(payload.bookie, 'Coolbet');
});

test('toUpdatePayload keeps stake and odds as entered strings', () => {
  const payload = toUpdatePayload({
    date: '2026-09-11',
    time: '15:50:00',
    game: 'Brann - Viking',
    bet: 'Brann',
    stake: '100',
    odds: '1.90',
    status: 'won',
    bookie: 'Coolbet',
    tipster: '',
    sport: 'Football',
    notes: 'ok',
  });
  assert.equal(payload.stake, '100');
  assert.equal(payload.odds, '1.90');
  assert.equal(payload.notes, 'ok');
});

test('stakeAffix uses kr for NOK', () => {
  assert.equal(stakeAffix('NOK'), 'kr');
  assert.equal(stakeAffix('USD'), '$');
  assert.equal(stakeAffix('UNITS'), 'U');
});
```

Keep the Task 1 tests in the same file. Replace the previous `before`-import so all symbols are loaded once.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/markusselander/Desktop/App/frontend && node --test src/lib/betTicket.test.js`

Expected: FAIL (`defaultCreateValues is not a function` or similar).

- [ ] **Step 3: Write minimal implementation**

Append to `frontend/src/lib/betTicket.js`:

```javascript
export function isPresent(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && value !== '';
}

export function shouldShowDetailField(key, { mode, values } = {}) {
  if (mode !== 'view' && isDetailFieldWritable(key)) return true;
  const value = values?.[key];
  return isPresent(value) || value === 0;
}

export function defaultCreateValues(now = new Date()) {
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  return {
    date,
    time: now.toTimeString().slice(0, 8),
    game: '',
    bet: '',
    stake: '',
    odds: '',
    status: 'pending',
    bookie: '',
    tipster: '',
    sport: '',
    notes: '',
  };
}

export function valuesFromBet(bet, now = new Date()) {
  const defaults = defaultCreateValues(now);
  if (!bet) return defaults;
  return {
    ...defaults,
    date: bet.date || defaults.date,
    time: bet.time || '',
    game: bet.game || '',
    bet: bet.bet || '',
    stake: bet.stake === 0 || bet.stake ? String(bet.stake) : '',
    odds: bet.odds === 0 || bet.odds ? String(bet.odds) : '',
    status: bet.status || 'pending',
    bookie: bet.bookie || '',
    tipster: bet.tipster || '',
    sport: bet.sport || '',
    notes: bet.notes || '',
    league: bet.league,
    ticket_type: bet.ticket_type,
    product: bet.product,
    total_matches: bet.total_matches,
    result: bet.result,
    expected_result_date: bet.expected_result_date,
    cashout_amount: bet.cashout_amount,
    display_id: bet.display_id,
    source_id: bet.source_id,
    legs: bet.legs,
  };
}

export function toCreatePayload(values) {
  return {
    date: values.date,
    time: values.time,
    game: values.game,
    bet: values.bet,
    stake: parseFloat(values.stake),
    odds: parseFloat(values.odds),
    status: values.status,
    bookie: values.bookie,
    tipster: values.tipster,
    sport: values.sport,
    notes: values.notes,
  };
}

export function toUpdatePayload(values) {
  return {
    date: values.date,
    time: values.time,
    game: values.game,
    bet: values.bet,
    stake: values.stake,
    odds: values.odds,
    status: values.status,
    bookie: values.bookie,
    tipster: values.tipster,
    sport: values.sport,
    notes: values.notes,
  };
}

export function stakeAffix(currency = 'NOK') {
  if (currency === 'UNITS') return 'U';
  if (currency === 'USD') return '$';
  return 'kr';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/markusselander/Desktop/App/frontend && node --test src/lib/betTicket.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/betTicket.js frontend/src/lib/betTicket.test.js
git commit -m "$(cat <<'EOF'
Bygg create-defaults og payloads for kupongskjemaet.

EOF
)"
```

---

### Task 3: Footer-handling, titler og manglende kombi-bein

**Files:**
- Modify: `frontend/src/lib/betTicket.js`
- Test: `frontend/src/lib/betTicket.test.js`

- [ ] **Step 1: Write the failing tests**

Add these bindings to the existing `let` / `before` import list: `visibleFooterActions`, `dialogTitle`, `submitLabel`, `missingComboLegs`.

Append:

```javascript
test('visibleFooterActions hides edit and delete without callbacks', () => {
  assert.deepEqual(visibleFooterActions({ mode: 'view' }), ['details']);
});

test('visibleFooterActions shows edit and delete in view when provided', () => {
  assert.deepEqual(
    visibleFooterActions({ mode: 'view', onEdit: () => {}, onDelete: () => {} }),
    ['edit', 'delete', 'details']
  );
});

test('visibleFooterActions uses submit plus details for create and edit', () => {
  assert.deepEqual(visibleFooterActions({ mode: 'create' }), ['submit', 'details']);
  assert.deepEqual(visibleFooterActions({ mode: 'edit', onEdit: () => {} }), ['submit', 'details']);
});

test('dialogTitle and submitLabel follow mode', () => {
  assert.equal(dialogTitle('create'), 'Nytt spill');
  assert.equal(dialogTitle('edit'), 'Rediger spill');
  assert.equal(dialogTitle('view'), 'Spilldetaljer');
  assert.equal(submitLabel('create'), 'Legg til');
  assert.equal(submitLabel('edit'), 'Oppdater');
});

test('missingComboLegs is true when stored legs are fewer than total_matches', () => {
  assert.equal(
    missingComboLegs({ ticket_type: 'combo', total_matches: 5, legs: [{ match: 'FC Porto - Manchester City' }] }),
    true
  );
  assert.equal(
    missingComboLegs({
      ticket_type: 'combo',
      total_matches: 2,
      legs: [{ match: 'A' }, { match: 'B' }],
    }),
    false
  );
  assert.equal(missingComboLegs({ ticket_type: 'single', total_matches: 1, legs: [] }), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/markusselander/Desktop/App/frontend && node --test src/lib/betTicket.test.js`

Expected: FAIL (`visibleFooterActions is not a function`).

- [ ] **Step 3: Write minimal implementation**

Append to `frontend/src/lib/betTicket.js`:

```javascript
export function visibleFooterActions({ mode, onEdit, onDelete } = {}) {
  if (mode === 'create' || mode === 'edit') return ['submit', 'details'];
  const actions = [];
  if (typeof onEdit === 'function') actions.push('edit');
  if (typeof onDelete === 'function') actions.push('delete');
  actions.push('details');
  return actions;
}

export function dialogTitle(mode) {
  if (mode === 'create') return 'Nytt spill';
  if (mode === 'edit') return 'Rediger spill';
  return 'Spilldetaljer';
}

export function submitLabel(mode) {
  return mode === 'edit' ? 'Oppdater' : 'Legg til';
}

export function missingComboLegs(bet) {
  const comboLike = Number(bet?.total_matches) > 1 || ['combo', 'system', 'betbuilder'].includes(bet?.ticket_type);
  if (!comboLike) return false;
  const stored = Array.isArray(bet?.legs) ? bet.legs.length : 0;
  const expected = Number(bet?.total_matches) || 0;
  if (expected > 1) return stored < expected;
  return stored < 2;
}

export function formatExpectedDate(value) {
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/markusselander/Desktop/App/frontend && node --test src/lib/betTicket.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/betTicket.js frontend/src/lib/betTicket.test.js
git commit -m "$(cat <<'EOF'
Styr kupongdialogens footer og kombi-advarsel fra delt logikk.

EOF
)"
```

---

### Task 4: `BetTicketDialog` med kjernegrid og Detaljer

**Files:**
- Create: `frontend/src/components/BetTicketDialog.jsx`

Ingen React-komponenttester (spec). Logikken er allerede dekket.

- [ ] **Step 1: Create the dialog**

Create `frontend/src/components/BetTicketDialog.jsx`:

```jsx
import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import BookmakerLogo from './BookmakerLogo';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import {
  defaultCreateValues,
  dialogTitle,
  formatExpectedDate,
  missingComboLegs,
  shouldShowDetailField,
  stakeAffix,
  submitLabel,
  valuesFromBet,
  visibleFooterActions,
} from '../lib/betTicket';
import { PRODUCT_LABELS, STATUS_LABELS, TICKET_TYPE_LABELS, formatCurrency, statusClass } from '../lib/format';

const FIELD = 'bg-black/20 border-white/10';

const STATUS_ORDER = ['pending', 'won', 'lost', 'push', 'cashed'];

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
  const title = dialogTitle(mode);
  const actions = visibleFooterActions({ mode, onEdit: onRequestEdit, onDelete });
  const [values, setValues] = useState(() => defaultCreateValues());
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setDetailsOpen(false);
      return;
    }
    if (mode === 'create') setValues(defaultCreateValues());
    else setValues(valuesFromBet(bet));
  }, [open, mode, bet]);

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
                <Select
                  value={values.status}
                  onValueChange={(value) => patch('status', value)}
                  disabled={readOnly}
                >
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

            {detailsOpen ? (
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

                {[
                  ['league', 'Liga'],
                  ['ticket_type', 'Type'],
                  ['product', 'Produkt'],
                  ['total_matches', 'Kamper'],
                  ['result', 'Resultat'],
                  ['expected_result_date', 'Forventet oppgjør'],
                  ['cashout_amount', 'Cashout'],
                  ['display_id', 'Kupong-ID'],
                  ['source_id', 'Kilde-ID'],
                ].map(([key, label]) =>
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

                {missingComboLegs(bet) ? (
                  <p className="text-xs text-text-muted bg-white/5 border border-white/10 rounded-md px-3 py-2">
                    Kun første utvalg er lagret. Synk på nytt fra Coolbet for å hente øvrige bein.
                  </p>
                ) : null}

                {shouldShowDetailField('legs', { mode, values: detailValues }) ? (
                  <div className="space-y-2" data-testid="bet-details-legs">
                    <p className="text-xs text-text-secondary">Utvalg</p>
                    {detailValues.legs.map((leg, index) => (
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
              </div>
            ) : null}

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
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
```

- [ ] **Step 2: Lint the new file**

Run: `cd /Users/markusselander/Desktop/App/frontend && npx eslint src/components/BetTicketDialog.jsx src/lib/betTicket.js`

Expected: no errors. Fix Prettier/unused imports if any (`npx prettier --write src/components/BetTicketDialog.jsx src/lib/betTicket.js`).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/BetTicketDialog.jsx
git commit -m "$(cat <<'EOF'
Legg til felles kupongdialog med kjernegrid og Detaljer.

EOF
)"
```

---

### Task 5: Oversikt og Kalender bruker `BetTicketDialog`

**Files:**
- Modify: `frontend/src/pages/Dashboard.jsx`
- Modify: `frontend/src/pages/CalendarPage.jsx`

- [ ] **Step 1: Swap Dashboard import and usage**

In `frontend/src/pages/Dashboard.jsx` replace:

```jsx
import BetDetailsDialog from '../components/BetDetailsDialog';
```

with:

```jsx
import BetTicketDialog from '../components/BetTicketDialog';
```

Replace the `BetDetailsDialog` block at the bottom with:

```jsx
      <BetTicketDialog
        bet={detailBet}
        mode="view"
        open={Boolean(detailBet)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDetailBet(null);
        }}
        currency={currency}
      />
```

Do **not** pass `onRequestEdit` or `onDelete`.

- [ ] **Step 2: Swap Calendar the same way**

In `frontend/src/pages/CalendarPage.jsx` replace the import and the bottom dialog with the same `BetTicketDialog` `view`-props as Dashboard (still `detailBet` / `setDetailBet` / `currency`).

- [ ] **Step 3: Confirm no leftover BetDetailsDialog imports on those pages**

Run: `cd /Users/markusselander/Desktop/App && rg "BetDetailsDialog" frontend/src/pages/Dashboard.jsx frontend/src/pages/CalendarPage.jsx`

Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Dashboard.jsx frontend/src/pages/CalendarPage.jsx
git commit -m "$(cat <<'EOF'
Vis kupongdetaljer med felles dialog på Oversikt og Kalender.

EOF
)"
```

---

### Task 6: Spill-siden: én dialog for vis, nytt og rediger

**Files:**
- Modify: `frontend/src/pages/BetsPage.jsx`

- [ ] **Step 1: Replace dialog state**

Remove `isDialogOpen`, `editingBet`, `formData` and `resetForm`. Keep `detailBet` renamed to ticket state:

Replace:

```javascript
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBet, setEditingBet] = useState(null);
  const [detailBet, setDetailBet] = useState(null);
```

and the `formData` `useState` block with:

```javascript
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketMode, setTicketMode] = useState('view');
  const [ticketBet, setTicketBet] = useState(null);
```

Remove unused imports after the old form is gone: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`. Keep `Input`, `Label`, `Select` (filters still use them).

Add:

```javascript
import BetTicketDialog from '../components/BetTicketDialog';
import { toCreatePayload, toUpdatePayload } from '../lib/betTicket';
```

Remove `import BetDetailsDialog from '../components/BetDetailsDialog';`.

- [ ] **Step 2: Replace open/submit/edit/delete handlers**

Replace `handleSubmit`, `handleEdit`, `openBetDetails`, `resetForm`, `openCreateDialog` with:

```javascript
  const closeTicket = () => {
    setTicketOpen(false);
    setTicketBet(null);
    setTicketMode('view');
  };

  const openBetDetails = (bet) => {
    setTicketBet(bet);
    setTicketMode('view');
    setTicketOpen(true);
  };

  const openCreateDialog = () => {
    setTicketBet(null);
    setTicketMode('create');
    setTicketOpen(true);
  };

  const handleSubmit = async (values) => {
    try {
      if (ticketMode === 'edit' && ticketBet) {
        const response = await fetchWithTimeout(`${BACKEND_URL}/api/bets/${ticketBet.bet_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(toUpdatePayload(values)),
        });
        if (!response.ok) throw new Error('Kunne ikke oppdatere spill');
        toast.success('Spill oppdatert');
      } else {
        const response = await fetchWithTimeout(`${BACKEND_URL}/api/bets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(toCreatePayload(values)),
        });
        if (!response.ok) throw new Error('Kunne ikke opprette spill');
        toast.success('Spill lagt til');
      }
      closeTicket();
      fetchData();
    } catch (error) {
      console.error('Error saving bet:', error);
      toast.error('Kunne ikke lagre spill');
    }
  };
```

Keep existing `handleDelete(betId)` (it already toasts and returns boolean). Update the row-click handler that referenced `detailBet` to keep using `openBetDetails`.

`Nytt spill` already calls `openCreateDialog` via `data-testid="add-bet-btn"` — leave that button.

- [ ] **Step 3: Replace the two dialogs at the bottom with one**

Delete the entire `<Dialog open={isDialogOpen} ...>...</Dialog>` block (the old create/edit form) and the `<BetDetailsDialog ... />` block.

Insert:

```jsx
      <BetTicketDialog
        open={ticketOpen}
        mode={ticketMode}
        bet={ticketBet}
        currency={currency}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeTicket();
        }}
        onRequestEdit={() => setTicketMode('edit')}
        onDelete={async (bet) => {
          const deleted = await handleDelete(bet.bet_id);
          if (deleted) closeTicket();
        }}
        onSubmit={handleSubmit}
      />
```

If any remaining `setDetailBet` / `setIsDialogOpen` / `editingBet` references exist, update them to the ticket helpers.

- [ ] **Step 4: Lint BetsPage**

Run: `cd /Users/markusselander/Desktop/App/frontend && npx eslint src/pages/BetsPage.jsx`

Expected: no errors. Fix unused vars.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/BetsPage.jsx
git commit -m "$(cat <<'EOF'
Samle visning og redigering av spill i én kupongdialog.

EOF
)"
```

---

### Task 7: Fjern `BetDetailsDialog`

**Files:**
- Delete: `frontend/src/components/BetDetailsDialog.jsx`

- [ ] **Step 1: Confirm no remaining imports**

Run: `cd /Users/markusselander/Desktop/App && rg "BetDetailsDialog" frontend`

Expected: no matches in `src/` (docs may still mention the old name historically — leave docs unless they import the file).

- [ ] **Step 2: Delete the file**

Delete `frontend/src/components/BetDetailsDialog.jsx`.

- [ ] **Step 3: Re-run lib tests and eslint on touched frontend files**

Run:

```bash
cd /Users/markusselander/Desktop/App/frontend && node --test src/lib/betTicket.test.js src/lib/betsDisplay.test.js
cd /Users/markusselander/Desktop/App/frontend && npx eslint src/lib/betTicket.js src/components/BetTicketDialog.jsx src/pages/BetsPage.jsx src/pages/Dashboard.jsx src/pages/CalendarPage.jsx
```

Expected: tests PASS, eslint clean.

- [ ] **Step 4: Commit**

```bash
git add -u frontend/src/components/BetDetailsDialog.jsx
git commit -m "$(cat <<'EOF'
Fjern den gamle kupongdetalj-dialogen.

EOF
)"
```

---

### Task 8: Verifiser i nettleseren

**Files:** none (manual / browser tools)

Frontend må kjøre (`cd frontend && npm start`, typisk `http://localhost:3000`). Logg inn hvis appen krever det.

- [ ] **Step 1: Spill-siden visning**

Åpne `/bets`. Klikk en rad. Forvent: bred dialog, kjernegrid (Kamp, Status, Utvalg, Innsats med `kr`, Odds, Sport, Tipster, Bookmaker-merke). Ingen Single/Multiple-faner. Ingen nøkkel–verdi-liste før Detaljer. Knapper: Rediger, Slett, Detaljer.

- [ ] **Step 2: Detaljer-utvidelse**

Klikk **Detaljer**. Forvent: dato/tid/notater når de finnes; liga/type/produkt/kamper/resultat/oppgjør/IDer/bein når data finnes. Kombi med manglende bein viser advarselen. Extra felt er skjult igjen hvis du lukker og åpner dialogen på nytt.

- [ ] **Step 3: Rediger i samme dialog**

Klikk **Rediger**. Forvent: samme dialog, feltene blir redigerbare, footer **Oppdater** + **Detaljer**. Ingen andre modal. Endre et felt, lagre, dialogen lukkes, listen oppdateres. Feil: toast «Kunne ikke lagre spill», dialogen blir åpen.

- [ ] **Step 4: Nytt spill**

Klikk **Nytt spill**. Forvent: tomt kjernegrid, status Åpen, **Legg til** + **Detaljer**. Åpne Detaljer: dato er i dag, tid og notater vises, ingen liga/kupong-ID. Lagre uten å åpne Detaljer: spillet får dagens dato. X lukker uten Avbryt-knapp.

- [ ] **Step 5: Oversikt og Kalender**

Åpne et spill fra Oversikt og fra Kalender. Forvent: samme visningslayout, **Detaljer** finnes, **Rediger** og **Slett** vises ikke.

- [ ] **Step 6: Commit only if verification required extra fixes**

If you had to patch UI during verification, commit those fixes with a message that says why (f.eks. at Detaljer resettes når dialogen lukkes). Do not commit if nothing changed.

---

## Self-review

Spec coverage:

| Spec | Task |
|------|------|
| Felles dialog view/create/edit | 4–6 |
| Kjernegrid Kamp/Status/Utvalg/Innsats/Odds/Sport/Tipster/Bookmaker | 1, 4 |
| Bookmaker som merke, ikke logo-rad | 4 |
| Detaljer-utvidelse, reset ved lukk | 4, 8 |
| Bare date/time/notes skrivbare bak Detaljer | 1–2, 4 |
| Create-dato i dag uten kjernefelt | 2, 6, 8 |
| Rediger i samme dialog på Spill | 6 |
| Ingen Rediger/Slett på Oversikt/Kalender | 5 |
| POST/PATCH/DELETE uendret | 6 |
| Behold `bet-details-*` testids | 4 |
| `betTicket.js` + node:test | 1–3 |
| Fjern `BetDetailsDialog` | 7 |
| Ingen faner, tags, lock, nye API-felt | hele planen (ikke innført) |
