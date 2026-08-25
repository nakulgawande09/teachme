import { dispatch, getState } from '../core/app.js';
import { A } from '../core/actions.js';
import { createTimers } from '../core/timers.js';
import { need, setAttr, setVars, replaceChildren, el } from '../core/dom.js';
import { slateSize, SEED_VECTORS } from './geometry.js';
import { createStrokeEngine } from './strokeEngine.js';
import { createMaskEngine } from './maskEngine.js';
import { pickEngine, strokesFor } from '../data/strokes.js';
import { CRAY } from './crayon.js';
import * as progress from '../storage/progress.js';
import { snapshot } from '../storage/store.js';
import * as daily from '../features/daily.js';

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
let current = null;      // {trackId, letter, track, kind, slate}
let attemptStart = 0;
let abort = null;
let activePointer = null;
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
export async function open(trackId, letter, track, { fresh = true } = {}) {
  destroy();

  const n = collectNodes();
  // The rendered size comes from state (render/attrs.js writes --slate on
  // #app every paint); the engine must use the SAME number or its tolerance
  // silently rescales against what is actually on screen.
  const slate = getState().layout.slate || slateSize();
  const strictness = getState().settings.strictness;
  const kind = track.traceable ? pickEngine(letter.glyph) : 'mask';

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

  current = { trackId, letter, track, kind, slate };
  attemptStart = performance.now();
  // A resize re-open is the same attempt continuing, not a new try — counting
  // it again would flag every rotated phone as a struggling child.
  if (fresh) progress.recordAttempt(trackId, letter.glyph);

  engine.begin();
  bindPointer(n.canvas);
  runDemo();
}

function bindPointer(canvas) {
  abort = new AbortController();
  const { signal } = abort;
  activePointer = null;
  const guard = (fn) => (e) => {
    e.preventDefault();
    try {
      fn(e);
    } catch (err) {
      console.error('trace: pointer handler failed', err);
    }
  };

  // Presentation-only, written directly like the hold-door's progress bar:
  // hides the pulsing start dot while ink is flowing.
  const inking = (on) => setAttr(document.getElementById('app'), 'data-inking', on ? '1' : '');

  canvas.addEventListener('pointerdown', guard((e) => {
    // One finger drives the crayon. A palm or second finger landing must not
    // scribble lines between the two contacts or steal the stroke.
    if (activePointer !== null) return;
    activePointer = e.pointerId;
    inking(true);

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

  canvas.addEventListener('pointermove', guard((e) => {
    if (e.pointerId !== activePointer) return;
    engine?.pointerMove(e);
  }), { signal });

  // A deliberate lift is judged; a cancel (palm, edge gesture, capture lost)
  // is not the child's fault and must never read as a wrong answer.
  canvas.addEventListener('pointerup', guard((e) => {
    if (e.pointerId !== activePointer) return;
    activePointer = null;
    inking(false);
    engine?.pointerUp(e);
  }), { signal });
  for (const ev of ['pointercancel', 'pointerleave']) {
    canvas.addEventListener(ev, guard((e) => {
      if (e.pointerId !== activePointer) return;
      activePointer = null;
      inking(false);
      (engine?.pointerCancel || engine?.pointerUp)?.call(engine, e);
    }), { signal });
  }
}

const demoDuration = () =>
  Math.max(1, getState().trace.strokeCount) * (850 + DEMO_GAP_MS) + 250;

function runDemo() {
  setVars(document.documentElement, { '--demo-ms': '850ms' });
  dispatch(A.TRACE_STAGE, { stage: 'demo' });
  dispatch(A.TRACE_DEMO, { on: true });

  timers.t(() => {
    // The demo layer must actually leave when the run ends — data-demo is no
    // longer gated on the stage, so a replay can work mid-trace too.
    dispatch(A.TRACE_DEMO, { on: false });
    dispatch(A.TRACE_STAGE, { stage: 'trace' });
    startStuckTimer();
  }, demoDuration());
}

/** Hide, wait 40ms, show — the flicker is what restarts the CSS animation.
 *  The overlay stands down again once the run has played out. */
export function replayDemo() {
  dispatch(A.TRACE_DEMO, { on: false });
  timers.t(() => dispatch(A.TRACE_DEMO, { on: true }), RESTART_FLICKER_MS);
  timers.t(() => dispatch(A.TRACE_DEMO, { on: false }), RESTART_FLICKER_MS + demoDuration());
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

  // Tracing a letter counts as recalling it: the box moves on and the letter
  // comes round again in a day, then two, then four.
  const state = getState();
  if (state.daily.active && daily.current()?.glyph === letter.glyph) daily.complete(true);
  if (state.firstRun) dispatch(A.FIRST_RUN_DONE);

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
 *  scaling ImageData is lossy and the failure looks like a smear. Small
 *  height twitches (a collapsing URL bar fires resize on every scroll frame
 *  on Android) must NOT restart: they were silently deleting the child's
 *  in-progress stroke several times a minute. */
export function resize() {
  if (!current || getState().screen !== 'trace') return;
  const next = getState().layout.slate || slateSize();
  if (Math.abs(next - current.slate) < 12) return;
  const { trackId, letter, track } = current;
  open(trackId, letter, track, { fresh: false });
}

export function destroy() {
  timers.clearAll();
  abort?.abort();
  abort = null;
  activePointer = null;
  setAttr(document.getElementById('app'), 'data-inking', '');
  engine?.destroy();
  engine = null;
  current = null;
}

export const isOpen = () => !!current;
