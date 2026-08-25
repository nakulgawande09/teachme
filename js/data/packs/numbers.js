/**
 * Pack 4 — numbers, shapes & colors.
 *
 * Early-maths vocabulary, not maths drills: the words for one-to-five,
 * three shapes, six colors and the big/small pair. Counting real things at
 * the table (the prompts) is where the numbers become quantities.
 *
 * Colours are FILLED SQUARES on purpose: in a colour question every card
 * is the same shape and only the colour differs — which is the question.
 * Circles would collide with the circle shape card (three discs, no right
 * answer), which is exactly the defect this replaced.
 *
 * The numeral emoji are the one place a "glyph" appears in the words mode —
 * deliberate: recognising 3 is the point of the word तीन.
 */

const w = (id, emoji, en, mr, opts = {}) => Object.freeze({
  id,
  emoji,
  words: Object.freeze({ en, mr }),
  cat: opts.cat || 'number',
  rel: Object.freeze(opts.rel || {}),
  tier: opts.tier || 1,
  prompts: Object.freeze(opts.prompts || []),
  exp: opts.exp || null,
});

export const NUMBERS = Object.freeze({
  id: 'numbers',
  name: 'Numbers, shapes & colors',
  langs: Object.freeze(['en', 'mr']),
  items: Object.freeze([
    w('one', '1️⃣', 'one', 'एक', {
      rel: { goesWith: ['two'] },
      prompts: ['At dinner: put ONE spoon out. Ask for one more. Now how many?'],
    }),
    w('two', '2️⃣', 'two', 'दोन', {
      rel: { goesWith: ['one'] },
      prompts: ['Ask: what do you have two of? Eyes, ears, hands, feet — count each pair.'],
    }),
    w('three', '3️⃣', 'three', 'तीन', {
      rel: { goesWith: ['two'] },
      prompts: ['Count three bites, three claps, three jumps — तीन everywhere tonight.'],
    }),
    w('four', '4️⃣', 'four', 'चार', {
      tier: 2, rel: { goesWith: ['three'] },
      prompts: ['Ask: how many legs does the chair have? The dog? Count them together.'],
    }),
    w('five', '5️⃣', 'five', 'पाच', {
      tier: 2, rel: { goesWith: ['four'] },
      prompts: ['High-five! Count the five fingers that made it.'],
    }),
    w('circle', '⭕', 'circle', 'गोल', {
      cat: 'shape', tier: 2, rel: { goesWith: ['square'] },
      prompts: ['Hunt for circles at dinner: the plate, the cup rim, a coin. Who finds more?'],
    }),
    w('triangle', '🔺', 'triangle', 'त्रिकोण', {
      cat: 'shape', tier: 3, rel: { goesWith: ['circle'] },
      prompts: ['Make a triangle with three fingers. Count its corners — one, two, three.'],
    }),
    w('square', '🔲', 'square', 'चौकोन', {
      cat: 'shape', tier: 3, rel: { goesWith: ['circle'] },
      prompts: ['Ask: is the window a circle or a square? Trace its corners with a finger.'],
    }),
    w('red', '🟥', 'red', 'लाल', {
      cat: 'color', rel: { goesWith: ['yellow'] },
      prompts: ['At dinner: find something red on the table. Then something red on you.'],
    }),
    w('yellow', '🟨', 'yellow', 'पिवळा', {
      cat: 'color', rel: { goesWith: ['red'] },
      prompts: ['Ask: what is yellow? Banana, the sun, haldi in the dal — find one.'],
    }),
    w('green', '🟩', 'green', 'हिरवा', {
      cat: 'color', rel: { goesWith: ['yellow'] },
      prompts: ['Look out of the window: what is green out there? Count the green things.'],
    }),
    w('blue', '🟦', 'blue', 'निळा', {
      cat: 'color', rel: { goesWith: ['green'] },
      prompts: ['Ask: what color is the sky right now? Is it always blue?'],
    }),
    w('white', '⬜', 'white', 'पांढरा', {
      cat: 'color', tier: 2, rel: { goesWith: ['black'] },
      prompts: ['Find white at dinner: milk, rice, salt. Which one can you drink?'],
    }),
    w('black', '⬛', 'black', 'काळा', {
      cat: 'color', tier: 2, rel: { goesWith: ['white'] },
      prompts: ['Ask: what is black at night? Look for black shoes, black hair, a crow.'],
    }),
    w('big', '🐘', 'big', 'मोठा', {
      cat: 'size', tier: 2, rel: { goesWith: ['small'] },
      prompts: ['Line up three spoons: which is the big one? Whose plate is bigger tonight?'],
    }),
    w('small', '🐜', 'small', 'लहान', {
      cat: 'size', tier: 2, rel: { goesWith: ['big'] },
      prompts: ['Ask: who is small in our house? Who is big? Were the big ones small once?'],
    }),
  ]),
});
