// Thin wrapper around Phaser's built-in Sound Manager. PostcardScene calls
// audio.init()/audio.play(name) unconditionally, without needing to know
// whether a given postcard site actually loaded any sounds — play() is a
// quiet no-op if the named clip was never loaded (e.g. a site with no
// `sounds` manifest, or one missing this particular key).
//
// Loading happens in BootScene, from each site's data.js `sounds`
// manifest, via `this.load.audio(name, url)` — this module never loads
// anything itself, it only plays clips the scene already has.

let currentScene = null;

export function init(scene) {
  currentScene = scene;
}

export function play(name, config) {
  if (!currentScene || !currentScene.cache.audio.exists(name)) return;
  currentScene.sound.play(name, config);
}
