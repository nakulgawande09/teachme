/**
 * Tracked timers.
 *
 * The shipped app leaked: confetti removal, the cheer dismissal and the
 * tracer's speech callbacks all outlived the screen that armed them, so
 * switching tabs mid-animation left work running against a DOM that had moved
 * on. Every timeout in this app goes through `t()`, and every navigation
 * calls `clearAll()` — see js/core/router.js, which is the only place allowed
 * to change `screen`.
 */

/** @returns {{t:Function, every:Function, clear:Function, clearAll:Function, size:number}} */
export function createTimers(label = 'timers') {
  const timeouts = new Set();
  const intervals = new Set();

  // A throwing callback must not take the rest of the app's timers with it.
  const safe = (fn) => {
    try {
      fn();
    } catch (err) {
      console.error(`${label}: callback failed`, err);
    }
  };

  return {
    t(fn, ms) {
      const id = setTimeout(() => {
        timeouts.delete(id);
        safe(fn);
      }, ms);
      timeouts.add(id);
      return id;
    },

    every(fn, ms) {
      const id = setInterval(() => safe(fn), ms);
      intervals.add(id);
      return id;
    },

    clear(id) {
      if (timeouts.delete(id)) clearTimeout(id);
      if (intervals.delete(id)) clearInterval(id);
    },

    clearAll() {
      timeouts.forEach(clearTimeout);
      intervals.forEach(clearInterval);
      timeouts.clear();
      intervals.clear();
    },

    get size() {
      return timeouts.size + intervals.size;
    },
  };
}

/** App-wide timer pool. Cleared on every navigation. */
export const timers = createTimers('app');
