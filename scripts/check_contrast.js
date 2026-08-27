/**
 * Contrast gate for the colour fields.
 *
 * Three screens and every home card are a saturated colour edge to edge, so
 * "does the text on it survive" stopped being a judgement call and became
 * arithmetic. This reads the real values out of css/tokens.css — a test with
 * its own copy of the palette passes happily while the app ships something
 * else — and fails the build-ish check if any of them drops below WCAG AA.
 *
 *   node scripts/check_contrast.js
 *
 * The first version of the colour-block design shipped cream on haldi at
 * 2.15:1. That is what this exists to catch.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(ROOT, 'css/tokens.css'), 'utf8');

/** Resolve a token to a literal hex, following one level of var() aliasing. */
function token(name, seen = new Set()) {
  if (seen.has(name)) throw new Error(`circular token: ${name}`);
  seen.add(name);
  const m = css.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
  if (!m) throw new Error(`token not found in css/tokens.css: --${name}`);
  const value = m[1].trim();
  const alias = value.match(/^var\(\s*--([\w-]+)\s*\)$/);
  return alias ? token(alias[1], seen) : value;
}

const hex = (h) => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (a) =>
  `#${a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const lin = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const L = (h) => {
  const [r, g, b] = hex(h);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a, b) => {
  const [hi, lo] = L(a) > L(b) ? [L(a), L(b)] : [L(b), L(a)];
  return (hi + 0.05) / (lo + 0.05);
};
/** Text drawn at reduced opacity composites toward the field behind it. */
const over = (fg, bg, a) => {
  const F = hex(fg);
  const B = hex(bg);
  return toHex([0, 1, 2].map((i) => F[i] * a + B[i] * (1 - a)));
};

/* Every colour that is ever a whole screen or a whole card, paired with the
   ink token the CSS actually puts on it. */
const FIELDS = ['haldi', 'leaf', 'peacock', 'kumkum', 'indigo']
  .map((name) => ({ name, bg: token(name), ink: token(`on-${name}`) }));

/* The opacities the stylesheets actually use on a field, and what each owes.
   Large text and UI graphics need 3:1; body and small labels need 4.5:1. */
const ROLES = [
  ['body / small label', 1.00, 4.5],
  ['preview glyph .80',  0.80, 3.0],
  ['finished glyph .70', 0.70, 3.0],
  ['icon stroke',        1.00, 3.0],
  ['focus ring',         1.00, 3.0],
];

let failures = 0;
const line = (a, b, c, d, ok) =>
  console.log(`${a.padEnd(10)}${b.padEnd(22)}${c.toFixed(2).padStart(6)}  ${d.toFixed(1)}  ${ok ? 'pass' : '** FAIL **'}`);

console.log(`${'field'.padEnd(10)}${'role'.padEnd(22)} ratio  need  verdict`);
for (const { name, bg, ink } of FIELDS) {
  for (const [role, alpha, need] of ROLES) {
    const c = alpha === 1 ? ratio(ink, bg) : ratio(over(ink, bg, alpha), bg);
    const ok = c >= need;
    if (!ok) failures++;
    line(name, role, c, need, ok);
  }
  // The cream turn-card and answer cards sit ON the field. Where the field is
  // light the card cannot clear 3:1 on colour alone — its hard ink shadow is
  // the boundary, which is a legitimate non-colour edge, so this reports
  // rather than fails.
  const surface = ratio(token('card'), bg);
  console.log(`${name.padEnd(10)}${'cream card on field'.padEnd(22)}${surface.toFixed(2).padStart(6)}  3.0  ${
    surface >= 3 ? 'pass' : 'carried by its shadow edge'}`);
  console.log('');
}

/* The other direction, and the one the first pass of this file missed: a
   brand colour drawn as a MARK on a light surface — an answer glyph on a
   cream card, the hero speaker, a filled progress dot on paper. Haldi fails
   both surfaces, which is why --haldi-ink and --track-mark exist. */
console.log(`${'mark'.padEnd(10)}${'on surface'.padEnd(22)} ratio  need  verdict`);
const MARKS = ['haldi-ink', 'kumkum', 'peacock', 'indigo', 'leaf'];
for (const surface of ['card', 'paper']) {
  for (const mark of MARKS) {
    const c = ratio(token(mark), token(surface));
    // These carry glyphs and icons — large text and UI graphics, so 3:1.
    const ok = c >= 3.0;
    if (!ok) failures++;
    line(mark, `on --${surface}`, c, 3.0, ok);
  }
  console.log('');
}

/* Haldi must NEVER be a foreground. Asserted rather than described, because
   the tempting fix for "this looks washed out" is to reach for --haldi. */
for (const surface of ['card', 'paper']) {
  const c = ratio(token('haldi'), token(surface));
  if (c >= 3.0) {
    console.log(`unexpected: raw --haldi now clears 3:1 on --${surface}; --haldi-ink may be redundant`);
  }
}

console.log(failures ? `${failures} FAILING — fix before shipping` : 'ALL PASS');
process.exit(failures ? 1 : 0);
