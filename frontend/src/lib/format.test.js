const assert = require('node:assert/strict');
const { before, test } = require('node:test');

let convertFromNok;
let formatAxisAmount;
let formatCurrency;
let formatMoneyParts;
let formatPercent;
let formatSignedCurrency;
let setMoneyRates;

before(async () => {
  ({
    convertFromNok,
    formatAxisAmount,
    formatCurrency,
    formatMoneyParts,
    formatPercent,
    formatSignedCurrency,
    setMoneyRates,
  } = await import('./format.js'));
});

test('money parts split sign, integer, fraction and unit', () => {
  assert.deepEqual(formatMoneyParts(-12340.5, 'NOK'), {
    sign: '−',
    integer: '12\u00a0340',
    fraction: ',50',
    unit: 'kr',
  });
  assert.deepEqual(formatMoneyParts(250, 'NOK', 0), { sign: '+', integer: '250', fraction: '', unit: 'kr' });
  assert.equal(formatMoneyParts(0.001, 'NOK').sign, '');
});

test('signed currency keeps the sign for both directions', () => {
  assert.equal(formatSignedCurrency(1200, 'NOK', 0), '+1\u00a0200 kr');
  assert.equal(formatSignedCurrency(-45.5, 'NOK'), '−45,50 kr');
  assert.equal(formatSignedCurrency(0, 'NOK', 0), '0 kr');
});

test('axis amounts mark thousands consistently with k', () => {
  assert.equal(formatAxisAmount(1200, 'NOK'), '1,2k');
  assert.equal(formatAxisAmount(2000, 'NOK'), '2k');
  assert.equal(formatAxisAmount(15000, 'NOK'), '15k');
  assert.equal(formatAxisAmount(-500, 'NOK'), '−500');
});

test('percent uses a comma and an optional sign', () => {
  assert.equal(formatPercent(12.345), '12,3 %');
  assert.equal(formatPercent(-4, 1), '−4,0 %');
  assert.equal(formatPercent(2.5, 1, { signed: true }), '+2,5 %');
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
