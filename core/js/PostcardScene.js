import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../config.js';
import * as audio from './audio.js';

// Fit a Phaser Text object's font size into a box by shrinking it (never
// growing past maxSize) until its wrapped height fits, or minSize is hit.
function fitTextToBox(text, maxWidth, maxHeight, maxSize, minSize) {
  text.setWordWrapWidth(maxWidth, true);
  let size = maxSize;
  text.setFontSize(size);
  while (text.height > maxHeight && size > minSize) {
    size -= 1;
    text.setFontSize(size);
  }
}

export class PostcardScene extends Phaser.Scene {
  constructor() {
    super('PostcardScene');
  }

  create() {
    const postcard = this.game.registry.get('postcard');
    this.layout = postcard.layout;
    this.pages = postcard.pages;
    this.currentIndex = 0;
    this.isTransitioning = false;

    this.buildBackground();
    this.buildEnvelope();
    this.buildHotspot();
    this.buildLetter();
    this.buildFinale();
    this.buildNavZones();
    this.buildNavButtons();
    this.buildProgressDots();

    audio.init(this);

    this.enterClosedState();
  }

  // ---- background -------------------------------------------------------

  buildBackground() {
    if (!this.textures.exists('background')) return;
    const bg = this.add.image(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, 'background');
    bg.setDepth(-10);
    // Cover-fit: scale up so the design canvas is fully covered, cropping
    // overflow rather than stretching/distorting.
    const scale = Math.max(DESIGN_WIDTH / bg.width, DESIGN_HEIGHT / bg.height);
    bg.setScale(scale);
  }

  // ---- envelope -----------------------------------------------------------

  buildEnvelope() {
    const { x, y, width } = this.layout.envelope;
    const scale = width / this.textures.get('envelopeClosed').getSourceImage().width;

    this.envelopeClosed = this.add.image(x, y, 'envelopeClosed').setScale(scale).setDepth(0);
    this.envelopeOpen = this.add.image(x, y, 'envelopeOpen').setScale(scale).setDepth(0).setAlpha(0);

    this.envelopeClosed.setInteractive({ useHandCursor: true });
    this.envelopeClosed.on('pointerdown', () => this.openEnvelope());
  }

  openEnvelope() {
    if (this.state !== 'closed') return;
    this.state = 'transitioning-open';
    this.envelopeClosed.disableInteractive();

    // Crossfade closed -> open, with a quick subtle scale/settle so the
    // swap doesn't feel like a flat cut.
    const baseScale = this.envelopeOpen.scaleX;
    this.envelopeOpen.setScale(baseScale * 0.96);

    this.tweens.add({
      targets: this.envelopeClosed,
      alpha: 0,
      duration: 350,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: this.envelopeOpen,
      alpha: 1,
      scale: baseScale,
      duration: 350,
      ease: 'Back.easeOut',
      onComplete: () => this.enterOpenState(),
    });
  }

  enterClosedState() {
    this.state = 'closed';
  }

  enterOpenState() {
    this.state = 'open';
    this.hotspotZone.setInteractive({ useHandCursor: true });
    this.startEnvelopeBob();
  }

  startEnvelopeBob() {
    const baseY = this.envelopeOpen.y;
    this.envelopeBobTween = this.tweens.add({
      targets: this.envelopeOpen,
      y: baseY - 6,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  stopEnvelopeBob() {
    if (this.envelopeBobTween) {
      this.envelopeBobTween.stop();
      this.envelopeBobTween = null;
    }
    this.envelopeOpen.y = this.layout.envelope.y;
  }

  // ---- peeking-corner hotspot --------------------------------------------

  buildHotspot() {
    const { x, y, width, height } = this.layout.hotspot;
    this.hotspotZone = this.add.zone(x, y, width, height).setOrigin(0.5).setDepth(1);
    this.hotspotZone.on('pointerdown', () => this.pullOutLetter());
  }

  pullOutLetter() {
    if (this.state !== 'open') return;
    this.state = 'transitioning-reveal';
    this.hotspotZone.disableInteractive();
    this.stopEnvelopeBob();

    const { restX, restY } = this.layout.paper;
    const hotspot = this.layout.hotspot;

    this.letterContainer.setPosition(hotspot.x, hotspot.y + 20);
    this.letterContainer.setScale(0.35);
    this.letterContainer.setAlpha(0.4);
    this.letterContainer.setVisible(true);

    this.tweens.add({
      targets: this.letterContainer,
      x: restX,
      y: restY,
      scale: 1,
      alpha: 1,
      duration: 550,
      ease: 'Cubic.easeOut',
      onComplete: () => this.enterReadingState(),
    });
  }

  enterReadingState() {
    this.state = 'reading';
    this.leftZone.setInteractive();
    this.rightZone.setInteractive();
    this.prevButton.setInteractive().setVisible(true);
    this.nextButton.setInteractive().setVisible(true);
    this.dots.forEach((dot) => dot.setVisible(true));
    this.renderPage(this.currentIndex);
    this.updateProgressDots();
  }

  // ---- letter / paper -----------------------------------------------------

  buildLetter() {
    const { width } = this.layout.paper;
    const paperTexture = this.textures.get('paper').getSourceImage();
    const scale = width / paperTexture.width;
    const displayHeight = paperTexture.height * scale;

    this.letterContainer = this.add.container(0, 0).setDepth(10).setVisible(false);

    this.paperImage = this.add.image(0, 0, 'paper').setScale(scale);
    this.letterContainer.add(this.paperImage);

    // Text is inset well inside the paper's opaque printed area so it
    // never spills past the paper's edges, on both the shortest and
    // longest seeded pages.
    const insetTop = displayHeight * 0.20;
    const insetBottom = displayHeight * 0.22;
    const insetSide = width * 0.16;
    const textAreaWidth = width - insetSide * 2;
    const textTop = -displayHeight / 2 + insetTop;
    const textBottom = displayHeight / 2 - insetBottom;

    this.titleText = this.add.text(0, textTop, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '34px',
      color: '#3a2f28',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: textAreaWidth },
    }).setOrigin(0.5, 0);

    this.bodyText = this.add.text(0, 0, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '24px',
      color: '#3a2f28',
      align: 'center',
      wordWrap: { width: textAreaWidth },
    }).setOrigin(0.5, 0);

    this.letterContainer.add(this.titleText);
    this.letterContainer.add(this.bodyText);

    this._textLayout = { textAreaWidth, textTop, textBottom };
  }

