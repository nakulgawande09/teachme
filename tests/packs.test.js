import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PACKS, PACK_IDS, LANGS, LANG_IDS, itemsOf, itemById,
  wordKey, parseWordKey, ALL_WORD_KEYS, wordClipKey,
} from '../js/data/packs/index.js';

test('every pack declares only known languages, and every item covers them all', () => {
  for (const packId of PACK_IDS) {
    const pack = PACKS[packId];
    assert.ok(pack.langs.length >= 1, `${packId}: no languages`);
    for (const lang of pack.langs) {
      assert.ok(LANG_IDS.includes(lang), `${packId}: unknown language "${lang}"`);
    }
    for (const item of pack.items) {
      for (const lang of pack.langs) {
        assert.ok(item.words[lang], `${packId}:${item.id} has no ${lang} word`);
      }
    }
  }
});

test('every item has an id, art, a category and a sane tier', () => {
  for (const packId of PACK_IDS) {
    for (const item of itemsOf(packId)) {
      assert.match(item.id, /^[a-z][a-z0-9-]*$/, `${packId}: "${item.id}" is not a stable ascii id`);
      assert.ok(item.emoji, `${packId}:${item.id} has no art`);
      assert.ok(item.cat, `${packId}:${item.id} has no category`);
      assert.ok(item.tier >= 1 && item.tier <= 3, `${packId}:${item.id} tier out of range`);
    }
  }
});

/* Item ids are storage keys. A duplicate would silently merge two words'
   schedules; a renamed id would orphan a child's progress. */
test('item ids are unique within a pack and word keys unique across the corpus', () => {
  for (const packId of PACK_IDS) {
    const ids = itemsOf(packId).map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length, `${packId}: duplicate item id`);
  }
  const expected = PACK_IDS.reduce(
    (n, p) => n + itemsOf(p).length * PACKS[p].langs.length, 0);
  assert.equal(ALL_WORD_KEYS.size, expected);
  assert.ok(ALL_WORD_KEYS.has(wordKey('objects', 'cup', 'mr')));
});

test('word keys round-trip through the parser', () => {
  const parsed = parseWordKey(wordKey('objects', 'cup', 'en'));
  assert.deepEqual(parsed, { packId: 'objects', itemId: 'cup', lang: 'en' });
  assert.equal(parseWordKey('nonsense'), null);
  assert.equal(parseWordKey(''), null);
});

/* Word clips must never collide with letter clips: the letter namespace is
   `<trackId>/<glyph>/<kind>` and every word clip key starts `w/`. */
test('word clip keys live in their own namespace', () => {
  assert.equal(wordClipKey('objects', 'cup', 'mr'), 'w/mr/objects/cup');
  for (const packId of PACK_IDS) {
    for (const item of itemsOf(packId)) {
      for (const lang of PACKS[packId].langs) {
        assert.ok(wordClipKey(packId, item.id, lang).startsWith('w/'));
      }
    }
  }
});

/* goesWith is what "which two go together?" is generated from; a target that
   does not resolve would put a blank card in front of a child. */
test('every relation target resolves to an item in the same pack', () => {
  for (const packId of PACK_IDS) {
    for (const item of itemsOf(packId)) {
      for (const target of item.rel.goesWith || []) {
        assert.ok(itemById(packId, target), `${packId}:${item.id} goesWith unknown "${target}"`);
        assert.notEqual(target, item.id, `${packId}:${item.id} goes with itself`);
      }
    }
  }
});

/* The tonight card needs something to hand the parents. Not every item needs
   a prompt, but a pack where hardly any item has one starves the card. */
test('most items in a pack carry a parent prompt', () => {
  for (const packId of PACK_IDS) {
    const items = itemsOf(packId);
    const withPrompts = items.filter((i) => i.prompts.length > 0);
    assert.ok(withPrompts.length >= items.length * 0.6,
      `${packId}: only ${withPrompts.length}/${items.length} items have prompts`);
  }
});

test('the objects pack is the size the daily maths assumes', () => {
  const n = itemsOf('objects').length;
  assert.ok(n >= 25 && n <= 35, `objects pack has ${n} items`);
});

/* Prediction — "what will happen?" — is the point of the STEM pack; the
   experiments are what the tonight card hands the parents. */
test('the STEM pack carries real home experiments', () => {
  const exps = itemsOf('stem').filter((i) => i.exp);
  assert.ok(exps.length >= 3, `only ${exps.length} STEM items have an experiment`);
  for (const item of exps) {
    assert.ok(item.exp.title, `${item.id}: experiment has no title`);
    assert.ok(Array.isArray(item.exp.steps) && item.exp.steps.length >= 2,
      `${item.id}: an experiment needs at least two steps`);
  }
});

/* Every STEM property pairs with its opposite — that pairing is the
   goes-together question AND the dinner conversation. */
test('STEM opposites point at each other', () => {
  for (const item of itemsOf('stem')) {
    const partner = (item.rel.goesWith || [])[0];
    if (!partner) continue;
    const other = itemsOf('stem').find((i) => i.id === partner);
    assert.ok(other, `${item.id}: partner ${partner} missing`);
  }
});

/* Two items with the same picture in one pack can end up side by side in a
   picture question — and then the right answer is refusable. */
test('no two items in a pack share a picture', () => {
  for (const packId of PACK_IDS) {
    const emoji = itemsOf(packId).map((i) => i.emoji);
    assert.equal(new Set(emoji).size, emoji.length, `${packId}: duplicate emoji`);
  }
});

test('pack data is deeply frozen — the scheduler must not be able to bend it', () => {
  const item = itemById('objects', 'cup');
  assert.ok(Object.isFrozen(item));
  assert.ok(Object.isFrozen(item.words));
  assert.ok(Object.isFrozen(item.rel));
  assert.ok(Object.isFrozen(PACKS.objects.items));
});
