/**
 * Pack 5 — STEM intro.
 *
 * Honest STEM for a two-year-old is not facts, it is properties and
 * cause-and-effect: hot/cold, wet/dry, floats/sinks, heavy/light. Every
 * pair here is an opposite (the goesWith relation IS the opposite), and
 * the load-bearing part of this pack is the `exp` field — a two-minute
 * home experiment the tonight card hands the parents, because prediction
 * ("what will happen?") is the first scientific act a child can perform.
 */

const w = (id, emoji, en, mr, opts = {}) => Object.freeze({
  id,
  emoji,
  words: Object.freeze({ en, mr }),
  cat: opts.cat || 'property',
  rel: Object.freeze(opts.rel || {}),
  tier: opts.tier || 2,
  prompts: Object.freeze(opts.prompts || []),
  exp: opts.exp || null,
});

export const STEM = Object.freeze({
  id: 'stem',
  name: 'STEM intro',
  langs: Object.freeze(['en', 'mr']),
  items: Object.freeze([
    w('hot', '🔥', 'hot', 'गरम', {
      rel: { goesWith: ['cold'] },
      prompts: ['At dinner: which dish is hot, which is cold? Hover a hand over each first.'],
      exp: {
        title: 'Two bowls',
        steps: [
          'One bowl of fridge-cold water, one warm from the tap (never hot).',
          'Before touching each, ask: गरम की थंड? Hot or cold?',
          'Dip a finger in each and say the answer together. Then swap hands.',
        ],
      },
    }),
    w('cold', '🧊', 'cold', 'थंड', {
      rel: { goesWith: ['hot'] },
      prompts: ['Open the fridge together: what is cold in there? What makes it cold?'],
    }),
    w('wet', '💦', 'wet', 'ओलं', {
      rel: { goesWith: ['dry'] },
      prompts: ['After washing hands: are they wet or dry? And after the towel?'],
      exp: {
        title: 'The sponge',
        steps: [
          'A dry sponge and a cup of water.',
          'Ask first: what will happen if we dip it?',
          'Dip, squeeze, feel — say ओलं and कोरडं at each step.',
        ],
      },
    }),
    w('dry', '🍂', 'dry', 'कोरडं', {
      rel: { goesWith: ['wet'] },
      prompts: ['Hang one wet sock and check it after dinner: what happened? Where did the water go?'],
    }),
    w('up', '⬆️', 'up', 'वर', {
      cat: 'direction', rel: { goesWith: ['down'] },
      prompts: ['Ask: what is up in this room? What is down? Point with the whole arm.'],
    }),
    w('down', '⬇️', 'down', 'खाली', {
      cat: 'direction', rel: { goesWith: ['up'] },
      prompts: ['Drop a spoon (safely): which way did it go? Does anything fall UP?'],
    }),
    w('fast', '🐇', 'fast', 'पटपट', {
      rel: { goesWith: ['slow'] },
      prompts: ['Race to the door fast, come back slow. Which took longer?'],
    }),
    w('slow', '🐢', 'slow', 'हळू', {
      rel: { goesWith: ['fast'] },
      prompts: ['Eat one bite in slow motion together. Ask: who walks slowly — a tortoise or a rabbit?'],
    }),
    w('float', '🛟', 'float', 'तरंगतं', {
      tier: 3, rel: { goesWith: ['sink'] },
      prompts: ['Ask in the bath: will the duck float or sink? And the soap?'],
      exp: {
        title: 'Floats or sinks — the bath game',
        steps: [
          'Collect a plastic duck or lid, a metal spoon, a soap, a leaf.',
          'Before each one ask: तरंगेल की बुडेल? Float or sink? Wait for a guess.',
          'Drop it in. Say what happened. A wrong guess is the best part — guess again tomorrow.',
        ],
      },
    }),
    w('sink', '⚓', 'sink', 'बुडतं', {
      tier: 3, rel: { goesWith: ['float'] },
      prompts: ['Ask: why did the spoon go down but the duck stayed up? Any answer is a good answer.'],
    }),
    w('heavy', '🪨', 'heavy', 'जड', {
      rel: { goesWith: ['light'] },
      prompts: ['Ask before lifting: which bag is heavy? Then let your child check both.'],
      exp: {
        title: 'The two bags',
        steps: [
          'Two identical bags: one with a book, one with a sock.',
          'Ask first: which one is जड — heavy? Point before touching.',
          'Lift both. Now hide-and-swap them and play again.',
        ],
      },
    }),
    w('light', '🎈', 'light', 'हलकं', {
      rel: { goesWith: ['heavy'] },
      prompts: ['Blow a feather or a scrap of paper: why does it fly? Try blowing a spoon.'],
    }),
    w('day', '🌅', 'day', 'दिवस', {
      cat: 'time', rel: { goesWith: ['night'] },
      prompts: ['Ask at breakfast: is it day or night? How do you know? Look outside.'],
    }),
    w('night', '🌃', 'night', 'रात्र', {
      cat: 'time', rel: { goesWith: ['day'] },
      prompts: ['At lights-off: what happens at night? Who sleeps? Does the sun sleep?'],
    }),
    w('wheel', '🛞', 'wheel', 'चाक', {
      cat: 'machine', rel: { goesWith: ['fast'] },
      prompts: ['Ask: what has wheels in our house? Why wheels and not squares?'],
      exp: {
        title: 'What rolls?',
        steps: [
          'Gather a ball, a bottle, a book, a banana.',
          'Ask before each: will it roll? गडगडेल का?',
          'Roll them down a cushion slope. Sort into "rolls" and "does not".',
        ],
      },
    }),
  ]),
});
