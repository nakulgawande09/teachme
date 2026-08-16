/**
 * The corpus. Three tracks; one screen per track from the home picker.
 *
 * Tuple form keeps the data scannable:  [glyph, keyword, art, sound, flags?]
 *   glyph   what the child traces
 *   keyword a word the letter lives in — null when there honestly isn't one
 *   art     placeholder emoji, shown large inside the 8:5 art frame. This is
 *           the slot commissioned illustration drops into as
 *           /art/<track>/<glyph>.svg; nothing else needs to change.
 *   sound   the PHONEME, not the letter name. Pedagogy: lead with the sound.
 *           Latin letter names actively mislead early readers — "C" is called
 *           "see" but says /k/.
 *   flags   'medial' = the letter does not occur word-initially, so the
 *           keyword contains it rather than starting with it. The UI says
 *           "inside a word" instead of implying initial position.
 *           'conjunct' = the letter only appears in conjuncts.
 *
 * REVIEW NEEDED: the ten keywords marked `NEW` below were authored to fill
 * gaps where the shipped app had a placeholder. A native Marathi speaker must
 * approve them before this reaches a child.
 */

const t = (glyph, keyword, art, sound, flags = '') => Object.freeze({
  glyph,
  keyword: keyword || null,
  art: art || null,
  sound,
  medial: flags.includes('medial'),
  conjunct: flags.includes('conjunct'),
});

const EN_LETTERS = [
  t('A', 'apple', '🍎', '/a/'),      t('B', 'ball', '⚽', '/b/'),
  t('C', 'cat', '🐱', '/k/'),        t('D', 'dog', '🐶', '/d/'),
  t('E', 'elephant', '🐘', '/e/'),   t('F', 'fish', '🐟', '/f/'),
  t('G', 'grapes', '🍇', '/g/'),     t('H', 'house', '🏠', '/h/'),
  t('I', 'ice cream', '🍦', '/i/'),  t('J', 'jar', '🫙', '/j/'),
  t('K', 'kite', '🪁', '/k/'),       t('L', 'lion', '🦁', '/l/'),
  t('M', 'mango', '🥭', '/m/'),      t('N', 'nest', '🪺', '/n/'),
  t('O', 'owl', '🦉', '/o/'),        t('P', 'peacock', '🦚', '/p/'),
  t('Q', 'queen', '👑', '/kw/'),     t('R', 'rainbow', '🌈', '/r/'),
  t('S', 'sun', '☀️', '/s/'),        t('T', 'tiger', '🐯', '/t/'),
  t('U', 'umbrella', '☂️', '/u/'),   t('V', 'van', '🚐', '/v/'),
  t('W', 'watch', '⌚', '/w/'),      t('X', 'xylophone', '🎻', '/ks/'),
  t('Y', 'yarn', '🧶', '/y/'),       t('Z', 'zebra', '🦓', '/z/'),
];

const SWARA = [
  t('अ', 'अननस', '🍍', '/अ/'),
  t('आ', 'आंबा', '🥭', '/आ/'),
  t('इ', 'इमारत', '🏢', '/इ/'),
  t('ई', 'ईडलिंबू', '🍋', '/ई/'),          // NEW — बालभारती primer word
  t('उ', 'उंदीर', '🐭', '/उ/'),
  t('ऊ', 'ऊस', '🎋', '/ऊ/'),
  t('ए', 'एडका', '🐏', '/ए/'),             // NEW — primer word for ए
  t('ऐ', 'ऐरण', '⚒️', '/ऐ/'),             // NEW — anvil, standard primer word
  t('ओ', 'ओठ', '👄', '/ओ/'),
  t('औ', 'औषध', '💊', '/औ/'),
  t('अं', 'अंडे', '🥚', '/अं/'),            // NEW — anusvara, standard primer word
  t('अः', 'नमः', '🙏', '/अः/', 'medial'),  // NEW — visarga never starts a word
];

