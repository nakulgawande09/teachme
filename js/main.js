import { dispatch, store, getState } from './core/app.js';
import { A } from './core/actions.js';
import * as router from './core/router.js';
import { TRACKS, TRACK_IDS } from './data/tracks.js';
import { slateSize } from './trace/geometry.js';
import { startRender, lists } from './render/index.js';
import { bindEvents } from './render/events.js';
import { load, onStorageMode, flush, update, snapshot } from './storage/store.js';
import { whenVoicesReady, unlock } from './audio/voices.js';
import { unlockContext, loadManifest } from './audio/resolver.js';
import { say, refreshTiers } from './audio/say.js';
import { invalidateAudibility, configureLocalClips } from './audio/wordAudio.js';
import * as recorder from './audio/recorder.js';
import * as clips from './storage/clips.js';
import * as trace from './trace/session.js';
import * as turn from './features/turn.js';
import * as session from './features/session.js';
import { registerServiceWorker, detectStandalone } from './pwa.js';

/** Boot. Order matters: state before paint, paint before listeners. */
async function boot() {
  const { data, mode } = load();
  dispatch(A.SETTINGS_LOAD, { settings: data.settings });
  dispatch(A.PROGRESS_LOAD, { progress: data.progress });
  dispatch(A.STORAGE_MODE, { mode });

  // Derived, not stored: a child who has never touched a letter is on their
  // first run. Keeping this in memory only would replay the walkthrough on
  // every single launch; giving it its own stored flag would then disagree
  // with the progress a parent had just reset.
  if (Object.keys(data.progress.letters).length > 0) dispatch(A.FIRST_RUN_DONE);
  onStorageMode((next) => dispatch(A.STORAGE_MODE, { mode: next }));

  dispatch(A.LAYOUT, {
    slate: slateSize(),
    standalone: detectStandalone(),
    motion: data.settings.motion === 'reduced' ? 'reduced' : 'full',
  });

  lists.mountIcons();
  trace.configure({ speakFn: say });
  turn.configure({ rec: recorder, finish: router.finishWordTurn });
  startRender();
  bindEvents();

  bindLifecycle();
  session.start();
  firstRunWalkthrough();

  // Parent-recorded clips are the words mode's first audio rung: hasClip is
  // sync, play decodes through the shared context via the recorder.
  configureLocalClips({
    has: clips.hasClip,
    play: async (key) => {
      const rec = await clips.getClip(key);
      return rec ? recorder.play(rec.blob, 8000) : false;
    },
  });

  // Voices resolve asynchronously; publish the honest tier list as soon as
  // they land, so the parent-zone readout is never stale. The words mode's
  // audibility memo invalidates on the same beat — VOICE_READY repaints the
  // home card, which then sees the fresh answer.
  await Promise.allSettled([whenVoicesReady(), loadManifest(), clips.loadIndex()]);
  invalidateAudibility();
  refreshTiers();

  registerServiceWorker();
  runDevTools();
}

/**
 * On a very first launch, skip the choice entirely and walk the child through
 * one letter: hear it, trace it, watch it come alive. A three-year-old handed
 * three cards and no instructions taps at random; handed one thing to do,
 * they do it. The picker appears from the second launch onward.
 */
function firstRunWalkthrough() {
  const state = getState();
  if (!state.firstRun) return;

  const trackId = TRACK_IDS.find((id) => state.settings.tracks[id] && TRACKS[id].traceable);
  if (!trackId) return;

  router.pickTrack(trackId);
}

function bindLifecycle() {
  // iOS needs a gesture before it will speak at all, and the first tap is not
  // reliably where we expect it — so we listen for the first one anywhere.
  const onFirstTouch = () => {
    unlock();
    unlockContext();
    invalidateAudibility();
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

  window.addEventListener('pagehide', () => {
    flush();
    turn.releaseMic();
  });
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
