import { dispatch, getState } from '../core/app.js';
import { A } from '../core/actions.js';
import { need, setVar } from '../core/dom.js';

/**
 * Two-factor by dexterity, not by secret: a 1.4s press-and-hold on a
 * deliberately low-contrast target, then an arithmetic question.
 *
 * No PIN. A PIN is one more thing for a parent to forget, and a three-year-old
 * watching over a shoulder learns four digits faster than an adult expects.
 */

const HOLD_MS = 1400;
const POLL_MS = 60;
const MOVE_ABORT_PX = 24;
const SHAKE_MS = 500;
const REGENERATE_AFTER = 2;
const LOCKOUT_AFTER = 3;

const uniq = (arr) => [...new Set(arr)];

function shuffle(arr, rand) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Addition only — multiplication quietly excludes some adults, and this is a
 * speed bump for a small child, not a test of the grown-up.
 */
export function makeQuestion(rand = Math.random) {
  const a = 3 + Math.floor(rand() * 7);   // 3..9
  const b = 4 + Math.floor(rand() * 6);   // 4..9
  const answer = a + b;
  const pool = uniq([answer - 1, answer + 1, answer - 3, answer + 3, answer + b])
    .filter((n) => n > 0 && n !== answer);
  return { a, b, answer, choices: shuffle([answer, ...pool.slice(0, 3)], rand) };
}

/** Wire the hold-to-reveal door. Returns a teardown function. */
export function mountHoldDoor(onOpen) {
  const door = need('holdDoor');
  const root = need('app');
  let interval = 0;
  let startedAt = 0;
  let origin = null;

  const reset = () => {
    clearInterval(interval);
    interval = 0;
    origin = null;
    // Presentation only — 23 dispatches per hold would be reducer noise.
    setVar(root, '--hold-pct', '0%');
  };

  const onDown = (e) => {
    e.preventDefault();
    origin = { x: e.clientX, y: e.clientY };
    startedAt = Date.now();
    clearInterval(interval);
    interval = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - startedAt) / HOLD_MS) * 100);
      setVar(root, '--hold-pct', `${pct}%`);
      if (pct >= 100) {
        reset();
        onOpen();
      }
    }, POLL_MS);
  };

  // A child dragging across the screen must not open the parent area.
  const onMove = (e) => {
    if (!origin) return;
    if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > MOVE_ABORT_PX) reset();
  };

  door.addEventListener('pointerdown', onDown);
  door.addEventListener('pointermove', onMove);
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) {
    door.addEventListener(ev, reset);
  }

  return reset;
}

export function openGate() {
  dispatch(A.GATE_OPEN, { question: makeQuestion() });
  dispatch(A.OVERLAY, { overlay: 'gate' });
}

/**
 * @returns {'pass'|'retry'|'locked'} — three misses closes the gate entirely,
 * so the hold must be repeated. Defeats brute-force tapping without punishing
 * a parent who mis-taps once.
 */
export function answerGate(value, { onPass, onLocked } = {}) {
  const { gate } = getState();
  if (Number(value) === gate.answer) {
    dispatch(A.GATE_RESET);
    onPass?.();
    return 'pass';
  }

  dispatch(A.GATE_WRONG, { on: true });
  setTimeout(() => dispatch(A.GATE_WRONG, { on: false }), SHAKE_MS);

  const misses = getState().gate.misses;
  if (misses >= LOCKOUT_AFTER) {
    dispatch(A.GATE_RESET);
    dispatch(A.OVERLAY, { overlay: null });
    onLocked?.();
    return 'locked';
  }
  if (misses >= REGENERATE_AFTER) {
    setTimeout(() => dispatch(A.GATE_OPEN, { question: makeQuestion() }), SHAKE_MS);
  }
  return 'retry';
}
