/**
 * Voice inventory and the language-match guard.
 *
 * The bug this module exists to kill: the shipped app asked for Marathi with
 * a fallback chain `["mr","hi","en-in"]`. Almost no device ships a Marathi
 * voice, so it silently handed the text to a HINDI voice. Hindi applies
 * final-schwa deletion, so कमळ comes out closer to "kamal", and ळ — a letter
 * Hindi does not have — is rendered as ल. Sanskrit resolves nowhere, so every
 * shloka got Hindi prosody.
 *
 * A three-year-old treats this app as the authority on how a letter sounds.
 * Being silent is a smaller failure than being confidently wrong, so a
 * language mismatch means we do not speak. The grown-ups area says why.
 */

const VOICES_TIMEOUT_MS = 2000;

let voices = [];
let readyResolve = null;
let readyPromise = null;
let unlocked = false;

/** 'mr-IN' -> 'mr'. Comparing base languages, not full tags. */
export const baseLang = (tag) => String(tag || '').toLowerCase().split(/[-_]/)[0];

function refresh() {
  try {
    voices = window.speechSynthesis ? window.speechSynthesis.getVoices() || [] : [];
  } catch (err) {
    console.warn('voices: getVoices failed', err);
    voices = [];
  }
  return voices;
}

/**
 * Resolves when the voice list is populated — or when we give up waiting.
 * `getVoices()` returns [] on first call in Chrome and fills in later via
 * onvoiceschanged. The shipped app read it at parse time, so a child tapping
 * within the first second got the platform default (often US English).
 */
export function whenVoicesReady() {
  if (readyPromise) return readyPromise;

  readyPromise = new Promise((resolve) => {
    readyResolve = resolve;

    if (!window.speechSynthesis) {
      resolve([]);
      return;
    }
    if (refresh().length) {
      resolve(voices);
      return;
    }

    const onChange = () => {
      if (refresh().length) finish();
    };
    const finish = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onChange);
      clearTimeout(timer);
      resolve(voices);
    };

    window.speechSynthesis.addEventListener('voiceschanged', onChange);
    // A device with genuinely no voices must not leave the app waiting.
    const timer = setTimeout(finish, VOICES_TIMEOUT_MS);
  });

  return readyPromise;
}

/** Keep the list fresh — some platforms add voices after first paint. */
if (window.speechSynthesis) {
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    refresh();
    if (readyResolve && voices.length) readyResolve(voices);
  });
}

/**
 * The best voice whose BASE language matches the request, or null.
 * Never falls through to a different language — that fallthrough is the bug.
 */
export function matchingVoice(lang) {
  const want = baseLang(lang);
  if (!want) return null;
  const list = voices.length ? voices : refresh();

  const exact = list.find((v) => String(v.lang).toLowerCase().replace('_', '-') === String(lang).toLowerCase());
  if (exact) return exact;

  const sameBase = list.filter((v) => baseLang(v.lang) === want);
  if (!sameBase.length) return null;
  // Prefer a local voice: no network round trip, works offline.
  return sameBase.find((v) => v.localService) || sameBase[0];
}

/** @returns {'device'|'none'} what the device can honestly offer for `lang`. */
export const deviceTier = (lang) => (matchingVoice(lang) ? 'device' : 'none');

/**
 * iOS will not speak until a user gesture has unlocked synthesis. Called from
 * a one-shot capture listener on the first pointerdown ANYWHERE, not just the
 * track card — a child's first tap is not reliably where we expect it.
 */
export function unlock() {
  if (unlocked || !window.speechSynthesis) return unlocked;
  try {
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    window.speechSynthesis.speak(u);
    window.speechSynthesis.cancel();
    unlocked = true;
  } catch (err) {
    console.warn('voices: unlock failed', err);
  }
  return unlocked;
}

export const isUnlocked = () => unlocked;
export const voiceCount = () => voices.length;
