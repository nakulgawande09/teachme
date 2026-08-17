import { getState, store } from '../core/app.js';
import { need, setHTML } from '../core/dom.js';
import { progressCard, voiceCard, card, esc } from './dashboard.js';
import { dailyCard, sessionCard, contentCard, voiceControlsCard, motionCard } from './settings.js';
import { isConfigured, payloadText, feedbackUrl, APP_VERSION } from './feedback.js';

/**
 * The grown-ups area. Loaded on demand — nothing in here is downloaded until
 * the gate is passed, which is also why the string "tally.so" never enters
 * the code a child's session loads.
 */

let unsubscribe = null;

export function mount() {
  paint(getState());
  if (!unsubscribe) {
    unsubscribe = store.subscribe((state) => {
      if (state.overlay === 'parent') paint(state);
    });
  }
}

export function unmount() {
  unsubscribe?.();
  unsubscribe = null;
}

function paint(state) {
  setHTML(need('parentCards'), [
    progressCard(state),
    dailyCard(state),
    sessionCard(state),
    contentCard(state),
    voiceCard(state),
    voiceControlsCard(state),
    motionCard(state),
    dataCard(state),
    feedbackCard(),
    installCard(state),
  ].join(''));
}

function dataCard(state) {
  const readonly = state.storage === 'readonly';
  return card('Your data', `
    <p class="pcard__body">Everything stays on this device. What is stored, in full:</p>
    <p class="pcard__body">
      · which letters have been finished<br>
      · how many tries each took, and how long<br>
      · how many minutes were played each day, for the last two weeks<br>
      · the settings on this page
    </p>
    <p class="pcard__body"><b>No accounts, no adverts, no analytics on your child, no scores or
      streaks. Nothing is sent anywhere.</b></p>
    ${readonly ? '<p class="pnote">This device is not letting the app save anything, so none of the above is being kept.</p>' : ''}
    <div class="pbtn-row" style="margin-top:12px">
      <button class="pbtn" type="button" data-action="export-data">Download my data</button>
      <button class="pbtn pbtn--danger" type="button" data-action="reset-progress">Reset progress</button>
      <button class="pbtn pbtn--danger" type="button" data-action="reset-all">Reset everything</button>
    </div>`);
}

function feedbackCard() {
  // Absent rather than broken: until the Tally form exists there is nothing
  // honest to link to.
  if (!isConfigured()) return '';
  return card('Send feedback', `
    <p class="pcard__body">The form opens in a new tab on tally.so. This is <em>everything</em>
      that goes with it:</p>
    <pre class="payload">${esc(payloadText())}</pre>
    <p class="pcard__body">No letter names, no dates, no timings, nothing that identifies you or
      your child. Nothing is sent unless you submit the form.</p>
    <a class="pbtn pbtn--primary" href="${feedbackUrl()}" target="_blank" rel="noopener noreferrer">
      Open the feedback form
    </a>`);
}

function installCard(state) {
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/.test(ua);

  if (state.layout.standalone) {
    return card('Nothing to install', `
      <p class="pcard__body">This is running from your home screen and works offline. Version
        ${esc(APP_VERSION)}.</p>`);
  }

  // No install button on iOS: there is no beforeinstallprompt, so a button
  // would silently do nothing for a large share of the audience.
  const how = isIOS
    ? 'Tap the Share button in Safari, then "Add to Home Screen".'
    : 'Use your browser menu, then "Install app" or "Add to Home Screen".';

  return card('Add it to the home screen', `
    <p class="pcard__body">It is a web page, not an app store download. Added to the home screen it
      opens full-screen and keeps working without a connection. ${esc(how)}</p>
    <p class="pcard__body">Version ${esc(APP_VERSION)}.</p>`);
}
