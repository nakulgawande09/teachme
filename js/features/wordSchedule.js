import { dayKey, layout } from './schedule.js';
import {
  PACKS, itemsOf, itemById, wordKey, parseWordKey, LANGS,
} from '../data/packs/index.js';

/**
 * Scheduling for the words mode — today's set, its thinking turns, and the
 * card the parents get at night.
 *
 * Everything here is pure: `(rows, packs, audible, size, now) -> turns`.
 * `rows` is the stored progress map keyed by wordKey; `audible` is a Set of
 * wordKeys that can actually make a sound on this device (recorded clip,
 * shipped clip, or a genuinely matching voice). The audibility filter lives
 * HERE, at selection time, because a turn built around a silent word is a
 * turn that teaches nothing — "silence beats a wrong sound" also means
 * "don't schedule the silence".
 *
 * The unit is (item × language): knowing "cup" and knowing "कप" are two
 * memories, each with its own Leitner box. But an ITEM appears at most once
 * per set, in whichever language is most due — that is the rotation the
 * whole method rests on: same thirty objects, languages taking turns.
 */

const DAY = 864e5;

/* Same tiny deterministic hash the letter scheduler uses: stable per input,
   so a re-render never reshuffles anything under the child's finger. */
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const dayNumber = (now) => Math.floor(now / DAY);

/** Days between a stored 'YYYY-MM-DD' and now; Infinity for no date. */
function daysSince(dayStr, now) {
  if (!dayStr) return Infinity;
  const then = new Date(`${dayStr}T00:00:00`).getTime();
  if (!Number.isFinite(then)) return Infinity;
  return Math.floor((now - then) / DAY);
}

/**
 * An item marked "not yet" three days running is not a scheduling problem,
 * it is a signal the word is too hard right now. It sits out for two days —
 * quietly, with something easier in its place — instead of becoming a wall
 * the child runs into every single morning.
 */
export const isCooling = (row, now) =>
  !!row && row.missStreak >= 3 && daysSince(row.lastMissDay, now) <= 2;

const boxOf = (row) => (row && row.box) || 0;
const isDue = (row, now) => !!row && row.box > 0 && row.dueAt <= now;

/** review | new — how a stored key should be presented today. */
export const wordKindOf = (rows, key) => (boxOf((rows || {})[key]) > 0 ? 'review' : 'new');

/* One record per item the device can say in at least one language. */
function candidates(rows, enabledPacks, audible) {
  const out = [];
  for (const packId of enabledPacks) {
    const pack = PACKS[packId];
    if (!pack) continue;
    pack.items.forEach((item, rank) => {
      const langs = pack.langs.filter((lang) => audible.has(wordKey(packId, item.id, lang)));
      if (langs.length) out.push({ packId, item, rank, langs });
    });
  }
  return out;
}

/**
 * Choose today's set.
 *
 * Order of assembly, each stage skipping items already placed:
 *   1  due reviews, most overdue first, one language per item, capped at ⅔
 *   2  easy known items standing in for anything that is cooling off
 *   3  new items — tier first, then pack order; a second language for an
 *      item only unlocks once the first has reached box 2, so cup-English
 *      and cup-Marathi arrive as one idea rather than two strangers
 *   4  soonest-due known items, so the day is never empty
 * then a quiet thinking turn is woven in after every second word.
 *
 * @returns {Array<{t:'w'|'q', key:string}>}
 */
