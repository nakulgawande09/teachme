import { OBJECTS } from './objects.js';

/**
 * The pack registry — "learn almost anything" as data, not code.
 *
 * A pack is a topic: ~15-30 everyday things, each with a picture (emoji until
 * commissioned art lands, same as the letters), a word in every language the
 * pack teaches, and enough structure — category, relations, parent prompts —
 * for the thinking activities and the tonight card to be generated rather
 * than hand-authored per feature.
 *
 * Adding a topic = one data file + one line in PACKS below.
 * Adding a language = one entry in LANGS + a `words` value per item.
 * Nothing in the engine changes for either.
 */

/** The languages the words mode can teach. The ONE place a language is
 *  declared; `tag` is what the audio layer asks the device for, and the
 *  resolver's language-match guard makes that request honest. */
export const LANGS = Object.freeze({
  en: Object.freeze({ tag: 'en-IN', name: 'English' }),
  mr: Object.freeze({ tag: 'mr-IN', name: 'मराठी' }),
});

export const LANG_IDS = Object.freeze(Object.keys(LANGS));

export const PACKS = Object.freeze({
  objects: OBJECTS,
});

export const PACK_IDS = Object.freeze(Object.keys(PACKS));

/** Flat item list for a pack, or [] for an unknown one. */
export function itemsOf(packId) {
  const pack = PACKS[packId];
  if (!pack) {
    console.warn('packs: unknown pack', packId);
    return [];
  }
  return pack.items;
}

export function itemById(packId, itemId) {
  return itemsOf(packId).find((item) => item.id === itemId) || null;
}

/**
 * Scheduling key for one (item × language) — the unit the Leitner boxes
 * track, because knowing "cup" in English and knowing "कप" in Marathi are two
 * different memories. Stable across releases — do not change.
 */
export const wordKey = (packId, itemId, lang) => `${packId}:${itemId}:${lang}`;

export function parseWordKey(key) {
  const [packId, itemId, lang] = String(key || '').split(':');
  if (!packId || !itemId || !lang) return null;
  return { packId, itemId, lang };
}

/** Every valid word key, used to filter junk out of stored progress. */
export const ALL_WORD_KEYS = Object.freeze(
  new Set(PACK_IDS.flatMap((packId) =>
    itemsOf(packId).flatMap((item) =>
      PACKS[packId].langs.map((lang) => wordKey(packId, item.id, lang)))))
);

/**
 * Audio clip id for one spoken word. Shared by the shipped manifest and the
 * parent-recorded clips; the `w/` prefix keeps it disjoint from the letter
 * clip namespace (`<trackId>/<glyph>/<kind>` in js/audio/resolver.js).
 */
export const wordClipKey = (packId, itemId, lang) => `w/${lang}/${packId}/${itemId}`;
