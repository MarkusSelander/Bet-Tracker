const assert = require('node:assert/strict');
const { before, test } = require('node:test');

let convertFromNok;
let formatCurrency;
let setMoneyRates;

before(async () => {
  ({ convertFromNok, formatCurrency, setMoneyRates } = await import('./format.js'));
});

test('units divide kroner by the unit size', () => {
  setMoneyRates({ unitSize: 500 });
  assert.equal(convertFromNok(15301, 'UNITS'), 30.602);
  assert.equal(formatCurrency(1000, 'UNITS'), '2,00 u');
});

test('dollars divide kroner by the NOK per USD rate', () => {
  setMoneyRates({ nokPerUsd: 10 });
  assert.equal(convertFromNok(15301, 'USD'), 1530.1);
  assert.equal(formatCurrency(1530, 'USD', 0), '153 $');
});

test('nok is unchanged', () => {
  assert.equal(formatCurrency(15301, 'NOK', 0), '15\u00a0301 kr');
});
