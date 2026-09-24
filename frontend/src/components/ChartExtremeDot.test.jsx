import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChartExtremeDot, latestExtremeDates } from './ChartExtremeDot';

test('latestExtremeDates keeps the latest high and low', () => {
  const dates = latestExtremeDates(
    [
      { date: 'a', cumulative_pl: 1 },
      { date: 'b', cumulative_pl: 5 },
      { date: 'c', cumulative_pl: -2 },
      { date: 'd', cumulative_pl: 5 },
    ],
    'cumulative_pl'
  );
  expect(dates).toEqual({ highDate: 'd', lowDate: 'c' });
});

test('ChartExtremeDot draws a glow only on the high and low points', () => {
  const high = renderToStaticMarkup(
    createElement(ChartExtremeDot, {
      cx: 10,
      cy: 20,
      payload: { date: 'd', cumulative_pl: 5 },
      value: 5,
      highDate: 'd',
      lowDate: 'c',
    })
  );
  const low = renderToStaticMarkup(
    createElement(ChartExtremeDot, {
      cx: 10,
      cy: 40,
      payload: { date: 'c', cumulative_pl: -2 },
      value: -2,
      highDate: 'd',
      lowDate: 'c',
    })
  );
  const mid = renderToStaticMarkup(
    createElement(ChartExtremeDot, {
      cx: 10,
      cy: 30,
      payload: { date: 'a', cumulative_pl: 1 },
      value: 1,
      highDate: 'd',
      lowDate: 'c',
    })
  );

  expect(high).toContain('#34D399');
  expect(low).toContain('#F87171');
  expect(mid).toBe('');
});
