import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWordSet, requeuePosition, wordDistractors, makeThinking,
  tonightsCard, wordKindOf, isCooling,
} from '../js/features/wordSchedule.js';
import { itemsOf, wordKey, ALL_WORD_KEYS, parseWordKey } from '../js/data/packs/index.js';
import { dayKey } from '../js/features/schedule.js';

const NOW = Date.parse('2026-08-22T10:00:00Z');
const DAY = 864e5;
const TODAY = dayKey(NOW);

const row = (over = {}) => ({
  attempts: 1, gotIt: 1, notYet: 0, lastAt: NOW,
  box: 1, dueAt: NOW - DAY, missStreak: 0, lastMissDay: '', ...over,
});

/* Audibility fixtures: a phone with an English voice only, and a phone that
   can say everything (clips recorded). */
const EN_ONLY = new Set([...ALL_WORD_KEYS].filter((k) => k.endsWith(':en')));
const ALL = ALL_WORD_KEYS;
const NONE = new Set();

const PACKS_ON = ['objects'];
const keys = (set) => set.map((it) => it.key);
const wordTurns = (set) => set.filter((it) => it.t === 'w');

/* ── audibility is the gate ────────────────────────────────────────────── */

test('a word the device cannot say is never scheduled', () => {
  const set = buildWordSet({}, PACKS_ON, EN_ONLY, 6, NOW);
  assert.ok(set.length > 0);
  assert.ok(keys(set).every((k) => k.endsWith(':en')), 'only audible languages appear');
});

test('no audible words means no set, not a broken one', () => {
  assert.deepEqual(buildWordSet({}, PACKS_ON, NONE, 6, NOW), []);
  assert.deepEqual(buildWordSet({}, [], ALL, 6, NOW), []);
});

/* ── a brand-new child ─────────────────────────────────────────────────── */

test('a brand-new child gets new words, easiest tier first, and no quiz turns', () => {
  const set = buildWordSet({}, PACKS_ON, EN_ONLY, 6, NOW);
  assert.equal(set.length, 6);
  assert.ok(set.every((it) => it.t === 'w'), 'nothing is known, so nothing can be asked');
  for (const k of keys(set)) {
    const { packId, itemId } = parseWordKey(k);
    const item = itemsOf(packId).find((i) => i.id === itemId);
    assert.equal(item.tier, 1, 'a first day should not open with an abstract word');
  }
  assert.ok(keys(set).every((k) => wordKindOf({}, k) === 'new'));
});

test('the set respects the size the parent chose', () => {
  assert.equal(wordTurns(buildWordSet({}, PACKS_ON, EN_ONLY, 4, NOW)).length, 4);
  assert.equal(wordTurns(buildWordSet({}, PACKS_ON, EN_ONLY, 8, NOW)).length, 8);
});

/* ── rotation: one item, one appearance, languages take turns ──────────── */

test('an item appears at most once per set even when due in both languages', () => {
  const rows = {
    [wordKey('objects', 'cup', 'en')]: row({ dueAt: NOW - DAY }),
    [wordKey('objects', 'cup', 'mr')]: row({ dueAt: NOW - 3 * DAY }),
  };
  const set = buildWordSet(rows, PACKS_ON, ALL, 6, NOW);
  const cups = keys(set).filter((k) => k.includes(':cup:'));
  assert.equal(cups.length, 1, 'same object twice in a day teaches nothing');
  assert.ok(cups[0].endsWith(':mr'), 'the more overdue language wins the slot');
});

test('the second language unlocks only once the first has taken hold', () => {
  const locked = buildWordSet(
    { [wordKey('objects', 'cup', 'en')]: row({ box: 1, dueAt: NOW + DAY }) },
    PACKS_ON, ALL, 30, NOW);
  assert.ok(!keys(locked).includes(wordKey('objects', 'cup', 'mr')),
    'box 1 in English must not invite Marathi yet');

  const unlocked = buildWordSet(
    { [wordKey('objects', 'cup', 'en')]: row({ box: 2, dueAt: NOW + DAY }) },
    PACKS_ON, ALL, 30, NOW);
  assert.ok(keys(unlocked).includes(wordKey('objects', 'cup', 'mr')),
    'box 2 in English makes Marathi the natural next step');
});

/* ── reviews ───────────────────────────────────────────────────────────── */

