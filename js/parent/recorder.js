import { card, esc } from './dashboard.js';
import { PACKS, LANGS, wordClipKey } from '../data/packs/index.js';
import { enabledPacks } from '../features/words.js';
import * as recorder from '../audio/recorder.js';
import * as clips from '../storage/clips.js';
import { invalidateAudibility } from '../audio/wordAudio.js';
import { invalidate as invalidateLists } from '../render/lists.js';

/**
 * The recorder card: the parents ARE the Marathi voice.
 *
 * No phone ships a Marathi voice worth teaching from, and the app refuses
 * to let Hindi stand in (see js/audio/voices.js). This card closes that gap
 * word by word: tap record, say the word, hear it back — it is saved on
 * this device only and the child hears YOU from the next session on.
 *
 * Transient row states (recording / saved / quota) are written straight to
 * DOM attributes rather than dispatched — the same presentation-only
 * exemption the hold-door progress bar uses. The durable truth (which clips
 * exist) lives in the IndexedDB key index and survives any repaint.
 */

let lang = 'mr';   // the language being recorded; Marathi is the one that needs it

export function setLang(next) {
  if (LANGS[next]) lang = next;
}
export const currentLang = () => lang;

export function recorderCard(state) {
  if (!state.settings.words) return '';

  const packs = enabledPacks(state.settings);
  const langSeg = Object.keys(LANGS).map((id) => `
    <button class="seg__opt" type="button" data-action="rec-lang" data-arg="${id}"
            aria-pressed="${id === lang}">${esc(LANGS[id].name)}</button>`).join('');

  let total = 0;
  const rows = packs.map((packId) => {
    const pack = PACKS[packId];
    if (!pack || !pack.langs.includes(lang)) return '';
    return pack.items.map((item) => {
      total++;
      const key = wordClipKey(packId, item.id, lang);
      const has = clips.hasClip(key);
      return `<div class="rrow" data-clip="${esc(key)}" data-rec="${has ? 1 : 0}">
        <span class="pglyph pglyph--emoji" aria-hidden="true">${item.emoji}</span>
        <span class="rrow__word">${esc(item.words[lang])}</span>
        <span class="rrow__state" aria-live="polite"></span>
        <span class="rrow__btns">
          <button class="pbtn" type="button" data-action="rec-start" data-arg="${esc(key)}">${has ? 'again' : 'record'}</button>
          <button class="pbtn" type="button" data-action="rec-play" data-arg="${esc(key)}" ${has ? '' : 'hidden'}>play</button>
          <button class="pbtn pbtn--danger" type="button" data-action="rec-del" data-arg="${esc(key)}" ${has ? '' : 'hidden'}>✕</button>
        </span>
      </div>`;
    }).join('');
  }).join('');

  const doneCount = clips.clipCount(`w/${lang}/`);
  const device = state.voice.tiers[lang] === 'device';
  const why = lang === 'mr' && !device
    ? `<p class="pcard__body">This phone has no Marathi voice, and a Hindi one would teach the
        wrong sounds — so until words are recorded here, Marathi words simply don't come up.
        Each word you record starts appearing from the next session, in your voice.</p>`
    : `<p class="pcard__body">The phone can already say these — but a child copies a parent's
        voice far more readily than a machine's. Anything you record replaces the synthetic
        voice for that word.</p>`;

  return card('Record the words in your own voice', `
    ${why}
    <p class="pcard__body">Tap <b>record</b>, say the word once, clearly — it stops by itself
      and plays back. Recordings stay on this phone. <b>${doneCount} of ${total}</b> recorded
      in ${esc(LANGS[lang].name)}.</p>
    <div class="seg" style="margin-bottom:12px">${langSeg}</div>
    <div class="rlist" id="recorderList">${rows}</div>`);
}

/* ── the flows behind the buttons ──────────────────────────────────────── */

const rowFor = (key) => document.querySelector(`.rrow[data-clip="${CSS.escape(key)}"]`);

const setState = (key, text) => {
  const row = rowFor(key);
  if (!row) return;
  const slot = row.querySelector('.rrow__state');
  if (slot) slot.textContent = text;
};

export async function startRecording(key) {
  if (!(await recorder.requestMic())) {
    setState(key, recorder.isDenied()
      ? 'the browser has blocked the microphone'
      : 'no microphone available');
    return;
  }

  setState(key, 'recording — say it now');
  const blob = await recorder.recordFor(3500);
  if (!blob || !blob.size) {
    setState(key, 'nothing was heard — try again');
    return;
  }

  setState(key, 'listen…');
  await recorder.play(blob, 5000);

  const res = await clips.putClip(key, blob);
  if (!res.ok) {
    setState(key, res.reason === 'quota'
      ? 'this phone is out of room — free some space and try again'
      : 'could not save — try again');
    return;
  }

  setState(key, 'saved ✓');
  markSaved(key, true);
  afterChange();
  // Ask the browser to protect the recordings from silent eviction.
  try { navigator.storage?.persist?.(); } catch { /* best effort */ }
}

export async function playClip(key) {
  const rec = await clips.getClip(key);
  if (rec) await recorder.play(rec.blob, 8000);
}

export async function removeClip(key) {
  await clips.deleteClip(key);
  markSaved(key, false);
  setState(key, '');
  afterChange();
}

function markSaved(key, saved) {
  const row = rowFor(key);
  if (!row) return;
  row.setAttribute('data-rec', saved ? '1' : '0');
  const [rec, play, del] = row.querySelectorAll('.pbtn');
  if (rec) rec.textContent = saved ? 'again' : 'record';
  if (play) play.hidden = !saved;
  if (del) del.hidden = !saved;
}

/** A clip changed: the audibility answer and the home card are both stale. */
function afterChange() {
  invalidateAudibility();
  invalidateLists();
}
