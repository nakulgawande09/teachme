import { update, snapshot, flush } from './store.js';
import { letterKey } from '../data/tracks.js';

/**
 * Progress recording and the "worth another go" heuristic.
 *
 * Everything here is immutable: each recorder returns a new blob rather than
 * writing through an existing object, which is what keeps the store's
 * change-detection honest.
 *
 * Definitions, so the numbers mean one thing:
 *   attempt     entering the trace screen for a glyph
 *   retry       one rejected stroke
 *   completion  the glyph came alive
 */

const EMPTY_ROW = Object.freeze({
  attempts: 0, completions: 0, retries: 0, totalMs: 0, bestMs: 0, lastAt: 0,
});

/** A single attempt is capped, so a backgrounded tab cannot poison bestMs. */
const MAX_ATTEMPT_MS = 180000;

const dayKey = (ts = Date.now()) => new Date(ts).toISOString().slice(0, 10);

const withRow = (data, key, change) => {
  const row = data.progress.letters[key] || EMPTY_ROW;
  return {
    ...data,
    progress: {
      ...data.progress,
      letters: { ...data.progress.letters, [key]: { ...row, ...change(row) } },
    },
  };
};

export function recordAttempt(trackId, glyph) {
  const key = letterKey(trackId, glyph);
  update((data) => withRow(data, key, (row) => ({
    attempts: row.attempts + 1,
    lastAt: Date.now(),
  })));
}

export function recordRetry(trackId, glyph) {
  const key = letterKey(trackId, glyph);
  update((data) => withRow(data, key, (row) => ({ retries: row.retries + 1 })));
}

export function recordCompletion(trackId, glyph, elapsedMs) {
  const key = letterKey(trackId, glyph);
  const ms = Math.max(0, Math.min(MAX_ATTEMPT_MS, Math.round(elapsedMs) || 0));

  update((data) => {
    const withDone = {
      ...data,
      progress: {
        ...data.progress,
        done: { ...data.progress.done, [trackId]: { ...(data.progress.done[trackId] || {}), [glyph]: true } },
      },
    };
    return withRow(withDone, key, (row) => ({
      completions: row.completions + 1,
      totalMs: row.totalMs + ms,
      bestMs: row.bestMs === 0 ? ms : Math.min(row.bestMs, ms),
      lastAt: Date.now(),
    }));
  });

  // The one write we must not lose to a debounce plus an app switch.
  flush();
}

export function recordUsage(deltaMs) {
  const ms = Math.max(0, Math.round(deltaMs) || 0);
  if (ms < 1000) return;
  const day = dayKey();
  update((data) => ({
    ...data,
    usage: {
      ...data.usage,
      days: { ...data.usage.days, [day]: (data.usage.days[day] || 0) + ms },
      lastSessionAt: Date.now(),
    },
  }));
}

export function recordSessionStart() {
  update((data) => ({ ...data, usage: { ...data.usage, sessions: data.usage.sessions + 1 } }));
}

/* ── reading ───────────────────────────────────────────────────────────── */

export const isDone = (trackId, glyph) =>
  !!(snapshot().progress.done[trackId] && snapshot().progress.done[trackId][glyph]);

export const doneCount = (trackId) =>
  Object.keys(snapshot().progress.done[trackId] || {}).length;

const rowsFor = (letters, trackId) =>
  Object.entries(letters)
    .filter(([k]) => k.startsWith(`${trackId}:`))
    .map(([k, row]) => ({ ...row, glyph: k.slice(trackId.length + 1) }));

const medianOf = (nums) => {
  const s = [...nums].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * Letters worth revisiting together. Pure — unit-tested against fixtures.
 *
 * The `median !== null` guard is load-bearing: with fewer than four completed
 * letters the median is noise, and without it the child's very FIRST letters
 * get flagged as struggles, which is both wrong and demoralising to read.
 */
export function strugglingIn(letters, trackId, now = Date.now()) {
  const rows = rowsFor(letters || {}, trackId);
  const finished = rows.filter((r) => r.completions > 0 && r.bestMs > 0);
  const median = finished.length >= 4 ? medianOf(finished.map((r) => r.bestMs)) : null;

  return rows
    .filter((r) => r.attempts >= 3)
    .filter((r) =>
      r.completions === 0 ||                              // tried, never finished
      r.retries / r.attempts >= 1.5 ||                    // lots of rejected strokes
      (median !== null && r.bestMs > 2.5 * median))       // much slower than its peers
    .filter((r) => now - r.lastAt < 30 * 24 * 3600 * 1000) // forget stale data
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 5);
}

/** Plain language, never judgemental. No scores, no comparison to other children. */
export function struggleReason(row) {
  if (row.completions === 0) return 'tried a few times, not finished yet';
  if (row.retries / row.attempts >= 1.5) return 'the strokes keep slipping';
  return 'takes a lot longer than the others';
}

export function msToday() {
  return snapshot().usage.days[dayKey()] || 0;
}

export function msThisWeek() {
  const days = snapshot().usage.days;
  const cutoff = Date.now() - 7 * 864e5;
  return Object.entries(days)
    .filter(([d]) => new Date(`${d}T00:00:00`).getTime() >= cutoff)
    .reduce((sum, [, ms]) => sum + ms, 0);
}

export function formatDuration(ms) {
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'under a minute';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
