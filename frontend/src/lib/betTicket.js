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
