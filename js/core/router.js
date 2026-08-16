import { dispatch, getState } from './app.js';
import { A } from './actions.js';
import { timers } from './timers.js';
import { stop as stopSpeech } from '../audio/speech.js';
import * as trace from '../trace/session.js';
import { TRACKS, lettersOf } from '../data/tracks.js';

const DEV = new URLSearchParams(location.search).has('dev');

/**
 * The ONLY place allowed to change `screen`.
 *
 * Every navigation tears down in the same order — timers, speech, trace
 * session — before the state changes. The shipped app had no such choke
 * point, so confetti removal, cheer dismissal and speech callbacks all
 * outlived the screen that armed them.
 */
function teardown() {
  timers.clearAll();
  stopSpeech();
  trace.destroy();
}

export function navigate(patch) {
  teardown();
  dispatch(A.NAV, patch);

  if (DEV && timers.size > 2) console.warn('router: timer leak after navigation —', timers.size);
}

export const overlay = (name) => dispatch(A.OVERLAY, { overlay: name });

export function closeOverlay() {
  dispatch(A.OVERLAY, { overlay: null });
}

export function goHome() {
  navigate({ screen: 'home' });
}

export function pickTrack(trackId) {
  const track = TRACKS[trackId];
  if (!track) {
    console.warn('router: unknown track', trackId);
    return;
  }
  dispatch(A.FIRST_RUN_DONE);
  // Sanskrit has no letter grid — the shloka screen is its whole content.
  navigate({ screen: trackId === 'sa' ? 'shloka' : 'grid', trackId, letterIndex: 0 });
}

export function openListen(index) {
  const letters = lettersOf(getState().trackId);
  if (index < 0 || index >= letters.length) {
    console.warn('router: letter index out of range', index);
    return;
  }
  navigate({ screen: 'listen', letterIndex: index });
}

export function openTrace() {
  const { trackId, letterIndex } = getState();
  const track = TRACKS[trackId];
  const letter = lettersOf(trackId)[letterIndex];
  if (!track || !letter) return;

  navigate({ screen: 'trace' });
  trace.open(trackId, letter, track).catch((err) => console.error('router: trace failed to open', err));
}

/** Wraps, so the child never reaches a dead end at the last letter. */
export function nextLetter() {
  const { trackId, letterIndex } = getState();
  const letters = lettersOf(trackId);
  if (!letters.length) return goHome();
  const next = (letterIndex + 1) % letters.length;
  const track = TRACKS[trackId];
  navigate({ screen: 'trace', letterIndex: next });
  trace.open(trackId, letters[next], track).catch((err) => console.error('router: trace failed', err));
}

export function traceAgain() {
  openTrace();
}

export const currentLetter = () => lettersOf(getState().trackId)[getState().letterIndex] || null;
export const currentTrack = () => TRACKS[getState().trackId] || TRACKS.en;
