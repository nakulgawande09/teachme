/**
 * Teaching order — which letter a child meets next.
 *
 * Deliberately NOT alphabetical. A–Z is a memorisation sequence, not an
 * instructional one: it front-loads A, B, C (two of which are visually and
 * aurally confusable) and buries the letters that actually build words.
 *
 * The grid still shows letters in the familiar order, because that is what a
 * parent expects to see and what a wall chart at home will match. Only the
 * daily set follows this sequence. The two never have to agree.
 */

/**
 * English follows the well-trodden `satpin` opening: those six letters alone
 * build sat, tin, pan, nap, sit, pit — so a child can read a real word within
 * the first week rather than after twenty-six of them.
 */
export const EN_ORDER = Object.freeze([
  's', 'a', 't', 'p', 'i', 'n',
  'm', 'd', 'g', 'o', 'c', 'k',
  'e', 'u', 'r', 'h', 'b', 'f', 'l',
  'j', 'v', 'w', 'x', 'y', 'z', 'q',
].map((c) => c.toUpperCase()));

/**
 * Marathi: स्वर first — every consonant is built on those sounds — then
 * व्यंजन in small groups, simplest shapes and commonest words first.
 * ङ and ञ come last because they only ever appear inside conjuncts, and
 * क्ष / ज्ञ last of all because they are conjuncts themselves.
 */
export const MR_ORDER = Object.freeze([
  'अ', 'आ', 'इ', 'ई', 'उ', 'ऊ', 'ए', 'ऐ', 'ओ', 'औ', 'अं', 'अः',
  'क', 'म', 'ग', 'स', 'प', 'ब',
  'त', 'न', 'ल', 'व', 'ह', 'र',
  'द', 'ज', 'य', 'श', 'भ', 'ध',
  'थ', 'च', 'ख', 'घ', 'फ', 'ट',
  'ठ', 'ड', 'ढ', 'झ', 'छ', 'ण',
  'ष', 'ळ', 'ङ', 'ञ', 'क्ष', 'ज्ञ',
]);

const ORDERS = Object.freeze({ en: EN_ORDER, mr: MR_ORDER, sa: Object.freeze([]) });

/** Teaching order for a track, or [] for a track with no daily set. */
export const orderFor = (trackId) => ORDERS[trackId] || [];

/** Position in the teaching sequence; unknown glyphs sort to the end. */
export function rankOf(trackId, glyph) {
  const i = orderFor(trackId).indexOf(glyph);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}
