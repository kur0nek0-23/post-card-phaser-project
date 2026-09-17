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
     optional background).
   - `layout` — where things sit in the 750x1334 design canvas. `hotspot`
     in particular needs to be re-measured to match wherever your
     open-envelope art's peeking paper corner actually is.
   - `pages` — your `{ id, type, title, body }` entries. Only `type:
     "paper"` renders today (see the schema comment in data.js for the
     reserved future types).
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
  real art and a seeded 3-page birthday message.

## Stubs — not implemented yet

These are deliberately out of scope for this build, but the surrounding
code leaves clear seams for them:

- **`paper-photo` and `finale` page types.** The `pages` schema in every
  `data.js` documents these as reserved values. `PostcardScene` only
  renders `type: "paper"` today.
- **Finale hand-off** (cake + "Happy Birthday" lettering card, candle
  flame, blow-out-the-candle mic interaction). See the comment block at
  the bottom of `PostcardScene.js` for where this wires in. When it's
  built: the mic permission prompt (`getUserMedia` + `AnalyserNode` volume
  detection) must be requested from a direct user tap (e.g. a "light the
  candle" button), never on page/scene load — browsers will block or the
  user will be confused by an unprompted permission dialog otherwise.
- **Real audio.** `core/js/audio.js` exports no-op `init()`/`play(name)`
  functions. The intended real implementation is Phaser's built-in Sound
  Manager: load clips in `BootScene` with `this.load.audio(...)`, and swap
  `play()`'s body for `scene.sound.play(name)`.

The unused assets already in `/assets/` at the repo root (polaroid frame,
finale cake/lettering card, candle flame) belong to these stubs and aren't
referenced by any postcard site yet.
