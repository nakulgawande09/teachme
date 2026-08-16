import { A } from '../actions.js';

const STATUSES = new Set(['idle', 'loading', 'playing', 'blocked']);

export function reduceAudio(slice, action) {
  if (action.type !== A.AUDIO_STATUS) return slice;

  const status = STATUSES.has(action.status) ? action.status : 'idle';
  const next = {
    status,
    key: action.key === undefined ? slice.key : action.key,
    tier: action.tier === undefined ? slice.tier : action.tier,
    // `blockedLang` is what the parent-zone honesty card reads: which language
    // we declined to speak because no matching voice exists.
    blockedLang: status === 'blocked' ? (action.blockedLang ?? slice.blockedLang) : null,
  };

  const unchanged =
    next.status === slice.status &&
    next.key === slice.key &&
    next.tier === slice.tier &&
    next.blockedLang === slice.blockedLang;

  return unchanged ? slice : next;
}

export function reduceVoice(slice, action) {
  if (action.type !== A.VOICE_READY) return slice;

  const tiers = action.tiers ? { ...slice.tiers, ...action.tiers } : slice.tiers;
  const ready = action.ready === undefined ? slice.ready : !!action.ready;
  const unlocked = action.unlocked === undefined ? slice.unlocked : !!action.unlocked;

  const tiersSame =
    tiers === slice.tiers ||
    Object.keys(tiers).every((k) => tiers[k] === slice.tiers[k]);

  if (ready === slice.ready && unlocked === slice.unlocked && tiersSame) return slice;
  return { ready, unlocked, tiers: tiersSame ? slice.tiers : tiers };
}

export function reduceShloka(slice, action) {
  if (action.type !== A.SHLOKA_LINE) return slice;
  const playingLine = action.playing === undefined ? slice.playingLine : action.playing;
  const loadingLine = action.loading === undefined ? slice.loadingLine : action.loading;
  if (playingLine === slice.playingLine && loadingLine === slice.loadingLine) return slice;
  return { playingLine, loadingLine };
}
