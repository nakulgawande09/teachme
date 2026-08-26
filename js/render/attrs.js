/**
 * State -> the flat attribute set on #app. CSS does the rest: every screen,
 * overlay, stage and audio state is a selector, not a style write.
 */
export function attrsFor(state) {
  const t = state.trace;
  return {
    'data-screen': state.screen,
    'data-overlay': state.overlay || '',
    'data-track': state.trackId,
    'data-engine': t.engine,
    'data-stage': t.stage,
    'data-alive': String(t.aliveStep),
    // Not gated on the stage: the "show me again" replay and the stuck-timer
    // demo both fire mid-trace, and gating on stage==='demo' left every one
    // of them invisible — a stuck child had no way out.
    'data-demo': t.showDemo ? '1' : '',
    'data-stuck': t.stuck ? '1' : '',
    'data-retry': t.retry ? '1' : '',
    'data-audio': state.audio.status,
    'data-quiz': state.quiz.solved ? 'solved' : '',
    // A words question belongs to the words track, so the recall screen wears
    // haldi rather than whichever letter track was open last.
    'data-scope': state.quiz.scope || '',
    'data-turn': state.screen === 'words' ? state.turn.step : '',
    'data-mark': state.screen === 'words' ? (state.turn.mark || '') : '',
    'data-first-run': state.firstRun ? '1' : '',
    'data-gate-wrong': state.gate.wrong ? '1' : '',
    'data-standalone': state.layout.standalone ? '1' : '',
    'data-storage': state.storage,
    'data-motion': state.layout.motion === 'reduced' ? 'reduced' : '',
  };
}

export function varsFor(state) {
  return {
    '--slate': `${state.layout.slate}px`,
    '--qcards': String(state.quiz.cards.length || 2),
  };
}
