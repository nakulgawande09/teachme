import { dispatch, getState } from '../core/app.js';
import { A } from '../core/actions.js';
import { need } from '../core/dom.js';
import * as router from '../core/router.js';
import * as trace from '../trace/session.js';
import * as shloka from '../features/shloka.js';
import * as session from '../features/session.js';
import * as gate from '../parent/gate.js';
import { say, refreshTiers } from '../audio/say.js';
import { sayWord } from '../audio/wordAudio.js';
import { TRACKS, lettersOf } from '../data/tracks.js';
import { parseWordKey } from '../data/packs/index.js';
import { resetProgress, resetEverything, exportJSON, snapshot } from '../storage/store.js';
import { invalidate } from './lists.js';
import * as daily from '../features/daily.js';
import * as words from '../features/words.js';
import * as turn from '../features/turn.js';
import { coach } from './coach.js';

/**
 * One delegated click listener and a dispatch table. `?selftest=1` asserts
 * that every data-action in the DOM has an entry here and vice versa, which
 * is the whole reason for keeping them in one object.
 */

const sayLetter = () => {
  const letter = router.currentLetter();
  const track = router.currentTrack();
  if (!letter) return;
  const { soundFirst } = getState().settings;
  // Sound before name: what a letter SAYS is the thing being taught.
  const text = soundFirst && letter.keyword ? letter.keyword : letter.glyph;
  say(text, track.lang, { key: `${track.id}/${letter.glyph}/name` });
  coach('trace');
};

export const ACTIONS = {
  'pick-track': (id) => {
    router.pickTrack(id);
    session.checkAtBoundary();
  },
  'say-track-name': (id) => {
    const track = TRACKS[id];
    if (track) say(track.name, track.lang, { key: `${id}/name` });
  },
  'say-track': () => {
    const track = router.currentTrack();
    say(track.name, track.lang, { key: `${track.id}/name` });
  },
  'say-letter': sayLetter,

  'go-home': () => {
    router.goHome();
    session.checkAtBoundary();
  },
  // Inside today's set there is no grid behind the listen card, so "back"
  // means back out to the home screen rather than into a wall of letters.
  'go-grid': () => {
    if (getState().daily.active) return ACTIONS['go-home']();
    router.openGrid();
    session.checkAtBoundary();
  },
  'go-explore': () => {
    router.openGrid();
    session.checkAtBoundary();
  },
  'go-listen': () => {
    router.openListen(getState().letterIndex);
    session.checkAtBoundary();
  },
  'go-trace': () => {
    coach(null);
    router.openTrace();
  },
  'open-listen': (arg) => router.openListen(Number(arg)),
  'replay-demo': () => trace.replayDemo(),

  'trace-again': () => router.traceAgain(),
  'next-letter': () => {
    router.nextLetter();
    session.checkAtBoundary();
  },

  'play-line': (arg) => shloka.playLine(Number(arg)),
  'play-all': () => shloka.playAll(),

  'quiz-replay': () => sayQuizPrompt(),
  'quiz-answer': (value) => answerQuiz(value),

  /* words — the child-facing surface is two taps: the big picture, and the
     replay speaker. The marks are the grown-up's, and invisible-in-practice. */
  'pick-words': () => {
    router.pickWords();
    session.checkAtBoundary();
  },
  'word-tap': () => turn.tap(),
  'word-replay': () => turn.replay(),
  'mark-got': () => turn.mark('got'),
  'mark-notyet': () => turn.mark('notyet'),

  'finish-day': () => {
    dispatch(A.DAILY_END);
    dispatch(A.WORDS_END);
    router.goHome();
  },

  'end-session': () => session.end(),
  'five-more': () => session.extend(),

  'gate-answer': (arg) => gate.answerGate(arg, { onPass: openParent }),
  'close-gate': () => dispatch(A.OVERLAY, { overlay: null }),
  'close-parent': () => {
    dispatch(A.OVERLAY, { overlay: null });
    import('../parent/index.js').then((m) => m.unmount()).catch(() => {});
  },

  'set-setting': (arg) => {
    const i = String(arg).indexOf(':');
    if (i < 0) return;
    dispatch(A.SETTINGS_SET, { key: arg.slice(0, i), value: coerce(arg.slice(i + 1)) });
  },
  'toggle-track': (id) => {
    const tracks = getState().settings.tracks;
    dispatch(A.SETTINGS_SET, { key: 'tracks', value: { ...tracks, [id]: !tracks[id] } });
    invalidate();
  },
  'toggle-pack': (id) => {
    const packs = getState().settings.packs;
    dispatch(A.SETTINGS_SET, { key: 'packs', value: { ...packs, [id]: !packs[id] } });
    invalidate();
  },
  'test-voice': (id) => {
    const track = TRACKS[id];
    if (!track) return;
    const sample = id === 'sa' ? 'गुरुर्ब्रह्मा' : lettersOf(id)[0]?.keyword || track.name;
    say(sample, track.lang);
  },

  'export-data': () => downloadJSON(),
  'reset-progress': () => confirmThen('Reset all progress? The letters go back to un-lit.', () => {
    resetProgress();
    dispatch(A.PROGRESS_LOAD, { progress: snapshot().progress });
    invalidate();
  }),
  'reset-all': () => confirmThen('Erase progress AND settings on this device?', () => {
    resetEverything();
    const data = snapshot();
    dispatch(A.SETTINGS_LOAD, { settings: data.settings });
    dispatch(A.PROGRESS_LOAD, { progress: data.progress });
    invalidate();
  }),
};

