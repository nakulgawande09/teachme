import { reduceNav } from './reduce/nav.js';
import { reduceTrace } from './reduce/trace.js';
import { reduceAudio, reduceVoice, reduceShloka } from './reduce/audio.js';
import { reduceGate, reduceSettings, reduceProgress } from './reduce/parent.js';
import { reduceSession, reduceLayout, reduceStorageMode } from './reduce/session.js';
import { reduceDaily, reduceQuiz } from './reduce/daily.js';
import { reduceWords, reduceTurn } from './reduce/words.js';

/**
 * Root reducer. Every slice returns its own input reference when nothing
 * changed, so the identity check at the bottom lets an irrelevant action cost
 * exactly one comparison and no render.
 */
export function reducer(state, action) {
  const navved = reduceNav(state, action);

  const trace    = reduceTrace(navved.trace, action);
  const audio    = reduceAudio(navved.audio, action);
  const voice    = reduceVoice(navved.voice, action);
  const shloka   = reduceShloka(navved.shloka, action);
  const gate     = reduceGate(navved.gate, action);
  const settings = reduceSettings(navved.settings, action);
  const progress = reduceProgress(navved.progress, action);
  const session  = reduceSession(navved.session, action);
  const layout   = reduceLayout(navved.layout, action);
  const storage  = reduceStorageMode(navved.storage, action);
  const daily    = reduceDaily(navved.daily, action);
  const quiz     = reduceQuiz(navved.quiz, action);
  const words    = reduceWords(navved.words, action);
  const turn     = reduceTurn(navved.turn, action);

  if (
    navved === state &&
    trace === state.trace && audio === state.audio && voice === state.voice &&
    shloka === state.shloka && gate === state.gate && settings === state.settings &&
    progress === state.progress && session === state.session &&
    layout === state.layout && storage === state.storage &&
    daily === state.daily && quiz === state.quiz &&
    words === state.words && turn === state.turn
  ) {
    return state;
  }

  return {
    ...navved,
    trace, audio, voice, shloka, gate, settings, progress, session, layout, storage,
    daily, quiz, words, turn,
  };
}
