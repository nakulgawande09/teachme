import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSettings, validateField, validateLetterRow, SETTINGS_DEFAULTS } from '../js/storage/schema.js';

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
