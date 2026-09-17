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
};

// Layout: where things sit in the 750x1334 design-resolution canvas
// (core/config.js). These numbers are specific to the geometry of the art
// above (e.g. `hotspot` marks where this envelope's baked-in peeking paper
// corner actually is) — swapping in different art means re-measuring these,
// but nothing in /core/ needs to change.
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
  // the screen edge, with zero letterbox margin to hide it in).
  envelope: { x: 375, y: 575, width: 867 },
  hotspot: { x: 408, y: 516, width: 263, height: 139 },
  paper: { width: 520, restX: 375, restY: 575 },
  // `finale` positions candle flames for the "finale" page type below.
  // `candles` are wick-tip positions measured from birthday-card.png, as
  // offsets from the card's own center (it renders at the same
  // position/scale as `paper` above, so these are local to that same
  // space). `flameHeight` is the target on-screen height (design px) of
  // each flame's opaque shape.
  finale: {
    flameHeight: 40,
    candles: [
      { x: -42, y: -18 },
      { x: -12, y: -20 },
      { x: 17, y: -20 },
      { x: 44, y: -19 },
    ],
  },
};

// Data-driven page array. Every entry is { id, type, title, body }.
//
// "paper" and "finale" are implemented by PostcardScene. One more type is
// reserved for later without changing this shape:
//   - "paper-photo": a paper page with a polaroid photo composited on top,
//     alongside title/body text.
// "finale" renders the cake + "Happy Birthday" lettering card (finaleCard)
// with flickering candle flames on top; title/body are unused for this
// type since the card art is fully baked. The mic-based blow-out-the-
// candle interaction is a separate future feature — see the stub comment
// at the bottom of PostcardScene.js.
export const pages = [
  {
    id: 1,
    type: 'paper',
    title: 'Your title here',
    body: 'Edit data.js to add your own pages, then swap the art in ./assets/.',
  },
  {
    id: 2,
    type: 'finale',
    title: '',
    body: '',
  },
];
