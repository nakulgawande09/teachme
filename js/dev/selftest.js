import { ACTIONS } from '../render/events.js';
import { TRACK_IDS, lettersOf } from '../data/tracks.js';
import { pickEngine } from '../data/strokes.js';

/**
 * Boot-time assertions, behind ?selftest=1. Not a test framework — these are
 * the checks that catch whole classes of silent breakage which unit tests
 * cannot see because they involve the real DOM, the real fonts and the real
 * service-worker cache.
 */

const pass = (msg) => console.log('%c✓', 'color:#5E8B3A', msg);
const fail = (msg) => console.warn('✗', msg);

export async function run() {
  console.group('akshar selftest');

  actionsMatchDom();
  animationsCarryMotionAttr();
  everyGlyphResolves();
  noEmojiInChrome();
  await fontsLoaded();
  await shellIsCached();

  console.groupEnd();
}

function actionsMatchDom() {
  const used = new Set([...document.querySelectorAll('[data-action]')].map((el) => el.dataset.action));
  const defined = new Set(Object.keys(ACTIONS));

  // Dynamic markup (grid cards, gate choices, parent cards) is not in the
  // static DOM at boot, so only the reverse direction is checked eagerly.
  const orphans = [...used].filter((a) => !defined.has(a) && !a.startsWith('set-'));
  orphans.length
    ? fail(`data-action with no handler: ${orphans.join(', ')}`)
    : pass('every data-action in the DOM has a handler');
}

/**
 * The opt-in [data-motion] selector is only as good as its coverage: an
 * animated element missing the attribute silently ignores the user's
 * reduced-motion preference.
 */
function animationsCarryMotionAttr() {
  const missing = [...document.querySelectorAll('*')].filter((el) => {
    const name = getComputedStyle(el).animationName;
    return name && name !== 'none' && !el.hasAttribute('data-motion');
  });
  missing.length
    ? fail(`animated but missing data-motion: ${missing.map((e) => e.className || e.tagName).join(', ')}`)
    : pass('every animated element carries data-motion');
}

function everyGlyphResolves() {
  const bad = [];
  for (const id of TRACK_IDS) {
    for (const letter of lettersOf(id)) {
      const engine = pickEngine(letter.glyph);
      if (engine !== 'stroke' && engine !== 'mask') bad.push(`${id}:${letter.glyph}`);
      if (!letter.sound) bad.push(`${id}:${letter.glyph} has no sound label`);
    }
  }
  bad.length ? fail(bad.join(', ')) : pass('every glyph resolves to an engine and has a sound label');
}

/** Emoji belong in the art frame and nowhere else — a locked design decision,
 *  enforced here rather than by memory. */
function noEmojiInChrome() {
  const rx = /\p{Extended_Pictographic}/u;
  // The art frames: the listen card's, the words mode's big picture and its
  // home-card preview, quiz picture cards, and the words closing screen.
  const FRAMES = '.listen__art, .wturn__art, .wcard__art, .wcard__today, .qcard__art, .done__glyphs';
  const offenders = [...document.querySelectorAll('.measure *')].filter((el) => {
    if (el.closest(FRAMES)) return false;
    if (el.children.length) return false;
    return rx.test(el.textContent || '');
  });
  offenders.length
    ? fail(`emoji outside the art frame: ${offenders.map((e) => e.textContent.trim()).join(' ')}`)
    : pass('no emoji in child-facing chrome');
}

async function fontsLoaded() {
  try {
    await document.fonts.ready;
    // Each face is checked against text it will actually render. Google Fonts
    // serves unicode-range subsets, so checking a Devanagari face with the
    // default Latin probe string is a guaranteed false negative.
    const faces = [
      ['Andika', 'Aa'],
      ['Tiro Devanagari Marathi', 'क'],
      ['Work Sans', 'Aa'],
    ];
    // load() before check(): a webfont face is only "loaded" once something
    // has needed it, so a weight the current screen happens not to use would
    // report missing when it is in fact perfectly available.
    await Promise.allSettled(faces.map(([f, probe]) => document.fonts.load(`400 40px "${f}"`, probe)));
    const missing = faces
      .filter(([f, probe]) => !document.fonts.check(`400 40px "${f}"`, probe))
      .map(([f]) => f);
    missing.length
      ? fail(`webfont not loaded: ${missing.join(', ')} — falling back`)
      : pass('all three typefaces loaded');
  } catch (err) {
    fail(`font check failed: ${err.message}`);
  }
}

/**
 * The service-worker asset list is hand-maintained, which means it silently
 * drifts. Comparing it against what the page actually loaded catches the
 * entire "forgot to add the new module" bug class.
 */
async function shellIsCached() {
  if (!('caches' in window) || !navigator.serviceWorker?.controller) {
    pass('no active service worker — shell check skipped');
    return;
  }
  const loaded = performance.getEntriesByType('resource')
    .filter((r) => r.initiatorType === 'script' || r.initiatorType === 'link')
    .map((r) => new URL(r.name))
    .filter((u) => u.origin === location.origin)
    .map((u) => u.pathname)
    .filter((p) => !p.startsWith('/js/dev/')); // dev tools are deliberately not precached

  const missing = [];
  for (const path of [...new Set(loaded)]) {
    if (!(await caches.match(path))) missing.push(path);
  }
  missing.length
    ? fail(`loaded but not in the service-worker shell: ${missing.join(', ')}`)
    : pass('every loaded asset is in the shell cache');
}
