import { getState } from '../core/app.js';
import { setAttr } from '../core/dom.js';

/**
 * The first-run fingertip: which single control it points at right now.
 *
 * Presentation only, so it writes the attribute directly instead of going
 * through the reducer — the same call the hold-door progress bar makes, and
 * for the same reason. It also lives in its own module so the router can set
 * it without importing the event table.
 */
export function coach(step) {
  const root = document.getElementById('app');
  if (!root) return;
  setAttr(root, 'data-coach', getState().firstRun && step ? step : '');
}