export function buildWordSet(rows, enabledPacks, audible, size = 6, now = Date.now()) {
  rows = rows || {};
  const all = candidates(rows, enabledPacks, audible);
  if (!all.length) return [];

  const rowOf = (packId, itemId, lang) => rows[wordKey(packId, itemId, lang)];
  const itemCooling = (c) => c.langs.some((l) => isCooling(rowOf(c.packId, c.item.id, l), now));

  const used = new Set();          // "packId:itemId" — one appearance per item
  const itemTag = (c) => `${c.packId}:${c.item.id}`;
  const set = [];
  const place = (c, lang) => {
    used.add(itemTag(c));
    set.push({ key: wordKey(c.packId, c.item.id, lang) });
  };

  /* 1 · due reviews. For an item due in both languages, the older due date
     wins; a dead tie rotates by day so neither language monopolises. */
  const due = [];
  let coolingCount = 0;
  for (const c of all) {
    const dueLangs = c.langs.filter((l) => isDue(rowOf(c.packId, c.item.id, l), now));
    if (!dueLangs.length) continue;
    if (itemCooling(c)) {
      coolingCount++;
      continue;
    }
    const lang = dueLangs.slice().sort((a, b) =>
      (rowOf(c.packId, c.item.id, a).dueAt - rowOf(c.packId, c.item.id, b).dueAt)
      || ((dayNumber(now) + hash(c.item.id)) % 2 ? -1 : 1))[0];
    due.push({ c, lang, dueAt: rowOf(c.packId, c.item.id, lang).dueAt });
  }
  due.sort((a, b) => (a.dueAt - b.dueAt) || (a.c.rank - b.c.rank));
  const reviewCap = Math.max(1, Math.floor((size * 2) / 3));
  for (const d of due.slice(0, reviewCap)) place(d.c, d.lang);

  /* 2 · a cooled item's slot goes to an easy win — something well known
     (box 3+), because a child mid-struggle needs a reminder that she is
     good at this, not a harder queue. */
  let replaced = 0;
  if (coolingCount) {
    const easy = all
      .filter((c) => !used.has(itemTag(c)) && !itemCooling(c))
      .map((c) => {
        const lang = c.langs
          .filter((l) => boxOf(rowOf(c.packId, c.item.id, l)) >= 3)
          .sort((a, b) => rowOf(c.packId, c.item.id, a).dueAt - rowOf(c.packId, c.item.id, b).dueAt)[0];
        return lang ? { c, lang, dueAt: rowOf(c.packId, c.item.id, lang).dueAt } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.dueAt - b.dueAt);
    for (const e of easy.slice(0, Math.min(coolingCount, size - set.length))) {
      place(e.c, e.lang);
      replaced++;
    }
  }

  /* 3 · new items. */
  const fresh = [];
  for (const c of all) {
    if (used.has(itemTag(c)) || itemCooling(c)) continue;
    const met = c.langs.filter((l) => boxOf(rowOf(c.packId, c.item.id, l)) > 0);
    if (!met.length) {
      // A brand-new item starts in one language, chosen stably per item so
      // roughly half the pack leads English and half leads Marathi.
      const lang = c.langs[hash(c.item.id) % c.langs.length];
      fresh.push({ c, lang, tier: c.item.tier, rank: c.rank });
    } else {
      const unmet = c.langs.filter((l) => boxOf(rowOf(c.packId, c.item.id, l)) === 0);
      if (!unmet.length) continue;
      const anchor = Math.max(...met.map((l) => boxOf(rowOf(c.packId, c.item.id, l))));
      if (anchor >= 2) fresh.push({ c, lang: unmet[0], tier: c.item.tier, rank: c.rank });
    }
  }
  fresh.sort((a, b) => (a.tier - b.tier) || (a.rank - b.rank));
  for (const f of fresh) {
    if (set.length >= size) break;
    place(f.c, f.lang);
  }

  /* 4 · nothing due and nothing new left: the soonest-due known items come
     round early. A short easy day beats "come back tomorrow". */
  if (set.length < size) {
    const soonest = all
      .filter((c) => !used.has(itemTag(c)) && !itemCooling(c))
      .map((c) => {
        const lang = c.langs
          .filter((l) => boxOf(rowOf(c.packId, c.item.id, l)) > 0)
          .sort((a, b) => rowOf(c.packId, c.item.id, a).dueAt - rowOf(c.packId, c.item.id, b).dueAt)[0];
        return lang ? { c, lang, dueAt: rowOf(c.packId, c.item.id, lang).dueAt } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.dueAt - b.dueAt);
    for (const s of soonest) {
      if (set.length >= size) break;
      place(s.c, s.lang);
    }
  }

  if (!set.length) return [];

  /* Thinking turns: recognition questions on words she already owns, woven
     in after every second word. Only when there is enough known material to
     make a real question, and never more than two — the session is a voice
     session with a little thinking in it, not a quiz. */
  const thinkKeys = pickThinkAnswers(rows, enabledPacks, audible, used, 2, now);
  const out = [];
  let sinceThink = 0;
  let t = 0;
  for (const w of set) {
    out.push({ t: 'w', key: w.key });
    sinceThink++;
    if (sinceThink === 2 && t < thinkKeys.length) {
      out.push({ t: 'q', key: thinkKeys[t++] });
      sinceThink = 0;
    }
  }
  return out;
}

/**
 * Items that can carry a thinking question today: box 2 or better in some
 * audible language, not already in the set (each key appears once per day —
 * the done-list depends on it). Needs three such items overall before it
 * asks anything: a recognition question over two barely-known pictures is
 * a coin flip, not thinking.
 */
export function pickThinkAnswers(rows, enabledPacks, audible, usedItemTags, count = 2, now = Date.now()) {
  rows = rows || {};
  const known = [];
  for (const c of candidates(rows, enabledPacks, audible)) {
    const lang = c.langs
      .filter((l) => boxOf(rows[wordKey(c.packId, c.item.id, l)]) >= 2)
      .sort((a, b) => rows[wordKey(c.packId, c.item.id, a)].dueAt - rows[wordKey(c.packId, c.item.id, b)].dueAt)[0];
    if (lang) known.push({ c, lang });
  }
  if (known.length < 3) return [];

  return known
    .filter(({ c }) => !usedItemTags.has(`${c.packId}:${c.item.id}`))
    .sort((a, b) => hash(a.c.item.id + dayNumber(now)) - hash(b.c.item.id + dayNumber(now)))
    .slice(0, count)
    .map(({ c, lang }) => wordKey(c.packId, c.item.id, lang));
}

/** Where a missed word re-enters the running session: three turns later,
 *  which is far enough to not feel like a correction and near enough that
 *  the sound is still warm. */
export const requeuePosition = (length, index) => Math.min(length, index + 3);

/* Categories whose pictures are SYMBOLS rather than things: a colour disc, a
   shape outline, a numeral. Their distractors must come from the same
   category — asking "where is लाल?" against a circle outline and a numeral
   is a shape question by accident, and worse, a circle answer against two
   colour discs has no right card at all. */
const SYMBOLIC_CATS = new Set(['color', 'shape', 'number', 'size']);

/**
 * Distractor ITEMS for a picture question. Same pack, never the answer,
 * never the answer's own picture (two identical cards make the right answer
 * refusable); prefers items the child has met — confusing two known things
 * is useful practice, guessing between strangers is not (the letter quiz's
 * rule). Distractors are pictures, so they do not need to be audible.
 */
export function wordDistractors(answerKey, rows, count = 2, now = Date.now()) {
  const parsed = parseWordKey(answerKey);
  if (!parsed) return [];
  rows = rows || {};
  const pack = PACKS[parsed.packId];
  if (!pack) return [];

  const target = itemById(parsed.packId, parsed.itemId);
  let pool = pack.items.filter((i) =>
    i.id !== parsed.itemId && (!target || i.emoji !== target.emoji));
  if (target && SYMBOLIC_CATS.has(target.cat)) {
    const sameCat = pool.filter((i) => i.cat === target.cat);
    if (sameCat.length >= count) pool = sameCat;
  }
  if (!pool.length) return [];

  const metIds = new Set();
  for (const i of pool) {
    if (pack.langs.some((l) => boxOf(rows[wordKey(parsed.packId, i.id, l)]) > 0)) metIds.add(i.id);
  }
  const met = pool.filter((i) => metIds.has(i.id));
  const source = met.length >= count ? met : pool;

  const answerTier = target ? target.tier : 1;
  const seed = answerKey + dayKey(now);
  return source
    .slice()
    .sort((a, b) =>
      (Math.abs(a.tier - answerTier) - Math.abs(b.tier - answerTier))
      || (hash(a.id + seed) - hash(b.id + seed)))
    .slice(0, count)
    .map((i) => i.id);
}

/**
 * Build one thinking question: hear the word, find the picture. Error-free
 * exactly like the letter quiz — a wrong tap replays the sound and the card
 * settles back. The payload drops straight into QUIZ_ASK; `scope: 'words'`
 * is what routes the replay button and the completion to the words session.
 */
export function makeThinking(answerKey, rows, now = Date.now()) {
  const parsed = parseWordKey(answerKey);
  if (!parsed) return null;
  const item = itemById(parsed.packId, parsed.itemId);
  if (!item) return null;

  const others = wordDistractors(answerKey, rows, 2, now)
    .map((id) => itemById(parsed.packId, id))
    .filter(Boolean);
  if (!others.length) return null;

  const card = (it) => ({ value: it.id, art: it.emoji, keyword: it.words.en, show: 'art' });
  const cards = layout(card(item), others.map(card), answerKey + dayKey(now));
  return { kind: 'word2picture', scope: 'words', answer: item.id, cards, key: answerKey };
}

/**
 * The card the grown-ups get at night: four words to use out loud at dinner
 * and a couple of authored questions to ask. Misses first — the words she
 * could not give back are the ones dinner can save — then whatever is due
 * tomorrow, then today's new words. Languages alternate so the table hears
 * both. Audibility is irrelevant here: the PARENTS are the voice.
 *
 * @returns {{words:Array, prompts:string[], experiment:object|null}}
 */
export function tonightsCard(rows, dayItems, now = Date.now()) {
  rows = rows || {};
  const today = dayKey(now);
  const items = Array.isArray(dayItems) ? dayItems : [];
  const wordTurns = items.filter((it) => it && it.t === 'w').map((it) => it.key);
  const inDay = new Set(wordTurns);

  const live = Object.keys(rows).filter((k) => rows[k] && typeof rows[k] === 'object');
  const missed = live
    .filter((k) => rows[k].lastMissDay === today)
    .sort((a, b) => rows[b].notYet - rows[a].notYet);

  const dueSoon = live
    .filter((k) => !missed.includes(k) && rows[k].box > 0 && rows[k].dueAt <= now + DAY)
    .sort((a, b) => rows[a].dueAt - rows[b].dueAt);

  const fresh = wordTurns.filter((k) => !missed.includes(k) && !dueSoon.includes(k));

  const seen = new Set();
  const picked = [];
  for (const k of [...missed, ...dueSoon, ...fresh]) {
    const parsed = parseWordKey(k);
    if (!parsed || !itemById(parsed.packId, parsed.itemId)) continue;
    const tag = `${parsed.packId}:${parsed.itemId}`;
    if (seen.has(tag)) continue;
    seen.add(tag);
    picked.push(parsed);
    if (picked.length >= 4) break;
  }

  // Alternate languages where possible, so dinner hears both.
  const byLang = {};
  for (const p of picked) (byLang[p.lang] = byLang[p.lang] || []).push(p);
  const langsHere = Object.keys(byLang);
  let ordered = picked;
  if (langsHere.length > 1) {
    ordered = [];
    let i = 0;
    while (ordered.length < picked.length) {
      const lang = langsHere[i % langsHere.length];
      if (byLang[lang].length) ordered.push(byLang[lang].shift());
      i++;
    }
  }

  const words = ordered.map((p) => {
    const item = itemById(p.packId, p.itemId);
    return {
      packId: p.packId,
      itemId: p.itemId,
      lang: p.lang,
      text: item.words[p.lang],
      emoji: item.emoji,
      langName: LANGS[p.lang] ? LANGS[p.lang].name : p.lang,
      missed: rows[wordKey(p.packId, p.itemId, p.lang)]?.lastMissDay === today,
    };
  });

  /* Prompts come from today's items — authored per item, rotated by day so
     the same question does not arrive every evening. */
  const prompts = [];
  let experiment = null;
  const promptSeen = new Set();
  for (const k of wordTurns) {
    const parsed = parseWordKey(k);
    const item = parsed && itemById(parsed.packId, parsed.itemId);
    if (!item || promptSeen.has(item.id)) continue;
    promptSeen.add(item.id);
    if (item.prompts.length && prompts.length < 3) {
      prompts.push(item.prompts[dayNumber(now) % item.prompts.length]);
    }
    if (!experiment && item.exp) experiment = item.exp;
  }

  return { words, prompts, experiment };
}
