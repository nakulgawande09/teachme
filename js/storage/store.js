import {
  CURRENT_VERSION, STORAGE_KEY, CORRUPT_KEY,
  validateSettings, validateLetterRow, validateDaily,
  SETTINGS_DEFAULTS, EMPTY_PROGRESS, EMPTY_USAGE,
} from './schema.js';
import { ALL_LETTER_KEYS, TRACK_IDS } from '../data/tracks.js';

/**
 * localStorage, one key, written atomically.
 *
 * Nothing here trusts what it reads. A blob can be corrupt, hand-edited,
 * written by a newer deploy, or refused outright (Safari private browsing) —
 * all four have explicit paths, and none of them are allowed to break the
 * child-facing app.
 */

const WRITE_DEBOUNCE_MS = 400;
const KEEP_DAYS = 14;

let cache = fresh();
let mode = 'ok';          // ok | readonly
let pending = 0;
let onModeChange = () => {};

function fresh() {
  return {
    v: CURRENT_VERSION,
    createdAt: Date.now(),
    settings: { ...SETTINGS_DEFAULTS },
    progress: { done: {}, letters: {} },
    usage: { ...EMPTY_USAGE, days: {} },
    daily: { day: '', sets: {} },
  };
}

export function onStorageMode(fn) {
  onModeChange = typeof fn === 'function' ? fn : () => {};
}

const setMode = (next) => {
  if (mode === next) return;
  mode = next;
  onModeChange(mode);
};

/* ── read ──────────────────────────────────────────────────────────────── */

/** @returns {{data:object, mode:'ok'|'readonly', recovered:boolean}} */
export function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    // Private browsing, or storage disabled by policy. The app runs entirely
    // in memory; the child notices nothing, and the parent zone says so.
    console.warn('storage: unavailable, running in memory', err);
    setMode('readonly');
    cache = fresh();
    return { data: cache, mode, recovered: false };
  }

  if (!raw) {
    cache = fresh();
    return { data: cache, mode, recovered: false };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn('storage: blob is not valid JSON, starting fresh', err);
    try { localStorage.setItem(CORRUPT_KEY, raw.slice(0, 20000)); } catch { /* best effort */ }
    cache = fresh();
    return { data: cache, mode, recovered: true };
  }

  cache = normalise(migrate(parsed));
  return { data: cache, mode, recovered: false };
}

function migrate(data) {
  if (!data || typeof data !== 'object') return fresh();
  const v = Number(data.v) || 0;

  // A newer deploy wrote this. Do NOT downgrade or wipe — read the one field
  // whose shape is guaranteed stable and leave the rest of the blob alone.
  if (v > CURRENT_VERSION) {
    console.warn('storage: blob is from a newer version, reading conservatively');
    const base = fresh();
    base.progress.done = (data.progress && data.progress.done) || {};
    return base;
  }

  // No migrations yet. When v2 arrives: MIGRATIONS[1] = (d) => ({...d, v:2}).
  return data;
}

function normalise(data) {
  const out = fresh();
  out.createdAt = Number(data.createdAt) || out.createdAt;
  out.settings = validateSettings(data.settings);

  const done = {};
  const rawDone = (data.progress && data.progress.done) || {};
  for (const trackId of TRACK_IDS) {
    const track = rawDone[trackId];
    if (!track || typeof track !== 'object') continue;
    const kept = {};
    for (const glyph of Object.keys(track)) {
      if (track[glyph] === true && ALL_LETTER_KEYS.has(`${trackId}:${glyph}`)) kept[glyph] = true;
    }
    if (Object.keys(kept).length) done[trackId] = kept;
  }
  out.progress.done = done;

  // Filtering against the known glyph set both drops junk and bounds growth.
  const letters = {};
  const rawLetters = (data.progress && data.progress.letters) || {};
  for (const key of Object.keys(rawLetters)) {
    if (!ALL_LETTER_KEYS.has(key)) continue;
    const row = validateLetterRow(rawLetters[key]);
    if (row) letters[key] = row;
  }
  out.progress.letters = letters;

  const usage = data.usage && typeof data.usage === 'object' ? data.usage : {};
  out.usage.sessions = Math.max(0, Math.min(1e6, Number(usage.sessions) || 0));
  out.usage.lastSessionAt = Math.max(0, Number(usage.lastSessionAt) || 0);
  out.usage.days = trimDays(usage.days, KEEP_DAYS);
  out.daily = validateDaily(data.daily);

  return out;
}

function trimDays(days, keep) {
  if (!days || typeof days !== 'object') return {};
  return Object.fromEntries(
    Object.entries(days)
      .filter(([d, ms]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Number(ms)))
      .map(([d, ms]) => [d, Math.max(0, Math.min(8.64e7, Number(ms)))])
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, keep)
  );
}

/* ── write ─────────────────────────────────────────────────────────────── */

export const snapshot = () => cache;

/** Apply an immutable update and schedule a debounced write. */
export function update(fn) {
  const next = fn(cache);
  if (!next || next === cache) return cache;
  cache = next;
  schedule();
  return cache;
}

function schedule() {
  if (mode === 'readonly' || pending) return;
  pending = setTimeout(() => {
    pending = 0;
    flush();
  }, WRITE_DEBOUNCE_MS);
}

/** Write now. Called after comeAlive(), and on pagehide/visibilitychange. */
export function flush() {
  if (pending) {
    clearTimeout(pending);
    pending = 0;
  }
  if (mode === 'readonly') return mode;
  setMode(persist(cache));
  return mode;
}

const isQuota = (e) =>
  !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
       || e.code === 22 || e.code === 1014);

function trySet(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    if (!isQuota(err)) {
      console.error('storage: write failed', err);
      return false;
    }
    return false;
  }
}

/** Shed the least valuable data first; keep `done` + settings to the last. */
function persist(data) {
  if (trySet(data)) return 'ok';

  const a = { ...data, usage: { ...data.usage, days: trimDays(data.usage.days, 3) } };
  if (trySet(a)) return 'ok';

  const completed = Object.fromEntries(
    Object.entries(a.progress.letters).filter(([, r]) => r.completions > 0)
  );
  const b = { ...a, progress: { ...a.progress, letters: completed } };
  if (trySet(b)) return 'ok';

  const minimal = {
    v: CURRENT_VERSION,
    createdAt: data.createdAt,
    settings: data.settings,
    progress: { done: data.progress.done, letters: {} },
    usage: { days: {}, sessions: 0, lastSessionAt: 0 },
  };
  if (trySet(minimal)) return 'ok';

  console.warn('storage: out of room even after shedding — progress will not be saved');
  return 'readonly';
}

/* ── parent-zone data controls ─────────────────────────────────────────── */

export function resetProgress() {
  cache = {
    ...cache,
    progress: { done: {}, letters: {} },
    usage: { ...EMPTY_USAGE, days: {} },
    daily: { day: '', sets: {} },
  };
  flush();
  return cache;
}

export function resetEverything() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CORRUPT_KEY);
  } catch (err) {
    console.warn('storage: could not clear', err);
  }
  cache = fresh();
  return cache;
}

/** Exactly what is on this device, as a file the parent can open and read. */
export const exportJSON = () => JSON.stringify(cache, null, 2);

export const getMode = () => mode;
export { EMPTY_PROGRESS };
