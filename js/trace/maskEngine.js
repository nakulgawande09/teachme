import { pointerPos, eventPoints, threshold } from './geometry.js';
import { createCrayon } from './crayon.js';
import { setVars } from '../core/dom.js';

/**
 * Mask engine — the honest fallback for glyphs whose stroke order has not
 * been reviewed. It knows the SHAPE of the letter (from the font) but not the
 * order or direction of its strokes, and it never pretends otherwise: the
 * direction arrow is hidden in CSS for this engine.
 *
 * To keep the two engines feeling like one game, the ink is split into 2-4
 * connected components which drive the same bead rail. Beads light in
 * whatever order the child covers them — there is no sequential gate here.
 */

const CELL = 10;             // mask cell, in CSS px — DPR-independent on purpose
const MIN_COMPONENT = 0.03;  // drop specks below 3% of total ink
const MAX_BEADS = 4;
const MIN_BEADS = 2;

export function createMaskEngine({ nodes, slate, glyph, fontFamily, strictness, callbacks }) {
  const { canvas, mask, alive, seeds } = nodes;
  const cb = callbacks || {};

  const crayon = createCrayon(canvas, slate);
  const need = threshold(strictness);
  // Credit only what the crayon actually inks: the marking square is sized
  // from the crayon's half-width, not the hit tolerance. (The old radius
  // credited a 50px band for a 14px line — one swipe near the शिरोरेखा
  // finished the whole bar without the child colouring anything.)
  const cellRadius = Math.max(1, Math.round(Math.max(11, slate * 0.047) / 2 / CELL));
  const cols = Math.ceil(slate / CELL);
  const rows = Math.ceil(slate / CELL);

  let components = [];   // Array<Set<cellIndex>>
  let covered = [];      // Array<Set<cellIndex>>
  let completeCount = 0;
  let drawing = false;
  let last = null;
  let finished = false;
  let fontPx = Math.round(slate * 0.72);
  let building = false;
  let buildTries = 0;
  let inkPx = 0;         // total ink, for the fail-open when the mask is gone

  /** Every glyph render — mask, ghost, alive — goes through these params. */
  const applyFont = (ctx, px) => {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `400 ${px}px ${fontFamily}`;
  };

  /** Set up a canvas at the slate's size with DPR handling. */
  function prepare(canvasEl, opts) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvasEl.width = slate * dpr;
    canvasEl.height = slate * dpr;
    const ctx = canvasEl.getContext('2d', opts);
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  /**
   * Build the alpha mask from the glyph as the font actually renders it.
   *
   * `document.fonts.load` is not optional: without it the mask is built from a
   * SYSTEM FALLBACK while the visible ghost renders in the webfont, so the
   * shape the child colours sits somewhere the mask is not. The shipped app
   * had exactly this bug.
   */
  async function build() {
    building = true;
    buildTries++;
    try {
      await buildInner();
    } finally {
      building = false;
    }
  }

  async function buildInner() {
    try {
      await document.fonts.ready;
      await document.fonts.load(`400 ${fontPx}px ${fontFamily}`, glyph);
    } catch (err) {
      console.warn('maskEngine: font not ready, using fallback metrics', err);
    }

    const off = document.createElement('canvas');
    off.width = slate;
    off.height = slate;
    const ctx = off.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      console.error('maskEngine: no offscreen context');
      return;
    }

    fontPx = Math.round(slate * 0.72);
    applyFont(ctx, fontPx);
    // Conjuncts and matra-bearing glyphs (क्ष, ज्ञ, अः) are wider than the box.
    while (ctx.measureText(glyph).width > slate * 0.86 && fontPx > 40) {
      fontPx -= 10;
      applyFont(ctx, fontPx);
    }
    ctx.fillStyle = '#000';
    ctx.fillText(glyph, slate / 2, slate / 2);

    setVars(document.documentElement, { '--mask-px': `${fontPx}px` });
    drawGhost();
    drawAlive();

    let data;
    try {
      data = ctx.getImageData(0, 0, slate, slate).data;
    } catch (err) {
      console.error('maskEngine: could not read glyph mask', err);
      return;
    }

    const ink = new Set();
    for (let y = 0; y < slate; y += CELL) {
      for (let x = 0; x < slate; x += CELL) {
        if (data[(y * slate + x) * 4 + 3] > 60) ink.add(cellIndex(x / CELL | 0, y / CELL | 0));
      }
    }

    components = partition(ink);
    covered = components.map(() => new Set());
    completeCount = 0;
    cb.onMounted?.(components.length);
  }

  const cssVar = (name, fallback) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

  /** Ghost fill plus a dashed outline — same params as the mask, so they align. */
  function drawGhost() {
    const ctx = prepare(mask);
    if (!ctx) return;
    ctx.clearRect(0, 0, slate, slate);
    applyFont(ctx, fontPx);
    ctx.fillStyle = cssVar('--ghost', 'rgba(36,30,24,.13)');
    ctx.fillText(glyph, slate / 2, slate / 2);
    ctx.strokeStyle = cssVar('--guide-live', 'rgba(36,30,24,.22)');
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 6]);
    ctx.strokeText(glyph, slate / 2, slate / 2);
    ctx.setLineDash([]);
  }

  /** The clean letterform, in the track colour, at the exact same position the
   *  child's hand just worked over. That coincidence is the whole lesson. */
  function drawAlive() {
    const canvasEl = document.createElement('canvas');
    const ctx = prepare(canvasEl);
    if (!ctx) return;
    applyFont(ctx, fontPx);
    ctx.fillStyle = cssVar('--track-color', '#BE3F2C');
    ctx.fillText(glyph, slate / 2, slate / 2);
    alive.replaceChildren(canvasEl);
  }

  const cellIndex = (cx, cy) => cy * cols + cx;
  const cellX = (i) => i % cols;
  const cellY = (i) => (i / cols) | 0;

  /** 4-neighbour flood fill, then reduce to a bead-friendly 2-4 groups. */
  function partition(ink) {
    const seen = new Set();
    const groups = [];

    for (const start of ink) {
      if (seen.has(start)) continue;
      const group = new Set();
      const stack = [start];
      seen.add(start);
      while (stack.length) {
        const i = stack.pop();
        group.add(i);
        const x = cellX(i);
        const y = cellY(i);
        for (const n of [i - 1, i + 1, i - cols, i + cols]) {
          if (!ink.has(n) || seen.has(n)) continue;
          // guard the row wrap that i-1 / i+1 would otherwise cross
          if ((n === i - 1 && x === 0) || (n === i + 1 && x === cols - 1)) continue;
          if (n === i - cols && y === 0) continue;
          seen.add(n);
          stack.push(n);
        }
      }
      groups.push(group);
    }

    if (!groups.length) return [];

    const total = ink.size;
    const big = groups.filter((g) => g.size >= total * MIN_COMPONENT);
    const small = groups.filter((g) => g.size < total * MIN_COMPONENT);
    let out = big.length ? big : [groups.reduce((a, b) => (a.size >= b.size ? a : b))];

    // Specks (dots, matra fragments) join their nearest real component rather
    // than becoming beads a child cannot possibly find.
    for (const s of small) mergeInto(out, s);

    // Reading order: top band first, then left to right within the band.
    const band = Math.max(1, Math.round((slate / CELL) * 0.2));
    out.sort((a, b) => {
      const ay = Math.floor(minY(a) / band);
      const by = Math.floor(minY(b) / band);
      return ay !== by ? ay - by : minX(a) - minX(b);
    });

    while (out.length > MAX_BEADS) {
      const smallest = out.reduce((a, b) => (a.size <= b.size ? a : b));
      out = out.filter((g) => g !== smallest);
      mergeInto(out, smallest);
    }
    if (out.length < MIN_BEADS && out[0] && out[0].size > 8) out = splitLargest(out);

    return out;
  }

  function mergeInto(groups, group) {
    if (!groups.length) {
      groups.push(group);
      return;
    }
    const c = centroid(group);
    let best = groups[0];
    let bestD = Infinity;
    for (const g of groups) {
      const gc = centroid(g);
      const d = (gc.x - c.x) ** 2 + (gc.y - c.y) ** 2;
      if (d < bestD) { bestD = d; best = g; }
    }
    for (const i of group) best.add(i);
  }

  function splitLargest(groups) {
    const g = groups[0];
    const c = centroid(g);
    const left = new Set();
    const right = new Set();
    for (const i of g) (cellX(i) < c.x ? left : right).add(i);
    return left.size && right.size ? [left, right] : groups;
  }

  const minY = (g) => Math.min(...[...g].map(cellY));
  const minX = (g) => Math.min(...[...g].map(cellX));

  function centroid(g) {
    let sx = 0;
    let sy = 0;
    for (const i of g) { sx += cellX(i); sy += cellY(i); }
    return { x: sx / g.size, y: sy / g.size };
  }

  function cover(point) {
    const cx = (point[0] / CELL) | 0;
    const cy = (point[1] / CELL) | 0;
    for (let dy = -cellRadius; dy <= cellRadius; dy++) {
      for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        // Bounds first: without this, a pointer in the left gutter wraps to
        // cells on the far side of the row above — margin scribbles were
        // crediting the opposite edge of the glyph.
        if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
        const i = cellIndex(x, y);
        for (let c = 0; c < components.length; c++) {
          if (components[c].has(i)) covered[c].add(i);
        }
      }
    }
    check();
  }

  function check() {
    let done = 0;
    for (let c = 0; c < components.length; c++) {
      if (components[c].size && covered[c].size / components[c].size >= need) done++;
    }
    if (done === completeCount) return;
    completeCount = done;

    if (components.length && completeCount >= components.length) {
      finished = true;
      crayon?.snap();
      cb.onComplete?.();
      return;
    }
    cb.onStrokeAdvance?.(completeCount);
  }

  return {
    get beadCount() { return components.length || 1 },
    get strokeIndex() { return completeCount },

    async mount() { await build(); },

    begin() {
      finished = false;
      completeCount = 0;
      covered = components.map(() => new Set());
      crayon?.clear();
      // Start dot at the top-left of the first component. Direction we do not
      // know and do not show; a starting place we do.
      if (components[0]) {
        setVars(document.documentElement, {
          '--dot-x': `${minX(components[0]) * CELL + CELL / 2}px`,
          '--dot-y': `${minY(components[0]) * CELL + CELL / 2}px`,
        });
      }
    },

    pointerDown(e) {
      if (finished) return;
      // A silently failed mask build (canvas memory, getImageData refusal)
      // used to leave a letter that could never complete. Try again on the
      // child's next touch — the pressure that broke it has often passed.
      if (!components.length && !building && buildTries < 3) {
        build().catch(() => {});
      }
      drawing = true;
      last = pointerPos(e, canvas, slate);
      cover(last);
    },

    pointerMove(e) {
      if (!drawing || finished) return;
      const pts = eventPoints(e, canvas, slate);
      crayon?.drawLine(last, pts);
      let prev = last;
      for (const p of pts) {
        inkPx += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
        prev = p;
        cover(p);
      }
      last = prev;
    },

    /* No failure mode here: partial coverage is simply progress, and the only
       nudge is the stuck timer. Wiping a child's work because they lifted a
       finger would be a punishment for a shape we cannot even sequence. */
    pointerUp() {
      drawing = false;
      // Fail open: if the mask never built, a child who has genuinely
      // coloured a letter's worth of ink still gets the moment, instead of
      // an unwinnable screen with no error anywhere.
      if (!components.length && !building && inkPx > slate * 4 && !finished) {
        finished = true;
        crayon?.snap();
        cb.onComplete?.();
      }
    },
    pointerCancel() { drawing = false },
    retry() { crayon?.rollback() },
    seedNodes() { return seeds },
    destroy() { drawing = false; components = []; covered = [] },
  };
}
