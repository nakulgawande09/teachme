import { dispatch, getState } from '../core/app.js';
import { A } from '../core/actions.js';
import { update, snapshot, flush } from '../storage/store.js';
import { letterKey, lettersOf, TRACKS } from '../data/tracks.js';
import { buildSet, dayKey, promote, distractors, layout } from './schedule.js';

/**
 * Today's set — the bounded portion that replaces an endless grid.
 *
 * Two jobs, and they are the same job. It teaches in the small batches the
 * evidence supports, and it gives the session an end, which an infinite grid
 * of forty-eight letters never does. A child who finishes something feels
 * finished; a child who merely runs out of time feels interrupted.
 */

/** The set for a track today, built once per calendar day and then persisted
 *  so that closing and reopening the app does not silently hand out a new
 *  three letters (which would turn the daily cap into no cap at all). */
export function setFor(trackId, now = Date.now()) {
  const data = snapshot();
  const today = dayKey(now);
  const stored = data.daily && data.daily.day === today ? data.daily.sets[trackId] : null;

  if (stored && stored.glyphs.length) {
    return {
      items: stored.glyphs.map((glyph) => ({ glyph, kind: kindOf(data, trackId, glyph) })),
      done: stored.done.slice(),
      closed: !!stored.closed,
    };
  }

  const items = buildSet(data.progress.letters, trackId, data.settings.dailySize, now);
  persistSet(trackId, items.map((i) => i.glyph), [], false, now);
  return { items, done: [], closed: false };
}

const kindOf = (data, trackId, glyph) =>
  ((data.progress.letters[letterKey(trackId, glyph)]?.box || 0) > 0 ? 'review' : 'new');

function persistSet(trackId, glyphs, done, closed, now = Date.now()) {
  const today = dayKey(now);
  update((data) => {
    const sets = data.daily && data.daily.day === today ? { ...data.daily.sets } : {};
    sets[trackId] = { glyphs, done, closed };
    return { ...data, daily: { day: today, sets } };
  });
}

/** Remaining items for today, in order, skipping what is already finished. */
export function remaining(trackId) {
  const { items, done } = setFor(trackId);
  return items.filter((item) => !done.includes(item.glyph));
}

export const isComplete = (trackId) => remaining(trackId).length === 0;

/** Begin (or resume) today's set. Returns the item to show first. */
export function start(trackId) {
  const { items, done } = setFor(trackId);
  if (!items.length) return null;

  const firstUndone = items.findIndex((item) => !done.includes(item.glyph));
  const index = firstUndone === -1 ? items.length : firstUndone;

  dispatch(A.DAILY_START, { trackId, items, done, index: Math.min(index, items.length - 1) });
  return index < items.length ? items[index] : null;
}

/** Mark the current item finished and move the Leitner box on. */
export function complete(correct = true) {
  const { daily } = getState();
  const item = daily.items[daily.index];
  if (!item) return;

  const key = letterKey(daily.trackId, item.glyph);
  update((data) => {
    const row = data.progress.letters[key];
    const next = promote(row, correct);
    return {
      ...data,
      progress: {
        ...data.progress,
        letters: { ...data.progress.letters, [key]: { ...row, ...next } },
      },
    };
  });

  dispatch(A.DAILY_DONE, { glyph: item.glyph });
  const done = getState().daily.done;
  persistSet(daily.trackId, daily.items.map((i) => i.glyph), done, false);
  flush();
}

/** The next item, or null when today's set is finished. */
export function next() {
  const { daily } = getState();
  const index = daily.index + 1;
  if (index >= daily.items.length) {
    dispatch(A.DAILY_ADVANCE, { index: daily.items.length });
    return null;
  }
  dispatch(A.DAILY_ADVANCE, { index });
  return daily.items[index];
}

export function current() {
  const { daily } = getState();
  return daily.items[daily.index] || null;
}

export const progressLabel = () => {
  const { daily } = getState();
  return { done: daily.done.length, total: daily.items.length };
};

/* ── recall questions ──────────────────────────────────────────────────── */

/**
 * Build a question for a glyph. Two directions, alternating by day so a child
 * does not get the same shape of question every single time.
 *
 * Both are error-free by construction: a wrong tap replays the sound and the
 * card settles back. Nothing is scored, nothing is blocked, and there is no
 * path where being wrong costs the child anything but another listen.
 */
export function askFor(trackId, glyph, now = Date.now()) {
  const letters = lettersOf(trackId);
  const target = letters.find((l) => l.glyph === glyph);
  if (!target) return null;

  const data = snapshot();
  const others = distractors(trackId, glyph, 1, data.progress.letters, now);
  if (!others.length) return null;

  // letter → picture only works when every card actually has artwork, and
  // only for a letter whose keyword genuinely starts with it.
  const pictureable = !target.medial && !target.conjunct && !!target.art;
  const otherLetters = others.map((g) => letters.find((l) => l.glyph === g)).filter(Boolean);
  const canPicture = pictureable && otherLetters.every((l) => l.art && !l.medial);

  const useSound = !canPicture || (dayNumber(now) + glyph.length) % 2 === 0;
  const kind = useSound ? 'sound2letter' : 'letter2picture';

  const cards = layout(
    cardFor(kind, target),
    otherLetters.map((l) => cardFor(kind, l)),
    glyph + dayKey(now)
  );

  return { kind, answer: glyph, target, cards };
}

const cardFor = (kind, letter) => ({
  value: letter.glyph,
  glyph: letter.glyph,
  art: letter.art,
  keyword: letter.keyword,
  show: kind === 'letter2picture' ? 'art' : 'glyph',
});

const dayNumber = (now) => Math.floor(now / 864e5);

export { TRACKS };