test('due words come back first, capped so something new always gets in', () => {
  const rows = {};
  for (const item of itemsOf('objects').slice(0, 10)) {
    rows[wordKey('objects', item.id, 'en')] = row();
  }
  const set = wordTurns(buildWordSet(rows, PACKS_ON, EN_ONLY, 6, NOW));
  const kinds = keys(set).map((k) => wordKindOf(rows, k));
  assert.equal(kinds.filter((k) => k === 'review').length, 4, '⅔ of 6, rounded down');
  assert.equal(kinds.filter((k) => k === 'new').length, 2);
});

test('the most overdue word is offered first', () => {
  const rows = {
    [wordKey('objects', 'cup', 'en')]: row({ dueAt: NOW - DAY }),
    [wordKey('objects', 'dog', 'en')]: row({ dueAt: NOW - 9 * DAY }),
  };
  const set = buildWordSet(rows, PACKS_ON, EN_ONLY, 4, NOW);
  assert.equal(keys(set)[0], wordKey('objects', 'dog', 'en'));
});

test('when everything is known and nothing is due, the soonest words come round', () => {
  const rows = {};
  for (const item of itemsOf('objects')) {
    rows[wordKey('objects', item.id, 'en')] = row({ box: 5, dueAt: NOW + 10 * DAY });
    rows[wordKey('objects', item.id, 'mr')] = row({ box: 5, dueAt: NOW + 12 * DAY });
  }
  const set = wordTurns(buildWordSet(rows, PACKS_ON, ALL, 6, NOW));
  assert.equal(set.length, 6, 'a short easy day beats an empty one');
  assert.ok(keys(set).every((k) => wordKindOf(rows, k) === 'review'));
});

/* ── back-off: three missed days means it sits out ─────────────────────── */

test('a word missed three days running cools off and an easy win takes its slot', () => {
  const rows = {
    [wordKey('objects', 'cup', 'en')]: row({ missStreak: 3, lastMissDay: TODAY }),
    [wordKey('objects', 'ball', 'en')]: row({ box: 4, dueAt: NOW + 5 * DAY }),
  };
  assert.ok(isCooling(rows[wordKey('objects', 'cup', 'en')], NOW));

  const set = buildWordSet(rows, PACKS_ON, EN_ONLY, 4, NOW);
  assert.ok(!keys(set).includes(wordKey('objects', 'cup', 'en')), 'the hard word sits out');
  assert.ok(keys(set).includes(wordKey('objects', 'ball', 'en')),
    'something she is good at stands in for it');
});

test('cooling ends after two days and the word returns', () => {
  const staleRow = row({ missStreak: 3, lastMissDay: dayKey(NOW - 3 * DAY) });
  assert.ok(!isCooling(staleRow, NOW));
  const set = buildWordSet(
    { [wordKey('objects', 'cup', 'en')]: staleRow }, PACKS_ON, EN_ONLY, 4, NOW);
  assert.ok(keys(set).includes(wordKey('objects', 'cup', 'en')));
});

/* ── thinking turns ────────────────────────────────────────────────────── */

test('thinking turns appear only once three words are truly known, capped at two', () => {
  const rows = {
    [wordKey('objects', 'cup', 'en')]: row({ box: 2, dueAt: NOW + DAY }),
    [wordKey('objects', 'dog', 'en')]: row({ box: 3, dueAt: NOW + DAY }),
    [wordKey('objects', 'ball', 'en')]: row({ box: 2, dueAt: NOW + DAY }),
    [wordKey('objects', 'shoe', 'en')]: row({ box: 2, dueAt: NOW + DAY }),
  };
  const set = buildWordSet(rows, PACKS_ON, EN_ONLY, 4, NOW);
  const thinks = set.filter((it) => it.t === 'q');
  assert.ok(thinks.length >= 1 && thinks.length <= 2);
  assert.equal(set[2].t, 'q', 'a thinking turn lands after the second word');

  const wordKeys = new Set(keys(wordTurns(set)));
  for (const q of thinks) {
    assert.ok(!wordKeys.has(q.key), 'a quiz key never duplicates a word key');
    assert.ok(rows[q.key] && rows[q.key].box >= 2, 'only well-known words get asked');
  }
});

