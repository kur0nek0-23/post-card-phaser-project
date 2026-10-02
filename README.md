# Postcard (Phaser)

A birthday-postcard interaction (envelope → letter → paged pages) built on
Phaser 3, loaded via CDN with no bundler. This is a from-scratch rebuild of
an earlier DOM/CSS/GSAP version, which kept breaking on responsive sizing
because its elements were sized/positioned independently and drifted out of
alignment at different viewport widths. Phaser's Scale Manager fixes this
structurally: every visual element is positioned once in a fixed design
resolution (see `core/config.js`), and the whole scene is scaled/letterboxed
as a single unit — nothing can drift relative to anything else.

## Spinning up a new postcard site

1. Copy `/postcards/template/` to a new folder, e.g. `/postcards/my-card/`.
2. Edit `my-card/data.js`:
   - `assets` — filenames for your art (envelope closed/open, letter paper,
     optional background, and optional `finaleCard`/`flame` for the
     `"finale"` page).
   - `layout` — where things sit in the 750x1334 design canvas. `hotspot`
     in particular needs to be re-measured to match wherever your
     open-envelope art's peeking paper corner actually is.
   - `pages` — your `{ id, type, title, body }` entries. `"paper"` and
     `"finale"` render today (see the schema comment in data.js — `finale`
     needs `layout.finale.candles` measured against your own card art).
3. Replace the files in `my-card/assets/` with your own art.
4. Open `my-card/index.html` (via a local static server, not `file://`,
   since it uses ES module imports).

No file under `/core/` needs to change for a new postcard site.

## Project structure

- `/core/` — shared engine (Phaser scenes, config). Edited once, reused by
  every postcard site.
  - `config.js` — design resolution + Scale Manager config, imported by
    each site's `index.html`.
  - `js/BootScene.js` — preload scene; loads whatever's in the site's
    `data.js` `assets` manifest.
  - `js/PostcardScene.js` — the envelope → letter → paged-pages flow.
  - `js/audio.js` — thin wrapper around Phaser's Sound Manager; plays
    whatever a site loaded via its `sounds` manifest (see below).
- `/postcards/template/` — starter scaffold.
- `/postcards/for-wlh/` — a working postcard built from the template, using
  real art and a seeded 4-page birthday message (3 letter pages + finale).

## Blow-out-the-candles interaction

The finale page's candles are for real: `layout.finale` in `data.js`
positions four candle flames (`core/js/PostcardScene.js`,
`buildFinaleVisuals()`) with an idle stop-motion flicker
(`startFlameFlicker()`). Tapping "Tap to blow" requests the mic
(`core/js/candleMic.js` wraps the `getUserMedia`/`AnalyserNode` plumbing;
the request itself happens directly inside the button's tap handler,
`handleBlowButtonTap()`, since browsers require that gesture — never on
page/scene load). Granted mic access feeds a fill/decay progress bar
(`startListening()`) that intensifies the flame flicker while blowing;
completing it plays a wind-blown extinguish animation
(`extinguishFlame()`) and releases the mic. Denied/unavailable mic access
shows an inline retry message instead of leaving the user stuck.
`BLOW_VOLUME_THRESHOLD`/`BLOW_FILL_RATE`/`BLOW_DECAY_RATE` (top of that
section in `PostcardScene.js`) are the numbers to retune against a real
mic if the sensitivity ever feels off.

## Audio

A site opts into sound by adding a `sounds` manifest to its `data.js`
(same key -> path shape as `assets`, loaded via `this.load.audio` in
BootScene instead of `this.load.image`) and passing it into the registry
in `index.html` alongside `assets`/`layout`/`pages`. `core/js/audio.js`'s
`play(name)` is a quiet no-op for any key a site didn't load — a site
with no `sounds` manifest at all (like `postcards/template`) works
exactly as before.

`postcards/for-wlh` wires up four clips PostcardScene already calls by
name: `bgMusic` (starts once the closed envelope's zoom/fade-in intro
finishes), `envelopeOpen` (tapping the closed envelope),
`paperFlip` (every page turn, either direction), and `candleBlow`
(finishing the blow-out). Browsers require a user gesture before audio
can actually start, so `bgMusic`'s autoplay attempt may be silently
queued by Phaser until the very next tap unlocks audio, rather than
playing the instant the envelope appears, on some browsers.

## Text reveal + photo fade-in

Each "paper" page's title/body (and `closing`, if present) types itself
on letter by letter, in reading order, with each character fading in
individually rather than popping to full opacity — `renderPageLayer()`
builds a fresh set of per-character Text objects from the (invisible,
measurement-only) title/body/closing Text objects via
`layOutTypedText()`, then reveals them on a timer via `startTypewriter()`
(`PostcardScene.TYPEWRITER_CHAR_INTERVAL_MS`/`TYPEWRITER_CHAR_FADE_DURATION`
tune the pace). A page's photo overlay fades in on its own separate timer
(`PostcardScene.PHOTO_FADE_DURATION`) — deliberately not synced to the
text's typing pace.

## Stubs — not implemented yet

- **A photo actually inside the polaroid frame's die-cut window.** Any
  page can overlay a photo now (see the `photo` field in the pages-array
  schema comment in data.js, and `buildPhotoOverlay()` in
  PostcardScene.js) — the "One more thing..." example page in
  postcards/for-wlh uses this for a full photo. What's still missing is
  compositing a *second* image specifically into the polaroid frame's
  blank window (as used on the "PS" page) — today that window just stays
  empty/blank, since the frame is the only image there.
