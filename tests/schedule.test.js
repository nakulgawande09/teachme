import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSet, promote, distractors, layout, dayKey, metCount } from '../js/features/schedule.js';
import { EN_ORDER, MR_ORDER, rankOf, orderFor } from '../js/data/sequence.js';
import { BOX_INTERVAL_DAYS, MAX_BOX } from '../js/storage/schema.js';
import { lettersOf } from '../js/data/tracks.js';

const NOW = Date.parse('2026-08-17T10:00:00Z');
const DAY = 864e5;
const row = (over = {}) => ({
  attempts: 1, completions: 1, retries: 0, totalMs: 1e4, bestMs: 1e4, lastAt: NOW,
  box: 1, dueAt: NOW - DAY, ...over,
});

/* ── the sequence ──────────────────────────────────────────────────────── */

test('the teaching order covers every letter in its track exactly once', () => {
  for (const [trackId, order] of [['en', EN_ORDER], ['mr', MR_ORDER]]) {
    const glyphs = lettersOf(trackId).map((l) => l.glyph);
    assert.equal(order.length, glyphs.length, `${trackId}: order and corpus differ in size`);
    assert.equal(new Set(order).size, order.length, `${trackId}: duplicate in the order`);
    for (const g of order) assert.ok(glyphs.includes(g), `${trackId}: "${g}" is not in the corpus`);
  }
});

/* satpin is the point of not going alphabetically: those six letters alone
   build sat, tin, pan, nap, so a child reads a real word in the first week. */
test('English opens with satpin, not with A B C', () => {
  assert.deepEqual(EN_ORDER.slice(0, 6), ['S', 'A', 'T', 'P', 'I', 'N']);
});

test('Marathi teaches every स्वर before any व्यंजन', () => {
  const swara = lettersOf('mr').slice(0, 12).map((l) => l.glyph);
  const firstConsonantAt = MR_ORDER.findIndex((g) => !swara.includes(g));
  assert.equal(firstConsonantAt, 12, 'a consonant appears before the vowels are done');
});

test('conjunct-only letters are taught last, not in alphabet position', () => {
  for (const g of ['ङ', 'ञ', 'क्ष', 'ज्ञ']) {
    assert.ok(rankOf('mr', g) >= MR_ORDER.length - 4, `${g} should be near the end`);
  }
});

test('a track with no sequence yields no daily set', () => {
  assert.deepEqual(orderFor('sa'), []);
  assert.deepEqual(buildSet({}, 'sa', 3, NOW), []);
});

/* ── boxes ─────────────────────────────────────────────────────────────── */

test('a correct recall climbs one box; a nudged one drops to 1, never to 0', () => {
  assert.equal(promote({ box: 0 }, true, NOW).box, 1);
  assert.equal(promote({ box: 3 }, true, NOW).box, 4);
  assert.equal(promote({ box: 4 }, false, NOW).box, 1);
  // Box 0 means "never met". A child who has met a letter must never be shown
  // it as brand new again, however badly it went.
  assert.notEqual(promote({ box: 2 }, false, NOW).box, 0);
});

test('boxes cap out rather than running away', () => {
  assert.equal(promote({ box: MAX_BOX }, true, NOW).box, MAX_BOX);
});

test('intervals widen 1, 2, 4, 8, 16 days', () => {
  assert.deepEqual(BOX_INTERVAL_DAYS, [0, 1, 2, 4, 8, 16]);
  const due = promote({ box: 2 }, true, NOW).dueAt;   // -> box 3, +4 days
  assert.equal(Math.round((due - new Date(NOW).setHours(0, 0, 0, 0)) / DAY), 4);
});

test('a due date lands on a day boundary, so "tomorrow" means tomorrow', () => {
  const { dueAt } = promote({ box: 0 }, true, NOW);
  assert.equal(new Date(dueAt).getHours(), 0);
});

/* ── today's set ───────────────────────────────────────────────────────── */

test('a brand-new child gets new letters in teaching order', () => {
  const set = buildSet({}, 'en', 3, NOW);
  assert.deepEqual(set.map((i) => i.glyph), ['S', 'A', 'T']);
  assert.ok(set.every((i) => i.kind === 'new'));
});

