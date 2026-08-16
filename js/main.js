import { dispatch, store } from './core/app.js';
import { A } from './core/actions.js';
import { slateSize } from './trace/geometry.js';
import { startRender, lists } from './render/index.js';
import { bindEvents } from './render/events.js';
import { load, onStorageMode, flush, update, snapshot } from './storage/store.js';
import { whenVoicesReady, unlock } from './audio/voices.js';
import { unlockContext, loadManifest } from './audio/resolver.js';
import { say, refreshTiers } from './audio/say.js';
import * as trace from './trace/session.js';
import * as session from './features/session.js';
import { registerServiceWorker, detectStandalone } from './pwa.js';

/** Boot. Order matters: state before paint, paint before listeners. */
async function boot() {
  const { data, mode } = load();
  dispatch(A.SETTINGS_LOAD, { settings: data.settings });
  dispatch(A.PROGRESS_LOAD, { progress: data.progress });
  dispatch(A.STORAGE_MODE, { mode });
  onStorageMode((next) => dispatch(A.STORAGE_MODE, { mode: next }));

  dispatch(A.LAYOUT, {
    slate: slateSize(),
    standalone: detectStandalone(),
    motion: data.settings.motion === 'reduced' ? 'reduced' : 'full',
  });

  lists.mountIcons();
  trace.configure({ speakFn: say });
  startRender();
  bindEvents();

  bindLifecycle();
  session.start();

  // Voices resolve asynchronously; publish the honest tier list as soon as
  // they land, so the parent-zone readout is never stale.
  await Promise.allSettled([whenVoicesReady(), loadManifest()]);
  refreshTiers();

  registerServiceWorker();
  runDevTools();
}

function bindLifecycle() {
  // iOS needs a gesture before it will speak at all, and the first tap is not
  // reliably where we expect it — so we listen for the first one anywhere.
  const onFirstTouch = () => {
    unlock();
    unlockContext();
    refreshTiers();
  };
  window.addEventListener('pointerdown', onFirstTouch, { once: true, capture: true });

  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      dispatch(A.LAYOUT, { slate: slateSize(), standalone: detectStandalone() });
      trace.resize();
    }, 150);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  window.addEventListener('pagehide', () => flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });

  // Settings are owned by state but LIVE in storage. Without this the parent
  // can change a setting, see it apply, and lose it on the next launch.
  let lastSettings = snapshot().settings;
  store.subscribe((state) => {
    if (state.settings !== lastSettings) {
      lastSettings = state.settings;
      update((data) => ({ ...data, settings: { ...state.settings } }));
    }
    // Follow the motion setting when the parent changes it mid-session.
    const want = state.settings.motion === 'reduced' ? 'reduced' : 'full';
    if (state.layout.motion !== want) dispatch(A.LAYOUT, { motion: want });
  });
}

async function runDevTools() {
  const params = new URLSearchParams(location.search);
  try {
    if (params.has('selftest')) (await import('./dev/selftest.js')).run();
    if (params.has('harness')) (await import('./dev/harness.js')).mount();
  } catch (err) {
    console.warn('dev tools unavailable', err);
  }
}

boot().catch((err) => {
  console.error('boot failed', err);
  document.body.insertAdjacentHTML(
    'afterbegin',
    '<p style="padding:24px;font:400 17px/1.5 system-ui;color:#241E18">' +
    'अक्षर खेळ could not start. Reloading the page usually fixes it.</p>'
  );
});
