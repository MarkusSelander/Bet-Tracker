const assert = require('node:assert/strict');
const { before, test } = require('node:test');

let CORE_FIELDS;
let DETAIL_FIELDS;
let isDetailFieldWritable;
let defaultCreateValues;
let valuesFromBet;
let shouldShowDetailField;
let toCreatePayload;
let toUpdatePayload;
let stakeAffix;
let visibleFooterActions;
let dialogTitle;
let submitLabel;
let missingComboLegs;
let potentialReturn;
let shouldUseTicketLayout;
let formatLegKickoff;
let ticketViewLegs;
let ticketLegCount;

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
    visibleFooterActions,
    dialogTitle,
    submitLabel,
    missingComboLegs,
    potentialReturn,
    shouldUseTicketLayout,
    formatLegKickoff,
    ticketViewLegs,
    ticketLegCount,
  } = await import('./betTicket.js'));
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

test('visibleFooterActions hides edit and delete without callbacks', () => {
  assert.deepEqual(visibleFooterActions({ mode: 'view' }), ['details']);
});

test('visibleFooterActions shows edit and delete in view when provided', () => {
  assert.deepEqual(visibleFooterActions({ mode: 'view', onEdit: () => {}, onDelete: () => {} }), [
    'edit',
    'delete',
    'details',
  ]);
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

test('shouldUseTicketLayout is only for view mode', () => {
  const combo = { ticket_type: 'combo', legs: [{ match: 'A - B' }] };
  assert.equal(shouldUseTicketLayout('view', combo), true);
  assert.equal(shouldUseTicketLayout('edit', combo), false);
  assert.equal(shouldUseTicketLayout('create', combo), false);
  assert.equal(shouldUseTicketLayout('view', null), false);
});

test('potentialReturn is stake times odds like Coolbet possible payout', () => {
  assert.equal(potentialReturn({ stake: 1000, odds: 2.59 }), 2590);
  assert.equal(potentialReturn({ stake: '1000', odds: '2.59' }), 2590);
  assert.equal(potentialReturn({}), 0);
});

test('ticketViewLegs returns stored legs and ticketLegCount prefers total_matches', () => {
  const combo = {
    ticket_type: 'combo',
    total_matches: 2,
    legs: [{ match: 'Liverpool - Fulham' }, { match: 'Sabalenka, A - Rybakina, E' }],
  };
  assert.equal(ticketViewLegs(combo).length, 2);
  assert.equal(ticketLegCount(combo), 2);
  assert.deepEqual(ticketViewLegs({ ticket_type: 'single' }), []);
  assert.equal(ticketLegCount({ ticket_type: 'combo', total_matches: 5, legs: [{ match: 'A' }] }), 5);
});

test('ticketLegCount does not fall to 0 for combos missing total_matches and legs', () => {
  assert.equal(
    ticketLegCount({
      ticket_type: 'combo',
      game: 'David Martinez - Den lange (+3)',
      stake: 700,
      odds: 2.18,
    }),
    4
  );
  assert.equal(
    ticketLegCount({
      ticket_type: 'combo',
      total_matches: 2,
      game: 'Chelsea - Hull (+1)',
    }),
    2
  );
});

test('formatLegKickoff formats match start for ticket rows', () => {
  const text = formatLegKickoff('2026-09-12T20:05:00.000Z');
  assert.match(text, /12/);
  assert.match(text, /\d{1,2}[:.]\d{2}/);
  assert.equal(formatLegKickoff(null), '');
});
