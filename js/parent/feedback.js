import { getState } from '../core/app.js';
import { TRACKS, TRACK_IDS, lettersOf } from '../data/tracks.js';
import { msThisWeek } from '../storage/progress.js';

/**
 * Feedback goes to a hosted Tally form, opened in a new tab with context in
 * the URL. Tally fills hidden fields from query params whose key matches the
 * field key.
 *
 * TODO: create the form at tally.so, add hidden fields named exactly as the
 * keys in buildSnapshot(), and paste its id here. Until then the Parent Zone
 * feedback card does not render at all — better absent than broken.
 */
export const TALLY_FORM_ID = 'REPLACE_WITH_TALLY_FORM_ID';

export const APP_VERSION = '2026.08.24';

export const isConfigured = () => /^[A-Za-z0-9]{4,}$/.test(TALLY_FORM_ID);

/** Only these characters, only 64 of them. Anything else is dropped. */
const SAFE = /^[A-Za-z0-9:,./_-]{1,64}$/;

function platform() {
  const ua = navigator.userAgent || '';
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (/iPhone|iPad|iPod/.test(ua)) return standalone ? 'ios-standalone' : 'ios-safari';
  if (/Android/.test(ua)) return standalone ? 'android-standalone' : 'android-chrome';
  if (/Mobi/.test(ua)) return 'other-mobile';
  return 'desktop';
}

/**
 * Counts, tiers and buckets. Never a glyph, never a timestamp, never the
 * struggling-letter list, never the raw user-agent string, never anything a
 * child typed — the builder simply does not read those fields, which is why
 * the promise on the card can be stated flatly.
 */
export function buildSnapshot() {
  const state = getState();
  const done = state.progress.done;

  const prog = TRACK_IDS
    .map((id) => `${id}:${Object.keys(done[id] || {}).length}/${lettersOf(id).length}`)
    .join(',');

  const voice = TRACK_IDS.map((id) => `${id}:${state.voice.tiers[id] || 'none'}`).join(',');

  return {
    app: 'akshar-khel',
    v: APP_VERSION,
    plat: platform(),
    voice,
    prog,
    mins: String(Math.round(msThisWeek() / 60000 / 5) * 5),
    pwa: state.layout.standalone ? 'installed' : 'none',
    motion: state.layout.motion,
    lang: String(navigator.language || 'unknown').slice(0, 12),
  };
}

export function feedbackUrl(snapshot = buildSnapshot(), formId = TALLY_FORM_ID) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(snapshot)) {
    const s = String(value);
    if (SAFE.test(s)) q.set(key, s);
    else console.warn('feedback: dropped unsafe param', key);
  }
  return `https://tally.so/r/${encodeURIComponent(formId)}?${q.toString()}`;
}

/**
 * The literal payload, laid out for a human to read. Rendering the exact
 * string is what turns "we don't collect anything about your child" from a
 * promise into something the parent can check for themselves.
 */
export function payloadText(snapshot = buildSnapshot()) {
  return Object.entries(snapshot).map(([k, v]) => `${k}=${v}`).join('\n');
}

export { TRACKS };