test('two barely-known words are not enough to ask anything', () => {
  const rows = {
    [wordKey('objects', 'cup', 'en')]: row({ box: 2, dueAt: NOW + DAY }),
    [wordKey('objects', 'dog', 'en')]: row({ box: 2, dueAt: NOW + DAY }),
  };
  const set = buildWordSet(rows, PACKS_ON, EN_ONLY, 4, NOW);
  assert.ok(set.every((it) => it.t === 'w'));
});

/* ── the running session ───────────────────────────────────────────────── */

test('a missed word re-enters three turns later, bounded by the set', () => {
  assert.equal(requeuePosition(8, 2), 5);
  assert.equal(requeuePosition(4, 3), 4, 'never past the end');
  assert.equal(requeuePosition(0, 0), 0);
});

/* ── question construction ─────────────────────────────────────────────── */

test('a distractor is never the answer and prefers met items', () => {
  const rows = {
    [wordKey('objects', 'dog', 'en')]: row(),
    [wordKey('objects', 'cat', 'en')]: row(),
  };
  const ids = wordDistractors(wordKey('objects', 'cup', 'en'), rows, 2, NOW);
  assert.equal(ids.length, 2);
  assert.ok(!ids.includes('cup'));
  assert.deepEqual(new Set(ids), new Set(['dog', 'cat']),
    'two known items beat twenty-eight strangers');
});

test('distractors are stable within a day', () => {
  const a = wordDistractors(wordKey('objects', 'cup', 'en'), {}, 2, NOW);
  const b = wordDistractors(wordKey('objects', 'cup', 'en'), {}, 2, NOW + 3600e3);
  assert.deepEqual(a, b, 'a re-render must not reshuffle under the child\'s finger');
});

test('makeThinking builds an error-free picture question around the word', () => {
  const q = makeThinking(wordKey('objects', 'cup', 'en'), {}, NOW);
  assert.equal(q.kind, 'word2picture');
  assert.equal(q.scope, 'words');
  assert.equal(q.answer, 'cup');
  assert.equal(q.cards.filter((c) => c.value === 'cup').length, 1);
  assert.ok(q.cards.length >= 2 && q.cards.length <= 3);
  assert.ok(q.cards.every((c) => c.show === 'art' && c.art), 'cards are pictures, never text');
  assert.equal(makeThinking('garbage', {}, NOW), null);
});

/* ── tonight's card ────────────────────────────────────────────────────── */

test('tonight leads with today\'s misses, mixes languages, and stops at four', () => {
  const rows = {
    [wordKey('objects', 'cup', 'en')]: row({ lastMissDay: TODAY, notYet: 1, dueAt: NOW + DAY }),
    [wordKey('objects', 'dog', 'mr')]: row({ dueAt: NOW + 0.5 * DAY }),
    [wordKey('objects', 'ball', 'en')]: row({ dueAt: NOW + 10 * DAY }),
  };
  const dayItems = [
    { t: 'w', key: wordKey('objects', 'cup', 'en') },
    { t: 'w', key: wordKey('objects', 'dog', 'mr') },
    { t: 'w', key: wordKey('objects', 'ball', 'en') },
  ];
  const card = tonightsCard(rows, dayItems, NOW);

  assert.ok(card.words.length >= 3 && card.words.length <= 4);
  assert.equal(card.words[0].itemId, 'cup', 'the word she missed comes first');
  assert.equal(card.words[0].missed, true);
  assert.equal(card.words[1].lang, 'mr', 'languages alternate across the four');
  assert.ok(card.words.every((w) => w.text), 'every entry carries the word to say');

  assert.ok(card.prompts.length >= 1 && card.prompts.length <= 3);
  assert.ok(card.prompts.every((p) => typeof p === 'string' && p.length));
  assert.equal(card.experiment, null, 'objects carry no experiments — STEM will');
});

test('an empty day still yields a well-formed, empty card', () => {
  assert.deepEqual(tonightsCard({}, [], NOW), { words: [], prompts: [], experiment: null });
  assert.deepEqual(tonightsCard(null, null, NOW).words, []);
});

/* ── junk resistance ───────────────────────────────────────────────────── */

test('malformed rows and unknown keys never throw', () => {
  const rows = {
    'objects:😀:en': row(),
    [wordKey('objects', 'cup', 'en')]: { box: 'x' },
    junk: null,
  };
  assert.ok(Array.isArray(buildWordSet(rows, PACKS_ON, EN_ONLY, 6, NOW)));
  assert.ok(Array.isArray(tonightsCard(rows, [{ t: 'w', key: 'junk' }], NOW).words));
});
