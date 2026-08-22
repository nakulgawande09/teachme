/** Action types. One place, so a typo is a missing-key warning, not silence. */

export const A = Object.freeze({
  NAV:            'nav',              // {screen, trackId?, letterIndex?, overlay?}
  OVERLAY:        'overlay',          // {overlay: string|null}
  FIRST_RUN_DONE: 'firstRunDone',

  TRACE_BEGIN:    'trace/begin',      // {engine, strokeCount}
  TRACE_STAGE:    'trace/stage',      // {stage}
  TRACE_ADVANCE:  'trace/advance',    // {strokeIndex}
  TRACE_RETRY:    'trace/retry',      // {on}
  TRACE_STUCK:    'trace/stuck',      // {on}
  TRACE_DEMO:     'trace/demo',       // {on}
  TRACE_ALIVE:    'trace/alive',      // {step}

  AUDIO_STATUS:   'audio/status',     // {status, key?, tier?, blockedLang?}
  VOICE_READY:    'audio/voiceReady', // {ready, unlocked, tiers}

  SHLOKA_LINE:    'shloka/line',      // {playing, loading}

  DAILY_START:    'daily/start',      // {trackId, items}
  DAILY_ADVANCE:  'daily/advance',    // {index}
  DAILY_DONE:     'daily/done',       // {glyph}
  DAILY_END:      'daily/end',

  WORDS_START:    'words/start',      // {items, done, index}
  WORDS_ADVANCE:  'words/advance',    // {index}
  WORDS_DONE:     'words/done',       // {key}
  WORDS_REQUEUE:  'words/requeue',    // {key, at}
  WORDS_END:      'words/end',

  TURN_BEGIN:     'turn/begin',       // {key, canRecord}
  TURN_STEP:      'turn/step',        // {step}
  TURN_MARK:      'turn/mark',        // {mark: 'got'|'notyet'|null}

  QUIZ_ASK:       'quiz/ask',         // {kind, answer, cards, scope?, key?}
  QUIZ_WRONG:     'quiz/wrong',       // {value}
  QUIZ_SOLVED:    'quiz/solved',

  GATE_OPEN:      'gate/open',        // {question}
  GATE_WRONG:     'gate/wrong',       // {on}
  GATE_RESET:     'gate/reset',

  SETTINGS_SET:   'settings/set',     // {key, value}
  SETTINGS_LOAD:  'settings/load',    // {settings}
  PROGRESS_LOAD:  'progress/load',    // {progress}
  STORAGE_MODE:   'storage/mode',     // {mode}

  SESSION_START:  'session/start',    // {at}
  SESSION_TICK:   'session/tick',     // {activeMs, breakDue}
  SESSION_EXTEND: 'session/extend',
  SESSION_END:    'session/end',

  LAYOUT:         'layout',           // {slate?, standalone?, motion?}
});

/** Every action is a plain frozen object; the reducer never mutates one. */
export const act = (type, payload = {}) => Object.freeze({ type, ...payload });
