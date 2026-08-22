/**
 * Pack 1 — everyday things.
 *
 * Thirty objects a two-year-old already knows by sight. That is the point:
 * she is learning the SOUND in each language, never the concept, so every
 * item here must be something she can point at in her own house.
 *
 * Field notes:
 *   emoji    placeholder art, shown large in a square frame. Commissioned
 *            illustration drops in later as /art/words/<pack>/<id>.svg.
 *   words    parent-facing text and the string handed to a matching TTS
 *            voice. The child never sees it — her screen has no text.
 *   cat      category, which the thinking activities group and contrast by.
 *   rel      goesWith: ids in THIS pack that pair naturally — the seed for
 *            "which two go together?" questions and dinner-table prompts.
 *   tier     1 concrete-and-daily → 3 abstract. New items arrive tier first;
 *            the back-off rule swaps a struggling item for a lower tier.
 *   prompts  things a grown-up says at dinner, not things the app says.
 */

const w = (id, emoji, en, mr, opts = {}) => Object.freeze({
  id,
  emoji,
  words: Object.freeze({ en, mr }),
  cat: opts.cat || 'thing',
  rel: Object.freeze(opts.rel || {}),
  tier: opts.tier || 1,
  prompts: Object.freeze(opts.prompts || []),
  exp: opts.exp || null,
});

