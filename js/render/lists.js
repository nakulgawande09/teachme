import { el, need, setAttr, setText, setHTML, replaceChildren } from '../core/dom.js';
import { TRACKS, TRACK_IDS, lettersOf } from '../data/tracks.js';
import { SHLOKAS } from '../data/shlokas.js';
import { icon } from '../data/icons.js';
import { setFor } from '../features/daily.js';

/**
 * List rendering. Rebuilds are signature-gated: between rebuilds only
 * attributes on existing nodes change, so tapping a letter does not re-create
 * forty DOM nodes.
 */

const signatures = new Map();

const changed = (key, sig) => {
  if (signatures.get(key) === sig) return false;
  signatures.set(key, sig);
  return true;
};

/** Invalidate everything — used after a progress reset. */
export const invalidate = () => signatures.clear();

/* ── 01 track picker ───────────────────────────────────────────────────── */

export function renderTracks(state) {
  const enabled = TRACK_IDS.filter((id) => state.settings.tracks[id]);

  // The set is part of the signature so finishing a letter re-paints the card
  // and the child can watch today's dots fill in from the home screen.
  const sets = Object.fromEntries(
    enabled.filter((id) => TRACKS[id].traceable).map((id) => [id, setFor(id)])
  );
  const sig = enabled.map((id) => {
    const s = sets[id];
    return s ? `${id}:${s.items.map((i) => i.glyph).join('')}:${s.done.join('')}` : id;
  }).join('|');
  if (!changed('tracks', sig)) return;

  const host = need('trackList');
  replaceChildren(host, enabled.map((id) => {
    const track = TRACKS[id];
    const set = sets[id];
    const complete = set && set.items.length && set.done.length >= set.items.length;

    const card = el('button', {
      class: 'track-card',
      type: 'button',
      'data-track': id,
      'data-action': 'pick-track',
      'data-arg': id,
      'aria-label': track.name,
    });

    card.innerHTML =
      `<span class="track-card__glyph">${track.sample}</span>
       <span class="track-card__body">${bodyFor(track, set, complete)}<span class="track-card__rule"></span></span>
       <button class="btn-round btn-round--haldi" type="button" data-action="say-track-name"
               data-arg="${id}" aria-label="Hear ${track.name}">${icon('speaker')}</button>
       <span class="finger" data-motion aria-hidden="true"></span>`;
    return card;
  }));
}

function bodyFor(track, set, complete) {
  // Sanskrit has no daily set — it is shlokas, which are recited whole rather
  // than learned a letter at a time.
  if (!set || !set.items.length) {
    return track.id === 'sa'
      ? `<div class="track-card__lines">गुरुर्ब्रह्मा<br>गुरुर्विष्णुः</div>`
      : `<div class="track-card__preview">${track.preview.map((g) => `<span>${g}</span>`).join('')}</div>`;
  }

  const glyphs = set.items
    .map((item) => `<span data-done="${set.done.includes(item.glyph) ? 1 : 0}">${item.glyph}</span>`)
    .join('');

  return `<span class="track-card__label">${complete ? 'all done — explore' : 'today'}</span>
          <span class="track-card__today">${glyphs}</span>`;
}

/** The finish line, as dots a child can count. */
export function renderDots(hostId, total, doneCount, currentIndex = -1) {
  const host = document.getElementById(hostId);
  if (!host) return;
  if (host.children.length !== total) {
    replaceChildren(host, Array.from({ length: total }, () => el('i')));
  }
  Array.from(host.children).forEach((dot, i) => {
    setAttr(dot, 'data-on', i < doneCount ? '1' : '');
    setAttr(dot, 'data-current', i === currentIndex ? '1' : '');
  });
}

/* ── 02 letter grid ────────────────────────────────────────────────────── */

export function renderGrid(state) {
  const track = TRACKS[state.trackId];
  if (!track) return;

  const done = state.progress.done[state.trackId] || {};
  const sig = `${state.trackId}|${Object.keys(done).sort().join('')}`;
  const host = need('gridScroll');

  setText(need('gridChip'), track.sample);
  if (!changed('grid', sig)) return;

  let index = 0;
  const blocks = [];
  for (const group of track.groups) {
    if (group.label) blocks.push(el('h2', { class: 'section-label section-label--deva' }, group.label));
    const grid = el('div', { class: 'grid' });
    for (const letter of group.letters) {
      grid.appendChild(letterCard(letter, index, !!done[letter.glyph], track.id));
      index++;
    }
    blocks.push(grid);
  }
  replaceChildren(host, blocks);
}

