import { dispatch, getState } from '../core/app.js';
import { A } from '../core/actions.js';
import { timers } from '../core/timers.js';
import { sayWord } from '../audio/wordAudio.js';
import { parseWordKey } from '../data/packs/index.js';

/**
 * One word turn, start to finish.
 *
 * The child taps the big picture — that tap is the iOS gesture every sound
 * downstream chains off — hears the word, gets a beat to say it back (into
 * the mic when one is available, out loud into the room when not), hears
 * her own voice, and the card settles. While it settles, two quiet corner
 * dots accept a grown-up's got-it / not-yet; if nobody taps, the turn ends
 * neutrally on its own.
 *
 * Timing is fixed rather than event-chased: these are single words, and a
 * predictable rhythm matters more to a two-year-old than millisecond
 * accuracy. Every delay goes through the shared timer pool, so navigating
 * away cancels the whole turn; `live` tokens guard the awaited gaps the
 * timer pool cannot see.
 */

const PROMPT_MS = 1900;    // the word, clip or TTS, plus a beat
const ECHO_GAP_MS = 2600;  // her say-it-aloud beat when there is no recorder
const RECORD_MS = 3000;
const PLAYBACK_MAX_MS = 4000;
const SETTLE_MS = 2600;
const MARK_BEAT_MS = 350;

let recorder = null;       // plugged in by main.js once a recorder exists
let onFinish = () => {};
let live = 0;

export function configure({ rec, finish } = {}) {
  if (rec !== undefined) recorder = rec;
  if (typeof finish === 'function') onFinish = finish;
}

/** A live answer, not a boot-time one: the mic can be granted between one
 *  turn and the next, and revoked between sessions. */
const canRecordNow = () =>
  !!(recorder && recorder.ready() && getState().settings.recordBack);

/** Ask for the mic at session start — the permission dialog lands over the
 *  quiet invite screen, never mid-turn. */
export function prepareMic() {
  if (recorder && recorder.available() && getState().settings.recordBack && !recorder.ready()) {
    recorder.requestMic().catch(() => {});
  }
}

export function begin(key) {
  live++;
  dispatch(A.TURN_BEGIN, { key, canRecord: canRecordNow() });
}

/** The child's tap on the big picture. */
export function tap() {
  const { turn } = getState();
  if (!turn.key) return;
  if (turn.step === 'invite') {
    run().catch((err) => console.error('turn: failed', err));
    return;
  }
  // Mid-turn taps just play the word again — a tap must never feel ignored.
  if (turn.step === 'prompt' || turn.step === 'settle') replay();
}

export function replay() {
  const parsed = parseWordKey(getState().turn.key);
  if (parsed) sayWord(parsed.packId, parsed.itemId, parsed.lang);
}

async function run() {
  const token = live;
  const parsed = parseWordKey(getState().turn.key);
  if (!parsed) return;

  dispatch(A.TURN_STEP, { step: 'prompt' });
  await sayWord(parsed.packId, parsed.itemId, parsed.lang);
  if (token !== live) return;

  timers.t(() => {
    if (token !== live) return;
    if (canRecordNow()) {
      recordStep(token).catch((err) => {
        console.warn('turn: recording failed, settling without it', err);
        if (token === live) settleStep(token);
      });
    } else {
      // No mic: the halo still invites her to say it, into the room.
      dispatch(A.TURN_STEP, { step: 'record' });
      timers.t(() => { if (token === live) settleStep(token); }, ECHO_GAP_MS);
    }
  }, PROMPT_MS);
}

async function recordStep(token) {
  dispatch(A.TURN_STEP, { step: 'record' });
  const blob = await recorder.recordFor(RECORD_MS);
  if (token !== live) return;

  // A missing or zero-length blob (mic revoked mid-turn, iOS after
  // backgrounding) skips the echo rather than playing silence.
  if (!blob || !blob.size) {
    settleStep(token);
    return;
  }

  dispatch(A.TURN_STEP, { step: 'playback' });
  await recorder.play(blob, PLAYBACK_MAX_MS);
  if (token !== live) return;
  settleStep(token);
}

function settleStep(token) {
  dispatch(A.TURN_STEP, { step: 'settle' });
  timers.t(() => {
    if (token === live) finish(getState().turn.mark);
  }, SETTLE_MS);
}

/** A grown-up's quiet corner tap. Only meaningful while the card settles. */
export function mark(value) {
  if (getState().turn.step !== 'settle') return;
  dispatch(A.TURN_MARK, { mark: value });
  live++;                       // the settle timer stands down
  const token = live;
  timers.t(() => { if (token === live) finish(getState().turn.mark); }, MARK_BEAT_MS);
}

function finish(markValue) {
  live++;
  onFinish(markValue || null);
}

/** Called by the router on every navigation. Aborts any live recording but
 *  keeps the granted stream warm for the next turn. */
export function destroy() {
  live++;
  if (recorder) recorder.stop();
}

/** Hand the mic back entirely — the session is over or the child left. */
export function releaseMic() {
  if (recorder) recorder.release();
}
