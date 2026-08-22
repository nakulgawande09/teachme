import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSettings, validateField, validateLetterRow, SETTINGS_DEFAULTS,
  validateWordRow, validateWordsDaily, MAX_BOX,
} from '../js/storage/schema.js';

test('validateSettings fills a complete object from nothing', () => {
  assert.deepEqual(validateSettings(undefined), { ...SETTINGS_DEFAULTS, tracks: { en: true, mr: true, sa: true } });
  assert.deepEqual(validateSettings(null).sessionMin, 15);
  assert.deepEqual(validateSettings('{}').strictness, 'normal');
  assert.deepEqual(validateSettings([]).volume, 0.8);
});

test('unknown keys are dropped rather than carried', () => {
  const out = validateSettings({ sessionMin: 10, wat: 'nope', __proto__: { x: 1 } });
  assert.equal(out.sessionMin, 10);
  assert.ok(!('wat' in out));
});

test('enum values outside the set fall back to the default', () => {
  assert.equal(validateField('sessionMin', 99), 15);
  assert.equal(validateField('sessionMin', '15'), 15, 'a string is not the number 15');
  assert.equal(validateField('strictness', 'brutal'), 'normal');
  assert.equal(validateField('helpDelaySec', 0), 0, '0 means "never" and is legal');
});

test('numbers are clamped, not rejected', () => {
  assert.equal(validateField('volume', 5), 1);
  assert.equal(validateField('volume', -3), 0);
  assert.equal(validateField('rate', 'x'), 0.9);
  assert.equal(validateField('rate', 0.75), 0.75);
});

test('the last enabled track cannot be switched off', () => {
  assert.deepEqual(validateField('tracks', { en: false, mr: false, sa: false }),
    { en: true, mr: true, sa: true });
  assert.deepEqual(validateField('tracks', { en: true, mr: false, sa: false }),
    { en: true, mr: false, sa: false });
});

test('letter telemetry is bounded so a hand-edited blob cannot skew the heuristic', () => {
  const row = validateLetterRow({ attempts: 1e9, completions: -4, retries: 'x', totalMs: 1e12, bestMs: 1, lastAt: 0 });
  assert.equal(row.attempts, 9999);
  assert.equal(row.completions, 0);
  assert.equal(row.retries, 0);
  assert.equal(row.totalMs, 3.6e7);
  assert.equal(row.bestMs, 500);
  assert.equal(validateLetterRow(null), null);
});

/* ── words mode ────────────────────────────────────────────────────────── */

test('packs default to the starter pack only, and missing flags stay off', () => {
  assert.deepEqual(validateField('packs', undefined),
    { objects: true, animals: false, body: false, numbers: false, stem: false });
  // A blob written before a pack existed must not silently switch it on.
  assert.deepEqual(validateField('packs', { objects: true }),
    { objects: true, animals: false, body: false, numbers: false, stem: false });
  assert.deepEqual(validateField('packs', { objects: true, stem: true }).stem, true);
  // The last pack cannot be switched off, same rule as the last track.
  assert.deepEqual(validateField('packs', { objects: false }),
    { objects: true, animals: false, body: false, numbers: false, stem: false });
});

test('a word row is bounded and a malformed one is rejected whole', () => {
  const row = validateWordRow({
    attempts: 1e9, gotIt: -1, notYet: 'x', box: 99, dueAt: -5,
    missStreak: 40, lastMissDay: 'yesterday',
  });
  assert.equal(row.attempts, 9999);
  assert.equal(row.gotIt, 0);
  assert.equal(row.notYet, 0);
  assert.equal(row.box, MAX_BOX);
  assert.equal(row.dueAt, 0);
  assert.equal(row.missStreak, 9);
  assert.equal(row.lastMissDay, '', 'a non-date miss day is dropped');
  assert.equal(validateWordRow(null), null);
  assert.equal(validateWordRow('junk'), null);
});

test('a stored word day keeps only well-formed turns, capped', () => {
  const out = validateWordsDaily({
    day: '2026-08-22',
    items: [
      { t: 'w', key: 'objects:cup:en' },
      { t: 'q', key: 'objects:dog:mr' },
      { t: 'x', key: 'objects:cat:en' },     // unknown turn type
      { key: 'objects:sun:en' },             // no type
      'objects:moon:en',                     // not even an object
    ],
    done: ['objects:cup:en', 'objects:ball:en'],
  });
  assert.equal(out.items.length, 2);
  assert.deepEqual(out.done, ['objects:cup:en'], 'done keeps only keys still in the set');

  assert.deepEqual(validateWordsDaily(null), { day: '', items: [], done: [] });
  assert.deepEqual(validateWordsDaily({ day: 'not-a-date', items: [], done: [] }).day, '');
});
