# Voice & audio — how to make Akshar Khel sound right

Status: proposal. Written against `index.html` @ `main` (the `speak()` / `pickVoice()` block).

The single biggest quality gap in the app is not visual. It is that a three-year-old
learning **मराठी** is currently being read to, most of the time, by a **Hindi or Indian-English
voice**. Everything below is about closing that.

---

## 1. What is actually happening today

The current implementation is a reasonable first pass:

```js
const MR = ["mr","hi","en-in"];
const SA = ["sa","hi","mr","en-in"];
u.rate = 0.8; u.pitch = 1.05;
```

Four problems, in order of severity:

**1.1 The fallback chain silently degrades.**
A `mr-*` system voice ships on almost no device — not on stock Android, not on iOS,
not in desktop Chrome. So `pickVoice(MR)` falls through to `hi`, and a Hindi voice reads
Marathi text. It is intelligible to an adult and *wrong for a learner*: Hindi applies
final-schwa deletion, so `कमळ` comes out closer to *kamal* than *kamaḷ*, and `ळ` — a letter
Hindi does not have — is rendered as `ल`. The child is being taught the wrong phoneme by
the thing that is supposed to be the authority.

**1.2 Sanskrit has no voice anywhere.**
`sa` resolves on essentially zero consumer devices, so every shloka is read by a Hindi
voice. Hindi prosody mangles chanting: visarga (`ज्योतिर्नमोऽस्तु ते`) loses its aspiration,
anusvara flattens, vowel length is not respected, and the pausal rhythm that makes a shloka
memorable is replaced by sentence intonation. For a devotional text read aloud by a child
alongside a grandparent, this is the most visible defect in the product.

**1.3 The voice list is async and races the first tap.**
`speechSynthesis.getVoices()` returns `[]` on first call in Chrome; `onvoiceschanged` fills
it later. A child who taps within the first second gets the platform default voice
(often US English) or silence. On iOS, speech also needs to be unlocked by a user gesture.

**1.4 TTS latency breaks the tap→sound loop.**
Synthesis start-up is tens to hundreds of milliseconds and varies per device. For a
tap-a-letter-hear-a-letter toy, sound must feel *simultaneous* with the finger. Recorded
audio decoded into memory is the only way to get there reliably.

There is no bug to fix here — the architecture just needs to stop treating TTS as the
primary source.

---

## 2. The corpus is small and finite — record it

This is the key realisation. The app does not need open-ended speech. From the data in
`index.html`:

| Set | Items | Clips needed |
|---|---|---|
| `ABC` | 26 | 26 letter-names + 26 keywords |
| `SWARA` | 12 | 12 |
| `VYANJAN` | 36 | 36 |
| Marathi keywords (कमळ, खडू, घर …) | ~40 non-empty | ~40 |
| `WORDS` (Sanskrit body/nature) | 12 | 12 + 12 Marathi glosses |
| `SHLOKAS` | 3 × 2 lines | 6 lines, ×2 speeds = 12 |
| UI phrases (शाब्बास, बोटाने गिरव, थोडी विश्रांती …) | ~12 | 12 |

**≈ 200 clips.** That is one afternoon in a quiet room with one native Marathi speaker,
and it permanently removes problems 1.1–1.4.

### Recording spec

- 48 kHz / 24-bit mono, cardioid mic, 15–20 cm, pop filter, **no reverb** and no room tone —
  a soft room, not a booth-sounding one.
- Peak ≈ −3 dBFS, normalise the whole set to **−16 LUFS** so no letter is louder than another
  (uneven loudness is the thing parents notice first).
- Trim leading silence to 0, trailing to ~30 ms. A clip must not have a "wind-up".
- Child-directed register: slower, slightly higher pitch, warm — but **not baby-talk**, and
  never sing-song on Sanskrit.
- Record **three variants per letter** so screens can compose without re-recording:
  1. the letter *sound* alone — `/क/`
  2. the letter *name* — `क`
  3. letter + keyword — `क … कमळ`
- Shlokas: record each line twice — **chanting speed** and **teaching speed** — and also
  per-word, so the line can highlight word-by-word as it plays.
- Two speakers if budget allows: one adult model, one 5–6-year-old **echo** played after it.
  Children imitate a child's voice far more readily than an adult's.

### Dialect is a real decision, so make it consciously

Marathi is not uniform — Puneri, Varhadi, Konkani, Marathwadi differ audibly in exactly the
vowels a learner is calibrating on. Pick one (Puneri/standard is the safe default for a
teaching app), write it down in the manifest, and use one speaker for the whole set. Mixing
speakers mid-alphabet teaches inconsistency.

### Packaging

- Encode to **Opus ~64 kbps** in WebM (plus AAC/CAF for older iOS). ~8–15 KB per clip →
  **the entire set well under 3 MB.**
- Ship as one **sprite file + JSON offset map**, or individual files precached by a service
  worker. Either way: fetch once, decode via **Web Audio API**, keep decoded buffers in
  memory, and play on tap. That is the sub-10 ms response the toy needs.
- Unlock `AudioContext` on the first user gesture (iOS requirement) — the track-picker tap
  on the home screen is the natural place.

