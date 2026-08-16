/**
 * Pure geometry for the trace surface. No DOM writes, no state — everything
 * here is unit-testable in node.
 */

/** How forgiving the hit test is, as a fraction of the slate's edge. */
export const TOL_FACTOR = Object.freeze({ gentle: 0.070, normal: 0.055, strict: 0.045 });

/** Fraction of a stroke's sample points that must be covered to accept it. */
export const THRESHOLD = Object.freeze({ gentle: 0.60, normal: 0.70, strict: 0.80 });

/** Sample points taken along each stroke. 26 is dense enough at 460px. */
export const SAMPLES = 26;

/**
 * Slate edge in CSS px: square, never wider than the viewport, never taller
 * than 44% of it, never below a usable 220 or above 460.
 */
export function slateSize(w = window.innerWidth, h = window.innerHeight) {
  return Math.round(Math.max(220, Math.min(w - 40, h * 0.44, 460)));
}

export const tolerance = (slate, strictness = 'normal') =>
  Math.max(16, slate * (TOL_FACTOR[strictness] ?? TOL_FACTOR.normal));

export const threshold = (strictness = 'normal') =>
  THRESHOLD[strictness] ?? THRESHOLD.normal;

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
 * Sample a rendered SVG path into slate coordinates.
 *
 * The path MUST be rendered when this runs — `display:none` makes
 * getTotalLength() return 0 in some engines, which silently yields a stroke
 * that can never be completed. Callers sample lazily, on first pointerdown.
 *
 * @param {SVGPathElement} path
 * @param {number} slate edge length in CSS px
 * @returns {Array<[number,number]>}
 */
export function samplePath(path, slate) {
  if (!path || typeof path.getPointAtLength !== 'function') return [];
  let length = 0;
  try {
    length = path.getTotalLength();
  } catch {
    return [];
  }
  if (!length) return [];

  const f = slate / 100; // paths are authored in a 0-100 viewBox
  const out = [];
  for (let k = 0; k < SAMPLES; k++) {
    const pt = path.getPointAtLength((length * k) / (SAMPLES - 1));
    out.push([pt.x * f, pt.y * f]);
  }
  return out;
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

/** Fixed, hand-placed scatter vectors for the five celebration seeds. */
export const SEED_VECTORS = Object.freeze([
  [-70, -54], [62, -62], [-84, 26], [86, 18], [6, -92],
]);
