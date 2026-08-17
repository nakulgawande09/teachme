# अक्षर खेळ · Akshar Khel

A quiet alphabet toy for a pre-reader — English, मराठी and संस्कृत letters to hear and trace.

No accounts, no adverts, no analytics, no scores or streaks. Everything stays on the device.

## Running it

There is **no build step**, but the app uses native ES modules, so `file://` will not work
(modules are CORS-fetched). Serve the directory:

```sh
npm run dev        # npx serve -l 4321 .
npm test           # node --test — the pure logic only, no browser needed
```

Deploying is still `git push` — Vercel serves the tree as-is.

## Query-string tools

| Flag | What it does |
|---|---|
| `?harness=1` | State harness: force any screen, overlay, stuck/retry, silent-voice or read-only-storage state. Not part of the app. |
| `?selftest=1` | Boot assertions — orphaned `data-action`s, animations missing `data-motion`, unloaded typefaces, glyphs with no engine, emoji leaking out of the art frame, and assets missing from the service-worker shell. |
| `?dev=1` | Deep-freezes state after every dispatch (a mutation throws) and warns on leaked timers after a navigation. |
| `?nosw=1` | Unregisters the service worker, clears every cache, reloads once. Use this the moment a deploy looks stale. |

## Shape of the thing

```
index.html          markup only — no inline JS, no inline style
css/                tokens · base+keyframes · components · screens · parent
js/core/            store, immutable reducer slices, router, tracked timers, DOM helpers
js/data/            tracks (86 glyphs), stroke paths, shlokas, inline SVG icons
js/audio/           voice inventory, speech queue, the clip-resolver ladder
js/trace/           geometry, crayon, the two engines, and the lifecycle above them
js/storage/         schema + validation, localStorage, progress heuristics
js/parent/          hold-to-reveal gate, dashboard, settings, feedback contract
js/render/          state → attributes on #app; CSS does the rest
sw.js               offline shell (ASSETS is hand-maintained — ?selftest=1 checks it)
```

Rendering is **attributes on `#app` driven by CSS selectors**, not style writes:
`#app[data-screen="trace"][data-alive="2"]`. `pointermove` never dispatches — the trace
engines draw imperatively and report only three moments (stroke accepted, stroke rejected,
glyph finished).

## How a day works

Home leads with **today's letters** — a small set the app chose, shown on each track card.
Tapping the card starts them; finishing them shows a closing screen that says *done* and hands
the child one small thing to go and do away from the phone. After that, the same card opens the
full grid, so free exploration is what is left once the work is finished rather than the other
way round.

A letter the child has never met is **taught**: hear it, trace it, watch it come alive. A letter
they have met before is **asked** — "which one says this?" — because being asked to remember is
what makes it stick, while being shown a letter again is the weakest thing the app can do. Both
question directions exist (sound → letter, letter → picture) and both are error-free: a wrong
tap replays the sound and the card settles back. Nothing is scored, nothing is blocked.

Letters come back on Leitner intervals — 1 day, then 2, 4, 8, 16 — and drop back to tomorrow if
they needed a nudge. `js/features/schedule.js` is pure and unit-tested, so "why is she seeing
this letter today?" always has an answer.

The teaching order is **not** alphabetical. English opens `satpin`, which builds *sat, tin, pan,
nap* — a real word in the first week instead of after twenty-six letters. Marathi does every
स्वर before any व्यंजन, and leaves ङ ञ क्ष ज्ञ until last because they only appear in conjuncts.
The grid still lists letters in the familiar order, because that is what a parent expects and
what a wall chart at home will match; only the daily set follows the sequence. See
`js/data/sequence.js`.

## Three decisions worth knowing before you change anything

**Silence beats a wrong sound.** Almost no device ships a Marathi voice. The old build let the
request fall through to a Hindi voice, which deletes the final schwa (कमळ → *kamal*) and has no
ळ at all — so the app was teaching wrong phonemes with total confidence. The resolver now
refuses to speak when the resolved voice's language does not match the request, and the
Voice card in the grown-ups area says exactly why. Do not "fix" the silence by widening the
fallback chain. Fix it by recording the clips — see `docs/voice-and-audio.md` for the spec
(~200 clips, one afternoon, under 3 MB); `js/audio/resolver.js` is already the seam.

**Unreviewed stroke order is not taught.** `js/data/strokes.js` gates each glyph on a
`reviewed` flag. All 26 Latin capitals are reviewed and get the demo → follow-the-dots →
comes-alive lesson. Every Devanagari glyph is `reviewed: false` — those paths came from a
design mockup whose own notes call them engineering placeholders — so they route to the mask
engine, which knows the letter's *shape* but never claims a direction (the arrow is hidden for
that engine on purpose). Handwriting habits are sticky; get a Marathi teacher or a type
designer to sign off, then flip the boolean. A test guards this.

**The reward teaches rather than congratulates.** No stars, no confetti, no counter. When the
last stroke lands, the child's crayon lifts and blurs away and the correct letterform fades up
underneath it in the track colour, exactly where their hand just was. Progress is one amber dot
on the grid card — no count, no score. Both engines converge on the same `comeAlive()`.

**Everything that ends, ends on purpose.** The thing that makes an app hard to put down is a
missing stopping cue, so this one has several: today's set is finite and its dots are visible
from inside every activity; the celebration's green button walks the child through the set and
then turns into a tick rather than wrapping forever; the closing screen points off the device;
and the session timer still runs underneath all of it. If you add a feature that can go on
indefinitely, give it an end first.

## Still open

- [ ] **Devanagari stroke order** needs review before any `reviewed: true` flip.
- [ ] **Ten new Marathi keywords** (ई ए ऐ अं अः ङ ञ ष क्ष ज्ञ) are marked `NEW` in
      `js/data/tracks.js` and need a native speaker's approval.
- [ ] **Tally form** — create it, then paste the id into `TALLY_FORM_ID` in
      `js/parent/feedback.js`. The feedback card does not render until you do.
- [ ] **Keyword illustration** — emoji fill the 8:5 art frame for now; that frame is the slot
      real art drops into as `/art/<track>/<glyph>.svg`.
- [ ] **Voice recording (Tier 1)** — flip `CLIPS_SHIPPED` in `js/audio/resolver.js` in the same
      commit that adds `/audio/`.

Bump `VERSION` in `sw.js` and `APP_VERSION` in `js/parent/feedback.js` on each deploy.
