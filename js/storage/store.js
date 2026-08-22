import {
  CURRENT_VERSION, STORAGE_KEY, CORRUPT_KEY,
  validateSettings, validateLetterRow, validateDaily,
  validateWordRow, validateWordsDaily,
  SETTINGS_DEFAULTS, EMPTY_PROGRESS, EMPTY_USAGE,
} from './schema.js';
import { ALL_LETTER_KEYS, TRACK_IDS } from '../data/tracks.js';
import { ALL_WORD_KEYS } from '../data/packs/index.js';

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
    progress: { done: {}, letters: {}, words: {} },
    usage: { ...EMPTY_USAGE, days: {} },
    daily: { day: '', sets: {} },
    wordsDaily: { day: '', items: [], done: [] },
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
  let v = Number(data.v) || 0;

  // A newer deploy wrote this. Do NOT downgrade or wipe — read the one field
  // whose shape is guaranteed stable and leave the rest of the blob alone.
  if (v > CURRENT_VERSION) {
    console.warn('storage: blob is from a newer version, reading conservatively');
    const base = fresh();
    base.progress.done = (data.progress && data.progress.done) || {};
    return base;
  }

  /* Each entry lifts one version. A missing entry is a version that only
     bumped the number, which `normalise()` absorbs anyway. */
  const MIGRATIONS = {
    // v1 → v2: the words mode arrives — its progress map and today's set.
    1: (d) => ({
      ...d,
      v: 2,
      progress: { ...(d.progress || {}), words: {} },
      wordsDaily: { day: '', items: [], done: [] },
    }),
  };

  let out = data;
  for (; v < CURRENT_VERSION; v++) {
    out = (MIGRATIONS[v] || ((x) => ({ ...x, v: v + 1 })))(out);
  }
  return out;
}

/** Exported for the node tests only — the app goes through load(). */
export { migrate };

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

  // Word rows get the same treatment against the pack registry — a pack that
  // was removed takes its stored rows with it rather than leaving junk.
  const words = {};
  const rawWords = (data.progress && data.progress.words) || {};
  for (const key of Object.keys(rawWords)) {
    if (!ALL_WORD_KEYS.has(key)) continue;
    const row = validateWordRow(rawWords[key]);
    if (row) words[key] = row;
  }
  out.progress.words = words;

  const usage = data.usage && typeof data.usage === 'object' ? data.usage : {};
  out.usage.sessions = Math.max(0, Math.min(1e6, Number(usage.sessions) || 0));
  out.usage.lastSessionAt = Math.max(0, Number(usage.lastSessionAt) || 0);
  out.usage.days = trimDays(usage.days, KEEP_DAYS);
  out.daily = validateDaily(data.daily);

  const wordsDaily = validateWordsDaily(data.wordsDaily);
  wordsDaily.items = wordsDaily.items.filter((it) => ALL_WORD_KEYS.has(it.key));
  const keptKeys = new Set(wordsDaily.items.map((it) => it.key));
  wordsDaily.done = wordsDaily.done.filter((k) => keptKeys.has(k));
  out.wordsDaily = wordsDaily;

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
  // Word rows the child has actually met keep their box and due date — that
  // IS the schedule — while never-met rows are recomputable and shed first.
  const metWords = Object.fromEntries(
    Object.entries(a.progress.words || {}).filter(([, r]) => r.box > 0)
  );
  const b = { ...a, progress: { ...a.progress, letters: completed, words: metWords } };
  if (trySet(b)) return 'ok';

  const minimal = {
    v: CURRENT_VERSION,
    createdAt: data.createdAt,
    settings: data.settings,
    progress: { done: data.progress.done, letters: {}, words: {} },
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
    progress: { done: {}, letters: {}, words: {} },
    usage: { ...EMPTY_USAGE, days: {} },
    daily: { day: '', sets: {} },
    wordsDaily: { day: '', items: [], done: [] },
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
