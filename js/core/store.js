/**
 * Minimal immutable store. Subscribers are notified once per animation frame,
 * so a burst of dispatches costs one render.
 */

const isDev = () => new URLSearchParams(location.search).has('dev');

/** Recursively freeze, so an accidental mutation throws in dev instead of working. */
function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze(value[key], seen);
  return value;
}

export function createStore(reducer, initialState) {
  if (typeof reducer !== 'function') throw new TypeError('createStore: reducer must be a function');

  const dev = isDev();
  let state = dev ? deepFreeze(initialState) : Object.freeze(initialState);
  const listeners = new Set();
  let frame = 0;

  const notify = () => {
    frame = 0;
    for (const fn of listeners) {
      try {
        fn(state);
      } catch (err) {
        console.error('store: subscriber failed', err);
      }
    }
  };

  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(notify);
  };

  return {
    getState: () => state,

    dispatch(action) {
      if (!action || typeof action.type !== 'string') {
        console.warn('store: ignored malformed action', action);
        return state;
      }
      let next;
      try {
        next = reducer(state, action);
      } catch (err) {
        console.error(`store: reducer threw on "${action.type}"`, err);
        return state;
      }
      if (next === state) return state;
      state = dev ? deepFreeze(next) : Object.freeze(next);
      schedule();
      return state;
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** Render immediately rather than on the next frame. Boot only. */
    flush() {
      if (frame) cancelAnimationFrame(frame);
      notify();
    },
  };
}
