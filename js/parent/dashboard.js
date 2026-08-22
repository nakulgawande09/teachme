import { TRACKS, TRACK_IDS, lettersOf } from '../data/tracks.js';
import {
  strugglingIn, struggleReason, msToday, msThisWeek, formatDuration,
} from '../storage/progress.js';
import { tonightsCard } from '../features/wordSchedule.js';
import { snapshot } from '../storage/store.js';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Progress card.
 *
 * No charts, no percentages, no streaks, and no comparison to other children.
 * A parent wants two things: which letters have landed, and which are worth
 * sitting down with. Everything else is decoration that invites the wrong
 * kind of attention to a three-year-old's performance.
 */
export function progressCard(state) {
  if (state.storage === 'readonly') {
    return card('Progress',
      `<p class="pcard__body">This device will not let the app save anything — private browsing,
       or storage turned off. Everything still works, but the amber dots start over each time
       you open it.</p>`);
  }

  const enabled = TRACK_IDS.filter((id) => state.settings.tracks[id]);
  const tracks = enabled.map((id) => trackBlock(state, id)).join('');
  const struggles = enabled.flatMap((id) =>
    strugglingIn(state.progress.letters, id).map((row) => ({ ...row, trackId: id })));

  const worth = struggles.length
    ? `<p class="pcard__title" style="margin-top:16px">Worth another go together</p>
       ${struggles.map((row) => `
         <div class="vrow">
           <span class="pglyph" data-latin="${row.trackId === 'en' ? 1 : 0}">${esc(row.glyph)}</span>
           <span class="vrow__text">${esc(struggleReason(row))}</span>
         </div>`).join('')}`
    : '';

  const time = `<p class="pcard__body" style="margin-top:16px">
      Today ${formatDuration(msToday())} · This week ${formatDuration(msThisWeek())}
    </p>`;

  return card('Progress', tracks + worth + time);
}

function trackBlock(state, trackId) {
  const track = TRACKS[trackId];
  const letters = lettersOf(trackId);
  const done = state.progress.done[trackId] || {};
  const count = Object.keys(done).length;

  // Only the letters that have landed. Rendering all 86 glyphs turns this card
  // into a wall a parent has to scroll past to reach anything actionable, and
  // "which ones has she got" is the question they actually came here with.
  const chips = letters
    .filter((l) => done[l.glyph])
    .map((l) => `<span class="pglyph" data-done="1" data-latin="${trackId === 'en' ? 1 : 0}">${esc(l.glyph)}</span>`)
    .join('');

  return `<div class="ptrack">
    <p class="ptrack__head">${esc(track.name)} — ${count} of ${letters.length} brought to life</p>
    ${chips ? `<div class="pglyphs">${chips}</div>` : '<p class="pcard__body">Nothing yet — that is fine at the start.</p>'}
  </div>`;
}

/**
 * Tonight card — the app handing the language back to the family.
 *
 * The eleven minutes on the device are the smaller half of the method; the
 * words said out loud at dinner are the larger half. This card is the whole
 * hand-off: four words (the ones that need saving first), a couple of
 * authored questions that make a two-year-old compare and explain, and —
 * when a STEM pack item came up today — one tiny experiment.
 */
export function tonightCard(state) {
  if (!state.settings.words) return '';
  const data = snapshot();
  const tonight = tonightsCard(data.progress.words, data.wordsDaily.items);
  if (!tonight.words.length && !tonight.prompts.length) return '';

  const words = tonight.words.map((w) => `
    <div class="vrow">
      <span class="pglyph pglyph--emoji">${w.emoji}</span>
      <span class="vrow__text"><b>${esc(w.text)}</b>
        <span class="plang">${esc(w.langName)}</span>
        ${w.missed ? '<br>needed another go today — this one first' : ''}</span>
    </div>`).join('');

  const prompts = tonight.prompts.length
    ? `<p class="pcard__title" style="margin-top:16px">And ask, whenever it fits</p>
       ${tonight.prompts.map((p) => `<p class="pcard__body">· ${esc(p)}</p>`).join('')}`
    : '';

  const experiment = tonight.experiment
    ? `<p class="pcard__title" style="margin-top:16px">${esc(tonight.experiment.title)}</p>
       ${tonight.experiment.steps.map((s) => `<p class="pcard__body">· ${esc(s)}</p>`).join('')}`
    : '';

  return card('Tonight, away from the phone', `
    <p class="pcard__body">Say each of these out loud at dinner — point at the real thing,
      then wait. The words your child gives back at the table are worth more than
      anything the app heard today.</p>
    ${words}
    ${prompts}
    ${experiment}`);
}

/**
 * Voice card — the honesty readout.
 *
 * This exists so that refusing to speak reads as a considered decision rather
 * than a bug. A parent who is told the truth can act on it; a parent who just
 * hears silence files a one-star review.
 */
export function voiceCard(state) {
  const rows = TRACK_IDS.map((id) => {
    const tier = state.voice.tiers[id] || 'none';
    return `<div class="vrow">
      <span class="vswatch" data-tier="${tier}"></span>
      <span class="vrow__text">${voiceLine(id, tier)}</span>
    </div>`;
  }).join('');

  return card('Voice', rows + `
    <div class="pbtn-row" style="margin-top:12px">
      <button class="pbtn" type="button" data-action="test-voice" data-arg="en">Test English</button>
      <button class="pbtn" type="button" data-action="test-voice" data-arg="mr">Test मराठी</button>
      <button class="pbtn" type="button" data-action="test-voice" data-arg="sa">Test संस्कृत</button>
    </div>`);
}

function voiceLine(trackId, tier) {
  const name = TRACKS[trackId].name;
  if (tier === 'clip' || tier === 'pregen') {
    return `<b>${esc(name)}:</b> clips recorded by a native speaker.`;
  }
  if (tier === 'device') {
    return `<b>${esc(name)}:</b> your phone's own ${esc(name)} voice is being used.`;
  }
  if (trackId === 'mr') {
    return `<b>मराठी:</b> your phone has no Marathi voice. Letters are shown and animated but not
      spoken. We could hand the text to a Hindi voice, but Hindi drops the final vowel — कमळ would
      come out as "kamal" — and has no ळ at all, so it would teach the wrong sound.`;
  }
  if (trackId === 'sa') {
    return `<b>संस्कृत:</b> no phone ships a Sanskrit voice. A Hindi voice flattens the vowel
      lengths and the visarga, which is most of what makes a shloka a shloka, so the lines stay
      silent until they are recorded.`;
  }
  return `<b>${esc(name)}:</b> no matching voice on this phone, so these stay silent.`;
}

export function card(title, bodyHtml) {
  return `<section class="pcard">
    <h3 class="pcard__title">${esc(title)}</h3>
    ${bodyHtml}
  </section>`;
}

export { esc };
