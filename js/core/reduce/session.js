import { A } from '../actions.js';

/** A grown-up may extend the break twice, then the link stops being rendered. */
export const MAX_EXTENSIONS = 2;

/** One extension is worth five minutes. */
export const EXTENSION_MS = 5 * 60 * 1000;

export function reduceSession(slice, action) {
  switch (action.type) {
    case A.SESSION_START:
      return { startedAt: action.at || 0, activeMs: 0, extensions: 0, breakDue: false };

    case A.SESSION_TICK: {
      const activeMs = Math.max(0, action.activeMs | 0);
      const breakDue = !!action.breakDue;
      if (activeMs === slice.activeMs && breakDue === slice.breakDue) return slice;
      return { ...slice, activeMs, breakDue };
    }

    case A.SESSION_EXTEND: {
      if (slice.extensions >= MAX_EXTENSIONS) return slice;
      // Extending pushes the deadline out by rolling the accumulated time
      // back, so the existing clock keeps running rather than restarting.
      return {
        ...slice,
        extensions: slice.extensions + 1,
        activeMs: Math.max(0, slice.activeMs - EXTENSION_MS),
        breakDue: false,
      };
    }

    case A.SESSION_END:
      return { startedAt: 0, activeMs: 0, extensions: 0, breakDue: false };

    default:
      return slice;
  }
}

export function reduceLayout(slice, action) {
  if (action.type !== A.LAYOUT) return slice;
  const next = {
    slate: action.slate === undefined ? slice.slate : Math.max(180, action.slate | 0),
    standalone: action.standalone === undefined ? slice.standalone : !!action.standalone,
    motion: action.motion === undefined ? slice.motion : action.motion,
  };
  const unchanged =
    next.slate === slice.slate &&
    next.standalone === slice.standalone &&
    next.motion === slice.motion;
  return unchanged ? slice : next;
}

export function reduceStorageMode(mode, action) {
  if (action.type !== A.STORAGE_MODE) return mode;
  const next = action.mode === 'readonly' ? 'readonly' : 'ok';
  return next === mode ? mode : next;
}
