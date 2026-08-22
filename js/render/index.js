import { store } from '../core/app.js';
import { need, setAttrs, setVars, setText, setHTML } from '../core/dom.js';
import { icon } from '../data/icons.js';
import { attrsFor, varsFor } from './attrs.js';
import * as lists from './lists.js';
import { TRACKS, lettersOf } from '../data/tracks.js';
import { MAX_EXTENSIONS } from '../core/reduce/session.js';

/**
 * Three tiers per frame:
 *   1  attributes on #app   cheap, always
 *   2  CSS custom properties cheap, always
 *   3  lists                 signature-gated, mostly skipped
 */
export function startRender() {
  const root = need('app');

  const paint = (state) => {
    setAttrs(root, attrsFor(state));
    setVars(root, varsFor(state));

    switch (state.screen) {
      case 'home':   lists.renderTracks(state); break;
      case 'grid':   lists.renderGrid(state); break;
      case 'listen': lists.renderListen(state); paintDailyDots(state, 'listenDots'); break;
      case 'trace':  lists.renderBeads(state); break;
      case 'quiz':
        lists.renderQuiz(state);
        if (state.quiz.scope === 'words') paintWordsDots(state, 'quizDots');
        else paintDailyDots(state, 'quizDots');
        break;
      case 'done':   lists.renderDone(state); break;
      case 'shloka': lists.renderShlokas(state); break;
      case 'words':  lists.renderWordsTurn(state); paintWordsDots(state, 'wordsDots'); break;
      default: break;
    }

    if (state.overlay === 'celebrate') paintCelebrate(state);
    if (state.overlay === 'break') paintBreak(state);
    if (state.overlay === 'gate') paintGate(state);
  };

  store.subscribe(paint);
  paint(store.getState());
}

/** Today's dots, so the finish line is visible from inside the activity too. */
function paintDailyDots(state, hostId) {
  const { daily } = state;
  const host = document.getElementById(hostId);
  if (!host) return;
  if (!daily.active || !daily.items.length) {
    host.replaceChildren();
    return;
  }
  lists.renderDots(hostId, daily.items.length, daily.done.length, daily.index);
}

/** The words finish line counts PLANNED turns only — a re-queued miss must
 *  not visibly grow the day, or the end the dots promise stops being true. */
function paintWordsDots(state, hostId) {
  const { words } = state;
  const host = document.getElementById(hostId);
  if (!host) return;
  if (!words.active || !words.items.length) {
    host.replaceChildren();
    return;
  }
  const planned = words.items.filter((it) => it.kind !== 'requeue');
  const current = words.items[words.index];
  const currentIndex = current && current.kind !== 'requeue'
    ? words.items.slice(0, words.index + 1).filter((it) => it.kind !== 'requeue').length - 1
    : -1;
  lists.renderDots(hostId, planned.length, words.done.length, currentIndex);
}

function paintCelebrate(state) {
  const letter = lettersOf(state.trackId)[state.letterIndex];
  if (!letter) return;
  setText(need('celebrateGlyph'), letter.glyph);
  setText(need('celebrateKeyword'), letter.keyword || '');
  paintDailyDots(state, 'celebrateDots');

  // In a daily session the "next" button carries the child through today's
  // set and then stops. Outside one it wraps forever, which is fine when a
  // grown-up has deliberately opened the explore door.
  const { daily } = state;
  const last = daily.active && daily.done.length >= daily.items.length;
  setHTML(need('celebrateNextIcon'), icon(last ? 'check' : 'next', 42));
}

function paintBreak(state) {
  const letter = lettersOf(state.trackId)[state.letterIndex];
  const glyph = letter ? letter.glyph : TRACKS[state.trackId].sample;
  const minutes = state.settings.sessionMin;

  // The break sends the child OFF the device rather than merely blocking it.
  need('breakBody').innerHTML =
    `You've been playing for ${minutes} minutes. Go and find something in the house shaped like ` +
    `<b>${glyph}</b> — a spoon, a hook, a hanger.`;

  // Two extensions, then the link stops existing. That is what makes the
  // parent-zone copy — "it cannot be switched off" — literally true.
  need('fiveMore').hidden = state.session.extensions >= MAX_EXTENSIONS;
}

function paintGate(state) {
  const { a, b, choices } = state.gate;
  setText(need('gateQuestion'), `${a} + ${b}`);

  const host = need('gateChoices');
  const sig = choices.join(',');
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;

  host.replaceChildren(...choices.map((n) => {
    const btn = document.createElement('button');
    btn.className = 'gate__choice';
    btn.type = 'button';
    btn.dataset.action = 'gate-answer';
    btn.dataset.arg = String(n);
    btn.textContent = String(n);
    return btn;
  }));
}

export { lists };
