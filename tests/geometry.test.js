import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  slateSize, tolerance, threshold, progressNeed, pathEnds, pathNumbers,
  markHits, advanceProgress, SEED_VECTORS, MAX_INK_RATIO, SKIP_AHEAD, inkBudget,
  reachedEnd, endWindow, THRESHOLD, PROGRESS, END_MAX_RATIO, END_MIN_PX,
} from '../js/trace/geometry.js';

test('the slate is square and always fits the viewport', () => {
  assert.equal(slateSize(390, 844), 350);      // 844 * 0.44, width-limited
  assert.equal(slateSize(1440, 2000), 460);    // clamped down to the 460 ceiling
  assert.equal(slateSize(300, 900), 260);      // width-limited: 300 - 40
});

/* A slate taller than (viewport − chrome) gets clipped, and a clipped
   baseline is a stroke that can never be finished. The old 220 floor forced
   exactly that on landscape phones and short desktop windows. */
test('short viewports get a slate that fits instead of one that clips', () => {
  assert.ok(slateSize(844, 390) <= 390 - 200, 'landscape phone must not clip');
  assert.equal(slateSize(844, 390), 160);
  assert.equal(slateSize(320, 480), 211);      // 480*0.44, no longer forced to 220
  assert.ok(slateSize(1000, 300) >= 160, 'a floor still exists for tiny heights');
});

test('tolerance scales with the slate but never goes below a fingertip', () => {
  assert.ok(Math.abs(tolerance(400, 'normal') - 27.2) < 0.01);
  assert.ok(tolerance(400, 'gentle') > tolerance(400, 'strict'));
  assert.equal(tolerance(200, 'strict'), 16, 'floor applies on a small slate');
  assert.equal(tolerance(400, 'nonsense'), tolerance(400, 'normal'), 'unknown falls back');
});

/* The ghost letter the child follows is ±6.5 viewBox units wide. A corridor
   narrower than the visible target rejects honest tracing — the exact field
   bug: "correct strokes rejected". */
test('the normal corridor is at least as wide as the ghost letter', () => {
  const slate = 350;
  const ghostHalfWidth = (13 / 2) * (slate / 100);
  assert.ok(tolerance(slate, 'normal') >= ghostHalfWidth,
    'tracing inside the visible letter must always count');
});

test('thresholds are ordered and default safely', () => {
  assert.ok(threshold('gentle') < threshold('normal'));
  assert.ok(threshold('normal') < threshold('strict'));
  // Assert the FALLBACK, not the number: pinning the literal here only made
  // the test fail when the value was deliberately raised.
  assert.equal(threshold(undefined), THRESHOLD.normal);
  assert.equal(threshold('nonsense'), THRESHOLD.normal);
  assert.ok(progressNeed('gentle') < progressNeed('normal'));
  assert.ok(progressNeed('normal') < progressNeed('strict'));
  assert.equal(progressNeed(undefined), progressNeed('normal'));
});

/* A child colouring two thirds of अ had the letter finish under their hand.
   Whatever these are tuned to, they must demand most of the shape. */
test('a mask letter is not finished when a third of it is blank', () => {
  assert.ok(THRESHOLD.gentle >= 0.75, 'even the gentlest needs most of the shape');
  assert.ok(THRESHOLD.normal >= 0.85);
  assert.ok(THRESHOLD.strict <= 0.97, 'but never so strict it cannot be met');
});

/* ── the end anchor ────────────────────────────────────────────────────── */

test('reachedEnd is true only near the last sample', () => {
  const win = 18;
  assert.equal(reachedEnd(LINE, LINE[LINE.length - 1], win), true, 'exactly at the end');
  assert.equal(reachedEnd(LINE, LINE[0], win), false, 'at the start is not the end');
  assert.equal(reachedEnd(LINE, LINE[LINE.length - 3], win), false, 'three samples short');
  assert.equal(reachedEnd([], [0, 0], win), false, 'an unsampled stroke has no end');
});

