import { dispatch, getState } from '../core/app.js';
import { A } from '../core/actions.js';
import { need } from '../core/dom.js';
import * as router from '../core/router.js';
import * as trace from '../trace/session.js';
import * as shloka from '../features/shloka.js';
import * as session from '../features/session.js';
import * as gate from '../parent/gate.js';
import { say, refreshTiers } from '../audio/say.js';
import { TRACKS, lettersOf } from '../data/tracks.js';
import { resetProgress, resetEverything, exportJSON, snapshot } from '../storage/store.js';
import { invalidate } from './lists.js';

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
  'go-grid': () => {
    const { trackId } = getState();
    router.navigate({ screen: trackId === 'sa' ? 'shloka' : 'grid' });
    session.checkAtBoundary();
  },
  'go-listen': () => {
    router.openListen(getState().letterIndex);
    session.checkAtBoundary();
  },
  'go-trace': () => router.openTrace(),
  'open-listen': (arg) => {
    router.openListen(Number(arg));
    // Sound fires on arrival: the screen is audio-first, not tap-then-audio.
    setTimeout(sayLetter, 120);
  },
  'replay-demo': () => trace.replayDemo(),

  'trace-again': () => router.traceAgain(),
  'next-letter': () => {
    router.nextLetter();
    session.checkAtBoundary();
  },

  'play-line': (arg) => shloka.playLine(Number(arg)),
  'play-all': () => shloka.playAll(),

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
