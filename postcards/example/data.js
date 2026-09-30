// Per-site content + art. Copy this whole /postcards/<name>/ folder, edit
// this file and swap /assets/ to make a new postcard — no engine code
// (anything under /core/) needs to change.

// Asset manifest: logical key -> path relative to this file's folder.
// BootScene loads exactly these keys. `background` is optional — omit or
// leave falsy to skip it.
export const assets = {
  background: './assets/Background.jpg',
  envelopeClosed: './assets/envelope-closed-cutout.png',
  envelopeOpen: './assets/envelope-open-cutout.png',
  paper: './assets/paper-stack-cutout.png',
  finaleCard: './assets/birthday-card.png',
  flame: './assets/flame-cutout.png',
  polaroidFrame: './assets/polaroid-frame-cutout.png',
  portraitFinal: './assets/Portrait-final.png',
};

// Layout: where things sit in the 750x1334 design-resolution canvas
// (core/config.js). These numbers are specific to the geometry of the art
// above (e.g. `hotspot` marks where this envelope's baked-in peeking paper
// corner actually is) — a different envelope/paper illustration would need
// these re-measured, but nothing in /core/ would change.
// Envelope and paper share the same vertical center (575) rather than the
// canvas's true center (667), since that leaves balanced empty space above
// the envelope and below the paper once the ~250px reserved for the nav
// buttons/dots near the bottom of the canvas is accounted for.
export const layout = {
  // envelope.width is the FULL source image's display width, including the
  // transparent padding baked around the art — the actual visible envelope
  // shape is only ~58% of that (its opaque bounding box within
  // envelope-*-cutout.png's 1408x768 canvas). Past width ~1300, the visible
  // shape exceeds the 750px design canvas and starts clipping at the left/
  // right edges — invisible on a wide window (blends into the matching
  // backdrop color) but very visible on a narrow one (clips flush against
  // the screen edge, with zero letterbox margin to hide it in). 1200 is
  // close to the practical max before that clipping kicks in.
  envelope: { x: 375, y: 575, width: 1200 },
  hotspot: { x: 421, y: 493, width: 364, height: 193 },
  paper: { width: 800, restX: 375, restY: 575 },
  // `finale` positions candle flames for the "finale" page type below.
  // `candles` are wick-tip positions measured from birthday-card.png,
  // as offsets from the card's own center (it renders at the same
  // position/scale as `paper` above, so these are local to that same
  // space). `flameHeight` is the target on-screen height (design px) of
  // each flame's opaque shape.
  finale: {
    flameHeight: 62,
    candles: [
      { x: -65, y: -27 },
      { x: -19, y: -30 },
      { x: 25, y: -30 },
      { x: 67, y: -29 },
    ],
  },
  // Photo overlays are configured per-page now (see the `photo` field on
  // individual entries in `pages` below), not here — different pages want
  // different images in different spots. `x`/`y` on a page's `photo` are
  // offsets from the paper's own center (local to the same space as
  // `finale.candles` above); `width` is the image's own full-canvas
  // display width (same convention as `paper.width`/`envelope.width`);
  // `rotation` is in degrees.
  //
  // Watch for the same clipping trap as envelope.width above when placing
  // one near an edge (e.g. the "PS" page's polaroid, which deliberately
  // overhangs the paper's own edge): a ROTATED image's bounding box is
  // bigger than its unrotated one — a tilted rectangle's corners sweep
  // out further — and can cross the 750px design canvas edge and get
  // clipped, same as any other canvas content. Verify against the
  // object's actual getBounds() rather than eyeballing it if you push one
  // out close to an edge; rotation makes the safe range harder to guess
  // than the envelope's was.
};

// Data-driven page array. Every entry is { id, type, title, body, photo? }.
//
// "paper" and "finale" are the two page types PostcardScene implements:
//   - "paper": title/body text on the paper background. Optionally add a
//     `photo` field — { asset, width, x, y, rotation } — to overlay an
//     image on top of the paper and its text (e.g. a polaroid or a full
//     photo); see `layout` above for what those fields mean, and the "PS"
//     and "One more thing..." pages below for two different examples
//     (one overhanging the paper's corner, one contained within it).
//     Omit `photo` for a plain text-only page.
//   - "finale": renders the cake + "Happy Birthday" lettering card
//     (finaleCard) with flickering candle flames on top; title/body are
//     unused since the card art is fully baked. The mic-based blow-out-
//     the-candle interaction is a separate future feature — see the stub
//     comment at the bottom of PostcardScene.js.
export const pages = [
  {
    id: 1,
    type: 'paper',
    title: 'Happy Birthday!',
    body:
      "Wishing you the happiest of birthdays! I hope your day is filled " +
      "with all your favorite things — good food, good company, and " +
      "maybe a little too much cake. Here's to another year of you " +
      "being exactly as wonderful as you are.",
  },
  {
    id: 2,
    type: 'paper',
    title: 'PS',
    body: 'You\'re the best.',
    // Deliberately overhangs the paper's bottom-right corner rather than
    // sitting inside its printed area — see the clipping-trap note above.
    photo: { asset: 'polaroidFrame', width: 280, x: 180, y: 380, rotation: 8 },
  },
  {
    id: 3,
    type: 'paper',
    title: 'One more thing...',
    body:
      "TEST PARAGRAPH",
    // Contained within the paper's own printed area (not overhanging its
    // edge like the polaroid above) — sits near the bottom, tilted, on
    // top of whatever text is underneath it.
    photo: { asset: 'portraitFinal', width: 420, x: 0, y: 280, rotation: -5 },
  },
  {
    id: 4,
    type: 'finale',
    title: '',
    body: '',
  },
];
