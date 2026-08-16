import { A } from '../actions.js';

const patch = (slice, changes) => {
  for (const k in changes) if (slice[k] !== changes[k]) return { ...slice, ...changes };
  return slice;
};

/**
 * Trace slice.
 *
 * Note what is NOT here: pointer position, covered samples, canvas pixels.
 * The engine keeps those locally and draws imperatively. Only three moments
 * reach the store — a stroke was accepted, a stroke was rejected, the glyph is
 * finished. Running the reducer at pointermove frequency (120 Hz on a modern
 * phone) would visibly stutter the crayon.
 */
export function reduceTrace(slice, action) {
  switch (action.type) {
    case A.TRACE_BEGIN:
      return patch(slice, {
        engine: action.engine === 'stroke' ? 'stroke' : 'mask',
        strokeCount: Math.max(0, action.strokeCount | 0),
        stage: 'demo',
        strokeIndex: 0,
        showDemo: true,
        stuck: false,
        retry: false,
        aliveStep: 0,
      });

    case A.TRACE_STAGE:
      return patch(slice, { stage: action.stage, stuck: false });

    case A.TRACE_ADVANCE:
      return patch(slice, {
        strokeIndex: Math.max(0, Math.min(slice.strokeCount, action.strokeIndex | 0)),
        retry: false,
        stuck: false,
      });

    case A.TRACE_RETRY:
      return patch(slice, { retry: !!action.on });

    case A.TRACE_STUCK:
      return patch(slice, { stuck: !!action.on });

    case A.TRACE_DEMO:
      return patch(slice, { showDemo: !!action.on });

    case A.TRACE_ALIVE:
      return patch(slice, {
        stage: 'alive',
        aliveStep: Math.max(0, Math.min(2, action.step | 0)),
        stuck: false,
        retry: false,
        showDemo: false,
      });

    default:
      return slice;
  }
}
