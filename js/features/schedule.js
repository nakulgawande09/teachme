import { BOX_INTERVAL_DAYS, MAX_BOX } from '../storage/schema.js';
import { orderFor, rankOf } from '../data/sequence.js';
import { lettersOf, letterKey } from '../data/tracks.js';

/**
 * Leitner scheduling and today's set.
 *
 * Everything here is pure: `(letters, trackId, size, now) -> glyphs`. That is
 * what makes it testable, and it is also what keeps the "why is she seeing
 * this letter today?" question answerable rather than mystical.
 *
 * Deliberately not SM-2. SM-2 needs the learner to grade their own recall,
 * which a three-year-old cannot do and a parent should not be asked to do on
 * their behalf. Boxes with fixed intervals get most of the benefit from a
 * signal we actually have: did they get it, yes or no.
 */

export const dayKey = (ts = Date.now()) => new Date(ts).toISOString().slice(0, 10);

const startOfDay = (ts) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Next box and due date after an attempt. Failure drops to 1, never to 0. */
export function promote(row, correct, now = Date.now()) {
  const box = correct ? Math.min(MAX_BOX, (row?.box || 0) + 1) : 1;
  const days = BOX_INTERVAL_DAYS[box];
  return { box, dueAt: startOfDay(now) + days * 864e5 };
}

/** A letter the child has met and which has come round again. */
const isDue = (row, now) => !!row && row.box > 0 && row.dueAt <= now;

/** A letter the child has never been taught. */
const isNew = (row) => !row || row.box === 0;

/**
 * Choose today's set.
 *
 * Reviews come first and are capped at two thirds of the set, so a child who
 * has built up a backlog still meets something new — a set that is nothing but
 * revision is the fastest way to make a five-year-old stop caring.
 *
 * @returns {Array<{glyph:string, kind:'new'|'review'}>}
 */
export function buildSet(letters, trackId, size = 3, now = Date.now()) {
  const order = orderFor(trackId);
  if (!order.length) return [];

  const known = new Set(lettersOf(trackId).map((l) => l.glyph));
  const rowFor = (glyph) => (letters || {})[letterKey(trackId, glyph)];

  const due = order
    .filter((g) => known.has(g) && isDue(rowFor(g), now))
    .sort((a, b) => (rowFor(a).dueAt - rowFor(b).dueAt) || (rankOf(trackId, a) - rankOf(trackId, b)))
    .slice(0, Math.max(1, Math.floor((size * 2) / 3)))
    .map((glyph) => ({ glyph, kind: 'review' }));

  const fresh = order
    .filter((g) => known.has(g) && isNew(rowFor(g)))
    .slice(0, size - due.length)
    .map((glyph) => ({ glyph, kind: 'new' }));

  const set = [...due, ...fresh];
  if (set.length) return set;

  // Every letter learned and nothing due yet. Rather than an empty card, offer
  // the ones closest to coming round — a short, easy day is a better answer
  // than "come back tomorrow" to a child who wants to play now.
  return order
    .filter((g) => known.has(g) && rowFor(g))
    .sort((a, b) => rowFor(a).dueAt - rowFor(b).dueAt)
    .slice(0, size)
    .map((glyph) => ({ glyph, kind: 'review' }));
}

/** How many letters in this track the child has met at all. */
export const metCount = (letters, trackId) =>
  lettersOf(trackId).filter((l) => ((letters || {})[letterKey(trackId, l.glyph)]?.box || 0) > 0).length;

/** Distractors for a recall question: near in the sequence, so it is a real
 *  choice, but never the answer itself. */
export function distractors(trackId, answer, count = 1, letters = {}, now = Date.now()) {
  const order = orderFor(trackId);
  const pool = order.filter((g) => g !== answer);
  if (!pool.length) return [];

  // Prefer letters the child has already met — confusing a known letter with
  // another known letter is useful practice; guessing between two strangers
  // is not.
  const met = pool.filter((g) => ((letters[letterKey(trackId, g)]?.box) || 0) > 0);
  const source = met.length >= count ? met : pool;

  const answerRank = rankOf(trackId, answer);
  // Deterministic per (answer, day): stable across re-renders of the same
  // question, different across days. The old comparator ignored its
  // arguments entirely, which is not a shuffle at all.
  const seed = answer + Math.floor(now / 864e5);
  return source
    .slice()
    .sort((a, b) => Math.abs(rankOf(trackId, a) - answerRank) - Math.abs(rankOf(trackId, b) - answerRank))
    .slice(0, Math.max(count, 4))
    .sort((a, b) => hash(a + seed) - hash(b + seed))
    .slice(0, count);
}

/* A tiny deterministic shuffle seeded by the question, so the correct answer
   does not sit in the same position every time but a re-render mid-question
   does not reshuffle the cards under the child's finger. */
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Place the answer among the distractors, deterministically per question.
 *  Cards are objects, so the hash keys on the answer's VALUE — hashing the
 *  object itself stringified every answer to "[object Object]". */
export function layout(answer, others, seed = '') {
  const cards = [answer, ...others];
  const id = answer && answer.value !== undefined ? String(answer.value) : String(answer);
  const at = hash(id + seed) % cards.length;
  const out = others.slice();
  out.splice(at, 0, answer);
  return out;
}
