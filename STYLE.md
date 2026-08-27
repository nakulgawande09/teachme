# Block Print

The visual system for अक्षर खेळ, written down. `css/tokens.css` is the
implementation; this file is the reasoning, so the next person changing a value
knows what it was holding up.

## Style Read

**Block Print** is a sanded-wood-and-cotton-paper world: warm matte surfaces,
five block-printed colours, and ink that presses into paper rather than
floating above it. It is built for a two-to-three-year-old who cannot read a
word on the screen, with a parent nearby who will judge the whole app by the
one screen behind the hold-to-open door.

The direction draws from **durable** fundamentals rather than a current look,
because the primary user's constraints — no reading, developing fine motor
control, an eleven-minute attention span — do not move with fashion. The one
place it takes a live cue is the return of material weight to interfaces
(see Field read), and it takes it as confirmation rather than instruction: the
app was already there.

Explicitly rejected: gradients, blur, glass, glow, mascots, confetti, stars,
coins, streaks, and any number on a screen the child can see.

## Signature move

**Everything presses down and settles. Nothing bounces, glows, or gradients.**

Stated as a rule: every pressable surface carries a hard, blur-free shadow
offset straight down, and on `:active` that offset compresses toward the paper
(`--sh-2` → `--sh-press`) while the element translates down by the same amount.
No `blur` value appears anywhere in a shadow in this codebase. If you are
reaching for one, you have left the system.

Second, newer rule: **colour is the navigation.** Each track owns a hue and
wears it edge to edge, so a pre-reader learns the red screen is the one with क
on it. Three variables travel together and must never be set apart —
`--track-color` (the field), `--track-ink` (what is legible on it), and
`--track-mark` (the track drawn as a foreground on cream).

## Tokens

The full set lives in `css/tokens.css` with per-token comments. The decisions
worth restating here:

### Colour

Five block-print hues over a warm neutral ramp; no pure white, no pure black.

| Token | Value | Job |
|---|---|---|
| `--paper` | `#F3EADC` | the ground |
| `--card` | `#FDF8F0` | raised surface, and the ink on dark fields |
| `--ink` → `--ink-4` | `#241E18` → `#8A7C6C` | text ramp; `--ink-3` is the last that clears 4.5:1 on `--card` |
| `--haldi` | `#E0A02A` | words track, audio, attention |
| `--kumkum` | `#BE3F2C` | मराठी |
| `--peacock` | `#14706B` | English |
| `--indigo` | `#313B77` | संस्कृत |
| `--leaf` | `#547C34` | success, done |

Two derived families exist because a colour cannot do every job:

- `--on-<hue>` — what is legible **on** that hue as a full screen. Haldi is a
  *light* colour and takes `--ink` (7.25:1); the dark three take `--card`.
- `--haldi-ink` `#93691C` — haldi is 2.15:1 on `--card` and 1.91:1 on
  `--paper`, so it can never be a foreground. This is the step to draw with.
  `--leaf-ink` exists for the same reason.

`npm run contrast` reads these values out of the stylesheet and fails below
WCAG AA. **Not optional** — the first cut of the colour-field design shipped
cream on haldi and looked fine to every human who reviewed it.

*Not adopted:* OKLCH. It is the right long-term home for these ramps and is
production-safe now, but converting a palette that is currently *measured* to
pass would trade a verified system for a tidier one. The migration path is to
express each hue in OKLCH, re-run `npm run contrast`, and only then swap.

### Type

Three families, each doing a job no other can:

- `--face-latin` `'Andika'` — a literacy face with single-storey a/g, because
  the child copies these letterforms by hand.
- `--face-deva` `'Tiro Devanagari Marathi'` — locale-correct letterforms; the
  Hindi-styled alternatives teach the wrong shapes.
- `--face-ui` `'Work Sans'` — everything an adult reads.

Weights cap at 600. Three families is normally too many; here each is load-
bearing and none is decorative.

### Space, radius, depth

