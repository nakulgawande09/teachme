import { say } from './say.js';
import { hasClip } from './resolver.js';
import { deviceTier } from './voices.js';
import {
  PACKS, PACK_IDS, LANGS, itemsOf, itemById, wordKey, wordClipKey,
} from '../data/packs/index.js';

/**
 * Words-mode audio: the same ladder the letters use, asked per
 * (item × language), plus the question the scheduler needs answered first —
 * "can this word make a correct sound on this device at all?"
 *
 * Resolution order for one word:
 *   1  a clip the parents recorded on this device   (arrives with clips.js)
 *   2  a shipped clip — word clips live in the same reviewed manifest as the
 *      letter clips, under their own `w/` namespace, so the resolver's
 *      manifest machinery is reused whole
 *   3  the device voice, ONLY when its language genuinely matches
 *   4  nothing — and the scheduler never builds a turn around nothing
 */

/** Set by the parent-recorder step; checks a locally recorded clip. */
let localClipCheck = () => false;
let localClipPlayer = null;

export function configureLocalClips({ has, play }) {
  localClipCheck = typeof has === 'function' ? has : () => false;
  localClipPlayer = typeof play === 'function' ? play : null;
}

/**
 * Say one word in one language.
 * @returns {Promise<'parent'|'clip'|'pregen'|'device'|'none'>}
 */
export async function sayWord(packId, itemId, lang, { rate } = {}) {
  const item = itemById(packId, itemId);
  const spec = LANGS[lang];
  if (!item || !spec) {
    console.warn('wordAudio: unknown word', packId, itemId, lang);
    return 'none';
  }

  const clip = wordClipKey(packId, itemId, lang);
  if (localClipPlayer && localClipCheck(clip)) {
    const played = await localClipPlayer(clip);
    if (played) return 'parent';
    // A broken recording degrades to the next rung, never to silence-by-bug.
  }
  return say(item.words[lang], spec.tag, { key: clip, rate });
}

/** Can this (item × language) make a correct sound right now? */
export const audible = (packId, itemId, lang) => {
  const spec = LANGS[lang];
  if (!spec) return false;
  const clip = wordClipKey(packId, itemId, lang);
  return localClipCheck(clip) || hasClip(clip) || deviceTier(spec.tag) === 'device';
};

/* Memoised per enabled-pack signature. Voices resolve asynchronously and
   recordings land while the app runs, so anything that changes the answer
   calls invalidateAudibility(). */
let memoSig = null;
let memoSet = null;

/**
 * Every audible wordKey across the given packs — the Set the pure scheduler
 * filters on.
 */
export function audibleSet(enabledPacks) {
  const sig = enabledPacks.join(',');
  if (memoSig === sig && memoSet) return memoSet;
  const out = new Set();
  for (const packId of enabledPacks) {
    const pack = PACKS[packId];
    if (!pack) continue;
    for (const item of itemsOf(packId)) {
      for (const lang of pack.langs) {
        if (audible(packId, item.id, lang)) out.add(wordKey(packId, item.id, lang));
      }
    }
  }
  memoSig = sig;
  memoSet = out;
  return out;
}

export function invalidateAudibility() {
  memoSig = null;
  memoSet = null;
}

/** A cheap fingerprint for render signatures: repaint when audibility moves. */
export const audibleFingerprint = (enabledPacks) => String(audibleSet(enabledPacks).size);

/** What each words language can honestly offer, for the grown-ups readout. */
export function wordTierFor(lang) {
  const spec = LANGS[lang];
  if (!spec) return 'none';
  for (const packId of PACK_IDS) {
    for (const item of itemsOf(packId)) {
      const clip = wordClipKey(packId, item.id, lang);
      if (localClipCheck(clip) || hasClip(clip)) return localClipCheck(clip) ? 'parent' : 'clip';
    }
  }
  return deviceTier(spec.tag);
}
