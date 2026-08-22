import { A } from '../actions.js';

const EMPTY_QUIZ = Object.freeze({
  kind: null, answer: null, cards: Object.freeze([]), wrong: Object.freeze([]), solved: false,
  scope: null, key: null,
});

export function reduceDaily(slice, action) {
  switch (action.type) {
    case A.DAILY_START: {
      const items = Array.isArray(action.items) ? action.items : [];
      if (!items.length) return slice;
      return {
        trackId: action.trackId,
        items,
        done: Array.isArray(action.done) ? action.done : [],
        index: Math.max(0, Math.min(items.length - 1, action.index | 0)),
        active: true,
      };
    }

    case A.DAILY_ADVANCE: {
      const index = Math.max(0, Math.min(slice.items.length, action.index | 0));
      return index === slice.index ? slice : { ...slice, index };
    }

    case A.DAILY_DONE: {
      if (!action.glyph || slice.done.includes(action.glyph)) return slice;
      return { ...slice, done: [...slice.done, action.glyph] };
    }

    case A.DAILY_END:
      return slice.active ? { ...slice, active: false } : slice;

    default:
      return slice;
  }
}

export function reduceQuiz(slice, action) {
  switch (action.type) {
    case A.QUIZ_ASK:
      return {
        kind: action.kind,
        answer: action.answer,
        cards: Array.isArray(action.cards) ? action.cards : [],
        wrong: [],
        solved: false,
        // words-scope questions replay and complete against the words
        // session; letters leave both null and behave exactly as before.
        scope: action.scope === 'words' ? 'words' : null,
        key: typeof action.key === 'string' ? action.key : null,
      };

    /* A wrong tap is recorded so that card can settle back, and for nothing
       else. There is no score, no penalty, and no path where a wrong answer
       stops the child getting to the next thing. */
    case A.QUIZ_WRONG: {
      if (slice.wrong.includes(action.value)) return slice;
      return { ...slice, wrong: [...slice.wrong, action.value] };
    }

    case A.QUIZ_SOLVED:
      return slice.solved ? slice : { ...slice, solved: true };

    default:
      return slice;
  }
}

export { EMPTY_QUIZ };
