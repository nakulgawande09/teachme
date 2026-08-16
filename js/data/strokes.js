/**
 * Stroke-order paths, in a 0–100 viewBox, listed in WRITING order.
 *
 * `reviewed` is the ship gate, and it is data rather than code on purpose:
 * a glyph is only taught by the stroke engine once a human who teaches this
 * script has signed off on the order and direction. Everything else falls
 * back to the mask engine, which never claims to know a direction. Flipping
 * one boolean ships the stroke-order lesson for a glyph — no code change.
 *
 * Why that gate exists: handwriting habits are sticky. Teaching a child the
 * wrong stroke order is worse than teaching them no stroke order at all.
 *
 * Latin: reviewed. Standard uppercase order — verticals before diagonals,
 * crossbars last.
 *
 * Devanagari: NOT reviewed. The six entries below came from the design
 * mockups, whose own notes call them "engineering placeholders pending review
 * by a Marathi teacher or type designer". They are kept as a seed for that
 * authoring pass. Note the shape the review must preserve: the vertical stem
 * and then the शिरोरेखा are always the LAST two strokes, which is correct
 * teaching order.
 */

const s = (reviewed, d) => Object.freeze({ reviewed, d: Object.freeze(d) });

export const STROKES = Object.freeze({
  /* ── Latin, reviewed ─────────────────────────────────────────────────── */
  A: s(true,  ['M28,88 L50,14', 'M50,14 L72,88', 'M36,58 L64,58']),
  B: s(true,  ['M32,14 L32,88', 'M32,14 C64,14 66,48 34,50', 'M34,50 C70,50 70,88 32,88']),
  C: s(true,  ['M74,28 C56,8 24,18 24,51 C24,84 56,94 74,74']),
  D: s(true,  ['M32,14 L32,88', 'M32,14 C80,18 80,84 32,88']),
  E: s(true,  ['M34,14 L34,88', 'M34,14 L70,14', 'M34,51 L64,51', 'M34,88 L70,88']),
  F: s(true,  ['M34,14 L34,88', 'M34,14 L70,14', 'M34,51 L64,51']),
  G: s(true,  ['M74,28 C56,8 24,18 24,51 C24,84 56,94 74,74', 'M74,74 L74,54 L56,54']),
  H: s(true,  ['M30,14 L30,88', 'M70,14 L70,88', 'M30,51 L70,51']),
  I: s(true,  ['M50,14 L50,88', 'M34,14 L66,14', 'M34,88 L66,88']),
  J: s(true,  ['M64,14 L64,72 C64,88 44,92 36,78']),
  K: s(true,  ['M32,14 L32,88', 'M70,14 L34,52', 'M40,46 L72,88']),
  L: s(true,  ['M34,14 L34,88', 'M34,88 L70,88']),
  M: s(true,  ['M22,88 L22,14', 'M22,14 L50,60', 'M50,60 L78,14', 'M78,14 L78,88']),
  N: s(true,  ['M28,88 L28,14', 'M28,14 L72,88', 'M72,88 L72,14']),
  O: s(true,  ['M50,14 C26,14 20,36 20,51 C20,66 26,88 50,88 C74,88 80,66 80,51 C80,36 74,14 50,14']),
  P: s(true,  ['M32,14 L32,88', 'M32,14 C70,16 70,52 32,52']),
  Q: s(true,  ['M50,14 C26,14 20,36 20,51 C20,66 26,88 50,88 C74,88 80,66 80,51 C80,36 74,14 50,14', 'M60,70 L82,94']),
  R: s(true,  ['M32,14 L32,88', 'M32,14 C70,16 70,50 32,50', 'M32,50 L72,88']),
  S: s(true,  ['M72,26 C62,10 30,10 30,32 C30,50 70,46 70,68 C70,90 36,92 26,74']),
  T: s(true,  ['M50,14 L50,88', 'M26,14 L74,14']),
  U: s(true,  ['M28,14 L28,62 C28,84 72,84 72,62 L72,14']),
  V: s(true,  ['M26,14 L50,88', 'M50,88 L74,14']),
  W: s(true,  ['M20,14 L34,88', 'M34,88 L50,38', 'M50,38 L66,88', 'M66,88 L80,14']),
  X: s(true,  ['M28,14 L72,88', 'M72,14 L28,88']),
  Y: s(true,  ['M28,14 L50,50', 'M72,14 L50,50', 'M50,50 L50,88']),
  Z: s(true,  ['M28,14 L72,14 L28,88 L72,88']),

  /* ── Devanagari, NOT reviewed — mask engine handles these today ──────── */
  'क': s(false, ['M34,34 C20,44 20,64 32,70 C42,74 46,62 36,56', 'M36,56 L70,56', 'M70,24 L70,86', 'M20,24 L82,24']),
  'ग': s(false, ['M32,28 C30,54 36,70 50,66', 'M70,24 L70,86', 'M20,24 L82,24']),
  'प': s(false, ['M30,28 C26,52 34,70 50,68 C60,66 58,52 46,50', 'M70,24 L70,86', 'M20,24 L82,24']),
  'ब': s(false, ['M34,32 C22,44 24,66 40,70 C56,74 62,58 50,50', 'M34,48 L52,48', 'M70,24 L70,86', 'M20,24 L82,24']),
  'म': s(false, ['M44,44 C30,44 22,56 26,68 C31,79 46,78 46,66', 'M46,66 C50,48 62,40 70,45', 'M70,24 L70,86', 'M20,24 L82,24']),
  'स': s(false, ['M28,30 C22,50 30,62 42,58 C50,55 48,44 38,44', 'M46,32 C44,52 48,66 60,70', 'M70,24 L70,86', 'M20,24 L82,24']),
});

/**
 * Which trace engine teaches this glyph.
 * `mask` is not a degraded mode — it is the honest one for a glyph whose
 * stroke order we have not had reviewed.
 * @returns {'stroke'|'mask'}
 */
export function pickEngine(glyph) {
  const entry = STROKES[glyph];
  return entry && entry.reviewed === true ? 'stroke' : 'mask';
}

/** @returns {string[]} ordered path `d` strings, or [] when unavailable. */
export function strokesFor(glyph) {
  const entry = STROKES[glyph];
  return entry && entry.reviewed === true ? entry.d.slice() : [];
}
