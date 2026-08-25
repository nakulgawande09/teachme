import {
  samplePath, advanceProgress, eventPoints, tolerance, progressNeed, pathEnds, inkBudget,
} from './geometry.js';
import { createCrayon, CRAY } from './crayon.js';
import { setVars, setAttr, replaceChildren } from '../core/dom.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Stroke-order engine: an animated demonstration, then the child follows the
 * dots, one stroke at a time, in writing order.
 *
 * Validation is ORDERED progress along the path (see advanceProgress in
 * geometry.js): start at the dot, travel the stroke's way, wobble forgiven.
 * Lifting the finger keeps whatever progress was made — toddlers draw in
 * dabs — and only a gesture that drew plenty while following nothing gets
 * wiped and nudged. A stroke whose total ink runs far past the path length
 * is a scribble that happened to sweep the corridor; it is wiped whole
 * rather than accepted.
 *
 * Only reached for glyphs whose paths a human has reviewed — see
 * js/data/strokes.js. Everything else uses the mask engine, which never
 * claims to know a direction.
 */
export function createStrokeEngine({ nodes, slate, strokes, strictness, callbacks }) {
  const { ghosts, guides, demo, canvas, alive, seeds } = nodes;
  const cb = callbacks || {};

  const crayon = createCrayon(canvas, slate);
  const tol = tolerance(slate, strictness);
  const need = progressNeed(strictness);
  const f = slate / 100;

  let strokeIndex = 0;
  let samples = [];
  let lengthPx = 0;
  let progress = 0;
  let strokeInk = 0;       // ink spent on the current stroke, across gestures
  let gestureInk = 0;
  let gestureStart = 0;    // progress when the current gesture began
  let fallbackInk = 0;     // ink spent while a stroke could not be sampled
  let drawing = false;
  let last = null;
  let finished = false;

  const path = (parent, d, attrs = {}) => {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    for (const k in attrs) p.setAttribute(k, attrs[k]);
    parent.appendChild(p);
    return p;
  };

  function mount() {
    ghosts.replaceChildren();
    guides.replaceChildren();
    demo.replaceChildren();
    alive.replaceChildren();

    strokes.forEach((d, i) => {
      path(ghosts, d);
      path(guides, d, { 'data-stroke': String(i), 'data-state': i === 0 ? 'current' : 'pending' });
      // pathLength=1 + dasharray/offset of 1 is what lets ONE keyframe draw a
      // path of any length. Must be an attribute, not a style.
      const p = path(demo, d, { pathLength: '1' });
      p.style.stroke = CRAY[i % CRAY.length];
      p.style.setProperty('--i', String(i));
    });

    const aliveSvg = document.createElementNS(SVG_NS, 'svg');
    aliveSvg.setAttribute('viewBox', '0 0 100 100');
    aliveSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    strokes.forEach((d) => path(aliveSvg, d));
    replaceChildren(alive, [aliveSvg]);

    positionAffordances();
  }

  /** Start dot and direction arrow, read off the current path's `d` string. */
  function positionAffordances() {
    const ends = pathEnds(strokes[strokeIndex]);
    if (!ends) return;
    setVars(document.documentElement, {
      '--dot-x': `${ends.sx * f}px`,
      '--dot-y': `${ends.sy * f}px`,
      '--arrow-x': `${ends.ex * f}px`,
      '--arrow-y': `${ends.ey * f}px`,
      '--arrow-a': `${ends.angle}deg`,
    });
  }

  function markGuides() {
    const list = guides.querySelectorAll('path[data-stroke]');
    list.forEach((p, i) => {
      const state = i < strokeIndex ? 'done' : i === strokeIndex ? 'current' : 'pending';
      setAttr(p, 'data-state', state);
    });
  }

  /** Sampled lazily: the SVG must be RENDERED or getTotalLength() returns 0. */
  function ensureSamples() {
    if (samples.length) return;
    const p = guides.querySelectorAll('path[data-stroke]')[strokeIndex];
    const sampled = samplePath(p, slate, tol);
    samples = sampled.points;
    lengthPx = sampled.lengthPx;
    if (!samples.length) console.warn('strokeEngine: could not sample stroke', strokeIndex);
  }

  function nextStroke() {
    crayon?.snap();
    strokeIndex += 1;
    samples = [];
    lengthPx = 0;
    progress = 0;
    strokeInk = 0;

    if (strokeIndex >= strokes.length) {
      finished = true;
      cb.onComplete?.();
      return;
    }
    markGuides();
    positionAffordances();
    cb.onStrokeAdvance?.(strokeIndex);
  }

  /** The scribble gate, checked only at the moment of completion: coverage
   *  earned with several times more ink than the path is long was swept, not
   *  traced. The whole stroke is wiped so the do-over starts clean. */
  function rejectStroke() {
    drawing = false;
    crayon?.rollback();
    progress = 0;
    strokeInk = 0;
    cb.onRetry?.();
  }

  function feed(points) {
    if (!samples.length) return;
    for (const p of points) progress = advanceProgress(samples, progress, p, tol);
    if (progress / samples.length >= need) {
      if (strokeInk > inkBudget(lengthPx, slate)) {
        rejectStroke();
        return;
      }
      // Completes mid-drag: the child does not have to lift a finger to
      // succeed, and the letter finishes itself under their hand.
      drawing = false;
      nextStroke();
    }
  }

  const inkOf = (from, points) => {
    let d = 0;
    let prev = from;
    for (const p of points) {
      d += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      prev = p;
    }
    return d;
  };

  return {
    get beadCount() { return strokes.length; },
    get strokeIndex() { return strokeIndex; },

    mount,

    begin() {
      strokeIndex = 0;
      samples = [];
      lengthPx = 0;
      progress = 0;
      strokeInk = 0;
      fallbackInk = 0;
      finished = false;
      crayon?.clear();
      markGuides();
      positionAffordances();
    },

    pointerDown(e) {
      if (finished) return;
      ensureSamples();
      drawing = true;
      gestureStart = progress;
      gestureInk = 0;
      crayon?.snapGesture();
      const pts = eventPoints(e, canvas, slate);
      last = pts[pts.length - 1];
      feed(pts);
    },

    pointerMove(e) {
      if (!drawing || finished) return;
      const pts = eventPoints(e, canvas, slate);
      crayon?.drawLine(last, pts);
      const ink = inkOf(last, pts);
      gestureInk += ink;
      strokeInk += ink;
      last = pts[pts.length - 1];
      feed(pts);
    },

    pointerUp() {
      if (!drawing) return;
      drawing = false;

      // Fail open when the path could not be sampled: enough ink advances the
      // stroke rather than trapping the child on an unwinnable screen.
      if (!samples.length) {
        fallbackInk += gestureInk;
        if (fallbackInk > slate) {
          fallbackInk = 0;
          nextStroke();
        }
        return;
      }

      // A deliberate lift keeps its progress — dabs accumulate. Only a
      // gesture that drew a real amount while following nothing gets wiped
      // (that ink alone; earlier productive dabs stay) and earns the nudge.
      if (progress === gestureStart && gestureInk > tol * 3) {
        crayon?.rollbackGesture();
        strokeInk -= gestureInk;
        cb.onRetry?.();
      }
    },

    /** The pointer went away without a deliberate lift — a palm landed, the
     *  edge gesture fired, the finger slid off the slate. No judgment: keep
     *  the ink, keep the progress, just stop drawing. */
    pointerCancel() {
      drawing = false;
    },

    /** Only the current stroke is cleared, never the whole glyph. */
    retry() {
      crayon?.rollback();
      progress = 0;
      strokeInk = 0;
    },

    seedNodes() {
      return seeds;
    },

    /* The slate's nodes are reused across letters — mount() replaces their
       children — so there is nothing to tear down but our own bookkeeping. */
    destroy() {
      drawing = false;
      samples = [];
      progress = 0;
    },
  };
}
