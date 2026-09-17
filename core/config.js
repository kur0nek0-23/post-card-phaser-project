// Shared Phaser game config, reused by every postcard site.
// Edited once here; individual postcard sites never duplicate this.

// Fixed design resolution. Every visual element in every scene is positioned
// in these coordinates. Phaser's Scale Manager (FIT + CENTER_BOTH below)
// scales/letterboxes the whole canvas as a single unit to fit any real
// viewport, so nothing can drift relative to anything else at different
// aspect ratios.
export const DESIGN_WIDTH = 750;
export const DESIGN_HEIGHT = 1334;

export function createGameConfig(scenes) {
  return {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    // Transparent rather than an opaque fill color: the page itself draws
    // a full-viewport backdrop behind the canvas (see index.html), and on
    // a wide window Scale.FIT letterboxes this canvas with empty margins —
    // transparent lets that backdrop show through those margins instead of
    // a flat color. Any postcard site that seeds its own in-scene
    // background image (drawn by PostcardScene) still fully covers the
    // canvas itself, so this only matters where a site has no such image.
    transparent: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: DESIGN_WIDTH,
      height: DESIGN_HEIGHT,
    },
    scene: scenes,
  };
}
