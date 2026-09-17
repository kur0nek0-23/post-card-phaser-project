// STUB — no real audio yet. Kept as a no-op module so PostcardScene can call
// audio.init()/audio.play(name) unconditionally without every postcard site
// needing to care whether sound has been implemented.
//
// Intended real implementation: Phaser's built-in Sound Manager. In
// BootScene, load clips with `this.load.audio(name, url)`; here, replace
// init() with storing the scene reference and replace play() with
// `scene.sound.play(name)`. No third-party audio library is needed.

export function init(_scene) {
  // no-op
}

export function play(_name) {
  // no-op
}
