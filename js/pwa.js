/**
 * PWA shell wiring. Everything in here is wrapped so that a failure degrades
 * to "a normal web page" rather than breaking the app.
 */

export function detectStandalone() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  } catch {
    return false;
  }
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const params = new URLSearchParams(location.search);

  // Kill switch. A service worker caching a half-built app is the fastest way
  // to lose an afternoon to stale assets; ?nosw=1 always gets you out.
  if (params.has('nosw')) {
    navigator.serviceWorker.getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .then(() => caches.keys())
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => {
        const url = new URL(location.href);
        url.searchParams.delete('nosw');
        location.replace(url.toString());
      })
      .catch((err) => console.warn('pwa: could not unregister', err));
    return;
  }

  const secure = location.protocol === 'https:' || location.hostname === 'localhost';
  if (!secure) return;

  // Boot awaits the voice list before calling this, and on a fast page the
  // `load` event can fire during that wait — a listener added after the
  // event has passed never runs, and the app silently loses its offline
  // shell for the session. Register now if load already happened.
  const register = () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch((err) => console.warn('pwa: service worker registration failed', err));
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);
}