export const OBJECTS = Object.freeze({
  id: 'objects',
  name: 'Everyday things',
  langs: Object.freeze(['en', 'mr']),
  items: Object.freeze([
    w('cup', '☕', 'cup', 'कप', {
      cat: 'kitchen', rel: { goesWith: ['milk'] },
      prompts: ['At dinner, hold up two cups: whose cup is bigger?'],
    }),
    w('spoon', '🥄', 'spoon', 'चमचा', {
      cat: 'kitchen', rel: { goesWith: ['plate'] },
      prompts: ['Ask: what do we do with a spoon? Let him show you.'],
    }),
    w('plate', '🍽️', 'plate', 'ताट', {
      cat: 'kitchen', rel: { goesWith: ['spoon'] },
      prompts: ['Ask: is the plate round or is it square? Trace the edge with his finger.'],
    }),
    w('water', '💧', 'water', 'पाणी', {
      cat: 'food', rel: { goesWith: ['fish'] },
      prompts: ['At bath time: where else do we find water? Rain, taps, tears.'],
    }),
    w('milk', '🥛', 'milk', 'दूध', {
      cat: 'food', rel: { goesWith: ['cow', 'cup'] },
      prompts: ['Ask: where does milk come from? See what he says before you answer.'],
    }),
    w('banana', '🍌', 'banana', 'केळं', {
      cat: 'food', rel: { goesWith: ['mango'] },
      prompts: ['Peel one together: what colour outside? What colour inside?'],
    }),
    w('apple', '🍎', 'apple', 'सफरचंद', {
      cat: 'food', rel: { goesWith: ['banana'] },
      prompts: ['Ask: apple and banana — which one is red?'],
    }),
    w('mango', '🥭', 'mango', 'आंबा', {
      cat: 'food', rel: { goesWith: ['banana'] },
      prompts: ['Ask: mango and milk together make what? आंबा + दूध!'],
    }),
    w('dog', '🐶', 'dog', 'कुत्रा', {
      cat: 'animal', rel: { goesWith: ['ball'] },
      prompts: ['Ask: what does the dog say? Then: what does the cat say? Take turns.'],
    }),
    w('cat', '🐱', 'cat', 'मांजर', {
      cat: 'animal', rel: { goesWith: ['milk'] },
      prompts: ['Ask: is a cat big or small? Is a cow big or small?'],
    }),
    w('cow', '🐄', 'cow', 'गाय', {
      cat: 'animal', rel: { goesWith: ['milk'] },
      prompts: ['Ask: the cow gives us something white to drink — what is it?'],
    }),
    w('bird', '🐦', 'bird', 'पक्षी', {
      cat: 'animal', rel: { goesWith: ['tree'] },
      prompts: ['At the window: can you see a bird? Where does it sleep?'],
    }),
    w('fish', '🐟', 'fish', 'मासा', {
      cat: 'animal', rel: { goesWith: ['water'] },
      prompts: ['Ask: can a fish walk? Why not? Wiggle like a fish together.'],
    }),
    w('ball', '⚽', 'ball', 'चेंडू', {
      cat: 'toy', rel: { goesWith: ['dog'] },
      prompts: ['Roll a ball: does it roll? Does a book roll? Try both.'],
    }),
    w('book', '📖', 'book', 'पुस्तक', {
      cat: 'toy', rel: { goesWith: ['bag'] },
      prompts: ['At bedtime: he picks the book, you name it in both languages.'],
    }),
    w('shoe', '👟', 'shoe', 'बूट', {
      cat: 'clothes', rel: { goesWith: ['sock'] },
      prompts: ['Ask: what goes on before the shoe — the sock or the hat?'],
    }),
    w('sock', '🧦', 'sock', 'मोजा', {
      cat: 'clothes', rel: { goesWith: ['shoe'] },
      prompts: ['Hold up one sock: where is the other one? Socks come in twos.'],
    }),
    w('hat', '🧢', 'hat', 'टोपी', {
      cat: 'clothes', rel: { goesWith: ['sun'] },
      prompts: ['Ask: where does a hat go — on your foot or on your head? Be silly.'],
    }),
    w('door', '🚪', 'door', 'दार', {
      cat: 'house', rel: { goesWith: ['key'] },
      prompts: ['Ask: open or closed? Say it each time you walk through one today.'],
    }),
    w('chair', '🪑', 'chair', 'खुर्ची', {
      cat: 'house', rel: { goesWith: ['bed'] },
      prompts: ['Ask: we sit on a chair — what do we sleep on?'],
    }),
    w('bed', '🛏️', 'bed', 'पलंग', {
      cat: 'house', rel: { goesWith: ['chair'] },
      prompts: ['At bedtime: who else is going to bed? The sun went to bed too.'],
    }),
    w('key', '🔑', 'key', 'किल्ली', {
      cat: 'house', tier: 2, rel: { goesWith: ['door'] },
      prompts: ['Let him turn the key once: what did the key do to the door?'],
    }),
    w('bag', '👜', 'bag', 'पिशवी', {
      cat: 'house', rel: { goesWith: ['book'] },
      prompts: ['Pack a bag together: what shall we put in? Name each thing.'],
    }),
    w('house', '🏠', 'house', 'घर', {
      cat: 'house', rel: { goesWith: ['door'] },
      prompts: ['Ask: who lives in our house? Name everyone, then the bird\'s house.'],
    }),
    w('car', '🚗', 'car', 'गाडी', {
      cat: 'vehicle', rel: { goesWith: ['key'] },
      prompts: ['On a walk: is that car fast or slow? Big or small?'],
    }),
    w('tree', '🌳', 'tree', 'झाड', {
      cat: 'nature', rel: { goesWith: ['bird'] },
      prompts: ['Touch a tree on a walk: is it taller than papa? Taller than the house?'],
    }),
    w('flower', '🌸', 'flower', 'फूल', {
      cat: 'nature', rel: { goesWith: ['tree'] },
      prompts: ['Smell a flower together: what else smells nice?'],
    }),
    w('sun', '☀️', 'sun', 'सूर्य', {
      cat: 'nature', tier: 2, rel: { goesWith: ['moon'] },
      prompts: ['Ask in the morning: is the sun awake? And at night: where did it go?'],
    }),
    w('moon', '🌙', 'moon', 'चंद्र', {
      cat: 'nature', tier: 2, rel: { goesWith: ['star'] },
      prompts: ['At night: find the moon. Is it round tonight or a smile?'],
    }),
    w('star', '⭐', 'star', 'चांदणी', {
      cat: 'nature', tier: 2, rel: { goesWith: ['moon'] },
      prompts: ['Ask: when do the stars come out — day or night? Why?'],
    }),
  ]),
});
