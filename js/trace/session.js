import { dispatch, getState } from '../core/app.js';
import { A } from '../core/actions.js';
import { createTimers } from '../core/timers.js';
import { need, setVars, replaceChildren, el } from '../core/dom.js';
import { slateSize, SEED_VECTORS } from './geometry.js';
import { createStrokeEngine } from './strokeEngine.js';
import { createMaskEngine } from './maskEngine.js';
import { pickEngine, strokesFor } from '../data/strokes.js';
import { CRAY } from './crayon.js';
import * as progress from '../storage/progress.js';
import { snapshot } from '../storage/store.js';

/**
 * The trace lifecycle, above whichever engine is running. This module owns the
 * demo, the stuck timer, the progress recording and comeAlive() — and after
 * `pickEngine` it never branches on engine type again. That is what makes the
 * two engines feel like one game.
 */

const ALIVE_STEP2_MS = 400;
const CELEBRATE_MS = 1450;
const DEMO_GAP_MS = 110;
const RESTART_FLICKER_MS = 40;
const RETRY_CHIP_MS = 900;

const timers = createTimers('trace');

let engine = null;
let nodes = null;
let current = null;      // {trackId, letter, engineKind}
let attemptStart = 0;
let abort = null;
let say = async () => {};

export function configure({ speakFn }) {
  if (typeof speakFn === 'function') say = speakFn;
}

function collectNodes() {
  if (nodes) return nodes;
  nodes = {
    slate: need('slate'),
    svg: need('slateSvg'),
    ghosts: need('slateGhosts'),
    guides: need('slateGuides'),
    demo: need('slateDemo'),
    mask: need('slateMask'),
    canvas: need('slateCanvas'),
    alive: need('slateAlive'),
    dot: need('slateDot'),
    arrow: need('slateArrow'),
    seeds: need('slateSeeds'),
  };
  return nodes;
}

/** Five fixed vectors, driven through CSS custom properties by one keyframe. */
function mountSeeds(host) {
  replaceChildren(
    host,
    SEED_VECTORS.map((v, i) => {
      const seed = el('span', { class: 'seed', 'data-motion': '' });
      seed.style.background = CRAY[i % CRAY.length];
      seed.style.setProperty('--tx', `${v[0]}px`);
      seed.style.setProperty('--ty', `${v[1]}px`);
      return seed;
    })
  );
}

/** Enter the trace screen for one letter. */
export async function open(trackId, letter, track) {
  destroy();

  const n = collectNodes();
  const slate = slateSize();
  const strictness = getState().settings.strictness;
  const kind = track.traceable ? pickEngine(letter.glyph) : 'mask';

  setVars(document.documentElement, { '--slate': `${slate}px` });
  mountSeeds(n.seeds);

  const callbacks = {
    onStrokeAdvance: (i) => {
      dispatch(A.TRACE_ADVANCE, { strokeIndex: i });
      startStuckTimer();
    },
    onRetry: () => {
      progress.recordRetry(trackId, letter.glyph);
      dispatch(A.TRACE_RETRY, { on: true });
      timers.t(() => dispatch(A.TRACE_RETRY, { on: false }), RETRY_CHIP_MS);
      replayDemo();
      startStuckTimer();
    },
    onComplete: () => comeAlive(),
    onMounted: (count) => dispatch(A.TRACE_BEGIN, { engine: kind, strokeCount: count }),
  };

  if (kind === 'stroke') {
    const strokes = strokesFor(letter.glyph);
    engine = createStrokeEngine({ nodes: n, slate, strokes, strictness, callbacks });
    engine.mount();
    dispatch(A.TRACE_BEGIN, { engine: 'stroke', strokeCount: engine.beadCount });
  } else {
    n.ghosts.replaceChildren();
    n.guides.replaceChildren();
    n.demo.replaceChildren();
    engine = createMaskEngine({
      nodes: n,
      slate,
      glyph: letter.glyph,
      fontFamily: track.id === 'en' ? "'Andika', sans-serif" : "'Tiro Devanagari Marathi', serif",
      strictness,
      callbacks,
    });
    dispatch(A.TRACE_BEGIN, { engine: 'mask', strokeCount: 1 });
    await engine.mount();
  }

  current = { trackId, letter, track, kind };
  attemptStart = performance.now();
  progress.recordAttempt(trackId, letter.glyph);

  engine.begin();
  bindPointer(n.canvas);
  runDemo();
}