function letterCard(letter, index, isDone, trackId) {
  const card = el('button', {
    class: 'card',
    type: 'button',
    'data-action': 'open-listen',
    'data-arg': String(index),
    'data-done': isDone ? '1' : '',
    'aria-label': letter.keyword ? `${letter.glyph} — ${letter.keyword}` : letter.glyph,
  });
  const long = trackId === 'sa' || letter.glyph.length > 2;
  card.innerHTML =
    `<span class="card__glyph${long ? ' card__glyph--word' : ''}">${letter.glyph}</span>
     <span class="card__done" aria-hidden="true"></span>`;
  return card;
}

/* ── 03 listen ─────────────────────────────────────────────────────────── */

export function renderListen(state) {
  const track = TRACKS[state.trackId];
  const letter = lettersOf(state.trackId)[state.letterIndex];
  if (!track || !letter) return;

  setText(need('listenGlyph'), letter.glyph);
  setText(need('listenSound'), state.settings.soundFirst ? letter.sound : '');
  setText(need('listenArt'), letter.art || '');
  setText(need('listenKeyword'), letter.keyword || '');

  // Say what is true rather than implying the letter starts these words.
  const note = letter.conjunct
    ? 'this letter only appears joined to another'
    : letter.medial
      ? 'this letter lives inside the word'
      : '';
  setText(need('listenNote'), note);

  setAttr(need('btnTrace'), 'hidden', track.traceable ? null : 'hidden');
}

/* ── 04 trace beads ────────────────────────────────────────────────────── */

export function renderBeads(state) {
  const { strokeCount, strokeIndex, aliveStep } = state.trace;
  const host = need('beads');

  if (changed('beads-count', String(strokeCount))) {
    replaceChildren(host, Array.from({ length: Math.max(1, strokeCount) },
      () => el('span', { class: 'bead' })));
  }

  const alive = aliveStep > 0;
  host.querySelectorAll('.bead').forEach((bead, i) => {
    setAttr(bead, 'data-on', i < strokeIndex || alive ? '1' : '');
    setAttr(bead, 'data-current', i === strokeIndex && !alive ? '1' : '');
  });
  setAttr(host, 'aria-valuenow', String(alive ? strokeCount : strokeIndex));
  setAttr(host, 'aria-valuemax', String(Math.max(1, strokeCount)));

  setText(need('traceHint'), hintFor(state));
}

function hintFor(state) {
  if (state.trace.stage === 'alive') return 'beautiful';
  if (state.trace.stage === 'demo') return 'watch how it goes';
  return state.trace.engine === 'stroke' ? 'your turn — follow the dots' : 'your turn — colour it in';
}

/* ── 04b recall ────────────────────────────────────────────────────────── */

export function renderQuiz(state) {
  const { kind, cards, answer, wrong, solved } = state.quiz;
  if (!kind || !cards.length) return;

  const target = lettersOf(state.trackId).find((l) => l.glyph === answer);
  const prompt = need('quizPrompt');

  // sound → letter leads with the speaker, because the question IS the sound.
  // letter → picture leads with the glyph, and the speaker is a hint, not the
  // question, so it sits smaller underneath.
  setHTML(prompt, kind === 'sound2letter'
    ? `<button class="btn-big btn-big--haldi" type="button" data-action="quiz-replay"
               aria-label="Play the sound again">
         <span class="audio-ring" aria-hidden="true"></span>${icon('speaker', 42)}
       </button>
       <span class="listen__sound">${target ? target.sound : ''}</span>`
    : `<span>${answer}</span>
       <button class="btn-round btn-round--haldi" type="button" data-action="quiz-replay"
               aria-label="Play the sound again">
         <span class="audio-ring" aria-hidden="true"></span>${icon('speaker')}
       </button>`);

  const sig = `${kind}|${cards.map((c) => c.value).join('')}`;
  const host = need('quizCards');
  if (changed('quiz', sig)) {
    replaceChildren(host, cards.map((card) => {
      const node = el('button', {
        class: 'qcard',
        type: 'button',
        'data-motion': '',
        'data-action': 'quiz-answer',
        'data-arg': card.value,
        'aria-label': card.show === 'art' ? (card.keyword || card.value) : card.value,
      });
      node.innerHTML = card.show === 'art'
        ? `<span class="qcard__art">${card.art || ''}</span>`
        : `<span class="qcard__glyph">${card.glyph}</span>`;
      return node;
    }));
  }

  host.querySelectorAll('.qcard').forEach((node) => {
    const value = node.dataset.arg;
    setAttr(node, 'data-wrong', wrong.includes(value) ? '1' : '');
    setAttr(node, 'data-right', solved && value === answer ? '1' : '');
  });
}

