import { A } from '../actions.js';

const SCREENS = new Set(['home', 'grid', 'listen', 'trace', 'shloka']);
const OVERLAYS = new Set(['celebrate', 'break', 'gate', 'parent']);

/**
 * Navigation slice. Operates on the whole state because `screen`, `trackId`,
 * `letterIndex` and `overlay` are top-level.
 * Returns the same reference when nothing changed.
 */
export function reduceNav(state, action) {
  switch (action.type) {
    case A.NAV: {
      const screen = SCREENS.has(action.screen) ? action.screen : state.screen;
      if (!SCREENS.has(action.screen)) console.warn('nav: unknown screen', action.screen);

      const next = {
        ...state,
        screen,
        overlay: action.overlay === undefined ? null : action.overlay,
      };
      if (action.trackId !== undefined) next.trackId = action.trackId;
      if (action.letterIndex !== undefined) next.letterIndex = action.letterIndex;
      return same(state, next) ? state : next;
    }

    case A.OVERLAY: {
      const overlay = action.overlay === null || OVERLAYS.has(action.overlay)
        ? action.overlay
        : (console.warn('nav: unknown overlay', action.overlay), state.overlay);
      return overlay === state.overlay ? state : { ...state, overlay };
    }

    case A.FIRST_RUN_DONE:
      return state.firstRun ? { ...state, firstRun: false } : state;

    default:
      return state;
  }
}

const same = (a, b) =>
  a.screen === b.screen &&
  a.overlay === b.overlay &&
  a.trackId === b.trackId &&
  a.letterIndex === b.letterIndex;