function bindPointer(canvas) {
  abort = new AbortController();
  const { signal } = abort;
  const guard = (fn) => (e) => {
    e.preventDefault();
    try {
      fn(e);
    } catch (err) {
      console.error('trace: pointer handler failed', err);
    }
  };

  canvas.addEventListener('pointerdown', guard((e) => {
    // An impatient toddler must never be made to sit through the animation.
    if (getState().trace.stage === 'demo') {
      timers.clearAll();
      dispatch(A.TRACE_DEMO, { on: false });
      dispatch(A.TRACE_STAGE, { stage: 'trace' });
      startStuckTimer();
    }
    try { canvas.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
    engine?.pointerDown(e);
  }), { signal });

  canvas.addEventListener('pointermove', guard((e) => engine?.pointerMove(e)), { signal });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
    canvas.addEventListener(ev, guard((e) => engine?.pointerUp(e)), { signal });
  }
}

function runDemo() {
  const count = Math.max(1, getState().trace.strokeCount);
  const demoMs = 850;
  setVars(document.documentElement, { '--demo-ms': `${demoMs}ms` });
  dispatch(A.TRACE_STAGE, { stage: 'demo' });
  dispatch(A.TRACE_DEMO, { on: true });

  timers.t(() => {
    dispatch(A.TRACE_STAGE, { stage: 'trace' });
    startStuckTimer();
  }, count * (demoMs + DEMO_GAP_MS) + 250);
}

/** Hide, wait 40ms, show — the flicker is what restarts the CSS animation. */
export function replayDemo() {
  dispatch(A.TRACE_DEMO, { on: false });
  timers.t(() => dispatch(A.TRACE_DEMO, { on: true }), RESTART_FLICKER_MS);
}

function startStuckTimer() {
  const seconds = getState().settings.helpDelaySec;
  dispatch(A.TRACE_STUCK, { on: false });
  if (!seconds) return; // "never" — some children find the replay distracting
  timers.t(() => {
    dispatch(A.TRACE_STUCK, { on: true });
    replayDemo();
  }, seconds * 1000);
}

/**
 * The signature moment. Identical for both engines — only what sits inside
 * `.slate__alive` differs, and a child cannot tell which one ran.
 */
function comeAlive() {
  if (!current) return;
  timers.clearAll();

  const { trackId, letter, track } = current;
  progress.recordCompletion(trackId, letter.glyph, performance.now() - attemptStart);
  // Storage is the source of truth, so state has to be told. Without this the
  // grid's amber dot only appears after a reload.
  dispatch(A.PROGRESS_LOAD, { progress: snapshot().progress });

  dispatch(A.TRACE_ALIVE, { step: 1 });
  say(letter.keyword || letter.glyph, track.lang, {
    key: `${trackId}/${letter.glyph}/keyword`,
  });

  timers.t(() => dispatch(A.TRACE_ALIVE, { step: 2 }), ALIVE_STEP2_MS);
  timers.t(() => dispatch(A.OVERLAY, { overlay: 'celebrate' }), CELEBRATE_MS);
}

/** Re-measure on rotate. The attempt restarts rather than rescaling pixels —
 *  scaling ImageData is lossy and the failure looks like a smear. */
export function resize() {
  if (!current || getState().screen !== 'trace') return;
  const { trackId, letter, track } = current;
  open(trackId, letter, track);
}

export function destroy() {
  timers.clearAll();
  abort?.abort();
  abort = null;
  engine?.destroy();
  engine = null;
  current = null;
}

export const isOpen = () => !!current;
