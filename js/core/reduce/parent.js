import { A } from '../actions.js';
import { validateField, validateSettings, EMPTY_PROGRESS } from '../../storage/schema.js';

const EMPTY_GATE = Object.freeze({
  a: 0, b: 0, answer: 0, choices: Object.freeze([]), wrong: false, misses: 0,
});

export function reduceGate(slice, action) {
  switch (action.type) {
    case A.GATE_OPEN: {
      const q = action.question;
      if (!q || typeof q.answer !== 'number' || !Array.isArray(q.choices)) {
        console.warn('gate: malformed question', q);
        return slice;
      }
      // A fresh question every open, and the answer lives here rather than in
      // the DOM — nothing in the markup reveals it.
      //
      // `misses` deliberately carries over: regenerating the question after two
      // wrong answers must not hand the guesser a clean slate, or the
      // three-strike lockout can never be reached. GATE_RESET clears it.
      return { a: q.a, b: q.b, answer: q.answer, choices: q.choices, wrong: false, misses: slice.misses };
    }

    case A.GATE_WRONG: {
      const on = !!action.on;
      const misses = on ? slice.misses + 1 : slice.misses;
      if (on === slice.wrong && misses === slice.misses) return slice;
      return { ...slice, wrong: on, misses };
    }

    case A.GATE_RESET:
      return slice === EMPTY_GATE ? slice : EMPTY_GATE;

    default:
      return slice;
  }
}

export function reduceSettings(slice, action) {
  switch (action.type) {
    case A.SETTINGS_LOAD: {
      const next = validateSettings(action.settings);
      return shallowSame(slice, next) ? slice : next;
    }

    case A.SETTINGS_SET: {
      // Same validator as the storage read path, so the UI cannot introduce a
      // value that a reload would then reject.
      const value = validateField(action.key, action.value);
      if (value === undefined) return slice;
      if (slice[action.key] === value) return slice;
      return { ...slice, [action.key]: value };
    }

    default:
      return slice;
  }
}

export function reduceProgress(slice, action) {
  if (action.type !== A.PROGRESS_LOAD) return slice;
  const p = action.progress;
  if (!p || typeof p !== 'object') return EMPTY_PROGRESS;
  return { done: p.done || {}, letters: p.letters || {} };
}

function shallowSame(a, b) {
  for (const k in b) {
    const av = a[k];
    const bv = b[k];
    if (av === bv) continue;
    if (av && bv && typeof av === 'object' && typeof bv === 'object') {
      for (const kk in bv) if (av[kk] !== bv[kk]) return false;
      continue;
    }
    return false;
  }
  return true;
}
