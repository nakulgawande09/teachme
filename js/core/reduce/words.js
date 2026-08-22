import { A } from '../actions.js';

/**
 * The words session and the single-turn machine.
 *
 * Same disciplines as every other slice: clamp everything, refuse unknown
 * values with a warning rather than storing them, and return the input
 * reference when nothing changed.
 */

const KINDS = new Set(['new', 'review', 'requeue', 'think']);

export function reduceWords(slice, action) {
  switch (action.type) {
    case A.WORDS_START: {
      const items = (Array.isArray(action.items) ? action.items : [])
        .filter((it) => it && typeof it.key === 'string')
        .map((it) => ({
          t: it.t === 'q' ? 'q' : 'w',
          key: it.key,
          kind: KINDS.has(it.kind) ? it.kind : 'new',
        }));
      if (!items.length) return slice;
      return {
        items,
        done: Array.isArray(action.done) ? action.done : [],
        index: Math.max(0, Math.min(items.length - 1, action.index | 0)),
        active: true,
      };
    }

    case A.WORDS_ADVANCE: {
      const index = Math.max(0, Math.min(slice.items.length, action.index | 0));
      return index === slice.index ? slice : { ...slice, index };
    }

    case A.WORDS_DONE: {
      if (!action.key || slice.done.includes(action.key)) return slice;
      return { ...slice, done: [...slice.done, action.key] };
    }

    /* A missed word slips back in a few turns ahead — once. A second miss of
       the same key in one session is answered by tomorrow's schedule, not by
       an in-session loop the child cannot see the end of. */
    case A.WORDS_REQUEUE: {
      if (!action.key) return slice;
      const ahead = slice.items.slice(slice.index + 1);
      if (ahead.some((it) => it.key === action.key && it.kind === 'requeue')) return slice;
      const at = Math.max(slice.index + 1, Math.min(slice.items.length, action.at | 0));
      const items = slice.items.slice();
      items.splice(at, 0, { t: 'w', key: action.key, kind: 'requeue' });
      return { ...slice, items };
    }

    case A.WORDS_END:
      return slice.active ? { ...slice, active: false } : slice;

    default:
      return slice;
  }
}

const STEPS = new Set(['invite', 'prompt', 'record', 'playback', 'settle']);
const MARKS = new Set(['got', 'notyet']);

export function reduceTurn(slice, action) {
  switch (action.type) {
    case A.TURN_BEGIN:
      return {
        step: 'invite',
        key: typeof action.key === 'string' ? action.key : null,
        canRecord: !!action.canRecord,
        mark: null,
      };

    case A.TURN_STEP: {
      if (!STEPS.has(action.step)) {
        console.warn('turn: unknown step', action.step);
        return slice;
      }
      return action.step === slice.step ? slice : { ...slice, step: action.step };
    }

    case A.TURN_MARK: {
      const mark = MARKS.has(action.mark) ? action.mark : null;
      return mark === slice.mark ? slice : { ...slice, mark };
    }

    default:
      return slice;
  }
}
