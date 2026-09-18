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
  - `js/audio.js` — stub (see below).
- `/postcards/template/` — starter scaffold.
- `/postcards/example/` — a working postcard built from the template, using
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

## Stubs — not implemented yet

- **Real audio.** `core/js/audio.js` exports no-op `init()`/`play(name)`
  functions. The intended real implementation is Phaser's built-in Sound
  Manager: load clips in `BootScene` with `this.load.audio(...)`, and swap
  `play()`'s body for `scene.sound.play(name)`. This includes any sound
  for the blow-out interaction above — it's mic input and visuals only
  right now, no audio feedback.
- **Photo compositing for `"paper-photo"` pages.** The polaroid overlay
  itself renders (`buildPolaroidOverlay()`), but always shows the frame's
  own blank/empty photo window — there's no mechanism yet for compositing
  an actual photo image into that window.
