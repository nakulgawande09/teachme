import { audioContext } from './resolver.js';

/**
 * The child's echo: record a few seconds, play it straight back, discard.
 *
 * Strictly on-device — MediaRecorder → in-memory Blob → the shared
 * AudioContext → gone. Nothing is uploaded, nothing is scored, nothing is
 * kept (docs/voice-and-audio.md §6; the grown-ups area says so in words).
 *
 * The stop timer here is deliberately a RAW setTimeout, not the shared
 * timer pool: navigation clears the pool, and a recording that nobody stops
 * would hold the mic open. `stop()` covers the navigation case instead.
 *
 * Playback rides the one gesture-unlocked AudioContext — a fresh <audio>
 * element would need a fresh gesture on iOS, and the child's gesture
 * happened two steps ago on the big picture.
 */

let stream = null;
let active = null;
let denied = false;

/** Recording is possible on this device (mic API present, not refused). */
export const available = () =>
  !denied && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
  && typeof window.MediaRecorder === 'function';

/** A live, granted mic — the thing a turn actually needs. */
export const ready = () => !!(stream && stream.active);

export const isDenied = () => denied;

/**
 * Ask for the mic. Called at words-session start (and from the parent
 * recorder card), never mid-turn — the permission dialog lands over the
 * quiet invite screen, where waiting costs nothing.
 */
export async function requestMic() {
  if (!available()) return false;
  if (ready()) return true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return true;
  } catch (err) {
    // Denial is an answer, not an error: every turn from here on is
    // hear → say it into the room → move on.
    denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
    console.warn('recorder: no mic', err && err.name);
    stream = null;
    return false;
  }
}

function mimeType() {
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';   // iOS Safari
  return '';
}

/** Record for up to `ms`. Resolves with a Blob, or null when anything at
 *  all goes wrong — a turn must degrade, never wedge. */
export function recordFor(ms) {
  if (!ready()) return Promise.resolve(null);

  return new Promise((resolve) => {
    let rec;
    const mime = mimeType();
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    } catch (err) {
      console.warn('recorder: could not start', err);
      resolve(null);
      return;
    }

    active = rec;
    const chunks = [];
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (active === rec) active = null;
      resolve(chunks.length ? new Blob(chunks, { type: mime || 'audio/webm' }) : null);
    };

    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = finish;
    rec.onerror = finish;

    try {
      rec.start();
    } catch (err) {
      console.warn('recorder: start failed', err);
      finish();
      return;
    }
    setTimeout(() => {
      try { if (rec.state !== 'inactive') rec.stop(); } catch { finish(); }
    }, ms);
  });
}

/** Play a just-recorded blob through the shared context. Resolves when the
 *  sound ends (or at maxMs, because iOS drops onended often enough). */
export async function play(blob, maxMs = 4000) {
  const ctx = audioContext();
  if (!ctx || !blob) return false;
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    return await new Promise((resolve) => {
      let settled = false;
      const done = () => { if (!settled) { settled = true; resolve(true); } };
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.onended = done;
      src.start();
      setTimeout(done, Math.min(maxMs, buf.duration * 1000 + 250));
    });
  } catch (err) {
    console.warn('recorder: playback failed', err);
    return false;
  }
}

/** Abort any live recording; the stream stays warm for the next turn. */
export function stop() {
  try {
    if (active && active.state !== 'inactive') active.stop();
  } catch { /* already gone */ }
  active = null;
}

/** Hand the mic back — session over, home screen, or page hidden. The
 *  browser's recording indicator must never outlive the words session. */
export function release() {
  stop();
  if (stream) {
    try { stream.getTracks().forEach((t) => t.stop()); } catch { /* best effort */ }
    stream = null;
  }
}
