const assert = require('node:assert/strict');
const { before, test } = require('node:test');

let scale;

before(async () => {
  scale = await import('./chartScale.js');
});

test('niceStep rounds to 1, 2, 2.5 or 5 times a power of ten', () => {
  assert.equal(scale.niceStep(1000, 4), 250);
  assert.equal(scale.niceStep(1800, 4), 500);
  assert.equal(scale.niceStep(70, 4), 20);
});

test('niceTicks stays inside the data and keeps zero', () => {
  assert.deepEqual(scale.niceTicks(-300, 1200, 4), [0, 500, 1000]);
  assert.deepEqual(scale.niceTicks(-600, 400, 4), [-500, -250, 0, 250]);
  assert.deepEqual(scale.niceTicks(0, 0), [0]);
});

test('bandDomain puts zero in the middle of the bottom band', () => {
  const [lo, hi] = scale.bandDomain(50, 0.2);
  assert.equal(lo, -50);
  assert.equal(hi, 450);
  assert.equal((0 - lo) / (hi - lo), 0.1);
});

test('curveDomain always includes zero and pads both ends', () => {
  assert.deepEqual(scale.curveDomain(100, 500, { bottom: 0.5, top: 0.1 }), [-250, 550]);
});
