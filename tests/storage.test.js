import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../js/storage/store.js';
import { CURRENT_VERSION } from '../js/storage/schema.js';

/* migrate() is the only stored-blob path that changes shape between deploys,
   so it is the one storage function worth testing in isolation. normalise()
   runs after it and absorbs anything these fixtures leave rough. */

const V1_BLOB = {
  v: 1,
  createdAt: 1723900000000,
  settings: { dailySize: 3 },
  progress: { done: { en: { S: true } }, letters: { 'en:S': { attempts: 2 } } },
  usage: { days: {}, sessions: 4, lastSessionAt: 0 },
  daily: { day: '2026-08-21', sets: {} },
};

test('a v1 blob gains the words map and today-set without losing anything', () => {
  const out = migrate(structuredClone(V1_BLOB));
  assert.equal(out.v, CURRENT_VERSION);
  assert.deepEqual(out.progress.words, {});
  assert.deepEqual(out.wordsDaily, { day: '', items: [], done: [] });
  // The letters side is untouched — migration adds, never rewrites.
  assert.deepEqual(out.progress.done, V1_BLOB.progress.done);
  assert.deepEqual(out.progress.letters, V1_BLOB.progress.letters);
  assert.equal(out.createdAt, V1_BLOB.createdAt);
});

test('an unversioned blob chains up to the current version', () => {
  const out = migrate({ ...structuredClone(V1_BLOB), v: undefined });
  assert.equal(out.v, CURRENT_VERSION);
  assert.deepEqual(out.progress.words, {});
});

test('a blob from a NEWER deploy is read conservatively, never downgraded in place', () => {
  const out = migrate({ v: CURRENT_VERSION + 1, progress: { done: { en: { S: true } } } });
  assert.equal(out.v, CURRENT_VERSION);
  assert.deepEqual(out.progress.done, { en: { S: true } });
  assert.deepEqual(out.progress.words, {});
});

test('garbage in, fresh state out', () => {
  assert.equal(migrate(null).v, CURRENT_VERSION);
  assert.equal(migrate('wat').v, CURRENT_VERSION);
  assert.ok(migrate(undefined).wordsDaily);
});

test('migrating an already-current blob is the identity', () => {
  const current = migrate(structuredClone(V1_BLOB));
  assert.deepEqual(migrate(structuredClone(current)), current);
});
