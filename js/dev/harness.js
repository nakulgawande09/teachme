import { dispatch, getState } from '../core/app.js';
import { A } from '../core/actions.js';
import * as router from '../core/router.js';

/**
 * State harness, behind ?harness=1. NOT part of the app.
 *
 * Half of these states are otherwise reachable only via a three-year-old's
 * finger and a fifteen-minute wait — "stuck", "retry", "no Marathi voice" and
 * "storage read-only" in particular.
 */

const STATES = [
  ['01 first run',      () => dispatch(A.NAV, { screen: 'home' }) || dispatch(A.SETTINGS_LOAD, {})],
  ['01 picker',         () => router.goHome()],
  ['02 grid en',        () => router.pickTrack('en')],
  ['02 grid mr',        () => router.pickTrack('mr')],
  ['03 listen',         () => { router.pickTrack('en'); router.openListen(0) }],
  ['03 audio loading',  () => dispatch(A.AUDIO_STATUS, { status: 'loading' })],
  ['03 audio playing',  () => dispatch(A.AUDIO_STATUS, { status: 'playing' })],
  ['03 audio blocked',  () => dispatch(A.AUDIO_STATUS, { status: 'blocked', blockedLang: 'mr-IN' })],
  ['04 trace stroke',   () => { router.pickTrack('en'); router.openListen(0); router.openTrace() }],
  ['04 trace mask',     () => { router.pickTrack('mr'); router.openListen(0); router.openTrace() }],
  ['04 stuck',          () => dispatch(A.TRACE_STUCK, { on: true })],
  ['04 retry',          () => dispatch(A.TRACE_RETRY, { on: true })],
  ['✦ alive 1',         () => dispatch(A.TRACE_ALIVE, { step: 1 })],
  ['✦ alive 2',         () => dispatch(A.TRACE_ALIVE, { step: 2 })],
  ['06 celebrate',      () => dispatch(A.OVERLAY, { overlay: 'celebrate' })],
  ['05 shloka',         () => router.pickTrack('sa')],
  ['07 break',          () => dispatch(A.OVERLAY, { overlay: 'break' })],
  ['07 break, no ext',  () => { dispatch(A.SESSION_EXTEND); dispatch(A.SESSION_EXTEND); dispatch(A.OVERLAY, { overlay: 'break' }) }],
  ['08 gate',           () => import('../parent/gate.js').then((m) => m.openGate())],
  ['08 parent',         () => import('../parent/index.js').then((m) => { dispatch(A.OVERLAY, { overlay: 'parent' }); m.mount() })],
  ['no mr voice',       () => dispatch(A.VOICE_READY, { tiers: { mr: 'none', sa: 'none' } })],
  ['storage readonly',  () => dispatch(A.STORAGE_MODE, { mode: 'readonly' })],
  ['reduced motion',    () => dispatch(A.LAYOUT, { motion: getState().layout.motion === 'reduced' ? 'full' : 'reduced' })],
];

export function mount() {
  const bar = document.createElement('div');
  bar.setAttribute('style', [
    'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:9999',
    'display:flex', 'flex-wrap:wrap', 'gap:4px', 'padding:6px',
    'background:rgba(36,30,24,.92)', 'max-height:34vh', 'overflow:auto',
    'font:400 11px ui-monospace,monospace',
  ].join(';'));

  bar.appendChild(label('DESIGNER HARNESS — NOT PART OF THE APP'));
  for (const [name, run] of STATES) {
    const b = document.createElement('button');
    b.textContent = name;
    b.setAttribute('style',
      'padding:5px 8px;border-radius:6px;border:none;background:#FDF8F0;color:#241E18;' +
      'font:inherit;cursor:pointer');
    b.addEventListener('click', () => {
      try { run(); } catch (err) { console.error('harness:', name, err); }
    });
    bar.appendChild(b);
  }
  document.body.appendChild(bar);
}

function label(text) {
  const el = document.createElement('span');
  el.textContent = text;
  el.setAttribute('style', 'width:100%;color:#8A7C6C;letter-spacing:.1em;padding:2px 4px');
  return el;
}
