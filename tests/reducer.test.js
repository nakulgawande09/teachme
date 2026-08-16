import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reducer } from '../js/core/reducer.js';
import { INITIAL } from '../js/core/state.js';
import { A, act } from '../js/core/actions.js';
import { MAX_EXTENSIONS, EXTENSION_MS } from '../js/core/reduce/session.js';

const run = (state, type, payload) => reducer(state, act(type, payload));

function deepFreeze(v, seen = new Set()) {
  if (!v || typeof v !== 'object' || seen.has(v)) return v;
  seen.add(v);
  Object.freeze(v);
  for (const k of Object.keys(v)) deepFreeze(v[k], seen);
  return v;
}

test('an irrelevant action returns the exact same reference', () => {
  const out = run(INITIAL, 'nothing/at/all');
  assert.equal(out, INITIAL, 'identity is what lets the render skip');
});

test('a no-op change returns the same reference too', () => {
  const s = run(INITIAL, A.NAV, { screen: 'grid', trackId: 'mr' });
  assert.equal(run(s, A.NAV, { screen: 'grid', trackId: 'mr' }), s);
});

test('the reducer never mutates the state it was given', () => {
  const frozen = deepFreeze(structuredClone(INITIAL));
  const before = JSON.stringify(frozen);
  run(frozen, A.TRACE_BEGIN, { engine: 'stroke', strokeCount: 3 });
  run(frozen, A.SETTINGS_SET, { key: 'sessionMin', value: 20 });
  run(frozen, A.NAV, { screen: 'trace' });
  assert.equal(JSON.stringify(frozen), before);
});

test('navigation clears any open overlay unless one is named', () => {
  const withOverlay = run(INITIAL, A.OVERLAY, { overlay: 'celebrate' });
  assert.equal(withOverlay.overlay, 'celebrate');
  assert.equal(run(withOverlay, A.NAV, { screen: 'grid' }).overlay, null);
});

test('an unknown screen or overlay is refused, not stored', () => {
  assert.equal(run(INITIAL, A.NAV, { screen: 'wat' }).screen, 'home');
  const s = run(INITIAL, A.OVERLAY, { overlay: 'wat' });
  assert.equal(s.overlay, null);
});

test('the trace lifecycle advances and clamps', () => {
  let s = run(INITIAL, A.TRACE_BEGIN, { engine: 'stroke', strokeCount: 3 });
  assert.deepEqual([s.trace.engine, s.trace.strokeCount, s.trace.stage], ['stroke', 3, 'demo']);

  s = run(s, A.TRACE_ADVANCE, { strokeIndex: 99 });
  assert.equal(s.trace.strokeIndex, 3, 'cannot advance past the last stroke');

  s = run(s, A.TRACE_ALIVE, { step: 7 });
  assert.equal(s.trace.aliveStep, 2, 'alive has exactly three steps');
  assert.equal(s.trace.stage, 'alive');
  assert.equal(s.trace.showDemo, false);
});

test('settings go through the same validator the storage read path uses', () => {
  assert.equal(run(INITIAL, A.SETTINGS_SET, { key: 'sessionMin', value: 20 }).settings.sessionMin, 20);
  assert.equal(run(INITIAL, A.SETTINGS_SET, { key: 'sessionMin', value: 99 }).settings.sessionMin, 15);
  assert.equal(run(INITIAL, A.SETTINGS_SET, { key: 'nope', value: 1 }), INITIAL);
});

test('a wrong gate answer counts a miss', () => {
  let s = run(INITIAL, A.GATE_OPEN, { question: { a: 3, b: 4, answer: 7, choices: [7, 8, 9, 10] } });
  assert.equal(s.gate.answer, 7);
  s = run(s, A.GATE_WRONG, { on: true });
  assert.equal(s.gate.misses, 1);
  s = run(run(s, A.GATE_WRONG, { on: false }), A.GATE_WRONG, { on: true });
  assert.equal(s.gate.misses, 2);
});

test('a malformed gate question is ignored rather than stored', () => {
  assert.equal(run(INITIAL, A.GATE_OPEN, { question: { a: 1 } }).gate, INITIAL.gate);
});

/* "It cannot be switched off" has to be literally true, so the extension
   count is capped in the reducer, not merely hidden in the UI. */
test('the break can be extended exactly twice', () => {
  let s = run(INITIAL, A.SESSION_TICK, { activeMs: 900000, breakDue: true });
  for (let i = 0; i < 5; i++) s = run(s, A.SESSION_EXTEND);
  assert.equal(s.session.extensions, MAX_EXTENSIONS);
  assert.equal(s.session.activeMs, 900000 - MAX_EXTENSIONS * EXTENSION_MS);
});

test('extending rolls the clock back rather than restarting it', () => {
  const s = run(run(INITIAL, A.SESSION_TICK, { activeMs: 60000, breakDue: true }), A.SESSION_EXTEND);
  assert.equal(s.session.activeMs, 0, 'clamped at zero, never negative');
  assert.equal(s.session.breakDue, false);
});