test('the set respects the size the parent chose', () => {
  assert.equal(buildSet({}, 'en', 2, NOW).length, 2);
  assert.equal(buildSet({}, 'en', 5, NOW).length, 5);
});

test('letters that are due come back before new ones are introduced', () => {
  const letters = { 'en:S': row(), 'en:A': row() };
  const set = buildSet(letters, 'en', 3, NOW);
  assert.deepEqual(set.map((i) => i.kind), ['review', 'review', 'new']);
  assert.deepEqual(set.map((i) => i.glyph), ['S', 'A', 'T']);
});

/* A set that is nothing but revision is the fastest way to make a five-year-old
   stop caring, so reviews are capped and something new always gets in. */
test('a backlog of reviews never crowds out every new letter', () => {
  const letters = {};
  for (const g of EN_ORDER.slice(0, 10)) letters[`en:${g}`] = row();
  const set = buildSet(letters, 'en', 3, NOW);
  assert.equal(set.filter((i) => i.kind === 'review').length, 2);
  assert.equal(set.filter((i) => i.kind === 'new').length, 1);
});

test('a letter not yet due is left alone', () => {
  const letters = { 'en:S': row({ dueAt: NOW + 3 * DAY }) };
  const set = buildSet(letters, 'en', 3, NOW);
  assert.ok(!set.some((i) => i.glyph === 'S' && i.kind === 'review'));
});

test('the most overdue letter is offered first', () => {
  const letters = {
    'en:S': row({ dueAt: NOW - DAY }),
    'en:A': row({ dueAt: NOW - 9 * DAY }),
  };
  assert.equal(buildSet(letters, 'en', 2, NOW)[0].glyph, 'A');
});

/* "Come back tomorrow" to a child who wants to play now just teaches them the
   app is arbitrary. A short easy day is a better answer than an empty one. */
test('when everything is learned and nothing is due, the soonest letters come round', () => {
  const letters = {};
  for (const g of EN_ORDER) letters[`en:${g}`] = row({ box: 5, dueAt: NOW + 10 * DAY });
  const set = buildSet(letters, 'en', 3, NOW);
  assert.equal(set.length, 3);
  assert.ok(set.every((i) => i.kind === 'review'));
});

test('the set never contains a glyph that is not in the corpus', () => {
  const letters = { 'en:😀': row(), 'en:S': row() };
  const set = buildSet(letters, 'en', 3, NOW);
  assert.ok(set.every((i) => lettersOf('en').some((l) => l.glyph === i.glyph)));
});

test('metCount counts only letters actually met', () => {
  assert.equal(metCount({}, 'en'), 0);
  assert.equal(metCount({ 'en:S': row(), 'en:A': row({ box: 0 }) }, 'en'), 1);
});

/* ── question construction ─────────────────────────────────────────────── */

test('a distractor is never the answer', () => {
  for (const g of EN_ORDER.slice(0, 8)) {
    assert.ok(!distractors('en', g, 1, {}, NOW).includes(g));
  }
});

test('distractors prefer letters the child has already met', () => {
  const letters = { 'en:A': row(), 'en:T': row() };
  const [d] = distractors('en', 'S', 1, letters, NOW);
  assert.ok(['A', 'T'].includes(d), 'should choose from known letters, got ' + d);
});

test('layout always includes the answer exactly once and is stable per question', () => {
  const a = layout('S', ['A'], 'seed');
  const b = layout('S', ['A'], 'seed');
  assert.deepEqual(a, b, 'a re-render must not reshuffle under the child\'s finger');
  assert.equal(a.filter((v) => v === 'S').length, 1);
  assert.equal(a.length, 2);
});

test('the answer does not always sit in the same slot', () => {
  const positions = new Set(
    EN_ORDER.slice(0, 12).map((g) => layout(g, ['?'], 'x').indexOf(g))
  );
  assert.ok(positions.size > 1, 'the correct card is always in one position');
});

test('dayKey is a plain calendar date', () => {
  assert.match(dayKey(NOW), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(dayKey(NOW), dayKey(NOW + 3600e3), 'same day, same key');
});
