import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strugglingIn, struggleReason } from '../js/storage/progress.js';

const NOW = 1_755_300_000_000;
const row = (over = {}) => ({
  attempts: 1, completions: 1, retries: 0, totalMs: 10000, bestMs: 10000, lastAt: NOW, ...over,
});

test('a letter needs at least three attempts before it can be flagged', () => {
  const letters = { 'mr:क': row({ attempts: 2, completions: 0 }) };
  assert.equal(strugglingIn(letters, 'mr', NOW).length, 0);
});

test('tried repeatedly and never finished is a struggle', () => {
  const letters = { 'mr:क': row({ attempts: 4, completions: 0, bestMs: 0 }) };
  const out = strugglingIn(letters, 'mr', NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].glyph, 'क');
  assert.equal(struggleReason(out[0]), 'tried a few times, not finished yet');
});

test('a high retry ratio is a struggle even when the letter completes', () => {
  const letters = { 'mr:ख': row({ attempts: 4, completions: 2, retries: 6 }) };
  assert.equal(strugglingIn(letters, 'mr', NOW)[0].glyph, 'ख');
});

/* The load-bearing guard: with fewer than four completed letters the median is
   noise, and flagging a child's very first letters as struggles is both wrong
   and demoralising for the parent reading it. */
test('slowness is not judged until there are four completions to compare against', () => {
  const slow = { 'en:A': row({ attempts: 3, completions: 1, bestMs: 90000 }) };
  assert.equal(strugglingIn(slow, 'en', NOW).length, 0);

  const withPeers = {
    'en:A': row({ attempts: 3, completions: 1, bestMs: 90000 }),
    'en:B': row({ bestMs: 8000 }),
    'en:C': row({ bestMs: 9000 }),
    'en:D': row({ bestMs: 10000 }),
    'en:E': row({ bestMs: 11000 }),
  };
  const out = strugglingIn(withPeers, 'en', NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].glyph, 'A');
  assert.equal(struggleReason(out[0]), 'takes a lot longer than the others');
});

test('stale rows are forgotten after thirty days', () => {
  const old = NOW - 40 * 24 * 3600 * 1000;
  const letters = { 'mr:ग': row({ attempts: 9, completions: 0, lastAt: old }) };
  assert.equal(strugglingIn(letters, 'mr', NOW).length, 0);
});

test('results are capped at five and ordered by attempts', () => {
  const letters = {};
  for (let i = 0; i < 8; i++) {
    letters[`en:${'ABCDEFGH'[i]}`] = row({ attempts: 3 + i, completions: 0 });
  }
  const out = strugglingIn(letters, 'en', NOW);
  assert.equal(out.length, 5);
  assert.deepEqual(out.map((r) => r.glyph), ['H', 'G', 'F', 'E', 'D']);
});

test('rows from other tracks are never mixed in', () => {
  const letters = {
    'mr:क': row({ attempts: 5, completions: 0 }),
    'en:A': row({ attempts: 5, completions: 0 }),
  };
  assert.deepEqual(strugglingIn(letters, 'en', NOW).map((r) => r.glyph), ['A']);
});

test('empty and malformed input do not throw', () => {
  assert.deepEqual(strugglingIn({}, 'en', NOW), []);
  assert.deepEqual(strugglingIn(null, 'en', NOW), []);
});
