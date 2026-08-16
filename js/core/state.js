import { SETTINGS_DEFAULTS, EMPTY_PROGRESS } from '../storage/schema.js';

/**
 * The whole app state. Two orthogonal machines live here:
 *   `screen`      — which page (home | grid | listen | trace | shloka)
 *   `trace.stage` — the trace lifecycle (demo | trace | alive)
 * plus `overlay`, which floats above whichever screen is current.
 */
export const INITIAL = Object.freeze({
  screen: 'home',
  overlay: null,            // null | celebrate | break | gate | parent
  trackId: 'en',
  letterIndex: 0,
  firstRun: true,

  trace: Object.freeze({
    engine: 'mask',         // stroke | mask
    stage: 'demo',          // demo | trace | alive
    strokeIndex: 0,
    strokeCount: 0,
    showDemo: true,
    stuck: false,
    retry: false,
    aliveStep: 0,           // 0 | 1 | 2
  }),

  audio: Object.freeze({
    status: 'idle',         // idle | loading | playing | blocked
    key: null,
    tier: 'none',           // clip | pregen | device | none
    blockedLang: null,
  }),

  voice: Object.freeze({
    ready: false,
    unlocked: false,
    tiers: Object.freeze({ en: 'none', mr: 'none', sa: 'none' }),
  }),

  shloka: Object.freeze({ playingLine: -1, loadingLine: -1 }),

  gate: Object.freeze({ a: 0, b: 0, answer: 0, choices: Object.freeze([]), wrong: false, misses: 0 }),

  session: Object.freeze({ startedAt: 0, activeMs: 0, extensions: 0, breakDue: false }),

  layout: Object.freeze({ slate: 300, standalone: false, motion: 'full' }),

  storage: 'ok',            // ok | readonly
  settings: SETTINGS_DEFAULTS,
  progress: EMPTY_PROGRESS,
});