/* ── recall ────────────────────────────────────────────────────────────── */

function sayQuizPrompt() {
  const { quiz, trackId } = getState();
  if (!quiz.answer) return;

  // A words question asks with the word, in the language being asked.
  if (quiz.scope === 'words') {
    const parsed = parseWordKey(quiz.key);
    if (parsed) sayWord(parsed.packId, parsed.itemId, parsed.lang);
    return;
  }

  const track = TRACKS[trackId];
  const letter = lettersOf(trackId).find((l) => l.glyph === quiz.answer);
  if (!letter) return;

  // sound → letter asks with the keyword, which carries the phoneme in a real
  // word. letter → picture asks with the letter itself.
  const text = quiz.kind === 'sound2letter' ? (letter.keyword || letter.glyph) : letter.glyph;
  say(text, track.lang, { key: `${trackId}/${letter.glyph}/name` });
}

/**
 * A wrong tap replays the sound and lets the card settle back. That is the
 * entire consequence — no score, no lockout, no red. The child can tap every
 * card in turn and still arrive somewhere good, which is the point: at this
 * age a question should be a nudge to listen again, not a test to fail.
 */
function answerQuiz(value) {
  const { quiz } = getState();
  if (!quiz.answer || quiz.solved) return;

  if (value !== quiz.answer) {
    dispatch(A.QUIZ_WRONG, { value });
    sayQuizPrompt();
    return;
  }

  dispatch(A.QUIZ_SOLVED);
  // Recalled unaided the first time counts as a promotion; needing a nudge
  // sends the letter back to tomorrow rather than forward.
  if (quiz.scope === 'words') {
    words.completeThinking(quiz.wrong.length === 0);
    dispatch(A.PROGRESS_LOAD, { progress: snapshot().progress });
    sayQuizPrompt();
    setTimeout(() => router.advanceWords(), 1400);
    return;
  }
  daily.complete(quiz.wrong.length === 0);
  dispatch(A.PROGRESS_LOAD, { progress: snapshot().progress });
  sayQuizPrompt();
  setTimeout(() => router.advanceDaily(), 1400);
}

const coerce = (raw) => {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const n = Number(raw);
  return Number.isFinite(n) && raw.trim() !== '' ? n : raw;
};

function confirmThen(message, fn) {
  // A native confirm is the right tool here: it is unmistakably a system
  // dialog, which is exactly what a destructive action in a kids' app wants.
  if (window.confirm(message)) fn();
}

function downloadJSON() {
  try {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'akshar-khel.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.error('export failed', err);
  }
}

async function openParent() {
  dispatch(A.OVERLAY, { overlay: 'parent' });
  try {
    const mod = await import('../parent/index.js');
    refreshTiers();
    mod.mount();
  } catch (err) {
    console.error('parent zone failed to load', err);
    dispatch(A.OVERLAY, { overlay: null });
  }
}

export function bindEvents() {
  const root = need('app');

  /* Device TTS takes tens to hundreds of milliseconds to start, so tap-and-
     hear never feels simultaneous with the finger. We cannot make synthesis
     faster, but we can make the FEEDBACK immediate: light the speaker's ring
     on pointerdown, before the audio layer has been asked for anything. The
     real status overwrites this a moment later either way. */
  root.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    if (!/^(say-|quiz-replay|play-)/.test(el.dataset.action)) return;
    if (getState().audio.status === 'idle') dispatch(A.AUDIO_STATUS, { status: 'loading' });
  }, { passive: true });

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !root.contains(el)) return;
    if (el.tagName === 'A') return; // real links do their own thing

    // A speaker nested inside a track card previews the track; it must not
    // also navigate into it.
    e.stopPropagation();

    const fn = ACTIONS[el.dataset.action];
    if (!fn) {
      console.warn('events: no handler for', el.dataset.action);
      return;
    }
    try {
      fn(el.dataset.arg, e);
    } catch (err) {
      console.error(`events: "${el.dataset.action}" failed`, err);
    }
  });

  root.addEventListener('input', (e) => {
    const action = e.target?.dataset?.action;
    if (action === 'set-volume') dispatch(A.SETTINGS_SET, { key: 'volume', value: Number(e.target.value) });
    if (action === 'set-rate') dispatch(A.SETTINGS_SET, { key: 'rate', value: Number(e.target.value) });
  });

  gate.mountHoldDoor(gate.openGate);
}
