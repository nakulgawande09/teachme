/**
 * Pure geometry for the trace surface. No DOM writes, no state — everything
 * here is unit-testable in node.
 */

/** How forgiving the hit test is, as a fraction of the slate's edge.
 *  The ghost letter the child is told to follow is ±6.5 viewBox units wide
 *  (stroke-width 13, css/screens.css), so `normal` must be at least that —
 *  a corridor narrower than the visible target rejects honest tracing. */
export const TOL_FACTOR = Object.freeze({ gentle: 0.085, normal: 0.068, strict: 0.055 });

/** Fraction of a MASK component's cells that must be coloured in.
 *  At the old 0.70 a child coloured about two thirds of अ and the letter
 *  declared itself finished under their hand — measured, not guessed. */
export const THRESHOLD = Object.freeze({ gentle: 0.80, normal: 0.90, strict: 0.95 });

/** Fraction of a stroke's ORDERED samples that must be passed to accept it.
 *
 *  This governs the MIDDLE of the stroke only. On its own it let a stroke
 *  drawn to 90% of its length count as finished, because 88% of the samples
 *  had been passed and nothing ever asked whether the child got to the end.
 *  Both ends are now anchored explicitly — see reachedEnd — so this number
 *  can stay generous about wobble without also excusing an unfinished
 *  stroke. */
export const PROGRESS = Object.freeze({ gentle: 0.88, normal: 0.95, strict: 0.98 });

/** The end window may never be more than this much of the stroke's own
 *  length, and never smaller than a couple of px of slop. */
export const END_MAX_RATIO = 0.10;
export const END_MIN_PX = 6;

/**
 * How close to the last sample counts as having arrived.
 *
 * Tolerance does two different jobs and they need different numbers. Across
 * the stroke it is a CORRIDOR, and it has to be at least as wide as the ghost
 * letter or honest tracing gets rejected — that was the original field bug.
 * Along the stroke it is an ARRIVAL test, and there a fixed 23.8px corridor
 * is a quarter of A's 98px crossbar, so stopping a quarter short still read
 * as reaching the end. The window is therefore capped to a tenth of the
 * stroke's own length: short strokes get a short window, long ones keep the
 * corridor's forgiveness.
 */
export function endWindow(tol, lengthPx) {
  return Math.max(END_MIN_PX, Math.min(tol, lengthPx * END_MAX_RATIO));
}

/**
 * Has this point reached the end of the stroke?
 *
 * The stroke is not finished until the child gets there. A percentage of
 * samples passed cannot express that — 88% of a stroke IS 88% of its samples,
 * so stopping short looked identical to wobbling through the middle.
 */
export function reachedEnd(samples, point, window) {
  if (!samples.length) return false;
  const last = samples[samples.length - 1];
  const dx = point[0] - last[0];
  const dy = point[1] - last[1];
  return dx * dx + dy * dy < window * window;
}

/** How many samples a wobble may skip without losing progress. At the sample
 *  density below this bridges an off-corridor arc of roughly 3 × tolerance. */
export const SKIP_AHEAD = 3;

/** A stroke may not use more than this much ink relative to the path length.
 *  An honest wobbly trace lands well under 2×; a raster scribble that games
 *  the ordered check needs 4-6×. Checked at the moment of completion. */
export const MAX_INK_RATIO = 3;

/**
 * The ink a stroke may spend before it reads as a sweep rather than a trace.
 *
 * The ratio alone is far too tight on SHORT strokes: A's crossbar is under a
 * third of the slate, and a child scrubbing back and forth over it a few
 * times — exactly what a two-year-old does — blows a 3× budget while doing
 * nothing wrong. The floor is what makes the check fire only on a real
 * scribble, which has to cross the whole glyph box many times over.
 */
export const inkBudget = (lengthPx, slate) =>
  Math.max(lengthPx * MAX_INK_RATIO, slate * 2);

/**
 * Slate edge in CSS px: square, never wider than the viewport, preferring 44%
 * of its height, and never taller than the height minus the trace screen's
 * own chrome (~240px) — a slate larger than its space gets clipped, and a
 * clipped baseline is a stroke that can never be finished.
 */
export function slateSize(w = window.innerWidth, h = window.innerHeight) {
  return Math.round(Math.min(Math.max(160, Math.min(h - 240, h * 0.44)), w - 40, 460));
}

export const tolerance = (slate, strictness = 'normal') =>
  Math.max(16, slate * (TOL_FACTOR[strictness] ?? TOL_FACTOR.normal));

export const threshold = (strictness = 'normal') =>
  THRESHOLD[strictness] ?? THRESHOLD.normal;

export const progressNeed = (strictness = 'normal') =>
  PROGRESS[strictness] ?? PROGRESS.normal;

/** Every number in an SVG path `d`, in order. */
export const pathNumbers = (d) => (String(d).match(/-?\d*\.?\d+/g) || []).map(Number);

/**
 * Start point, end point and exit-tangent angle of a path, read straight off
 * its `d` string. Used to place the pulsing start dot and rotate the
 * direction arrow — no DOM measurement needed.
 * @returns {{sx:number,sy:number,ex:number,ey:number,angle:number}|null}
 */
export function pathEnds(d) {
  const n = pathNumbers(d);
  if (n.length < 4) return null;

  const sx = n[0];
  const sy = n[1];
  const ex = n[n.length - 2];
  const ey = n[n.length - 1];
  // The point before the endpoint gives the exit direction. For a two-point
  // line that is the start point, which is exactly right.
  const px = n.length >= 6 ? n[n.length - 4] : sx;
  const py = n.length >= 6 ? n[n.length - 3] : sy;

  return { sx, sy, ex, ey, angle: (Math.atan2(ey - py, ex - px) * 180) / Math.PI };
}

