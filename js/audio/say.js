import { dispatch, getState } from '../core/app.js';
import { A } from '../core/actions.js';
import { setStatusHandler } from './speech.js';
import * as resolver from './resolver.js';
import { deviceTier } from './voices.js';
import { TRACKS, TRACK_IDS } from '../data/tracks.js';

/**
 * The single entry point for "make a sound". Everything above this line
 * — screens, trace, shlokas — is unaware of which tier produced it.
 */

setStatusHandler((status) => dispatch(A.AUDIO_STATUS, status));

export async function say(text, lang, { key = null, rate } = {}) {
  const { settings } = getState();
  resolver.setVolume(settings.volume);
  return resolver.say(text, lang, { key, rate: rate ?? settings.rate });
}

/** Shlokas at 0.65: sentence intonation at speaking speed flattens the metre. */
export const sayShloka = (text) => say(text, TRACKS.sa.lang, { rate: 0.65 });

export const silence = resolver.silence;

/** Recompute what each track can honestly offer, and publish it to state. */
export function refreshTiers() {
  const tiers = {};
  for (const id of TRACK_IDS) tiers[id] = resolver.tierFor(id, TRACKS[id].lang);
  dispatch(A.VOICE_READY, { ready: true, tiers });
  return tiers;
}

export { deviceTier };
