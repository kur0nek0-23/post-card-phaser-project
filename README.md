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

## Stubs — not implemented yet

These are deliberately out of scope for this build, but the surrounding
code leaves clear seams for them:

- **`paper-photo` page type.** The `pages` schema in every `data.js`
  documents this as a reserved value. `PostcardScene` renders `"paper"`
  and `"finale"` today, not this one.
- **Blow-out-the-candles interaction.** The `"finale"` page itself (cake
  card + flickering candle flames) is implemented — see `buildFinale()` in
  `PostcardScene.js`. Not implemented: extinguishing those flames via mic
  input. See the stub comment at the bottom of `PostcardScene.js` for
  where this wires in. When it's built: the mic permission prompt
  (`getUserMedia` + `AnalyserNode` volume detection) must be requested
  from a direct user tap (e.g. a "light the candle" button), never on
  page/scene load — browsers will block or the user will be confused by
  an unprompted permission dialog otherwise.
- **Real audio.** `core/js/audio.js` exports no-op `init()`/`play(name)`
  functions. The intended real implementation is Phaser's built-in Sound
  Manager: load clips in `BootScene` with `this.load.audio(...)`, and swap
  `play()`'s body for `scene.sound.play(name)`.

The polaroid frame asset already in `/assets/` at the repo root belongs to
the still-unimplemented `paper-photo` stub and isn't referenced by any
postcard site yet.
