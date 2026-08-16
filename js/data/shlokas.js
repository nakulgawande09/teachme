/**
 * Shlokas. Each line carries an IAST transliteration (what a non-reading
 * child's parent actually uses to say it aloud) and a Marathi gloss.
 *
 * Playback rate for these is 0.65, not the 0.9 used for letters — Hindi
 * sentence intonation applied at speaking speed destroys the pausal rhythm
 * that makes a shloka memorable. See docs/voice-and-audio.md.
 */

const line = (text, tr, meaning) => Object.freeze({ text, tr, meaning });

export const SHLOKAS = Object.freeze([
  Object.freeze({
    id: 'shubham',
    name: 'शुभं करोति',
    sub: 'संध्याकाळी दिवा लावताना',
    lines: Object.freeze([
      line(
        'शुभं करोति कल्याणम् आरोग्यं धनसंपदा ।',
        'śubhaṁ karoti kalyāṇam ārogyaṁ dhanasaṁpadā',
        'दिवा चांगले आरोग्य आणि सुख देतो'
      ),
      line(
        'शत्रुबुद्धिविनाशाय दीपज्योतिर्नमोऽस्तु ते ॥',
        'śatrubuddhi-vināśāya dīpajyotir namo’stu te',
        'दिव्याच्या ज्योतीला नमस्कार'
      ),
    ]),
  }),
  Object.freeze({
    id: 'vakratunda',
    name: 'वक्रतुण्ड महाकाय',
    sub: 'गणपती बाप्पाचा श्लोक',
    lines: Object.freeze([
      line(
        'वक्रतुण्ड महाकाय सूर्यकोटि समप्रभ ।',
        'vakratuṇḍa mahākāya sūryakoṭi samaprabha',
        'बाप्पा सूर्यासारखा तेजस्वी आहे'
      ),
      line(
        'निर्विघ्नं कुरु मे देव सर्वकार्येषु सर्वदा ॥',
        'nirvighnaṁ kuru me deva sarvakāryeṣu sarvadā',
        'बाप्पा, माझी सगळी कामे छान होऊ देत'
      ),
    ]),
  }),
  Object.freeze({
    id: 'karagre',
    name: 'कराग्रे वसते',
    sub: 'सकाळी उठल्यावर',
    lines: Object.freeze([
      line(
        'कराग्रे वसते लक्ष्मीः करमध्ये सरस्वती ।',
        'karāgre vasate lakṣmīḥ karamadhye sarasvatī',
        'हातात लक्ष्मी आणि सरस्वती राहतात'
      ),
      line(
        'करमूले तु गोविन्दः प्रभाते करदर्शनम् ॥',
        'karamūle tu govindaḥ prabhāte karadarśanam',
        'सकाळी आपल्या हातांकडे बघून नमस्कार'
      ),
    ]),
  }),
]);

/** Flat [{shlokaIndex, lineIndex, ...line}] — what the shloka screen renders. */
export const SHLOKA_LINES = Object.freeze(
  SHLOKAS.flatMap((s, si) => s.lines.map((l, li) => Object.freeze({ ...l, si, li, id: `${s.id}-${li}` })))
);