/* The corridor has to be at least as wide as the ghost letter or honest
   tracing is rejected — but on A's 98px crossbar that same 23.8px is a
   QUARTER of the stroke, and stopping a quarter short read as arriving. */
test('the arrival window shrinks with the stroke, so short strokes must be finished', () => {
  const tol = 23.8;
  assert.equal(endWindow(tol, 752), tol, 'a long stroke keeps the corridor');
  assert.ok(endWindow(tol, 98) < tol * 0.5, "A's crossbar gets a much tighter window");
  assert.equal(endWindow(tol, 98), 98 * END_MAX_RATIO);
  assert.equal(endWindow(tol, 10), END_MIN_PX, 'never zero, or a tiny stroke is unwinnable');
  // Monotonic: a longer stroke never gets a tighter window than a shorter one.
  let prev = 0;
  for (const len of [10, 50, 98, 200, 400, 800]) {
    const w = endWindow(tol, len);
    assert.ok(w >= prev, `window must not shrink as the stroke grows (${len}px)`);
    prev = w;
  }
});

test('stopping a quarter short of a SHORT stroke does not count as arriving', () => {
  const tol = 23.8;
  const CROSSBAR = Array.from({ length: 6 }, (_, i) => [10 + i * 19.6, 50]); // 98px
  const win = endWindow(tol, 98);
  const quarterShort = [10 + 98 * 0.76, 50];
  assert.equal(reachedEnd(CROSSBAR, quarterShort, win), false);
  assert.equal(reachedEnd(CROSSBAR, [10 + 98 * 0.97, 50], win), true, 'but nearly there does');
});

/* The exact shape of the report: a stroke drawn to 90% of its length passed
   the sample check and completed, with the child still mid-stroke. */
test('following the corridor is not enough without arriving', () => {
  const tol = 18;
  const drawn = LINE.slice(0, Math.round(LINE.length * 0.9));
  let p = 0;
  let atEnd = false;
  for (const pt of drawn) {
    p = advanceProgress(LINE, p, pt, tol);
    if (reachedEnd(LINE, pt, endWindow(tol, LINE_LEN))) atEnd = true;
  }
  assert.ok(p / LINE.length >= progressNeed('normal'),
    'the sample check alone is satisfied — this is why it used to complete');
  assert.equal(atEnd, false, 'but the end was never reached, so the stroke is not done');
});