  renderPage(index) {
    const page = this.pages[index];
    const isFinale = page.type === 'finale';

    this.paperImage.setVisible(!isFinale);
    this.titleText.setVisible(!isFinale);
    this.bodyText.setVisible(!isFinale);
    if (this.finaleImage) this.finaleImage.setVisible(isFinale);
    this.flames.forEach((flame) => flame.setVisible(isFinale));

    if (isFinale) return; // finale card is fully baked art — no text to lay out

    const { textAreaWidth, textTop, textBottom } = this._textLayout;

    this.titleText.setText(page.title);
    this.titleText.setY(textTop);

    this.bodyText.setText(page.body);
    const bodyTop = textTop + this.titleText.height + 24;
    this.bodyText.setY(bodyTop);
    const bodyMaxHeight = textBottom - bodyTop;
    fitTextToBox(this.bodyText, textAreaWidth, bodyMaxHeight, 26, 16);
  }

  // ---- finale (cake + flickering candles) ----------------------------------

  // Measured from flame-cutout.png's own opaque bounding box (a 1408x768
  // canvas): the flame sits with its base — where it should touch a candle
  // wick — at roughly the horizontal center, 85% of the way down the image.
  // Anchoring the flame's origin there (rather than the image center) means
  // it can be scaled for size without also having to recompute its position.
  static FLAME_ORIGIN_X = 0.4993;
  static FLAME_ORIGIN_Y = 0.8477;
  static FLAME_NATIVE_OPAQUE_HEIGHT = 520;

  buildFinale() {
    const finale = this.layout.finale;
    this.flames = [];

    if (!finale || !this.textures.exists('finaleCard')) {
      this.finaleImage = null;
      return;
    }

    // Shares the paper's stage scale/position, per the "same containment
    // rules as the other paper pages" — both source images are the same
    // 848x1264 canvas convention, so this lines up automatically.
    const { width } = this.layout.paper;
    const cardTexture = this.textures.get('finaleCard').getSourceImage();
    const scale = width / cardTexture.width;

    this.finaleImage = this.add.image(0, 0, 'finaleCard').setScale(scale).setVisible(false);
    this.letterContainer.add(this.finaleImage);

    if (!this.textures.exists('flame')) return;

    const flameScale = (finale.flameHeight || 40) / PostcardScene.FLAME_NATIVE_OPAQUE_HEIGHT;

    this.flames = (finale.candles || []).map((candle) => {
      const flame = this.add
        .image(candle.x, candle.y, 'flame')
        .setOrigin(PostcardScene.FLAME_ORIGIN_X, PostcardScene.FLAME_ORIGIN_Y)
        .setScale(flameScale)
        .setVisible(false);
      this.letterContainer.add(flame);
      this.startFlameFlicker(flame, candle.x, candle.y, flameScale);
      return flame;
    });
  }

  // Stop-motion style flicker: a handful of hand-posed variations, snapped
  // between on a low-frequency timer with no easing — a hard cut every
  // tick, not a smooth tween. Each flame picks randomly from its own pose
  // set and runs on its own independently-randomized interval/phase, so
  // multiple candles never step in visible unison.
  startFlameFlicker(flame, baseX, baseY, baseScale) {
    const poses = [
      { sx: 1.00, sy: 1.00, rot: 0, dx: 0, dy: 0 },
      { sx: 1.10, sy: 0.92, rot: -6, dx: -1, dy: -1 },
      { sx: 0.90, sy: 1.08, rot: 5, dx: 1, dy: 0 },
      { sx: 1.05, sy: 0.96, rot: 7, dx: 0, dy: -2 },
      { sx: 0.95, sy: 1.04, rot: -7, dx: -1, dy: 1 },
      { sx: 1.03, sy: 1.02, rot: 3, dx: 1, dy: -1 },
    ];

    const applyRandomPose = () => {
      const pose = Phaser.Utils.Array.GetRandom(poses);
      flame.setScale(baseScale * pose.sx, baseScale * pose.sy);
      flame.setAngle(pose.rot);
      flame.setPosition(baseX + pose.dx, baseY + pose.dy);
    };

    const interval = Phaser.Math.Between(90, 140);
    const startDelay = Phaser.Math.Between(0, interval);

    applyRandomPose();
    this.time.delayedCall(startDelay, () => {
      this.time.addEvent({ delay: interval, loop: true, callback: applyRandomPose });
    });
  }

