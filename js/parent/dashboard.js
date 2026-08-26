import { TRACKS, TRACK_IDS, lettersOf } from '../data/tracks.js';
import {
  strugglingIn, struggleReason, msToday, msThisWeek, formatDuration,
} from '../storage/progress.js';
import { tonightsCard } from '../features/wordSchedule.js';
import { snapshot } from '../storage/store.js';
import { PACKS, LANGS, itemsOf, parseWordKey } from '../data/packs/index.js';
import { enabledPacks } from '../features/words.js';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Progress.
 *
 * Every number here counts something the child DID — words said back, letters
 * finished, days the app was opened. None of them is a score: there is no
 * percentage of a notional target, no streak to break, and nothing is compared
 * to another child. The chart plots minutes a day because that is the one
 * series actually stored (fourteen days of it), and because it answers the
 * question a parent really has — is this a habit or is it drifting.
 *
 * All of it lives behind the hold-to-open door. Nothing on a screen the child
 * sees ever counts anything.
 */
export function progressCard(state) {
  if (state.storage === 'readonly') {
    return card('Progress',
      `<p class="pcard__body">This device will not let the app save anything — private browsing,
       or storage turned off. Everything still works, but the amber dots start over each time
       you open it.</p>`);
  }

  const enabled = TRACK_IDS.filter((id) => state.settings.tracks[id]);
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

  const tracks = enabled.map((id) => trackBlock(state, id)).join('');

  return `${wordsTile(state)}
    <div class="bento">${lettersTile(state, enabled)}${daysTile()}</div>
    ${minutesCard()}
    ${card('Letters brought to life', tracks + worth)}`;
}

/* ── the tiles ─────────────────────────────────────────────────────────── */

/** Words the child has said back at least once, split by language. */
function wordsTile(state) {
  const rows = state.progress.words || {};
  const packsOn = enabledPacks(state.settings);
  const known = { en: 0, mr: 0 };
  for (const key of Object.keys(rows)) {
    const row = rows[key];
    const parsed = parseWordKey(key);
    if (!row || !parsed || !row.gotIt || !packsOn.includes(parsed.packId)) continue;
    if (known[parsed.lang] !== undefined) known[parsed.lang] += 1;
  }
  const total = packsOn.reduce(
    (n, id) => n + itemsOf(id).length * (PACKS[id]?.langs.length || 0), 0);
  const sum = known.en + known.mr;

  // The bar is scaled to the whole pack, not to the two segments: a split bar
  // that fills the width whatever the count reads as "finished". Both segments
  // are named in the key underneath, because hue alone is unreadable to a
  // colour-blind parent, and a 2px gap separates them on the surface.
  const rest = Math.max(0, total - sum);
  const bar = sum
    ? `<div class="pbar" role="img"
            aria-label="${sum} of ${total}: ${known.en} English, ${known.mr} मराठी">
         ${known.en ? `<i data-series="en" style="flex:${known.en}"></i>` : ''}
         ${known.mr ? `<i data-series="mr" style="flex:${known.mr}"></i>` : ''}
         ${rest ? `<i data-series="rest" style="flex:${rest}"></i>` : ''}
       </div>
       <p class="pkey">
         <span><i data-series="en"></i>${esc(LANGS.en.name)} ${known.en}</span>
         <span><i data-series="mr"></i>${esc(LANGS.mr.name)} ${known.mr}</span>
       </p>`
    : `<p class="pcard__body">Nothing yet. The first one usually lands in a day or two.</p>`;

  return `<section class="pcard pcard--hero" data-tint="sky">
    <h3 class="pcard__eyebrow">Words he can say back</h3>
    <p class="pstat"><b>${sum}</b><span>of ${total}</span></p>
    ${bar}
  </section>`;
}

function lettersTile(state, enabled) {
  const traceable = enabled.filter((id) => TRACKS[id].traceable);
  const lit = traceable.reduce(
    (n, id) => n + Object.keys(state.progress.done[id] || {}).length, 0);
  const all = traceable.reduce((n, id) => n + lettersOf(id).length, 0);
  const names = traceable.map((id) => TRACKS[id].name).join(' + ') || 'no tracks on';

  return `<section class="pcard pcard--tile" data-tint="rose">
    <h3 class="pcard__eyebrow">Letters lit</h3>
    <p class="pstat"><b>${lit}</b><span>of ${all}</span></p>
    <p class="ptile__foot">${esc(names)}</p>
  </section>`;
}

function daysTile() {
  const days = lastDays(14);
  const played = days.filter((d) => d.ms > 0).length;

  return `<section class="pcard pcard--tile" data-tint="mint">
    <h3 class="pcard__eyebrow">Played</h3>
    <p class="pstat"><b>${played}</b><span>${played === 1 ? 'day' : 'days'}</span></p>
    <p class="ptile__foot">Today ${formatDuration(msToday())} · week ${formatDuration(msThisWeek())}</p>
  </section>`;
}

/* ── minutes a day ─────────────────────────────────────────────────────── */

/** The last `n` days, oldest first, from the usage log. */
function lastDays(n) {
  const days = snapshot().usage.days || {};
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push({ key, date: d, ms: days[key] || 0 });
  }
  return out;
}

/**
 * Fourteen days of minutes, as bars.
 *
 * Bars rather than a line: each day is its own bucket, and a line between two
 * days would draw minutes that were never played. Rounded tops anchored to the
 * baseline, a 2px gap between bars, and only two labels — today and the
 * longest day — because a number over every bar is noise, not information.
 */
function minutesCard() {
  const days = lastDays(14);
  const mins = days.map((d) => Math.round(d.ms / 60000));
  const peak = Math.max(...mins);

  if (!peak) {
    return card('Minutes a day',
      `<p class="pcard__body">Nothing recorded in the last two weeks.</p>`);
  }

  const peakIndex = mins.lastIndexOf(peak);
  const bars = days.map((d, i) => {
    const m = mins[i];
    const label = i === days.length - 1 || i === peakIndex;
    return `<div class="pbar-col" title="${esc(dayLabel(d.date))} · ${m} min">
      <span class="pbar-num" data-on="${label && m ? 1 : 0}">${m || ''}</span>
      <i style="height:${m ? Math.max(4, Math.round((m / peak) * 100)) : 0}%"
         data-zero="${m ? 0 : 1}"
         data-today="${i === days.length - 1 ? 1 : 0}"></i>
    </div>`;
  }).join('');

  return `<section class="pcard">
    <h3 class="pcard__eyebrow">Minutes a day · last 14</h3>
    <div class="pchart">${bars}</div>
    <p class="pchart__axis"><span>${esc(dayLabel(days[0].date))}</span><span>today</span></p>
  </section>`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayLabel = (d) => `${DAY_NAMES[d.getDay()]} ${d.getDate()}`;

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
