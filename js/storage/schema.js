/**
 * Declarative settings schema — the single source of truth for BOTH the
 * storage read path and the parent-zone controls. The same `validate()` backs
 * `SETTINGS_SET`, so a bad value cannot enter state from either direction.
 *
 * Validation walks the SCHEMA, not the parsed object: unknown keys are
 * dropped rather than carried, which is what stops a stale or hand-edited
 * localStorage blob from growing forever.
 */

export const CURRENT_VERSION = 1;
export const STORAGE_KEY = 'akshar.v1';
export const CORRUPT_KEY = 'akshar.v1.corrupt';

export const SETTINGS_SCHEMA = Object.freeze({
  dailySize:    { kind: 'enum',  of: [2, 3, 5],                             def: 3 },
  quiz:         { kind: 'bool',                                             def: true },
  sessionMin:   { kind: 'enum',  of: [10, 15, 20],                          def: 15 },
  helpDelaySec: { kind: 'enum',  of: [0, 4, 7],                             def: 7 },
  volume:       { kind: 'num',   min: 0,   max: 1,                          def: 0.8 },
  rate:         { kind: 'num',   min: 0.6, max: 1.2,                        def: 0.9 },
  strictness:   { kind: 'enum',  of: ['gentle', 'normal', 'strict'],        def: 'normal' },
  soundFirst:   { kind: 'bool',                                             def: true },
  motion:       { kind: 'enum',  of: ['auto', 'reduced'],                   def: 'auto' },
  tracks:       { kind: 'flags', of: ['en', 'mr', 'sa'], atLeast: 1,
                  def: { en: true, mr: true, sa: true } },
});

const clone = (v) => (v && typeof v === 'object' ? { ...v } : v);

export const SETTINGS_DEFAULTS = Object.freeze(
  Object.fromEntries(Object.entries(SETTINGS_SCHEMA).map(([k, r]) => [k, clone(r.def)]))
);

export const EMPTY_PROGRESS = Object.freeze({
  done: Object.freeze({}),
  letters: Object.freeze({}),
});

export const EMPTY_USAGE = Object.freeze({ days: {}, sessions: 0, lastSessionAt: 0 });

/** Validate one field. Returns the default (and warns once) on anything odd. */
export function validateField(key, raw) {
  const rule = SETTINGS_SCHEMA[key];
  if (!rule) {
    console.warn('settings: unknown key dropped —', key);
    return undefined;
  }

  switch (rule.kind) {
    case 'enum':
      return rule.of.includes(raw) ? raw : fallback(key, raw, rule.def);

    case 'num': {
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(n)) return fallback(key, raw, rule.def);
      return Math.min(rule.max, Math.max(rule.min, n));
    }

    case 'bool':
      return typeof raw === 'boolean' ? raw : fallback(key, raw, rule.def);

    case 'flags': {
      if (!raw || typeof raw !== 'object') return fallback(key, raw, clone(rule.def));
      const out = {};
      for (const id of rule.of) out[id] = raw[id] !== false;
      const on = rule.of.filter((id) => out[id]).length;
      // Turning off the last track would leave a child with a blank home
      // screen and no way back, so the schema refuses it.
      if (on < rule.atLeast) return fallback(key, raw, clone(rule.def));
      return out;
    }

    default:
      return clone(rule.def);
  }
}

function fallback(key, raw, def) {
  console.warn(`settings: invalid value for "${key}" (${JSON.stringify(raw)}) — using default`);
  return def;
}

/** Validate a whole settings object. Always returns a complete, safe object. */
export function validateSettings(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const key of Object.keys(SETTINGS_SCHEMA)) {
    const value = Object.prototype.hasOwnProperty.call(source, key)
      ? validateField(key, source[key])
      : clone(SETTINGS_SCHEMA[key].def);
    out[key] = value === undefined ? clone(SETTINGS_SCHEMA[key].def) : value;
  }
  return out;
}

const clamp = (n, lo, hi, def) => {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def;
};

/**
 * Leitner boxes. A letter climbs one box each time it is recalled and drops
 * to box 1 when it is not — never to 0, because 0 means "never met" and a
 * child who has met a letter should not be shown it as brand new again.
 */
export const BOX_INTERVAL_DAYS = Object.freeze([0, 1, 2, 4, 8, 16]);
export const MAX_BOX = BOX_INTERVAL_DAYS.length - 1;

/**
 * Validate one letter's telemetry row. Bounds every number so a corrupted or
 * hand-edited blob cannot poison the scheduler or the struggling heuristic.
 *
 * `box` and `dueAt` were added after v1 shipped. They need no migration:
 * a row without them validates to box 0 / dueAt 0, which reads as "new and
 * due now" — exactly right for a letter the scheduler has not seen before.
 */
export function validateLetterRow(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    attempts:    clamp(raw.attempts, 0, 9999, 0),
    completions: clamp(raw.completions, 0, 9999, 0),
    retries:     clamp(raw.retries, 0, 9999, 0),
    totalMs:     clamp(raw.totalMs, 0, 3.6e7, 0),
    bestMs:      clamp(raw.bestMs, 500, 600000, 0),
    lastAt:      clamp(raw.lastAt, 0, Date.now() + 864e5, 0),
    box:         clamp(raw.box, 0, MAX_BOX, 0),
    dueAt:       clamp(raw.dueAt, 0, Date.now() + 400 * 864e5, 0),
  };
}

/** Today's chosen set, per track. Rebuilt whenever the calendar day turns. */
export const EMPTY_DAILY = Object.freeze({ day: '', sets: Object.freeze({}) });

export function validateDaily(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.day !== 'string') return { day: '', sets: {} };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.day)) return { day: '', sets: {} };

  const sets = {};
  const source = raw.sets && typeof raw.sets === 'object' ? raw.sets : {};
  for (const trackId of Object.keys(source)) {
    const set = source[trackId];
    if (!set || !Array.isArray(set.glyphs)) continue;
    const glyphs = set.glyphs.filter((g) => typeof g === 'string').slice(0, 8);
    const done = Array.isArray(set.done) ? set.done.filter((g) => glyphs.includes(g)) : [];
    sets[trackId] = { glyphs, done, closed: set.closed === true };
  }
  return { day: raw.day, sets };
}