/**
 * Sample a rendered SVG path into slate coordinates, densely enough that
 * consecutive samples sit within one tolerance radius of each other — a
 * finger following the line can then never fall between two samples, and
 * the same tolerance is equally demanding on an 84px crossbar and a 630px O
 * (a fixed count made short strokes ~5× easier than long ones).
 *
 * The path MUST be rendered when this runs — `display:none` makes
 * getTotalLength() return 0 in some engines, which silently yields a stroke
 * that can never be completed. Callers sample lazily, on first pointerdown.
 *
 * @param {SVGPathElement} path
 * @param {number} slate edge length in CSS px
 * @param {number} tol   the acceptance tolerance, in slate px
 * @returns {{points: Array<[number,number]>, lengthPx: number}}
 */
export function samplePath(path, slate, tol = 20) {
  if (!path || typeof path.getPointAtLength !== 'function') return { points: [], lengthPx: 0 };
  let length = 0;
  try {
    length = path.getTotalLength();
  } catch {
    return { points: [], lengthPx: 0 };
  }
  if (!length) return { points: [], lengthPx: 0 };

  const f = slate / 100; // paths are authored in a 0-100 viewBox
  const lengthPx = length * f;
  // Spacing is exactly one tolerance, and the floor is low.
  //
  // At 0.9x tolerance, and worse under the old floor of 8 samples on a short
  // stroke, samples sat far closer together than the corridor is wide — so a
  // finger resting on one sample was inside the corridor of the next two or
  // three, and progress ran ahead of the hand. A's crossbar got 8 samples
  // 13.7px apart inside a 23.8px corridor, and the letter finished with 76%
  // of it drawn. At exactly one tolerance a point clears the sample it is on
  // and no more.
  const count = Math.max(4, Math.min(80, Math.ceil(lengthPx / tol) + 1));
  const points = [];
  for (let k = 0; k < count; k++) {
    const pt = path.getPointAtLength((length * k) / (count - 1));
    points.push([pt.x * f, pt.y * f]);
  }
  return { points, lengthPx };
}

/**
 * Ordered progress along a stroke — the heart of the validation.
 *
 * `progress` is how many samples have been passed IN ORDER. A point advances
 * it only when it lands within tolerance of one of the next SKIP_AHEAD+1
 * samples: the child must start at the start (sample 0 gets a slightly
 * generous radius, anchored to the pulsing dot), travel in the stroke's
 * direction, and may wobble off the corridor for a few samples without
 * losing what they had. Ink far from the line adds nothing; drawing the
 * stroke backwards adds nothing. Pure, and monotonic per call.
 *
 * @returns {number} the new progress
 */
export function advanceProgress(samples, progress, point, tol, skip = SKIP_AHEAD) {
  const tolSq = tol * tol;
  const startTolSq = (tol * 1.5) ** 2;
  const windowEnd = Math.min(samples.length, progress + skip + 1);
  let p = progress;
  // One pass, taking the FURTHEST sample in the window this point reaches.
  //
  // This used to loop: advance to the first match, then rescan from there,
  // and repeat. Each rescan let the same single point step through another
  // sample, so one fingertip could walk several samples forward at once and
  // progress overtook the hand. Scanning to the furthest match keeps the
  // skip-ahead window's forgiveness — a wobble off the corridor is still
  // bridged — without letting one point spend the window more than once.
  for (let i = progress; i < windowEnd; i++) {
    const dx = point[0] - samples[i][0];
    const dy = point[1] - samples[i][1];
    if (dx * dx + dy * dy < (i === 0 ? startTolSq : tolSq)) p = i + 1;
  }
  return p;
}

/**
 * Mark every uncovered sample within `tol` of `point`. Mutates `hits` (a Set
 * of indices) because this runs on every pointermove and allocating a new Set
 * per move would be the one place GC pressure is visible.
 * @returns {number} how many samples this call newly covered
 */
export function markHits(samples, hits, point, tol) {
  const tolSq = tol * tol;
  let added = 0;
  for (let i = 0; i < samples.length; i++) {
    if (hits.has(i)) continue;
    const dx = point[0] - samples[i][0];
    const dy = point[1] - samples[i][1];
    if (dx * dx + dy * dy < tolSq) {
      hits.add(i);
      added++;
    }
  }
  return added;
}

/** Pointer event -> slate coordinates, correcting for any CSS scaling. */
export function pointerPos(event, canvas, slate) {
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return [0, 0];
  return [
    (event.clientX - r.left) * (slate / r.width),
    (event.clientY - r.top) * (slate / r.height),
  ];
}

/**
 * Every position a pointer event carries, coalesced samples included, in
 * slate coordinates. On 120Hz digitisers the browser folds several input
 * samples into one pointermove; reading only the event's own position
 * discards half the child's stroke — visibly chordal ink, and honest fast
 * strokes falling "between" the samples of the hit test.
 */
export function eventPoints(event, canvas, slate) {
  let list = null;
  try {
    if (typeof event.getCoalescedEvents === 'function') list = event.getCoalescedEvents();
  } catch { /* some embedders throw — the event itself is always usable */ }
  const events = list && list.length ? list : [event];
  return events.map((e) => pointerPos(e, canvas, slate));
}

/** Fixed, hand-placed scatter vectors for the five celebration seeds. */
export const SEED_VECTORS = Object.freeze([
  [-70, -54], [62, -62], [-84, 26], [86, 18], [6, -92],
]);