test('an honest trace all the way to the end does complete', () => {
  const tol = 18;
  let p = 0;
  let atEnd = false;
  for (const [x, y] of LINE) {
    const pt = [x + 6, y];                 // a little wobble, inside the corridor
    p = advanceProgress(LINE, p, pt, tol);
    if (reachedEnd(LINE, pt, endWindow(tol, LINE_LEN))) atEnd = true;
  }
  assert.ok(atEnd && p / LINE.length >= progressNeed('normal'));
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

/* ── ordered progress: the stroke validator ────────────────────────────── */

// A straight vertical stroke, sampled every 15px — like a rendered path.
const LINE = Array.from({ length: 21 }, (_, i) => [100, 20 + i * 15]);
const LINE_LEN = 20 * 15;
const TOL = 18;

const run = (points, samples = LINE) => {
  let p = 0;
  for (const pt of points) p = advanceProgress(samples, p, pt, TOL);
  return p;
};

test('an honest wobbly trace completes', () => {
  // Follow the line downward with ±14px of wobble — inside tolerance.
  const trace = LINE.map(([x, y], i) => [x + (i % 2 ? 14 : -14), y + 4]);
  assert.equal(run(trace), LINE.length);
});

test('a trace that starts away from the start dot earns nothing', () => {
  // Perfect following, but beginning halfway down the stroke.
  const fromMiddle = LINE.slice(10);
  assert.equal(run(fromMiddle), 0, 'must start at the dot');
});

test('drawing the stroke backwards never comes close to acceptance', () => {
  // The finger ends at the start dot, so the start window's few samples are
  // legitimately touched — but nothing beyond them ever can be.
  const backwards = LINE.slice().reverse();
  const p = run(backwards);
  assert.ok(p / LINE.length < 0.4, `backwards may only graze the start window, got ${p}/${LINE.length}`);
  assert.ok(p / LINE.length < progressNeed('gentle'), 'far below even the gentlest acceptance');
});

test('a wobble off the corridor is bridged, a long detour is not', () => {
  // Off the line for 2 samples' worth mid-stroke, then back on: bridged.
  const detour = LINE.map(([x, y], i) => (i >= 8 && i <= 9 ? [x + 60, y] : [x, y]));
  assert.equal(run(detour), LINE.length, 'short wobbles must not cost progress');

  // Off the line for far longer than the skip window: progress stalls there.
  const longDetour = LINE.map(([x, y], i) => (i >= 8 ? [x + 60, y] : [x, y]));
  const p = run(longDetour);
  assert.ok(p <= 8 + SKIP_AHEAD, 'a long detour must not be bridged');
});

test('a lift-and-resume keeps its progress', () => {
  let p = 0;
  for (const pt of LINE.slice(0, 10)) p = advanceProgress(LINE, p, pt, TOL);
  const atLift = p;
  assert.ok(atLift >= 10);
  // Second dab resumes where the first ended.
  for (const pt of LINE.slice(9)) p = advanceProgress(LINE, p, pt, TOL);
  assert.equal(p, LINE.length);
});

/* The exact attack from the field report: a raster scribble over the glyph's
   bounding box. Ordered progress makes most orientations fail outright; the
   one that tracks the stroke's own direction is caught by the ink budget. */
test('a raster scribble cannot pass as a stroke', () => {
  const sweeps = [];
  let ink = 0;
  let prev = null;
  // Horizontal sweeps marching down — the scribble that beat the old check.
  for (let y = 10; y <= 330; y += 30) {
    for (let x = 40; x <= 160; x += 10) {
      const px = (y / 30) % 2 ? 200 - x : x; // boustrophedon, like a real scribble
      sweeps.push([px, y]);
      if (prev) ink += Math.hypot(px - prev[0], y - prev[1]);
      prev = [px, y];
    }
  }
  const p = run(sweeps);
  const pathLen = 15 * (LINE.length - 1);
  const budget = inkBudget(pathLen, 350);
  const completed = p / LINE.length >= 0.88;
  assert.ok(!completed || ink > budget,
    'a scribble must either fail the ordered check or blow the ink budget');
  assert.ok(ink > budget, 'this scribble sweeps many times the budget in ink');
});

/* The budget must NOT fire on a short stroke a child scrubs over — A's
   crossbar is under a third of the slate, and back-and-forth on it is
   normal toddler drawing, not a scribble. */
test('the ink budget has a floor that short strokes can live inside', () => {
  const slate = 343;
  const crossbar = 96;                    // A's crossbar at this slate
  assert.equal(inkBudget(crossbar, slate), slate * 2, 'the floor governs short strokes');
  assert.ok(inkBudget(crossbar, slate) > crossbar * 5,
    'scrubbing a short stroke five times over is still honest work');

  const longStroke = 600;                 // an O, most of the slate
  assert.equal(inkBudget(longStroke, slate), longStroke * MAX_INK_RATIO,
    'long strokes are governed by the ratio');

  // A full-glyph raster scribble is far above either.
  assert.ok(slate * 12 > inkBudget(longStroke, slate),
    'a scribble crossing the box a dozen times is still caught');
});

test('markHits covers each sample once and reports new coverage only', () => {
  const samples = [[0, 0], [10, 0], [100, 100]];
  const hits = new Set();
  assert.equal(markHits(samples, hits, [5, 0], 16), 2, 'both near points');
  assert.equal(markHits(samples, hits, [5, 0], 16), 0, 'already counted');
  assert.equal(markHits(samples, hits, [100, 100], 16), 1);
  assert.equal(hits.size, 3);
});

test('seed vectors are five fixed, non-random offsets', () => {
  assert.equal(SEED_VECTORS.length, 5);
  assert.ok(SEED_VECTORS.every((v) => v.length === 2 && v.every(Number.isFinite)));
});
