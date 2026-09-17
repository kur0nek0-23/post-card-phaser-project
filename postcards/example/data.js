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
// corner actually is) — a different envelope/paper illustration would need
// these re-measured, but nothing in /core/ would change.
// Envelope and paper share the same vertical center (575) rather than the
// canvas's true center (667), since that leaves balanced empty space above
// the envelope and below the paper once the ~250px reserved for the nav
// buttons/dots near the bottom of the canvas is accounted for.
export const layout = {
  envelope: { x: 375, y: 575, width: 867 },
  hotspot: { x: 408, y: 516, width: 263, height: 139 },
  paper: { width: 520, restX: 375, restY: 575 },
};

// Data-driven page array. Every entry is { id, type, title, body }.
//
// Only "paper" is implemented by PostcardScene. Two more types are
// reserved for later without changing this shape:
//   - "paper-photo": a paper page with a polaroid photo (see
//     polaroid-frame-cutout.png, out of scope for this build) composited
//     on top, alongside title/body text.
//   - "finale": the closing cake + "Happy Birthday" lettering card and the
//     mic-based blow-out-the-candle interaction (see the stub comment at
//     the bottom of PostcardScene.js), out of scope for this build.
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
  },
  {
    id: 3,
    type: 'paper',
    title: 'One more thing...',
    body:
      "I've been trying to think of the perfect way to say this, so " +
      "here goes: knowing you has made every year better than the one " +
      "before it, and I don't say that lightly.\n\n" +
      "Thank you for the late-night conversations, the terrible jokes " +
      "you insist on telling, and for always showing up when it " +
      "actually matters. Not everyone gets a friend like that, and I " +
      "know exactly how lucky I am.\n\n" +
      "So here's to another trip around the sun — may it bring you " +
      "just as much joy as you bring everyone around you. Happy " +
      "birthday, truly. I can't wait to see what this year has in " +
      "store for you.",
  },
];
