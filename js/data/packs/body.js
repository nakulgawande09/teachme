/**
 * Pack 3 — body & senses.
 *
 * The one pack the child can always point at. Part-and-whole and
 * what-is-it-for questions live here: eyes go with seeing, hands go with
 * fingers — the first honest "why" conversations a two-year-old can hold.
 */

const w = (id, emoji, en, mr, opts = {}) => Object.freeze({
  id,
  emoji,
  words: Object.freeze({ en, mr }),
  cat: opts.cat || 'body',
  rel: Object.freeze(opts.rel || {}),
  tier: opts.tier || 1,
  prompts: Object.freeze(opts.prompts || []),
  exp: opts.exp || null,
});

export const BODY = Object.freeze({
  id: 'body',
  name: 'Body & senses',
  langs: Object.freeze(['en', 'mr']),
  items: Object.freeze([
    w('hand', '🤚', 'hand', 'हात', {
      rel: { goesWith: ['finger'] },
      prompts: ['Wash hands tonight naming them in both languages. Ask: what do hands do?'],
    }),
    w('finger', '☝️', 'finger', 'बोट', {
      rel: { goesWith: ['hand'] },
      prompts: ['Count fingers slowly together, one hand at a time.'],
    }),
    w('leg', '🦵', 'leg', 'पाय', {
      rel: { goesWith: ['knee'] },
      prompts: ['Ask: what do legs do? March around the table saying the word each step.'],
    }),
    w('knee', '🧎', 'knee', 'गुडघा', {
      tier: 2, rel: { goesWith: ['leg'] },
      prompts: ['Find your knees, then papa\'s knees. Ask: where do knees bend?'],
    }),
    w('eye', '👁️', 'eye', 'डोळा', {
      rel: { goesWith: ['ear'] },
      prompts: ['Close your eyes together: what can you still hear? Open: what can you see?'],
    }),
    w('ear', '👂', 'ear', 'कान', {
      rel: { goesWith: ['eye'] },
      prompts: ['Ask: what are ears for? Sit quietly and name three sounds you can hear.'],
    }),
    w('nose', '👃', 'nose', 'नाक', {
      rel: { goesWith: ['mouth'] },
      prompts: ['At dinner: smell the food first. Ask: what does the nose do?'],
    }),
    w('mouth', '👄', 'mouth', 'तोंड', {
      rel: { goesWith: ['teeth'] },
      prompts: ['Ask: what does the mouth do — eat, talk, sing? Do all three.'],
    }),
    w('teeth', '🦷', 'teeth', 'दात', {
      rel: { goesWith: ['tongue'] },
      prompts: ['At brushing time: count teeth in the mirror. Ask: what are teeth for?'],
    }),
    w('tongue', '👅', 'tongue', 'जीभ', {
      tier: 2, rel: { goesWith: ['teeth'] },
      prompts: ['Stick tongues out at each other. Ask: what does the tongue taste today?'],
    }),
    w('hair', '💇', 'hair', 'केस', {
      rel: { goesWith: ['head'] },
      prompts: ['While combing: whose hair is longer? Whose is curlier?'],
    }),
    w('head', '🙆', 'head', 'डोकं', {
      rel: { goesWith: ['hair'] },
      prompts: ['Play: touch your head, touch your tummy — faster and faster, both languages.'],
    }),
    w('tummy', '🫃', 'tummy', 'पोट', {
      rel: { goesWith: ['mouth'] },
      prompts: ['Ask at dinner: where does the food go? Follow it — mouth, then tummy.'],
    }),
    w('foot', '🦶', 'foot', 'पाऊल', {
      tier: 2, rel: { goesWith: ['leg'] },
      prompts: ['Compare feet: yours and your child\'s. Whose is bigger? How many toes each?'],
    }),
  ]),
});
