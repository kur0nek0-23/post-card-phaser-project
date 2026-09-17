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
  envelope: { x: 375, y: 575, width: 650 },
  hotspot: { x: 400, y: 530, width: 197, height: 105 },
  paper: { width: 520, restX: 375, restY: 575 },
};

// Data-driven page array. Every entry is { id, type, title, body }.
//
// Only "paper" is implemented by PostcardScene. Two more types are
// reserved for later without changing this shape:
//   - "paper-photo": a paper page with a polaroid photo composited on top,
//     alongside title/body text.
//   - "finale": the closing cake + lettering card and the mic-based
//     blow-out-the-candle interaction.
export const pages = [
  {
    id: 1,
    type: 'paper',
    title: 'Your title here',
    body: 'Edit data.js to add your own pages, then swap the art in ./assets/.',
  },
];
