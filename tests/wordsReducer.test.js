import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reducer } from '../js/core/reducer.js';
import { INITIAL } from '../js/core/state.js';
import { A, act } from '../js/core/actions.js';

const run = (state, type, payload) => reducer(state, act(type, payload));

const ITEMS = [
  { t: 'w', key: 'objects:cup:en', kind: 'new' },
  { t: 'w', key: 'objects:dog:mr', kind: 'review' },
  { t: 'q', key: 'objects:ball:en', kind: 'think' },
  { t: 'w', key: 'objects:sun:en', kind: 'new' },
];

const started = () => run(INITIAL, A.WORDS_START, { items: ITEMS, done: [], index: 0 });

function deepFreeze(v, seen = new Set()) {
  if (!v || typeof v !== 'object' || seen.has(v)) return v;
  seen.add(v);
  Object.freeze(v);
  for (const k of Object.keys(v)) deepFreeze(v[k], seen);
  return v;
}

/* ── the session slice ─────────────────────────────────────────────────── */

test('irrelevant actions return the identical words and turn slices', () => {
  assert.equal(run(INITIAL, 'nothing/at/all'), INITIAL);
  const t = run(started(), A.TRACE_STAGE, { stage: 'trace' });
  const u = run(t, A.SHLOKA_LINE, { playing: 1 });
  assert.equal(u.words, t.words, 'unrelated actions must not touch the words slice');
  assert.equal(u.turn, t.turn);
});

test('starting a words session clamps the index and keeps only sane items', () => {
  const s = run(INITIAL, A.WORDS_START, {
    items: [...ITEMS, { t: 'w' }, null, { t: 'x', key: 'objects:cat:en', kind: 'wat' }],
    done: [],
    index: 99,
  });
  assert.equal(s.words.items.length, 5, 'keyless and null items are dropped');
  assert.equal(s.words.items[4].t, 'w', 'an unknown turn type falls back to a word turn');
  assert.equal(s.words.items[4].kind, 'new', 'an unknown kind falls back to new');
  assert.equal(s.words.index, 4, 'index clamps to the last item');
  assert.equal(s.words.active, true);

  assert.equal(run(INITIAL, A.WORDS_START, { items: [] }), INITIAL, 'an empty set never starts');
});

test('done records each key once', () => {
  let s = started();
  s = run(s, A.WORDS_DONE, { key: 'objects:cup:en' });
  s = run(s, A.WORDS_DONE, { key: 'objects:cup:en' });
  assert.deepEqual(s.words.done, ['objects:cup:en']);
  assert.equal(run(s, A.WORDS_DONE, {}), s, 'a keyless done is a no-op');
});

test('advance clamps to the end of the set', () => {
  let s = started();
  s = run(s, A.WORDS_ADVANCE, { index: 99 });
  assert.equal(s.words.index, 4, 'one past the last item means "finished"');
  s = run(s, A.WORDS_ADVANCE, { index: -3 });
  assert.equal(s.words.index, 0);
});

test('a missed word re-queues once, ahead of the cursor, and only once', () => {
  let s = started();
  s = run(s, A.WORDS_REQUEUE, { key: 'objects:cup:en', at: 3 });
  assert.equal(s.words.items.length, 5);
  assert.deepEqual(s.words.items[3], { t: 'w', key: 'objects:cup:en', kind: 'requeue' });

  const again = run(s, A.WORDS_REQUEUE, { key: 'objects:cup:en', at: 4 });
  assert.equal(again, s, 'a second requeue of the same key is refused');

  const behind = run(started(), A.WORDS_REQUEUE, { key: 'objects:dog:mr', at: 0 });
  assert.ok(behind.words.items.findIndex((it) => it.kind === 'requeue') > 0,
    'a requeue can never land behind the child');
});

test('ending the session leaves the day visible but inactive', () => {
  const s = run(started(), A.WORDS_END);
  assert.equal(s.words.active, false);
  assert.equal(s.words.items.length, 4, 'the items survive for the done screen');
  assert.equal(run(s, A.WORDS_END), s, 'ending twice is the identity');
});

/* ── the turn machine ──────────────────────────────────────────────────── */

test('a turn begins at invite with no mark, whatever came before', () => {
  let s = run(INITIAL, A.TURN_BEGIN, { key: 'objects:cup:en', canRecord: true });
  s = run(s, A.TURN_STEP, { step: 'settle' });
  s = run(s, A.TURN_MARK, { mark: 'got' });
  s = run(s, A.TURN_BEGIN, { key: 'objects:dog:mr', canRecord: false });
  assert.deepEqual(s.turn, { step: 'invite', key: 'objects:dog:mr', canRecord: false, mark: null });
});

test('unknown steps and marks are refused, not stored', () => {
  const s = run(INITIAL, A.TURN_BEGIN, { key: 'objects:cup:en' });
  assert.equal(run(s, A.TURN_STEP, { step: 'confetti' }).turn.step, 'invite');
  assert.equal(run(s, A.TURN_MARK, { mark: 'wrong!!' }).turn.mark, null);
});

test('the words reducers never mutate their input', () => {
  const frozen = deepFreeze(structuredClone(started()));
  const before = JSON.stringify(frozen);
  run(frozen, A.WORDS_REQUEUE, { key: 'objects:cup:en', at: 2 });
  run(frozen, A.WORDS_DONE, { key: 'objects:cup:en' });
  run(frozen, A.TURN_BEGIN, { key: 'objects:cup:en' });
  run(frozen, A.TURN_STEP, { step: 'settle' });
  assert.equal(JSON.stringify(frozen), before);
});

/* ── quiz scope ────────────────────────────────────────────────────────── */

test('a words question carries its scope and key; a letters one stays null', () => {
  const wordsQ = run(INITIAL, A.QUIZ_ASK, {
    kind: 'word2picture', answer: 'cup', cards: [{ value: 'cup' }],
    scope: 'words', key: 'objects:cup:en',
  });
  assert.equal(wordsQ.quiz.scope, 'words');
  assert.equal(wordsQ.quiz.key, 'objects:cup:en');

  const lettersQ = run(INITIAL, A.QUIZ_ASK, {
    kind: 'sound2letter', answer: 'S', cards: [{ value: 'S' }],
  });
  assert.equal(lettersQ.quiz.scope, null);
  assert.equal(lettersQ.quiz.key, null);

  const junk = run(INITIAL, A.QUIZ_ASK, {
    kind: 'word2picture', answer: 'cup', cards: [{ value: 'cup' }], scope: 'evil',
  });
  assert.equal(junk.quiz.scope, null, 'an unknown scope is dropped');
});
