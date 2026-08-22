import { deviceTier } from './voices.js';
import { speak, stop } from './speech.js';

/**
 * The fallback ladder, in priority order:
 *
 *   1  recorded clip        correct and instant          (tier 'clip')
 *   2  pre-generated synth  reviewed, shipped as audio   (tier 'pregen')
 *   3  device voice         ONLY if the language matches (tier 'device')
 *   4  silence + animation  never a wrong pronunciation  (tier 'none')
 *
 * Tiers 1 and 2 need a clip manifest that does not exist yet — ~200 clips,
 * one afternoon with one native Marathi speaker, under 3 MB as Opus. This
 * module is the seam so that lands as a content drop, not a refactor: nothing
 * above it knows which tier played.
 *
 * See docs/voice-and-audio.md for the recording spec and the manifest shape.
 */

const MANIFEST_URL = '/audio/clips.json';

/**
 * Flip to true in the same commit that adds /audio/. Kept as a constant
 * rather than "just try the fetch" so a device with no clips makes no request
 * at all — a 404 on every cold start is noise in a parent's devtools and a
 * wasted round trip on a slow connection.
 */
const CLIPS_SHIPPED = false;

let manifest = null;      // {speaker, dialect, loudness_lufs, reviewed_by, clips:{}}
let audioCtx = null;
let buffers = new Map();  // sprite file -> decoded AudioBuffer
let volume = 0.8;

/** Clip key for one utterance. Stable — the manifest is written against it. */
export const clipKey = (trackId, glyph, kind = 'name') => `${trackId}/${glyph}/${kind}`;

/**
 * Load the clip manifest if one has been shipped. Absence is the normal case
 * today and must be silent — a 404 here is not an error condition.
 */
export async function loadManifest() {
  if (manifest !== null) return manifest;
  if (!CLIPS_SHIPPED) {
    manifest = false;
    return manifest;
  }
  try {
    const res = await fetch(MANIFEST_URL, { cache: 'no-cache' });
    if (!res.ok) {
      manifest = false;
      return manifest;
    }
    const data = await res.json();
    // An unreviewed clip set must never reach a child. Ship nothing rather
    // than ship audio a native speaker has not signed off.
    if (!data || !data.clips || !data.reviewed_by) {
      console.warn('audio: clip manifest present but not marked reviewed_by — ignoring it');
      manifest = false;
      return manifest;
    }
    manifest = data;
  } catch {
    manifest = false;
  }
  return manifest;
}

export function setVolume(v) {
  volume = Math.min(1, Math.max(0, Number(v) || 0));
}

/** @returns {'clip'|'pregen'|'device'|'none'} the best tier available for a track. */
export function tierFor(trackId, lang) {
  if (manifest && hasAnyClip(trackId)) return manifest.pregen ? 'pregen' : 'clip';
  return deviceTier(lang);
}

function hasAnyClip(trackId) {
  if (!manifest || !manifest.clips) return false;
  const prefix = `${trackId}/`;
  for (const key of Object.keys(manifest.clips)) if (key.startsWith(prefix)) return true;
  return false;
}

/** Whether a shipped clip exists for one exact key. The words mode asks this
 *  per (item × language) — its schedulability rule, not just its tier. */
export const hasClip = (key) => !!(manifest && manifest.clips && manifest.clips[key]);

/**
 * Say one thing. Returns the tier that actually produced sound, so callers
 * (and the parent-zone readout) always know the truth.
 * @returns {Promise<'clip'|'pregen'|'device'|'none'>}
 */
export async function say(text, lang, { key = null, rate = 0.9 } = {}) {
  if (manifest && key && manifest.clips[key]) {
    const played = await playClip(key);
    if (played) return manifest.pregen ? 'pregen' : 'clip';
    // Fall through: a broken clip should degrade, not go silent.
  }
  return speak(text, lang, { rate, volume, key }) ? 'device' : 'none';
}

export const silence = stop;

/* ── clip playback (dormant until a manifest ships) ────────────────────── */

function context() {
  if (audioCtx) return audioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try {
    audioCtx = new Ctx();
  } catch (err) {
    console.warn('audio: no AudioContext', err);
    audioCtx = null;
  }
  return audioCtx;
}

/** iOS requires a gesture before an AudioContext will produce sound. */
export function unlockContext() {
  const ctx = context();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

/** The one shared, gesture-unlocked context. The recorder plays the child's
 *  own voice back through it, because a fresh <audio> element would need a
 *  fresh gesture on iOS and the gesture already happened a step ago. */
export const audioContext = () => context();

async function bufferFor(file) {
  if (buffers.has(file)) return buffers.get(file);
  const ctx = context();
  if (!ctx) return null;
  try {
    const res = await fetch(`/audio/${file}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await ctx.decodeAudioData(await res.arrayBuffer());
    buffers.set(file, buf);
    return buf;
  } catch (err) {
    console.warn('audio: could not load clip file', file, err);
    buffers.set(file, null);
    return null;
  }
}

async function playClip(key) {
  const entry = manifest.clips[key];
  const ctx = context();
  if (!entry || !ctx) return false;

  const buf = await bufferFor(entry.file);
  if (!buf) return false;

  try {
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    gain.gain.value = volume;
    src.connect(gain).connect(ctx.destination);
    src.start(0, entry.start || 0, entry.dur || undefined);
    return true;
  } catch (err) {
    console.warn('audio: clip playback failed', key, err);
    return false;
  }
}
