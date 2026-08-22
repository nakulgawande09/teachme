/**
 * Pack 2 — animals & nature.
 *
 * Rich in relations on purpose: who lives where, who goes with whom, who
 * makes which sound. The goes-together questions and half the dinner
 * prompts are generated from these pairs, so this is the pack where the
 * thinking activities get real teeth.
 */

const w = (id, emoji, en, mr, opts = {}) => Object.freeze({
  id,
  emoji,
  words: Object.freeze({ en, mr }),
  cat: opts.cat || 'animal',
  rel: Object.freeze(opts.rel || {}),
  tier: opts.tier || 1,
  prompts: Object.freeze(opts.prompts || []),
  exp: opts.exp || null,
});

export const ANIMALS = Object.freeze({
  id: 'animals',
  name: 'Animals & nature',
  langs: Object.freeze(['en', 'mr']),
  items: Object.freeze([
    w('monkey', '🐵', 'monkey', 'माकड', {
      rel: { goesWith: ['parrot'] },
      prompts: ['Jump like a monkey together. Then walk like an elephant. Which was harder?'],
    }),
    w('elephant', '🐘', 'elephant', 'हत्ती', {
      rel: { goesWith: ['lion'] },
      prompts: ['Ask: what is big on an elephant? Ears, trunk, feet — point at your own.'],
    }),
    w('lion', '🦁', 'lion', 'सिंह', {
      rel: { goesWith: ['tiger'] },
      prompts: ['Roar quietly, then loudly. Ask: which animal roars?'],
    }),
    w('tiger', '🐯', 'tiger', 'वाघ', {
      rel: { goesWith: ['lion'] },
      prompts: ['Ask: tiger and lion — how are they the same? How are they different?'],
    }),
    w('rabbit', '🐰', 'rabbit', 'ससा', {
      rel: { goesWith: ['mouse'] },
      prompts: ['Hop like rabbits to the kitchen. Ask: does a rabbit walk or hop?'],
    }),
    w('mouse', '🐭', 'mouse', 'उंदीर', {
      rel: { goesWith: ['rabbit'] },
      prompts: ['Ask: who is bigger, the mouse or the elephant? Who is faster?'],
    }),
    w('horse', '🐴', 'horse', 'घोडा', {
      rel: { goesWith: ['elephant'] },
      prompts: ['Ask: who can ride a horse? Gallop around the room together.'],
    }),
    w('hen', '🐔', 'hen', 'कोंबडी', {
      rel: { goesWith: ['egg'] },
      prompts: ['Ask: what does the hen give us? Find an egg in the kitchen.'],
    }),
    w('duck', '🦆', 'duck', 'बदक', {
      rel: { goesWith: ['frog'] },
      prompts: ['At bath time: can a duck swim? Can you? Ask what else swims.'],
    }),
    w('frog', '🐸', 'frog', 'बेडूक', {
      rel: { goesWith: ['duck'] },
      prompts: ['Jump like frogs. Ask: where does a frog live — water or a tree?'],
    }),
    w('butterfly', '🦋', 'butterfly', 'फुलपाखरू', {
      rel: { goesWith: ['bee'] },
      prompts: ['Ask: where does a butterfly go? Look for one near flowers tomorrow.'],
    }),
    w('ant', '🐜', 'ant', 'मुंगी', {
      tier: 2, rel: { goesWith: ['bee'] },
      prompts: ['Find a real ant on a walk. Ask: is it big or small? Where is it going?'],
    }),
    w('bee', '🐝', 'bee', 'मधमाशी', {
      tier: 2, rel: { goesWith: ['butterfly'] },
      prompts: ['Ask: what does the bee make? Taste a little honey together and say the word.'],
    }),
    w('peacock', '🦚', 'peacock', 'मोर', {
      rel: { goesWith: ['parrot'] },
      prompts: ['Ask: what happens when the peacock dances? Spread your arms like feathers.'],
    }),
    w('parrot', '🦜', 'parrot', 'पोपट', {
      rel: { goesWith: ['crow'] },
      prompts: ['Play parrot: whatever you say, your child repeats. Then swap.'],
    }),
    w('crow', '🐦‍⬛', 'crow', 'कावळा', {
      rel: { goesWith: ['nest'] },
      prompts: ['Listen from the window: can you hear a crow? What does it say?'],
    }),
    w('egg', '🥚', 'egg', 'अंडं', {
      rel: { goesWith: ['hen'] },
      prompts: ['Ask: what comes out of an egg? Who else lays eggs — hen, duck, crow?'],
    }),
    w('nest', '🪺', 'nest', 'घरटं', {
      tier: 2, rel: { goesWith: ['crow'] },
      prompts: ['Ask: the bird\'s house is a nest — what is our house called? Who made the nest?'],
    }),
    w('rain', '🌧️', 'rain', 'पाऊस', {
      cat: 'nature', tier: 2, rel: { goesWith: ['cloud'] },
      prompts: ['Next rain: watch from the window and say the word. Where does rain come from?'],
    }),
    w('cloud', '☁️', 'cloud', 'ढग', {
      cat: 'nature', tier: 2, rel: { goesWith: ['rain'] },
      prompts: ['Look up together: what do the clouds look like today? An animal? A boat?'],
    }),
  ]),
});
