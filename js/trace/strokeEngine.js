import { samplePath, markHits, pointerPos, tolerance, threshold, pathEnds } from './geometry.js';
import { createCrayon, CRAY } from './crayon.js';
import { setVars, setAttr, replaceChildren } from '../core/dom.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Stroke-order engine: an animated demonstration, then the child follows the
 * dots, one stroke at a time, in writing order.
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
  const need = threshold(strictness);
  const f = slate / 100;

  let strokeIndex = 0;
  let samples = [];
  let hits = new Set();
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
    samples = samplePath(p, slate);
    if (!samples.length) console.warn('strokeEngine: could not sample stroke', strokeIndex);
  }

  function nextStroke() {
    crayon?.snap();
    strokeIndex += 1;
    samples = [];
    hits = new Set();

    if (strokeIndex >= strokes.length) {
      finished = true;
      cb.onComplete?.();
      return;
    }
    markGuides();
    positionAffordances();
    cb.onStrokeAdvance?.(strokeIndex);
  }

  return {
    get beadCount() { return strokes.length; },
    get strokeIndex() { return strokeIndex; },

    mount,

    begin() {
      strokeIndex = 0;
      samples = [];
      hits = new Set();
      finished = false;
      crayon?.clear();
      markGuides();
      positionAffordances();
    },

    pointerDown(e) {
      if (finished) return;
      ensureSamples();
      drawing = true;
      last = pointerPos(e, canvas, slate);
      markHits(samples, hits, last, tol);
    },

    pointerMove(e) {
      if (!drawing || finished) return;
      const p = pointerPos(e, canvas, slate);
      crayon?.draw(last, p);
      last = p;
      markHits(samples, hits, p, tol);

      // Completes mid-drag: the child does not have to lift a finger to
      // succeed, and the letter finishes itself under their hand.
      if (samples.length && hits.size / samples.length >= need) {
        drawing = false;
        nextStroke();
      }
    },

    pointerUp() {
      if (!drawing) return;
      drawing = false;
      // Below threshold on lift: wipe only this stroke, keep the accepted ones.
      if (samples.length && hits.size / samples.length < need) {
        crayon?.rollback();
        hits = new Set();
        cb.onRetry?.();
      }
    },

    /** Only the current stroke is cleared, never the whole glyph. */
    retry() {
      crayon?.rollback();
      hits = new Set();
    },

    seedNodes() {
      return seeds;
    },

    /* The slate's nodes are reused across letters — mount() replaces their
       children — so there is nothing to tear down but our own bookkeeping. */
    destroy() {
      drawing = false;
      samples = [];
      hits = new Set();
    },
  };
}