/* ── 09 today is done ──────────────────────────────────────────────────── */

/**
 * The closing screen. It exists to say the word "done" out loud, and then to
 * hand the child something to do that is not the phone — which is the only
 * honest answer to "how do I stop this being addictive".
 */
export function renderDone(state) {
  const { daily } = state;
  const glyphs = daily.items.map((i) => i.glyph);
  setHTML(need('doneGlyphs'), glyphs.map((g) => `<span>${g}</span>`).join(''));

  const first = daily.items[0];
  const letter = first && lettersOf(daily.trackId || state.trackId).find((l) => l.glyph === first.glyph);
  setHTML(need('doneBody'), offDeviceTask(letter, glyphs));
}

/* One small, specific, physical thing. Specific matters: "go and play" gets
   ignored, "find three things in the kitchen that start with म" gets done. */
const TASKS = [
  (g, kw) => `Now go and find three things in the house that start with <b>${g}</b>.`,
  (g) => `Draw <b>${g}</b> in the air with your whole arm. Big as you can.`,
  (g, kw) => kw
    ? `Go and tell someone the word <b>${kw}</b>, and see if they can guess the letter.`
    : `Go and draw <b>${g}</b> for someone and see if they know it.`,
  (g) => `Look for <b>${g}</b> on a packet or a sign before dinner.`,
];

function offDeviceTask(letter, glyphs) {
  const glyph = letter ? letter.glyph : glyphs[0] || '';
  // Rotates by day so the same suggestion does not arrive every afternoon.
  const pick = TASKS[Math.floor(Date.now() / 864e5) % TASKS.length];
  return pick(glyph, letter && letter.keyword);
}

/* ── 05 shloka ─────────────────────────────────────────────────────────── */

export function renderShlokas(state) {
  if (changed('shlokas', 'static')) {
    const host = need('shlokaList');
    let lineIndex = 0;
    const blocks = SHLOKAS.map((shloka) => {
      const wrap = el('div', { class: 'shloka' });
      wrap.appendChild(el('h3', { class: 'shloka__name' }, shloka.name));
      wrap.appendChild(el('p', { class: 'shloka__sub' }, shloka.sub));
      for (const line of shloka.lines) {
        wrap.appendChild(shlokaLine(line, lineIndex));
        lineIndex++;
      }
      return wrap;
    });
    replaceChildren(host, blocks);
    renderWordGrid(state);
  }

  const { playingLine, loadingLine } = state.shloka;
  need('shlokaList').querySelectorAll('.shloka-line').forEach((row, i) => {
    setAttr(row, 'data-playing', i === playingLine ? '1' : '');
    setAttr(row, 'data-loading', i === loadingLine ? '1' : '');
  });
}

function shlokaLine(line, index) {
  const row = el('button', {
    class: 'shloka-line',
    type: 'button',
    'data-action': 'play-line',
    'data-arg': String(index),
  });
  row.innerHTML =
    `<span class="shloka-line__bead" aria-hidden="true"></span>
     <span class="shloka-line__text">${line.text}
       <span class="shloka-line__tr">${line.tr}</span>
       <span class="shloka-line__mean">${line.meaning}</span>
     </span>`;
  return row;
}

function renderWordGrid(state) {
  const done = state.progress.done.sa || {};
  const grid = need('wordGrid');
  replaceChildren(
    grid,
    lettersOf('sa').map((word, i) => letterCard(word, i, !!done[word.glyph], 'sa'))
  );
}

/* ── boot: fill every [data-icon] placeholder once ─────────────────────── */

export function mountIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((slot) => {
    const size = Number(slot.dataset.iconSize) || 30;
    setHTML(slot, icon(slot.dataset.icon, size));
  });
}
