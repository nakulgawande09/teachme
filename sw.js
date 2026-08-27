/* Akshar Khel service worker. Classic (not a module — Firefox still lacks
   module worker support). Bump VERSION on every deploy; it is the only knob.
   The trailing counter matters: two deploys on one day with the same string
   reuse the same shell cache, and the second one never reaches the device. */

const VERSION = '2026.08.26.5';
const SHELL = `akshar-shell-${VERSION}`;
const FONTS = 'akshar-fonts-v1';   // content-addressed URLs — survives deploys
const NAV_TIMEOUT_MS = 2500;
const CODE_TIMEOUT_MS = 1500;

/* Hand-maintained, which is the real cost of having no build step.
   ?selftest=1 cross-references this list against what the page actually
   loaded and logs anything missing — that catches the whole
   "forgot to add the new module" bug class. */
const ASSETS = [
  '/', '/index.html', '/manifest.webmanifest',
  '/css/tokens.css', '/css/base.css', '/css/components.css', '/css/screens.css', '/css/parent.css',
  '/js/main.js', '/js/pwa.js',
  '/js/core/app.js', '/js/core/actions.js', '/js/core/dom.js', '/js/core/reducer.js',
  '/js/core/router.js', '/js/core/state.js', '/js/core/store.js', '/js/core/timers.js',
  '/js/core/reduce/nav.js', '/js/core/reduce/trace.js', '/js/core/reduce/audio.js',
  '/js/core/reduce/parent.js', '/js/core/reduce/session.js', '/js/core/reduce/daily.js',
  '/js/core/reduce/words.js',
  '/js/data/tracks.js', '/js/data/strokes.js', '/js/data/shlokas.js', '/js/data/icons.js',
  '/js/data/sequence.js', '/js/data/packs/index.js', '/js/data/packs/objects.js',
  '/js/data/packs/animals.js', '/js/data/packs/body.js', '/js/data/packs/numbers.js',
  '/js/data/packs/stem.js',
  '/js/audio/voices.js', '/js/audio/speech.js', '/js/audio/resolver.js', '/js/audio/say.js',
  '/js/audio/wordAudio.js', '/js/audio/recorder.js',
  '/js/trace/geometry.js', '/js/trace/crayon.js', '/js/trace/strokeEngine.js',
  '/js/trace/maskEngine.js', '/js/trace/session.js',
  '/js/storage/schema.js', '/js/storage/store.js', '/js/storage/progress.js',
  '/js/storage/clips.js',
  '/js/features/shloka.js', '/js/features/session.js', '/js/features/schedule.js',
  '/js/features/daily.js', '/js/features/wordSchedule.js', '/js/features/words.js',
  '/js/features/turn.js',
  '/js/render/index.js', '/js/render/attrs.js', '/js/render/lists.js', '/js/render/events.js',
  '/js/render/coach.js',
  '/js/parent/index.js', '/js/parent/gate.js', '/js/parent/dashboard.js',
  '/js/parent/settings.js', '/js/parent/feedback.js', '/js/parent/recorder.js',
  '/icons/192.png', '/icons/512.png', '/icons/maskable-512.png', '/icons/apple-touch-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      // addAll is all-or-nothing; one missing file would leave the app with no
      // cache at all, so each asset is added independently.
      .then((cache) => Promise.allSettled(ASSETS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL && k !== FONTS).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept the feedback form. The privacy card says nothing is sent
  // unless the parent submits it, and that has to be true of us too.
  if (url.hostname.endsWith('tally.so')) return;

  if (url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, FONTS));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com') {
    event.respondWith(staleWhileRevalidate(request, FONTS));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationStrategy(request));
    return;
  }

  // The CSS and JS ARE the build, so they go to the network first.
  //
  // Under stale-while-revalidate they came back from cache instantly and the
  // new copy only landed in the background — so the launch right after a
  // deploy rendered the OLD app while quietly downloading the new one, and
  // the change appeared one launch later. That is indistinguishable from a
  // deploy that never happened, and it is how this was first reported.
  //
  // Offline still works: fetch rejects immediately with no connection and we
  // fall straight to the cache. The timeout is for the connected-but-dead
  // case, and costs one wait for the whole parallel batch, not one per file.
  if (/\.(?:css|js)$/.test(url.pathname)) {
    event.respondWith(networkFirst(request, SHELL, CODE_TIMEOUT_MS));
    return;
  }

  // Icons and the manifest change far less often than the code and are worth
  // an instant launch, so they stay stale-while-revalidate.
  event.respondWith(staleWhileRevalidate(request, SHELL));
});

/** Fresh if the network can answer in time, otherwise whatever we have. */
async function networkFirst(request, cacheName, ms) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await withTimeout(fetch(request), ms);
    if (shouldStore(fresh)) {
      cache.put(request, fresh.clone()).catch(() => {});
      return fresh;
    }
    // A 404 or a 500 is not an answer — prefer the copy that used to work.
    const stale = await cache.match(request);
    if (stale) return stale;
    return fresh || Response.error();
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}

/** A new deploy is picked up on the next online launch, without a prompt —
 *  a "new version available, reload?" dialog is a UI a toddler will tap. */
async function navigationStrategy(request) {
  const cache = await caches.open(SHELL);
  try {
    const fresh = await withTimeout(fetch(request), NAV_TIMEOUT_MS);
    if (fresh && fresh.ok) {
      cache.put('/index.html', fresh.clone()).catch(() => {});
      return fresh;
    }
  } catch {
    /* offline or slow — fall through */
  }
  return (await cache.match('/index.html')) || (await cache.match('/')) || Response.error();
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (shouldStore(res)) cache.put(request, res.clone()).catch(() => {});
    return res;
  } catch {
    return Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (shouldStore(res)) cache.put(request, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => null);
  return hit || (await network) || Response.error();
}

/* Never cache a 404 — doing so turns one bad deploy into a permanently
   broken install. Opaque responses are the cross-origin font files. */
const shouldStore = (res) => !!res && (res.ok || res.type === 'opaque');

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}
