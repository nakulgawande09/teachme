import { dispatch, getState } from '../core/app.js';
import { A } from '../core/actions.js';
import { recordUsage, recordSessionStart } from '../storage/progress.js';
import { flush } from '../storage/store.js';

/**
 * Session clock.
 *
 * Deliberately NOT `setTimeout(sessionMin * 60000)`. iOS throttles and
 * suspends background timers, so a naive timeout fires late, or never — and a
 * break prompt that never appears is the same as not having built one.
 *
 * Instead: accumulate wall-clock time only while the page is visible, and
 * check the total on a heartbeat and on every navigation.
 */

const HEARTBEAT_MS = 20000;

let lastMark = 0;
let heartbeat = 0;
let visible = true;

export function start() {
  lastMark = Date.now();
  visible = document.visibilityState === 'visible';
  dispatch(A.SESSION_START, { at: lastMark });
  recordSessionStart();

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onHide);
  heartbeat = setInterval(tick, HEARTBEAT_MS);
}

export function stop() {
  clearInterval(heartbeat);
  heartbeat = 0;
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('pagehide', onHide);
}

function onVisibility() {
  if (document.visibilityState === 'visible') {
    lastMark = Date.now();
    visible = true;
    return;
  }
  tick();
  visible = false;
  flush();
}

function onHide() {
  tick();
  flush();
}

/** Fold elapsed visible time into the session total and re-check the limit. */
export function tick() {
  const now = Date.now();
  if (!visible) {
    lastMark = now;
    return;
  }

  const delta = Math.max(0, now - lastMark);
  lastMark = now;
  if (delta === 0) return;

  recordUsage(delta);

  const state = getState();
  const activeMs = state.session.activeMs + delta;
  const limitMs = state.settings.sessionMin * 60000;
  const breakDue = activeMs >= limitMs;

  dispatch(A.SESSION_TICK, { activeMs, breakDue });

  // Never interrupt the celebration, a screen the child is mid-way through a
  // stroke on, or a moment the mic is live — the break lands at the next
  // natural boundary instead.
  const recording = state.screen === 'words'
    && (state.turn.step === 'record' || state.turn.step === 'playback');
  if (breakDue && !state.overlay && state.screen !== 'trace' && !recording) {
    dispatch(A.OVERLAY, { overlay: 'break' });
  }
}

/** Called at every navigation, so the break can land between activities. */
export function checkAtBoundary() {
  const state = getState();
  if (state.session.breakDue && !state.overlay) {
    dispatch(A.OVERLAY, { overlay: 'break' });
  }
}

export function extend() {
  dispatch(A.SESSION_EXTEND);
  dispatch(A.OVERLAY, { overlay: null });
}

export function end() {
  dispatch(A.SESSION_END);
  dispatch(A.OVERLAY, { overlay: null });
  dispatch(A.NAV, { screen: 'home' });
  lastMark = Date.now();
  flush();
}

export const activeMinutes = () => Math.round(getState().session.activeMs / 60000);
