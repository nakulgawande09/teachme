import { el, need, setAttr, setText, setHTML, replaceChildren } from '../core/dom.js';
import { TRACKS, TRACK_IDS, lettersOf } from '../data/tracks.js';
import { SHLOKAS } from '../data/shlokas.js';
import { icon } from '../data/icons.js';

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
  if (!changed('tracks', enabled.join(','))) return;

  const host = need('trackList');
  replaceChildren(host, enabled.map((id) => {
    const track = TRACKS[id];
    const card = el('button', {
      class: 'track-card',
      type: 'button',
      'data-track': id,
      'data-action': 'pick-track',
      'data-arg': id,
      'aria-label': track.name,
    });

    const body = id === 'sa'
      ? `<div class="track-card__lines">गुरुर्ब्रह्मा<br>गुरुर्विष्णुः</div>`
      : `<div class="track-card__preview">${track.preview.map((g) => `<span>${g}</span>`).join('')}</div>`;

    card.innerHTML =
      `<span class="track-card__glyph">${track.sample}</span>
       <span class="track-card__body">${body}<span class="track-card__rule"></span></span>
       <button class="btn-round btn-round--haldi" type="button" data-action="say-track-name"
               data-arg="${id}" aria-label="Hear ${track.name}">${icon('speaker')}</button>
       <span class="finger" data-motion aria-hidden="true"></span>`;
    return card;
  }));
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
