import { store } from '../core/app.js';
import { need, setAttrs, setVars, setText } from '../core/dom.js';
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
      case 'listen': lists.renderListen(state); break;
      case 'trace':  lists.renderBeads(state); break;
      case 'shloka': lists.renderShlokas(state); break;
      default: break;
    }

    if (state.overlay === 'celebrate') paintCelebrate(state);
    if (state.overlay === 'break') paintBreak(state);
    if (state.overlay === 'gate') paintGate(state);
  };

  store.subscribe(paint);
  paint(store.getState());
}

function paintCelebrate(state) {
  const letter = lettersOf(state.trackId)[state.letterIndex];
  if (!letter) return;
  setText(need('celebrateGlyph'), letter.glyph);
  setText(need('celebrateKeyword'), letter.keyword || '');
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