### Manifest

```json
{
  "speaker": "…", "dialect": "standard-puneri", "recorded": "2026-08-…",
  "loudness_lufs": -16, "reviewed_by": "…", "review_date": "…",
  "clips": { "mr/क/sound": {"file":"mr.webm","start":12.40,"dur":0.62} }
}
```

A `reviewed_by` field that is empty is a clip that has not been signed off by a native
speaker. Do not ship unreviewed audio to children.

---

## 3. Fallback ladder

Never let a missing clip become a wrong pronunciation. Resolve in this order:

1. **Recorded clip** (correct, instant) →
2. **Cached synthesis** for that exact string, generated once by a good engine and shipped
   as audio, not synthesised on device →
3. **Live `speechSynthesis`** — only when a genuine `mr-IN` / `sa-IN` voice is present →
4. **Silence + visual affordance.** A letter that animates but says nothing is far better
   than a letter mispronounced. If nothing is available, tell the *parent* (in the grown-ups
   area), never the child.

Concretely, step 3 should replace today's chain: if the resolved voice's language does not
match the requested language, **do not speak** — today it speaks anyway, and that is exactly
how Hindi ends up teaching Marathi.

---

## 4. Filling the gaps with synthesis (Sanskrit especially)

Where a human recording is impractical — long tail of shlokas, future word packs — modern
TTS with **voice cloning from a short consented sample** of the same speaker keeps the whole
app in one voice. (You already have `VoxCPM` forked; it is built for exactly this:
multilingual, tokenizer-free, voice cloning.) Two rules:

- Generate **offline, review, and ship the resulting audio files** — do not call a cloud TTS
  at runtime from a children's app (latency, offline, privacy, cost, and terms-of-use on
  synthetic voices all argue against it).
- Get written consent from the speaker for cloned use, and note it in the manifest.

For Sanskrit specifically, a Hindi model is not an acceptable substitute — no schwa deletion,
preserve vowel length, aspirate the visarga, nasalise the anusvara. This needs either a
Sanskrit-trained model or a human reader. A retired teacher or a local pathshala will
usually record shlokas gladly.

---

## 5. Pronunciation pedagogy — name vs sound

Currently a tap says the glyph and, for ABC, `"${g} for ${w}"`. Worth being deliberate:

- Teach the **sound** (`/k/`), then the **name** (`क` / "cee"), and keep them distinguishable.
  Phonics-first is why the listen card in the new design shows `/क/` beside the letter.
- Latin letter *names* actively mislead early readers (`C` says "see" but sounds `/k/`).
  Lead with the sound, offer the name second.
- Marathi: `ळ`, `ऱ`, and the aspirated pairs (`क`/`ख`, `ग`/`घ`) must be recorded by someone
  who distinguishes them crisply — this is the single most common flaw in existing
  Marathi learning apps.
- Say the keyword as a bare word, not inside a carrier sentence, when the child taps the
  keyword art. Sentences hide the initial phoneme.

---

## 6. Let the child speak back

The highest-leverage audio feature is not output, it is input: after the model plays, offer a
**record button** so the child says the letter and hears themselves next to the model. It
turns a listening app into a speaking one, and it is what parents notice.

Keep it strictly **on-device**: `MediaRecorder` → in-memory Blob → play → discard. No upload,
no server, no scoring, no "accuracy" number for a three-year-old. State that plainly in the
grown-ups area.

---

## 7. Grown-ups controls worth adding

- **Voice volume** (already stubbed in the parent area) — independent of system volume.
- **"Say it slower"** — switch the whole app to the teaching-speed clip set.
- **Speaker choice**, if more than one set is recorded (aai's voice / teacher's voice).
- **Which voice is being used right now**, plainly stated: "Marathi clips recorded by a native
  speaker" vs "your phone's Hindi voice is being used — Marathi may sound wrong". Parents can
  make good decisions if told the truth.

---

## 8. Sequenced plan

**Tier 0 — no recording, ~half a day.** Fix the voice race (wait for `onvoiceschanged`
before the first utterance, prewarm on first gesture); refuse to speak when the resolved
voice language ≠ requested language; drop shloka `rate` to ~0.65 and `pitch` to 1.0;
queue utterances instead of cancel-and-replace mid-word; surface the real voice status in the
grown-ups area.

**Tier 1 — record the ~200 clips.** Marathi + English letters, keywords, UI phrases.
Sprite + Web Audio + service-worker precache. This is the release that makes the app good.

**Tier 2 — Sanskrit done properly.** Human or Sanskrit-capable model, per-word timings,
word-by-word highlight while the line plays, two speeds.

**Tier 3 — child records and compares.** On-device only.

**Tier 4 — child echo voice, dialect packs, second speaker.**

---

## 9. Open questions for the team

1. Who is the speaker, and which dialect are we standardising on?
2. Is there an existing recording of the three shlokas we may use, and under what permission?
3. Do we teach letter *sounds* first or letter *names* first — and does that differ for
   English vs Marathi?
4. Is offline (post-first-load) a hard requirement? It decides sprite-vs-streaming and
   whether a service worker lands in Tier 1.
