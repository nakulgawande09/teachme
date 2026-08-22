import { dispatch, getState } from './app.js';
import { A } from './actions.js';
import { timers } from './timers.js';
import { stop as stopSpeech } from '../audio/speech.js';
import * as trace from '../trace/session.js';
import { TRACKS, lettersOf } from '../data/tracks.js';
import * as daily from '../features/daily.js';
import * as words from '../features/words.js';
import * as turn from '../features/turn.js';
import { say } from '../audio/say.js';
import { sayWord } from '../audio/wordAudio.js';
import { parseWordKey } from '../data/packs/index.js';
import { coach } from '../render/coach.js';

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
  turn.destroy();
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
  // The mic must never stay warm on the home screen — the browser's
  // recording indicator has to mean "a word turn is happening".
  turn.releaseMic();
}

/**
 * Tapping a track card starts today's set. Once today's set is finished the
 * same card opens the full grid instead — so the bounded path is what a child
 * meets first, and free exploration is what is left after the work is done,
 * rather than the other way round.
 */
export function pickTrack(trackId) {
  const track = TRACKS[trackId];
  if (!track) {
    console.warn('router: unknown track', trackId);
    return;
  }
  if (trackId === 'sa') {
    navigate({ screen: 'shloka', trackId, letterIndex: 0 });
    return;
  }

  const item = daily.start(trackId);
  if (!item) {
    openGrid(trackId);
    return;
  }
  navigate({ screen: 'home', trackId });
  presentDailyItem(item);
}

export function openGrid(trackId = getState().trackId) {
  dispatch(A.DAILY_END);
  navigate({ screen: trackId === 'sa' ? 'shloka' : 'grid', trackId, letterIndex: 0 });
}

/** Route one item of today's set to the right activity. */
export function presentDailyItem(item) {
  const { trackId } = getState();
  const letters = lettersOf(trackId);
  const index = letters.findIndex((l) => l.glyph === item.glyph);
  if (index === -1) {
    console.warn('router: daily item not in track', item);
    return openGrid(trackId);
  }

  // A letter met before gets asked rather than shown. Retrieval is the whole
  // point — being shown a letter again is the weakest thing the app can do.
  const question = item.kind === 'review' && getState().settings.quiz
    ? daily.askFor(trackId, item.glyph)
    : null;

  if (question) {
    navigate({ screen: 'quiz', letterIndex: index });
    dispatch(A.QUIZ_ASK, question);
    return;
  }
  openListen(index);
}

/** Move to the next item, or to the closing screen when the set is finished. */
export function advanceDaily() {
  const item = daily.next();
  if (!item) {
    navigate({ screen: 'done' });
    return;
  }
  presentDailyItem(item);
}

/**
 * Every route into the listen card goes through here, so the audio-first
 * behaviour and the first-run fingertip are guaranteed rather than being a
 * property of whichever button happened to be tapped.
 */
export function openListen(index) {
  const state = getState();
  const letters = lettersOf(state.trackId);
  if (index < 0 || index >= letters.length) {
    console.warn('router: letter index out of range', index);
    return;
  }
  navigate({ screen: 'listen', letterIndex: index });
  coach('hear');

  const letter = letters[index];
  const track = TRACKS[state.trackId];
  // Sound on arrival: this screen is audio-first, not tap-then-audio. On a
  // cold first run the browser refuses until a gesture, which is exactly why
  // the fingertip points at the speaker.
  timers.t(() => {
    const text = state.settings.soundFirst && letter.keyword ? letter.keyword : letter.glyph;
    say(text, track.lang, { key: `${track.id}/${letter.glyph}/name` });
  }, 120);
}

export function openTrace() {
  const { trackId, letterIndex } = getState();
  const track = TRACKS[trackId];
  const letter = lettersOf(trackId)[letterIndex];
  if (!track || !letter) return;

  navigate({ screen: 'trace' });
  trace.open(trackId, letter, track).catch((err) => console.error('router: trace failed to open', err));
}

/**
 * Inside a daily session this walks today's set and then stops. Outside one
 * it wraps, so the explore door never dead-ends at Z.
 */
export function nextLetter() {
  if (getState().daily.active) return advanceDaily();

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

/* ── words ─────────────────────────────────────────────────────────────── */

/** Tapping the words card starts (or resumes) today's words; once they are
 *  finished it re-opens the closing screen rather than doing nothing. */
export function pickWords() {
  const item = words.start();
  if (!item) {
    if (getState().words.active) navigate({ screen: 'done' });
    return;
  }
  turn.prepareMic();
  presentWordItem(item);
}

/** Route one item of today's words: a word turn, or a picture question. */
export function presentWordItem(item) {
  if (!item) return advanceWords();

  if (item.t === 'q') {
    const question = words.thinkQuestion(item.key);
    if (question) {
      navigate({ screen: 'quiz' });
      dispatch(A.QUIZ_ASK, question);
      // The question IS the sound; say it once on arrival, off the tap that
      // brought the child here so iOS is already unlocked.
      const parsed = parseWordKey(item.key);
      if (parsed) timers.t(() => sayWord(parsed.packId, parsed.itemId, parsed.lang), 400);
      return;
    }
    // A question that cannot be built degrades to a listen turn.
  }

  navigate({ screen: 'words' });
  turn.begin(item.key);
}

export function advanceWords() {
  const item = words.next();
  if (!item) {
    navigate({ screen: 'done' });
    turn.releaseMic();
    return;
  }
  presentWordItem(item);
}

/** The turn driver's terminal callback, wired up in main.js. */
export function finishWordTurn(mark) {
  words.complete(mark);
  advanceWords();
}

export const currentLetter = () => lettersOf(getState().trackId)[getState().letterIndex] || null;
export const currentTrack = () => TRACKS[getState().trackId] || TRACKS.en;
