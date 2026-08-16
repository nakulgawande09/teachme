/* Akshar Khel service worker. Classic (not a module — Firefox still lacks
   module worker support). Bump VERSION on every deploy; it is the only knob. */

const VERSION = '2026.08.16';
const SHELL = `akshar-shell-${VERSION}`;
const FONTS = 'akshar-fonts-v1';   // content-addressed URLs — survives deploys
const NAV_TIMEOUT_MS = 2500;

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
  '/js/core/reduce/parent.js', '/js/core/reduce/session.js',
  '/js/data/tracks.js', '/js/data/strokes.js', '/js/data/shlokas.js', '/js/data/icons.js',
  '/js/audio/voices.js', '/js/audio/speech.js', '/js/audio/resolver.js', '/js/audio/say.js',
  '/js/trace/geometry.js', '/js/trace/crayon.js', '/js/trace/strokeEngine.js',
  '/js/trace/maskEngine.js', '/js/trace/session.js',
  '/js/storage/schema.js', '/js/storage/store.js', '/js/storage/progress.js',
  '/js/features/shloka.js', '/js/features/session.js',
  '/js/render/index.js', '/js/render/attrs.js', '/js/render/lists.js', '/js/render/events.js',
  '/js/parent/index.js', '/js/parent/gate.js', '/js/parent/dashboard.js',
  '/js/parent/settings.js', '/js/parent/feedback.js',
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
  event.respondWith(staleWhileRevalidate(request, SHELL));
});

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
