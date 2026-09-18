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
    const activeContainer = this.pageLayers[this.activeLayerIndex].container;

    activeContainer.setPosition(hotspot.x, hotspot.y + 20);
    activeContainer.setScale(0.35);
    activeContainer.setAlpha(0.4);
    activeContainer.setVisible(true);

    this.tweens.add({
      targets: activeContainer,
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
    this.renderPageLayer(this.pageLayers[this.activeLayerIndex], this.currentIndex);
    this.updateProgressDots();
  }

  // ---- letter / paper -----------------------------------------------------

  // Two independent, fully-populated visual layers rather than one shared
  // set of objects. A true crossfade needs the outgoing page's finished
  // content fading out while the incoming page's content fades in on top
  // of it, at the same time — one shared layer can only empty out and then
  // refill, which shows a gap in between rather than a cross-dissolve.
  buildLetter() {
    this.pageLayers = [this.buildPageLayer(), this.buildPageLayer()];
    this.activeLayerIndex = 0;
  }

  buildPageLayer() {
    const { width } = this.layout.paper;
    const paperTexture = this.textures.get('paper').getSourceImage();
    const scale = width / paperTexture.width;
    const displayHeight = paperTexture.height * scale;

    const container = this.add.container(0, 0).setDepth(10).setVisible(false);

    const paperImage = this.add.image(0, 0, 'paper').setScale(scale);
    container.add(paperImage);

    // Text is inset well inside the paper's opaque printed area so it
    // never spills past the paper's edges, on both the shortest and
    // longest seeded pages.
    const insetTop = displayHeight * 0.20;
    const insetBottom = displayHeight * 0.22;
    const insetSide = width * 0.16;
    const textAreaWidth = width - insetSide * 2;
    const textTop = -displayHeight / 2 + insetTop;
    const textBottom = displayHeight / 2 - insetBottom;

    const titleText = this.add.text(0, textTop, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '34px',
      color: '#3a2f28',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: textAreaWidth },
    }).setOrigin(0.5, 0);

    const bodyText = this.add.text(0, 0, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '24px',
      color: '#3a2f28',
      align: 'center',
      wordWrap: { width: textAreaWidth },
    }).setOrigin(0.5, 0);

    container.add(titleText);
    container.add(bodyText);

    const { finaleImage, flames } = this.buildFinaleVisuals(container, width);

    return {
      container,
      paperImage,
      titleText,
      bodyText,
      finaleImage,
      flames,
      textLayout: { textAreaWidth, textTop, textBottom },
    };
  }

  renderPageLayer(layer, index) {
    const page = this.pages[index];
    const isFinale = page.type === 'finale';

    layer.paperImage.setVisible(!isFinale);
    layer.titleText.setVisible(!isFinale);
    layer.bodyText.setVisible(!isFinale);
    if (layer.finaleImage) layer.finaleImage.setVisible(isFinale);
    layer.flames.forEach((flame) => flame.setVisible(isFinale));

    if (isFinale) return; // finale card is fully baked art — no text to lay out

    const { textAreaWidth, textTop, textBottom } = layer.textLayout;

    layer.titleText.setText(page.title);
    layer.titleText.setY(textTop);

    layer.bodyText.setText(page.body);
    const bodyTop = textTop + layer.titleText.height + 24;
    layer.bodyText.setY(bodyTop);
    const bodyMaxHeight = textBottom - bodyTop;
    fitTextToBox(layer.bodyText, textAreaWidth, bodyMaxHeight, 26, 16);
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

  // Builds one layer's finale (cake card + candle flames) visuals into the
  // given container, so each of the two crossfading layers gets its own
  // fully independent copy — including its own flame flicker timers.
  buildFinaleVisuals(container, paperWidth) {
    const finale = this.layout.finale;
    if (!finale || !this.textures.exists('finaleCard')) {
      return { finaleImage: null, flames: [] };
    }

    // Shares the paper's stage scale/position, per the "same containment
    // rules as the other paper pages" — both source images are the same
    // 848x1264 canvas convention, so this lines up automatically.
    const cardTexture = this.textures.get('finaleCard').getSourceImage();
    const scale = paperWidth / cardTexture.width;

    const finaleImage = this.add.image(0, 0, 'finaleCard').setScale(scale).setVisible(false);
    container.add(finaleImage);

    if (!this.textures.exists('flame')) {
      return { finaleImage, flames: [] };
    }

    const flameScale = (finale.flameHeight || 40) / PostcardScene.FLAME_NATIVE_OPAQUE_HEIGHT;

    const flames = (finale.candles || []).map((candle) => {
      const flame = this.add
        .image(candle.x, candle.y, 'flame')
        .setOrigin(PostcardScene.FLAME_ORIGIN_X, PostcardScene.FLAME_ORIGIN_Y)
        .setScale(flameScale)
        .setVisible(false);
      container.add(flame);
      this.startFlameFlicker(flame, candle.x, candle.y, flameScale);
      return flame;
    });

    return { finaleImage, flames };
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

  // Shared duration (ms) for both halves of the page crossfade below.
  static PAGE_CROSSFADE_DURATION = 250;

  goToPage(delta) {
    if (this.state !== 'reading' || this.isTransitioning) return;
    const next = this.currentIndex + delta;
    if (next < 0 || next >= this.pages.length) return; // no-op at ends

    this.isTransitioning = true;
    this.currentIndex = next;
    this.updateProgressDots();

    const outgoing = this.pageLayers[this.activeLayerIndex];
    const incomingIndex = 1 - this.activeLayerIndex;
    const incoming = this.pageLayers[incomingIndex];

    // A real crossfade: render the new page into the OTHER layer while
    // it's invisible, then fade both layers at once — outgoing 1->0 and
    // incoming 0->1 in parallel — so the two dissolve into each other
    // instead of fading to empty and back. The envelope layer underneath
    // is never touched by this transition.
    this.renderPageLayer(incoming, this.currentIndex);
    const { restX, restY } = this.layout.paper;
    incoming.container.setPosition(restX, restY).setScale(1).setAlpha(0).setVisible(true);

    const duration = PostcardScene.PAGE_CROSSFADE_DURATION;

    this.tweens.add({
      targets: outgoing.container,
      alpha: 0,
      duration,
      ease: 'Sine.easeInOut',
      onComplete: () => outgoing.container.setVisible(false),
    });
    this.tweens.add({
      targets: incoming.container,
      alpha: 1,
      duration,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.activeLayerIndex = incomingIndex;
        this.isTransitioning = false;
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
  // card + flickering candle flames, buildFinaleVisuals() above) is
  // implemented.
  // Still not implemented: the mic-based "blow out the candles"
  // interaction that would extinguish the flames on this page. That will
  // need getUserMedia + AnalyserNode volume detection, and per browser
  // autoplay/permission rules the mic prompt MUST be triggered from a
  // direct user tap (e.g. a "light the candle" button), never on scene
  // load. The "paper-photo" page type remains unimplemented too (see the
  // schema comment in data.js).
  // ---------------------------------------------------------------------
}
