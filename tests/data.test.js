import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, TRACK_IDS, lettersOf, ALL_LETTER_KEYS, letterKey } from '../js/data/tracks.js';
import { STROKES, pickEngine, strokesFor } from '../js/data/strokes.js';
import { SHLOKAS, SHLOKA_LINES } from '../js/data/shlokas.js';
import { pathNumbers } from '../js/trace/geometry.js';

test('every letter in every track has a glyph and a phoneme label', () => {
  for (const id of TRACK_IDS) {
    for (const l of lettersOf(id)) {
      assert.ok(l.glyph, `${id} letter missing a glyph`);
      assert.ok(l.sound, `${id}:${l.glyph} missing a sound label`);
    }
  }
});

/* The gap this closed: ten Devanagari glyphs shipped with an empty keyword and
   a placeholder ✨, which the new listen card is built around. */
test('every Devanagari letter now has a keyword and art', () => {
  for (const l of lettersOf('mr')) {
    assert.ok(l.keyword, `मराठी ${l.glyph} has no keyword`);
    assert.ok(l.art, `मराठी ${l.glyph} has no art`);
  }
});

test('letters that cannot begin a word are flagged rather than implied', () => {
  const medial = lettersOf('mr').filter((l) => l.medial).map((l) => l.glyph);
  for (const g of ['ण', 'ळ', 'ङ', 'ञ', 'अः']) {
    assert.ok(medial.includes(g), `${g} should be marked medial`);
  }
});

test('letter keys are unique across the whole corpus', () => {
  const total = TRACK_IDS.reduce((n, id) => n + lettersOf(id).length, 0);
  assert.equal(ALL_LETTER_KEYS.size, total, 'a duplicate glyph would collide in storage');
  assert.ok(ALL_LETTER_KEYS.has(letterKey('mr', 'क')));
});

test('every glyph resolves to exactly one engine', () => {
  for (const id of TRACK_IDS) {
    for (const l of lettersOf(id)) {
      assert.ok(['stroke', 'mask'].includes(pickEngine(l.glyph)));
    }
  }
});

/* The ship gate. Devanagari stroke order has not been reviewed by anyone who
   teaches the script, so it must not be taught. If this test starts failing,
   somebody flipped a `reviewed` flag — make sure that was deliberate. */
test('no unreviewed glyph is taught by the stroke engine', () => {
  for (const [glyph, entry] of Object.entries(STROKES)) {
    if (entry.reviewed) continue;
    assert.equal(pickEngine(glyph), 'mask', `${glyph} is unreviewed but routed to the stroke engine`);
    assert.deepEqual(strokesFor(glyph), [], `${glyph} must expose no paths while unreviewed`);
  }
});

test('every stroke path parses to at least two coordinate pairs', () => {
  for (const [glyph, entry] of Object.entries(STROKES)) {
    for (const d of entry.d) {
      assert.ok(pathNumbers(d).length >= 4, `${glyph}: "${d}" is not a drawable path`);
    }
  }
});

test('all 26 Latin capitals have reviewed stroke data', () => {
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    assert.ok(STROKES[ch]?.reviewed, `${ch} has no reviewed stroke order`);
    assert.equal(pickEngine(ch), 'stroke');
  }
});

test('Devanagari stroke seeds end with the stem then the shirorekha', () => {
  for (const [glyph, entry] of Object.entries(STROKES)) {
    if (entry.reviewed) continue;
    const [stem, bar] = entry.d.slice(-2);
    assert.equal(stem, 'M70,24 L70,86', `${glyph}: stem should be second to last`);
    assert.equal(bar, 'M20,24 L82,24', `${glyph}: शिरोरेखा should be last`);
  }
});

test('shloka lines carry a transliteration and a meaning', () => {
  assert.equal(SHLOKA_LINES.length, SHLOKAS.reduce((n, s) => n + s.lines.length, 0));
  for (const line of SHLOKA_LINES) {
    assert.ok(line.text && line.tr && line.meaning, `incomplete line: ${line.id}`);
  }
});

test('the Sanskrit track requests its own language, not Hindi', () => {
  // Asking for hi-IN here would silently hand shlokas to a Hindi voice, which
  // is the exact failure the language-match guard exists to prevent.
  assert.equal(TRACKS.sa.lang, 'sa');
  assert.equal(TRACKS.sa.traceable, false);
});
