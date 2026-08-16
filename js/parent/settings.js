import { TRACKS, TRACK_IDS } from '../data/tracks.js';
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