const VYANJAN = [
  t('क', 'कमळ', '🪷', '/क/'),      t('ख', 'खडू', '🖍️', '/ख/'),
  t('ग', 'गणपती', '🙏', '/ग/'),    t('घ', 'घर', '🏠', '/घ/'),
  t('ङ', 'अङ्ग', '🦵', '/ङ/', 'medial conjunct'),  // NEW — conjunct-only letter
  t('च', 'चमचा', '🥄', '/च/'),     t('छ', 'छत्री', '☂️', '/छ/'),
  t('ज', 'जहाज', '🚢', '/ज/'),     t('झ', 'झाड', '🌳', '/झ/'),
  t('ञ', 'पञ्च', '✋', '/ञ/', 'medial conjunct'),  // NEW — conjunct-only letter
  t('ट', 'टोमॅटो', '🍅', '/ट/'),   t('ठ', 'ठसा', '👍', '/ठ/'),
  t('ड', 'डबा', '🍱', '/ड/'),      t('ढ', 'ढग', '☁️', '/ढ/'),
  t('ण', 'पाणी', '💧', '/ण/', 'medial'),
  t('त', 'तारा', '⭐', '/त/'),     t('थ', 'थवा', '🐦', '/थ/'),
  t('द', 'दिवा', '🪔', '/द/'),     t('ध', 'धनुष्य', '🏹', '/ध/'),
  t('न', 'नळ', '🚰', '/न/'),
  t('प', 'पतंग', '🪁', '/प/'),     t('फ', 'फुगा', '🎈', '/फ/'),
  t('ब', 'बदक', '🦆', '/ब/'),      t('भ', 'भोपळा', '🎃', '/भ/'),
  t('म', 'मासा', '🐟', '/म/'),
  t('य', 'यज्ञ', '🔥', '/य/'),     t('र', 'रोबोट', '🤖', '/र/'),
  t('ल', 'लाडू', '🟡', '/ल/'),     t('व', 'वाघ', '🐯', '/व/'),
  t('श', 'शंख', '🐚', '/श/'),
  t('ष', 'षटकोन', '🔷', '/ष/'),    // NEW — hexagon, standard primer word
  t('स', 'ससा', '🐰', '/स/'),      t('ह', 'हत्ती', '🐘', '/ह/'),
  t('ळ', 'बाळ', '👶', '/ळ/', 'medial'),
  t('क्ष', 'क्षीर', '🥛', '/क्ष/'), // NEW — milk. Primers often use क्षत्रिय;
                                    // क्षीर was chosen as gentler for age 3-6.
  t('ज्ञ', 'ज्ञान', '📖', '/ज्ञ/'), // NEW — knowledge
];

/** Sanskrit body-and-nature words. Spoken and illustrated, never traced. */
const SA_WORDS = [
  t('हस्त', 'हात', '🤚', '/hasta/'),      t('नेत्र', 'डोळा', '👁️', '/netra/'),
  t('कर्ण', 'कान', '👂', '/karṇa/'),      t('नासिका', 'नाक', '👃', '/nāsikā/'),
  t('मुखम्', 'तोंड', '😊', '/mukham/'),   t('पाद', 'पाय', '🦶', '/pāda/'),
  t('जलम्', 'पाणी', '💧', '/jalam/'),     t('फलम्', 'फळ', '🍎', '/phalam/'),
  t('पुष्पम्', 'फूल', '🌸', '/puṣpam/'),  t('सूर्य', 'सूर्य', '☀️', '/sūrya/'),
  t('चंद्र', 'चंद्र', '🌙', '/candra/'),  t('तारा', 'चांदणी', '⭐', '/tārā/'),
];

export const TRACKS = Object.freeze({
  en: Object.freeze({
    id: 'en',
    name: 'English',
    sample: 'A',
    preview: ['B', 'C', 'D'],
    lang: 'en-IN',
    traceable: true,
    groups: Object.freeze([Object.freeze({ label: null, letters: EN_LETTERS })]),
  }),
  mr: Object.freeze({
    id: 'mr',
    name: 'मराठी',
    sample: 'क',
    preview: ['ख', 'ग', 'घ'],
    lang: 'mr-IN',
    traceable: true,
    groups: Object.freeze([
      Object.freeze({ label: 'स्वर', letters: SWARA }),
      Object.freeze({ label: 'व्यंजन', letters: VYANJAN }),
    ]),
  }),
  sa: Object.freeze({
    id: 'sa',
    name: 'संस्कृत',
    sample: 'ॐ',
    preview: [],
    // No consumer device ships a `sa` voice. Requesting hi-IN here would be a
    // lie the resolver must catch, so we request 'sa' honestly and let the
    // language-match guard fall through to silence. See js/audio/resolver.js.
    lang: 'sa',
    traceable: false,
    groups: Object.freeze([Object.freeze({ label: 'जादूचे शब्द', letters: SA_WORDS })]),
  }),
});

export const TRACK_IDS = Object.freeze(['en', 'mr', 'sa']);

/** Flat letter list for a track, groups concatenated in reading order. */
export function lettersOf(trackId) {
  const track = TRACKS[trackId];
  if (!track) {
    console.warn('lettersOf: unknown track', trackId);
    return [];
  }
  return track.groups.flatMap((g) => g.letters);
}

/** Storage key for one letter. Stable across releases — do not change. */
export const letterKey = (trackId, glyph) => `${trackId}:${glyph}`;

/** Every valid letter key, used to filter junk out of stored progress. */
export const ALL_LETTER_KEYS = Object.freeze(
  new Set(TRACK_IDS.flatMap((id) => lettersOf(id).map((l) => letterKey(id, l.glyph))))
);
