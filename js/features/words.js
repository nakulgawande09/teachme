import { dispatch, getState } from '../core/app.js';
import { A } from '../core/actions.js';
import { update, snapshot, flush } from '../storage/store.js';
import { BOX_INTERVAL_DAYS, MAX_BOX } from '../storage/schema.js';
import { dayKey, promote } from './schedule.js';
import {
  buildWordSet, wordKindOf, requeuePosition, makeThinking,
} from './wordSchedule.js';
import { audibleSet } from '../audio/wordAudio.js';

/**
 * Today's words — the impure twin of js/features/daily.js, for the words
 * mode. Builds the day's set once and persists it (closing and reopening
 * the app must not mint a fresh set — that would turn the daily cap into no
 * cap at all), records each turn's outcome on the (item × language) row,
 * and quietly re-queues a miss a few turns ahead.
 */

const EMPTY_ROW = Object.freeze({
  attempts: 0, gotIt: 0, notYet: 0, lastAt: 0, box: 0, dueAt: 0, missStreak: 0, lastMissDay: '',
});

const startOfDay = (ts) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const enabledPacks = (settings) =>
  Object.keys(settings.packs).filter((id) => settings.packs[id]);

/** The persisted plan for today, built once per calendar day. */
export function setFor(now = Date.now()) {
  const data = snapshot();
  if (!data.settings.words) return { items: [], done: [] };

  const today = dayKey(now);
  const stored = data.wordsDaily;
  if (stored.day === today && stored.items.length) {
    return { items: stored.items, done: stored.done.slice() };
  }

  const packs = enabledPacks(data.settings);
  const items = buildWordSet(
    data.progress.words, packs, audibleSet(packs), data.settings.wordsPerDay, now);
  // An empty set (no audible words yet — voices still loading, nothing
  // recorded) is deliberately NOT persisted as today's answer; the next ask
  // rebuilds, so audibility arriving late still gets the child a real day.
  if (items.length) persistSet(items, [], now);
  return { items, done: [] };
}

function persistSet(items, done, now = Date.now()) {
  update((data) => ({
    ...data,
    wordsDaily: {
      day: dayKey(now),
      items: items.map((it) => ({ t: it.t, key: it.key })),
      done,
    },
  }));
}

export function remaining() {
  const { items, done } = setFor();
  return items.filter((it) => !done.includes(it.key));
}

export const isComplete = () => {
  const { items } = setFor();
  return items.length > 0 && remaining().length === 0;
};

/** Begin (or resume) today's words. Returns the first item to present. */
export function start() {
  const { items, done } = setFor();
  if (!items.length) return null;

  const rows = snapshot().progress.words;
  const stateItems = items.map((it) => ({
    t: it.t,
    key: it.key,
    kind: it.t === 'q' ? 'think' : wordKindOf(rows, it.key),
  }));

  const firstUndone = items.findIndex((it) => !done.includes(it.key));
  const index = firstUndone === -1 ? items.length : firstUndone;

  dispatch(A.WORDS_START, { items: stateItems, done, index: Math.min(index, items.length - 1) });
  return index < items.length ? stateItems[index] : null;
}

/**
 * Finish the current word turn.
 *
 * `mark` is the quiet parent affordance: 'got', 'notyet', or null when
 * nobody tapped anything. Neutral counts as recall only up to box 2 — an
 * unattended session must not climb the upper boxes without evidence —
 * while an explicit 'got' promotes fully and 'notyet' drops the row to
 * tomorrow AND slips the word back in a few turns from now.
 *
 * A re-queued showing is pure re-exposure: the row was already scored when
 * it missed, so hearing it again costs the schedule nothing.
 */
export function complete(mark = null) {
  const { words } = getState();
  const item = words.items[words.index];
  if (!item) return;

  const requeued = item.kind === 'requeue';
  if (!requeued) {
    recordOutcome(item.key, mark);
    dispatch(A.WORDS_DONE, { key: item.key });
    persistProgress();
  }
  if (mark === 'notyet' && !requeued) {
    dispatch(A.WORDS_REQUEUE, {
      key: item.key,
      at: requeuePosition(getState().words.items.length, words.index),
    });
  }
  flush();
}

/** Finish a thinking turn — scored exactly like a letter recall question:
 *  unaided counts, a nudged answer sends the word back to tomorrow. */
export function completeThinking(correct = true) {
  const { words } = getState();
  const item = words.items[words.index];
  if (!item || item.t !== 'q') return;

  const now = Date.now();
  update((data) => {
    const row = data.progress.words[item.key] || EMPTY_ROW;
    return withRow(data, item.key, {
      ...promote(row, correct, now),
      attempts: row.attempts + 1,
      lastAt: now,
      ...(correct ? { gotIt: row.gotIt + 1, missStreak: 0 } : {}),
    });
  });
  dispatch(A.WORDS_DONE, { key: item.key });
  persistProgress();
  flush();
}

function recordOutcome(key, mark) {
  const now = Date.now();
  const today = dayKey(now);
  update((data) => {
    const row = data.progress.words[key] || EMPTY_ROW;
    let change;

    if (mark === 'notyet') {
      const prev = row.lastMissDay;
      const yesterday = prev && (new Date(today) - new Date(prev)) === 864e5;
      change = {
        ...promote(row, false, now),
        notYet: row.notYet + 1,
        missStreak: prev === today ? row.missStreak : (yesterday ? row.missStreak + 1 : 1),
        lastMissDay: today,
      };
    } else {
      const box = mark === 'got'
        ? Math.min(MAX_BOX, row.box + 1)
        : (row.box < 2 ? row.box + 1 : row.box);
      change = {
        box,
        dueAt: startOfDay(now) + BOX_INTERVAL_DAYS[box] * 864e5,
        missStreak: 0,
        ...(mark === 'got' ? { gotIt: row.gotIt + 1 } : {}),
      };
    }

    return withRow(data, key, { ...change, attempts: row.attempts + 1, lastAt: now });
  });
}

const withRow = (data, key, change) => ({
  ...data,
  progress: {
    ...data.progress,
    words: {
      ...data.progress.words,
      [key]: { ...(data.progress.words[key] || EMPTY_ROW), ...change },
    },
  },
});

/** Write today's done-list back beside the plan. Requeues stay in memory. */
function persistProgress() {
  const { words } = getState();
  const planned = words.items.filter((it) => it.kind !== 'requeue');
  persistSet(planned, words.done);
}

/** The next item, or null when today's words are finished. */
export function next() {
  const { words } = getState();
  const index = words.index + 1;
  const items = getState().words.items;
  if (index >= items.length) {
    dispatch(A.WORDS_ADVANCE, { index: items.length });
    return null;
  }
  dispatch(A.WORDS_ADVANCE, { index });
  return items[index];
}

export function current() {
  const { words } = getState();
  return words.items[words.index] || null;
}

/** Build the picture question for a thinking turn. */
export const thinkQuestion = (key) => makeThinking(key, snapshot().progress.words);