  goToPage(delta) {
    if (this.state !== 'reading' || this.isTransitioning) return;
    const next = this.currentIndex + delta;
    if (next < 0 || next >= this.pages.length) return; // no-op at ends

    this.isTransitioning = true;
    this.currentIndex = next;
    this.updateProgressDots();

    // The envelope layer underneath is never touched by this transition —
    // only the paper+text container crossfades.
    this.tweens.add({
      targets: this.letterContainer,
      alpha: 0,
      duration: 160,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.renderPage(this.currentIndex);
        this.tweens.add({
          targets: this.letterContainer,
          alpha: 1,
          duration: 160,
          ease: 'Sine.easeOut',
          onComplete: () => {
            this.isTransitioning = false;
          },
        });
      },
    });
  }

  // ---- navigation: tap zones + buttons -------------------------------------

  buildNavZones() {
    // Not interactive yet: these cover the full canvas, which would
    // otherwise sit above (and steal input from) the closed envelope and
    // the open-envelope hotspot during earlier states. Left uninitialized
    // (input stays null) until enterReadingState() calls setInteractive()
    // for the first time.
    this.leftZone = this.add
      .zone(0, 0, DESIGN_WIDTH / 2, DESIGN_HEIGHT)
      .setOrigin(0, 0)
      .setDepth(1);
    this.leftZone.on('pointerdown', () => this.goToPage(-1));

    this.rightZone = this.add
      .zone(DESIGN_WIDTH / 2, 0, DESIGN_WIDTH / 2, DESIGN_HEIGHT)
      .setOrigin(0, 0)
      .setDepth(1);
    this.rightZone.on('pointerdown', () => this.goToPage(1));
  }

  buildNavButtons() {
    this.prevButton = this.makeNavButton(150, 1220, '< Prev', () => this.goToPage(-1));
    this.nextButton = this.makeNavButton(600, 1220, 'Next >', () => this.goToPage(1));
    // Hidden until there's a letter to page through (enterReadingState reveals them).
    this.prevButton.setVisible(false);
    this.nextButton.setVisible(false);
  }

  makeNavButton(x, y, label, onClick) {
    const width = 160;
    const height = 60;
    const container = this.add.container(x, y).setDepth(2);
    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.35).setStrokeStyle(1, 0xffffff, 0.6);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Georgia, serif',
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5);
    container.add([bg, text]);
    // Containers have no implicit hit area (no texture/frame), so a
    // Rectangle in local space (centered on 0,0, matching the children
    // above) has to be given explicitly, bundled with useHandCursor in the
    // same config object. This is the only setInteractive() call this
    // object ever gets — it starts disabled, and enterReadingState() later
    // re-enables it with a bare setInteractive() (no args), which reuses
    // this existing hit area/cursor config instead of trying to derive a
    // fresh one (which would fail for a Container without one).
    container.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    container.disableInteractive();
    container.on('pointerdown', onClick);
    return container;
  }

  // ---- progress dots --------------------------------------------------------

  buildProgressDots() {
    const total = this.pages.length;
    const spacing = 32;
    const startX = DESIGN_WIDTH / 2 - ((total - 1) * spacing) / 2;
    const y = 1300;

    this.dots = [];
    for (let i = 0; i < total; i++) {
      // Dark warm tone (matches the letter text color) rather than white,
      // since this sits over a light cream background where white dots
      // would have almost no contrast.
      const dot = this.add.circle(startX + i * spacing, y, 7, 0x3a2f28, 0.3).setDepth(2).setVisible(false);
      this.dots.push(dot);
    }
  }

  updateProgressDots() {
    this.dots.forEach((dot, i) => {
      dot.setFillStyle(0x3a2f28, i === this.currentIndex ? 1 : 0.3);
    });
  }

  // ---------------------------------------------------------------------
  // BLOW-OUT-THE-CANDLES HAND-OFF (stub): the finale page itself (cake
  // card + flickering candle flames, buildFinale() above) is implemented.
  // Still not implemented: the mic-based "blow out the candles"
  // interaction that would extinguish the flames on this page. That will
  // need getUserMedia + AnalyserNode volume detection, and per browser
  // autoplay/permission rules the mic prompt MUST be triggered from a
  // direct user tap (e.g. a "light the candle" button), never on scene
  // load. The "paper-photo" page type remains unimplemented too (see the
  // schema comment in data.js).
  // ---------------------------------------------------------------------
}
