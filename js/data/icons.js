/**
 * Hand-rolled inline SVG icons. 24x24 viewBox, round caps, no fill unless
 * stated. Colour comes from `stroke="currentColor"` so a button's own colour
 * drives it — that is why there is no hard-coded ink value in here.
 *
 * Deliberately not emoji: emoji render differently on every platform, and the
 * design's whole register depends on these being flat block-print marks.
 */

const wrap = (body, w = 30) =>
  `<svg class="icon" width="${w}" height="${w}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;

const line = (d, width = 2, extra = '') =>
  `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${extra ? ' ' + extra : ''}/>`;

export const ICONS = Object.freeze({
  home:   (w) => wrap(line('M4 11 L12 4 L20 11 V20 H4 Z', 2), w),
  back:   (w) => wrap(line('M15 5 L8 12 L15 19', 2.5), w),
  replay: (w) => wrap(line('M20 12 a8 8 0 1 1 -3 -6.2', 2.2) + line('M20 3.5 V9 H14.5', 2.2), w),
  next:   (w) => wrap(line('M6 12 H18', 2.6) + line('M13 6 L19 12 L13 18', 2.6), w),
  check:  (w) => wrap(line('M5 13 L10 18 L19 7', 2.8), w),
  close:  (w) => wrap(line('M6 6 L18 18 M18 6 L6 18', 2.4), w),
  play:   (w) => wrap('<path d="M8 5 L19 12 L8 19 Z" fill="currentColor"/>', w),

  /* filled cone + one arc: reads as a speaker at 30px and at 42px */
  speaker: (w) => wrap(
    '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>' + line('M17 8.6 a5 5 0 0 1 0 6.8', 2),
    w
  ),

  /* a wobbling pencil line with a nib dot — "trace this" */
  trace: (w) => wrap(
    line('M4 18 C8 8 14 16 20 6', 2.2, 'stroke-dasharray="3 4"') +
    '<circle cx="20" cy="6" r="3.2" fill="currentColor"/>',
    w
  ),

  /* direction arrow drawn on the slate, rotated to the stroke's exit tangent */
  arrowTip: (w) => wrap(line('M8 6 L16 13 L8 20', 3), w),
});

/** @returns {string} SVG markup, or '' for an unknown name (never throws). */
export function icon(name, size = 30) {
  const make = ICONS[name];
  if (!make) {
    console.warn('icon: unknown name', name);
    return '';
  }
  return make(size);
}
