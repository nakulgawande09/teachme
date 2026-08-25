/**
 * Pure geometry for the trace surface. No DOM writes, no state — everything
 * here is unit-testable in node.
 */

/** How forgiving the hit test is, as a fraction of the slate's edge.
 *  The ghost letter the child is told to follow is ±6.5 viewBox units wide
 *  (stroke-width 13, css/screens.css), so `normal` must be at least that —
 *  a corridor narrower than the visible target rejects honest tracing. */
export const TOL_FACTOR = Object.freeze({ gentle: 0.085, normal: 0.068, strict: 0.055 });

/** Fraction of a MASK component's cells that must be coloured in. */
export const THRESHOLD = Object.freeze({ gentle: 0.60, normal: 0.70, strict: 0.80 });

/** Fraction of a stroke's ORDERED samples that must be passed to accept it.
 *  Higher than the mask threshold because progress already forgives wobble
 *  (the skip-ahead window) — this mostly excuses lifting off a bit early. */
export const PROGRESS = Object.freeze({ gentle: 0.80, normal: 0.88, strict: 0.93 });

/** How many samples a wobble may skip without losing progress. At the sample
 *  density below this bridges an off-corridor arc of roughly 3 × tolerance. */
export const SKIP_AHEAD = 3;

/** A stroke may not use more than this much ink relative to the path length.
 *  An honest wobbly trace lands well under 2×; a raster scribble that games
 *  the ordered check needs 4-6×. Checked at the moment of completion. */
export const MAX_INK_RATIO = 3;

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
  const count = Math.max(8, Math.min(80, Math.ceil(lengthPx / (tol * 0.9)) + 1));
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
  let p = progress;
  for (;;) {
    const windowEnd = Math.min(samples.length, p + skip + 1);
    let moved = false;
    for (let i = p; i < windowEnd; i++) {
      const dx = point[0] - samples[i][0];
      const dy = point[1] - samples[i][1];
      if (dx * dx + dy * dy < (i === 0 ? startTolSq : tolSq)) {
        p = i + 1;
        moved = true;
        break;
      }
    }
    if (!moved || p >= samples.length) return p;
  }
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
