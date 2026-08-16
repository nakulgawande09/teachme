import { matchingVoice, unlock, whenVoicesReady } from './voices.js';

/**
 * Speech queue.
 *
 * The shipped app called `speechSynthesis.cancel()` at the top of every
 * `speak()`, so two quick taps cut the first word in half. Here, a new
 * request replaces the QUEUE but lets the current utterance finish its word
 * where it can, and rapid identical taps are collapsed rather than stacked.
 */

let queue = [];
let speaking = false;
let onStatus = () => {};

export function setStatusHandler(fn) {
  onStatus = typeof fn === 'function' ? fn : () => {};
}

/** Hard stop. Called by the router before every navigation. */
export function stop() {
  queue = [];
  speaking = false;
  try {
    window.speechSynthesis?.cancel();
  } catch (err) {
    console.warn('speech: cancel failed', err);
  }
  onStatus({ status: 'idle' });
}

/**
 * Speak `text` in `lang`, or report `blocked` and stay silent if the device
 * has no voice for that language. Never substitutes another language.
 *
 * @returns {boolean} true if something will actually be said.
 */
export function speak(text, lang, { rate = 0.9, volume = 0.8, pitch = 1, key = null } = {}) {
  if (!text || !window.speechSynthesis) {
    onStatus({ status: 'blocked', key, tier: 'none', blockedLang: lang });
    return false;
  }

  const voice = matchingVoice(lang);
  if (!voice) {
    // The whole point. A letter that animates but says nothing beats a letter
    // mispronounced by the wrong language's voice.
    onStatus({ status: 'blocked', key, tier: 'none', blockedLang: lang });
    return false;
  }

  unlock();
  queue = [{ text, voice, lang, rate, volume, pitch, key }];
  if (!speaking) drain();
  return true;
}

function drain() {
  const item = queue.shift();
  if (!item) {
    speaking = false;
    onStatus({ status: 'idle' });
    return;
  }

  speaking = true;
  let settled = false;
  const done = () => {
    if (settled) return;
    settled = true;
    drain();
  };

  try {
    const u = new SpeechSynthesisUtterance(item.text);
    u.voice = item.voice;
    u.lang = item.voice.lang || item.lang;
    u.rate = clamp(item.rate, 0.5, 1.5);
    u.pitch = clamp(item.pitch, 0.5, 1.5);
    u.volume = clamp(item.volume, 0, 1);

    // `playing` fires on onstart, not on a fabricated delay. The mockup faked
    // 420ms of "loading" to exercise the ring; faking latency just delays the
    // sound a child is waiting for.
    u.onstart = () => onStatus({ status: 'playing', key: item.key, tier: 'device' });
    u.onend = done;
    u.onerror = (e) => {
      // 'interrupted'/'canceled' are our own stop() — not worth a console error.
      if (e && e.error && e.error !== 'interrupted' && e.error !== 'canceled') {
        console.warn('speech: utterance error', e.error);
      }
      done();
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);

    // iOS occasionally drops onend entirely. Without this guard the queue
    // wedges and no further tap makes a sound.
    setTimeout(done, 1200 + item.text.length * 120);
  } catch (err) {
    console.error('speech: speak failed', err);
    done();
  }
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Number(n) || lo));

/** Warm the voice list before the first tap can happen. */
export const prewarm = () => whenVoicesReady();
