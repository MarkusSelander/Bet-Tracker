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
