import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../config.js';

// Loads every asset named in the postcard site's data.js `assets` manifest
// (images) and `sounds` manifest (audio clips), then hands off to
// PostcardScene. Generic across all postcard sites — it never hardcodes
// a filename, only each manifest's keys/paths.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    const postcard = this.game.registry.get('postcard');
    const assets = postcard.assets || {};
    const sounds = postcard.sounds || {};

    this.add.text(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, 'Loading…', {
      fontFamily: 'Georgia, serif',
      fontSize: '32px',
      color: '#ffffff',
    }).setOrigin(0.5);

    Object.entries(assets).forEach(([key, path]) => {
      if (!path) return;
      this.load.image(key, path);
    });

    Object.entries(sounds).forEach(([key, path]) => {
      if (!path) return;
      this.load.audio(key, path);
    });
  }

  create() {
    this.scene.start('PostcardScene');
  }
}
