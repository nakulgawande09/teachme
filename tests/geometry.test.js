import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  slateSize, tolerance, threshold, pathEnds, pathNumbers, markHits, SEED_VECTORS,
} from '../js/trace/geometry.js';

test('the slate is square and always fits the viewport', () => {
  assert.equal(slateSize(390, 844), 350);      // 844 * 0.44
  assert.equal(slateSize(320, 480), 211 + 9);  // clamped up to the 220 floor
  assert.equal(slateSize(1440, 2000), 460);    // clamped down to the 460 ceiling
  assert.equal(slateSize(300, 900), 260);      // width-limited: 300 - 40
});

test('tolerance scales with the slate but never goes below a fingertip', () => {
  assert.equal(tolerance(400, 'normal'), 22);
  assert.ok(tolerance(400, 'gentle') > tolerance(400, 'strict'));
  assert.equal(tolerance(200, 'strict'), 16, 'floor applies on a small slate');
  assert.equal(tolerance(400, 'nonsense'), tolerance(400, 'normal'), 'unknown falls back');
});

test('threshold is ordered and defaults safely', () => {
  assert.ok(threshold('gentle') < threshold('normal'));
  assert.ok(threshold('normal') < threshold('strict'));
  assert.equal(threshold(undefined), 0.7);
});

test('pathEnds reads start, end and exit tangent off a two-point line', () => {
  const e = pathEnds('M28,88 L50,14');
  assert.deepEqual([e.sx, e.sy, e.ex, e.ey], [28, 88, 50, 14]);
  assert.ok(e.angle < 0, 'the stroke travels upward, so the angle is negative');
});

test('pathEnds uses the penultimate control point of a curve', () => {
  const e = pathEnds('M74,28 C56,8 24,18 24,51 C24,84 56,94 74,74');
  assert.deepEqual([e.sx, e.sy], [74, 28]);
  assert.deepEqual([e.ex, e.ey], [74, 74]);
});

test('pathEnds refuses a path it cannot read', () => {
  assert.equal(pathEnds('M10'), null);
  assert.equal(pathEnds(''), null);
});

test('pathNumbers handles decimals and negatives', () => {
  assert.deepEqual(pathNumbers('M-1.5,2 L3,-4.25'), [-1.5, 2, 3, -4.25]);
});

test('markHits covers each sample once and reports new coverage only', () => {
  const samples = [[0, 0], [10, 0], [100, 100]];
  const hits = new Set();
  assert.equal(markHits(samples, hits, [5, 0], 16), 2, 'both near points');
  assert.equal(markHits(samples, hits, [5, 0], 16), 0, 'already counted');
  assert.equal(markHits(samples, hits, [100, 100], 16), 1);
  assert.equal(hits.size, 3);
});

test('markHits respects the tolerance boundary', () => {
  const samples = [[0, 0]];
  assert.equal(markHits(samples, new Set(), [15.9, 0], 16), 1);
  assert.equal(markHits(samples, new Set(), [16.1, 0], 16), 0);
});

test('seed vectors are five fixed, non-random offsets', () => {
  assert.equal(SEED_VECTORS.length, 5);
  assert.ok(SEED_VECTORS.every((v) => v.length === 2 && v.every(Number.isFinite)));
});
