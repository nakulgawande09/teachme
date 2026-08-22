import { TRACKS, TRACK_IDS } from '../data/tracks.js';
import { PACKS, PACK_IDS } from '../data/packs/index.js';
import { card, esc } from './dashboard.js';
import { activeMinutes } from '../features/session.js';

/**
 * Settings cards.
 *
 * Every control writes through `SETTINGS_SET`, which runs the same validator
 * as the storage read path — so the UI cannot produce a value that a reload
 * would then reject. Nothing here caches a setting; each is read at the
 * moment of use, which is what kills stale-config bugs.
 */

const seg = (key, options, current) =>
  `<div class="seg">${options.map((o) => `
    <button class="seg__opt" type="button" role="button"
            data-action="set-setting" data-arg="${key}:${o.value}"
            aria-pressed="${String(o.value) === String(current)}"
            ${o.disabled ? 'disabled' : ''}>${esc(o.label)}</button>`).join('')}</div>`;

/**
 * The daily portion. This is the app's main answer to "don't let it become a
 * thing they can't put down": a small set with a visible end, rather than a
 * grid of forty-eight letters that never runs out.
 */
export function dailyCard(state) {
  return card('Today\'s letters', `
    <p class="pcard__body">Each day the app picks a few letters — some new, some due to come
      round again — and says <b>done</b> when they are finished. Four or five at a time is what
      children of this age actually hold on to, and finishing something is a much better way to
      end than running out of time.</p>
    ${seg('dailySize', [
      { value: 2, label: '2 a day' },
      { value: 3, label: '3 a day' },
      { value: 5, label: '5 a day' },
    ], state.settings.dailySize)}

    <p class="pcard__body" style="margin-top:16px">Letters already met come back as a question —
      "which one says this?" — rather than just being shown again. Being asked to remember is
      what makes it stick. A wrong tap only replays the sound; nothing is scored.</p>
    ${seg('quiz', [
      { value: true, label: 'ask me' },
      { value: false, label: 'just show' },
    ], state.settings.quiz)}
    <p class="pcard__body" style="margin:12px 0 0">
      Letters come back after 1 day, then 2, 4, 8 and 16 — sooner if they were tricky.
    </p>`);
}

export function sessionCard(state) {
  const mins = activeMinutes();
  return card('Session length', `
    <p class="pcard__body">A gentle stop is suggested after this long. It cannot be switched off —
      after two "five more minutes" the option stops appearing.</p>
    ${seg('sessionMin', [
      { value: 10, label: '10 min' },
      { value: 15, label: '15 min' },
      { value: 20, label: '20 min' },
    ], state.settings.sessionMin)}
    <p class="pcard__body" style="margin:12px 0 0">
      This session so far: ${mins < 1 ? 'just started' : `${mins} min`}.
    </p>`);
}

export function contentCard(state) {
  const on = TRACK_IDS.filter((id) => state.settings.tracks[id]);
  const trackToggles = TRACK_IDS.map((id) => {
    const enabled = state.settings.tracks[id];
    const last = enabled && on.length === 1;
    return `<button class="seg__opt" type="button"
              data-action="toggle-track" data-arg="${id}"
              aria-pressed="${enabled}" ${last ? 'disabled' : ''}
              title="${last ? 'At least one track has to stay on' : ''}">${esc(TRACKS[id].name)}</button>`;
  }).join('');

  return card('Content & difficulty', `
    <p class="pcard__body">Which tracks appear on the home screen.</p>
    <div class="seg">${trackToggles}</div>

    <p class="pcard__body" style="margin-top:16px">How closely a stroke has to be followed.</p>
    ${seg('strictness', [
      { value: 'gentle', label: 'gentle' },
      { value: 'normal', label: 'normal' },
      { value: 'strict', label: 'strict' },
    ], state.settings.strictness)}

    <p class="pcard__body" style="margin-top:16px">How long before the demonstration replays itself.</p>
    ${seg('helpDelaySec', [
      { value: 4, label: '4 s' },
      { value: 7, label: '7 s' },
      { value: 0, label: 'never' },
    ], state.settings.helpDelaySec)}

    <p class="pcard__body" style="margin-top:16px">
      Show the sound (<span style="font-family:var(--face-mono)">/क/</span>) beside each letter.
      Letter <em>names</em> mislead early readers — "C" is called "see" but says /k/.
    </p>
    ${seg('soundFirst', [
      { value: true, label: 'show the sound' },
      { value: false, label: 'letter only' },
    ], state.settings.soundFirst)}`);
}

/* Pack names for toggles, including packs that ship in later releases —
   an unknown id in settings is harmless (the schema validates), but only
   packs that actually exist in PACKS get a button. */
export function wordsSettingsCard(state) {
  const on = PACK_IDS.filter((id) => state.settings.packs[id]);
  const packToggles = PACK_IDS.map((id) => {
    const enabled = !!state.settings.packs[id];
    const last = enabled && on.length === 1;
    return `<button class="seg__opt" type="button"
              data-action="toggle-pack" data-arg="${id}"
              aria-pressed="${enabled}" ${last ? 'disabled' : ''}
              title="${last ? 'At least one topic has to stay on' : ''}">${esc(PACKS[id].name)}</button>`;
  }).join('');

  return card('Words', `
    <p class="pcard__body">A daily set of everyday things: tap the picture, hear the word —
      English and मराठी take turns on the same objects — then say it back. Words that were
      tricky return sooner; this page's <b>Tonight</b> card tells you which ones to use at
      dinner.</p>
    ${seg('words', [
      { value: true, label: 'on' },
      { value: false, label: 'off' },
    ], state.settings.words)}

    <p class="pcard__body" style="margin-top:16px">How many words a day.</p>
    ${seg('wordsPerDay', [
      { value: 4, label: '4 a day' },
      { value: 6, label: '6 a day' },
      { value: 8, label: '8 a day' },
    ], state.settings.wordsPerDay)}

    <p class="pcard__body" style="margin-top:16px">Topics in the rotation.</p>
    <div class="seg">${packToggles}</div>

    <p class="pcard__body" style="margin-top:16px">After the word plays, record your child
      saying it back and play their own voice to them. The recording lives for a few
      seconds in memory and is thrown away — nothing is uploaded, nothing is kept,
      nothing is scored.</p>
    ${seg('recordBack', [
      { value: true, label: 'record & replay' },
      { value: false, label: 'just listen' },
    ], state.settings.recordBack)}`);
}

export function voiceControlsCard(state) {
  return card('Volume & speed', `
    <p class="pcard__body">Independent of your phone's volume.</p>
    <label class="sr-only" for="volRange">Voice volume</label>
    <input class="prange" id="volRange" type="range" min="0" max="1" step="0.05"
           value="${state.settings.volume}" data-action="set-volume">
    <p class="pcard__body" style="margin:12px 0 0">Speaking speed — slower helps a new letter land.</p>
    <label class="sr-only" for="rateRange">Speaking speed</label>
    <input class="prange" id="rateRange" type="range" min="0.6" max="1.2" step="0.05"
           value="${state.settings.rate}" data-action="set-rate">`);
}

export function motionCard(state) {
  return card('Motion', `
    <p class="pcard__body">The letter coming alive is the only long animation. Turn it down if
      movement is distracting or uncomfortable.</p>
    ${seg('motion', [
      { value: 'auto', label: 'follow my phone' },
      { value: 'reduced', label: 'reduce motion' },
    ], state.settings.motion)}`);
}