One 4pt scale (`--s1`…`--s7`). Radii scale with the box, roughly a third of its
height. Depth is **hard offsets only** — see the signature move.

### Tap targets

| Token | Value | For |
|---|---|---|
| `--tap` | `64px` | adult controls; clears the 44px platform minimum |
| `--tap-child` | `76px` | anything a child aims at |
| `--tap-lg` | `96px` | primary actions |

76px is ~2cm, which is what the research on this age group supports: roughly
four times the adult recommendation, because the big arm-and-hand movements are
developed at two and the fine motor control is not.

Two documented exceptions, both physical rather than stylistic — a 320px-wide
trace bar cannot hold four 2cm controls plus the bead rail, and a landscape
phone has no spare height. Both step back to `--tap` rather than clip a
control. `scripts/` has no automated guard for this yet; the browser harness
checks it.

### Motion

`--press:120ms`, `--demo-ms:850ms`, `--settle` and `--scatter` as the two
curves. Every decorative animation carries `data-motion`, and `?selftest=1`
asserts none is missing — that attribute is what the reduced-motion path keys
on, so a blanket `*` kill is never needed and the 120ms press feedback
survives for users who ask for less motion.

## Rejected

- **A new visual direction.** This project has a live, documented, measured
  design system. Replacing it would have thrown away a verified contrast pass
  to gain a fresher name.
- **OKLCH conversion.** Right idea, wrong moment — see Colour.
- **Glass, blur, gradients.** They contradict the signature move outright.
- **Bento on the child's screens.** It earns its place in the grown-ups
  dashboard, which is a scanning surface. A two-year-old gets one thing at a
  time.
- **Springs with overshoot.** A bouncy interface reads as a toy that wants
  attention. This one settles.

## Field read — August 2026

**Confidence: low on the trend half, high on the durable half.**

This environment's egress proxy blocks direct page fetches, so I could not open
shipped products and read their computed styles — the top of the source
hierarchy. What came back through search was mostly roundup posts, which are
leads, not evidence. I have not invented an emerging trend to fill that gap.

| Bucket | Finding |
|---|---|
| **Converged** | Heavy glassmorphism as a global theme; full-bleed gradients; flat-with-one-blue-accent. All already absent here. |
| **Consolidating** | OKLCH-based token ramps (Tailwind v4 rebuilt its palette on it). Springs for motion that must stay attached to the finger, easing for motion the system initiates. UI durations under ~300ms. |
| **Emerging** | Not enough primary evidence to name one honestly. |
| **Durable** | ~2cm touch targets for 2–3 year olds. Contrast ratios. Visible focus. Reduced-motion paths. Legibility over style. |

**Direction of travel:** away from weightless, interchangeable flatness and
back toward interfaces with material weight and orientation cues — depth,
texture, and palettes that reference the analogue world. Notably, this is a
move *toward* where Block Print already sat, which is the strongest argument
for extending it rather than restyling.

## References

Search-derived, August 2026. Direct page fetches were blocked, so these are
recorded as leads with the specifics that came through search summaries.

- Nielsen Norman Group, *Design for Kids Based on Their Stage of Physical
  Development* — ~2cm targets for young children, 4× the adult figure.
- Bedford et al., *Toddlers' Fine Motor Milestone Achievement Is Associated
  with Early Touchscreen Scrolling* (Frontiers in Psychology, PMC4969291) —
  tap 71%, drag 41%, swipe 20%, pinch 10% at this age; assistance need falls
  from 71.8% at 2y to 57.1% at 4y.
- *Touch interaction for children aged 3 to 6 years* (ScienceDirect) —
  accuracy and dragging smoothness improve with age.
- Design-engineering writing on springs vs easing: springs where motion must
  survive interruption and preserve velocity; easing where the system is
  announcing a change. Production bounce values 0.1–0.35; UI durations
  under 300ms.
- OKLCH adoption reporting — perceptually uniform L channel, even ramps across
  hues, Tailwind v4's palette rebuilt on it, stable across evergreen browsers.

Re-run the field read before trusting the trend half again; the durable half
does not expire.
