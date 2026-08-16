import { dispatch, getState } from '../core/app.js';
import { A } from '../core/actions.js';
import { createTimers } from '../core/timers.js';
import { SHLOKA_LINES } from '../data/shlokas.js';
import { sayShloka, silence } from '../audio/say.js';

/**
 * Shloka line playback.
 *
 * Driven off the real audio status rather than the mockup's fixed
 * `600 + i * 3600` schedule — but with a hard timeout, because iOS drops
 * `onend` often enough that a purely event-driven queue wedges.
 */

const timers = createTimers('shloka');
const MAX_LINE_MS = 12000;
const GAP_MS = 500;

let playingAll = false;

export function stopAll() {
  playingAll = false;
  timers.clearAll();
  silence();
  dispatch(A.SHLOKA_LINE, { playing: -1, loading: -1 });
}

export async function playLine(index) {
  const line = SHLOKA_LINES[index];
  if (!line) {
    console.warn('shloka: no line at index', index);
    return false;
  }

  timers.clearAll();
  dispatch(A.SHLOKA_LINE, { playing: -1, loading: index });

  const tier = await sayShloka(line.text);
  if (tier === 'none') {
    // No Sanskrit voice on this device, and a Hindi one would mangle the
    // metre. Show the line as selected so the tap still registers, and let
    // the grown-ups area explain the silence.
    dispatch(A.SHLOKA_LINE, { playing: index, loading: -1 });
    timers.t(() => dispatch(A.SHLOKA_LINE, { playing: -1 }), 1200);
    return false;
  }

  dispatch(A.SHLOKA_LINE, { playing: index, loading: -1 });
  timers.t(() => {
    if (getState().shloka.playingLine === index) dispatch(A.SHLOKA_LINE, { playing: -1 });
  }, MAX_LINE_MS);
  return true;
}

/** Sequential, and abandoned the moment the child navigates or taps stop. */
export async function playAll() {
  if (playingAll) {
    stopAll();
    return;
  }
  playingAll = true;

  for (let i = 0; i < SHLOKA_LINES.length; i++) {
    if (!playingAll) return;
    const spoke = await playLine(i);
    if (!playingAll) return;
    await wait(spoke ? MAX_LINE_MS * 0.35 : GAP_MS);
  }
  playingAll = false;
  dispatch(A.SHLOKA_LINE, { playing: -1, loading: -1 });
}

const wait = (ms) => new Promise((resolve) => timers.t(resolve, ms));
