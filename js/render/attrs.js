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
    'data-demo': t.showDemo && t.stage === 'demo' ? '1' : '',
    'data-stuck': t.stuck ? '1' : '',
    'data-retry': t.retry ? '1' : '',
    'data-audio': state.audio.status,
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
  };
}
