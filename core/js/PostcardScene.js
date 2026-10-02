import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../config.js';
import * as audio from './audio.js';
import { startMicVolumeMeter } from './candleMic.js';

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

    audio.init(this);

    this.enterClosedState();
    this.playEnvelopeIntro();
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
    this.envelopeBaseScale = scale;

    // Starts zoomed out slightly and fully transparent — playEnvelopeIntro()
    // (called once, right after create()) tweens it in rather than it
    // just appearing on a sudden cut. Not interactive yet: tapping mid
    // zoom-in would fight the intro tween over the same alpha property,
    // so this only gets enabled once that tween's onComplete fires.
    this.envelopeClosed = this.add.image(x, y, 'envelopeClosed').setScale(scale * 0.85).setAlpha(0).setDepth(0);
    this.envelopeOpen = this.add.image(x, y, 'envelopeOpen').setScale(scale).setDepth(0).setAlpha(0);

    this.envelopeClosed.setInteractive({ useHandCursor: true });
    this.envelopeClosed.disableInteractive();
    this.envelopeClosed.on('pointerdown', () => this.openEnvelope());
  }

  // Zoom/fade-in for the closed envelope's first appearance, instead of a
  // sudden cut. Background music starts right as this finishes — "right
  // after the envelope appears" — via audio.play(), though note that
  // browsers require a user gesture before audio can actually start;
  // Phaser's Sound Manager queues it and it plays as soon as the first
  // tap (almost certainly the very next thing the user does, opening the
  // envelope) unlocks audio, rather than failing silently forever.
  playEnvelopeIntro() {
    this.tweens.add({
      targets: this.envelopeClosed,
      alpha: 1,
      scale: this.envelopeBaseScale,
      duration: 2500,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.envelopeClosed.setInteractive();
        audio.play('bgMusic', { loop: true, volume: 0.5 });
      },
    });
  }

  openEnvelope() {
    if (this.state !== 'closed') return;
    this.state = 'transitioning-open';
    this.envelopeClosed.disableInteractive();
    audio.play('envelopeOpen');

    // Crossfade closed -> open, with a quick subtle scale/settle so the
    // swap doesn't feel like a flat cut.
    const baseScale = this.envelopeOpen.scaleX;
    this.envelopeOpen.setScale(baseScale * 0.96);

    this.tweens.add({
      targets: this.envelopeClosed,
      alpha: 0,
      duration: 600,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: this.envelopeOpen,
      alpha: 1,
      scale: baseScale,
      duration: 600,
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
      duration: 1000,
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
    this.renderPageLayer(this.pageLayers[this.activeLayerIndex], this.currentIndex);
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

    // titleText/bodyText/closingText are never actually shown — they stay
    // permanently invisible and exist purely as measuring tools (word-wrap,
    // fitTextToBox's shrink-to-fit, getWrappedText()). What's actually
    // displayed is a fresh set of individual per-character Text objects
    // built from them on every render (see layOutTypedText), since
    // Phaser's Text can't fade in individual characters within one object —
    // this is what makes the "typed, with each letter fading in" reveal
    // possible at all.
    const titleText = this.add.text(0, textTop, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '34px',
      color: '#3a2f28',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: textAreaWidth },
    }).setOrigin(0.5, 0).setVisible(false);

    const bodyText = this.add.text(0, 0, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '24px',
      color: '#3a2f28',
      align: 'center',
      wordWrap: { width: textAreaWidth },
    }).setOrigin(0.5, 0).setVisible(false);

    // A separate bold sign-off line (a page's optional `closing` field) —
    // deliberately its own Text object rather than appended into `body`,
    // so it reads as a distinct closing statement instead of just more
    // flowing paragraph text, the same way `title` is already split out
    // from `body` rather than being its first sentence.
    const closingText = this.add.text(0, 0, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#3a2f28',
      align: 'center',
      wordWrap: { width: textAreaWidth },
    }).setOrigin(0.5, 0).setVisible(false);

    container.add(titleText);
    container.add(bodyText);
    container.add(closingText);

    // Shared mutable state the flame flicker ticks read from (created
    // now, before buildFinaleVisuals/startFlameFlicker need it) and the
    // blow-interaction handlers below write to — same object either way,
    // so a flicker tick sees an update the instant a volume reading
    // changes it, with no extra wiring.
    const blow = { state: 'idle', progress: 0, isBlowingNow: false, micSession: null, tickEvent: null };
    const flameFlickerEvents = [];

    const { finaleImage, flames } = this.buildFinaleVisuals(container, width, blow, flameFlickerEvents);
    // Added after the finale visuals so it draws on top of them, and
    // before the photo overlay so that (unrelated to the finale page)
    // stays on top of everything as before.
    // `layerRef` is a forward reference: the blow button's tap handler
    // needs the full, finished layer object (to reach the progress bar,
    // status text, flame array, etc.), but that object doesn't exist
    // until this method returns — `layerRef.current` gets set at the very
    // end, and the handler (called later, on an actual tap) reads it then.
    const layerRef = {};
    const blowUI = this.buildBlowInteraction(container, layerRef, width);
    const photoImage = this.buildPhotoOverlay(container);

    const layer = {
      container,
      paperImage,
      titleText,
      bodyText,
      closingText,
      finaleImage,
      flames,
      photoImage,
      textLayout: { textAreaWidth, textTop, textBottom },
      blow,
      flameFlickerEvents,
      candlesExtinguished: false,
      typewriter: { event: null, chars: [] },
      ...blowUI,
    };
    layerRef.current = layer;
    return layer;
  }

  // Layout for the "blow out the candles" UI. Positioned BELOW the whole
  // cake rather than above the candles: the flames' actual rendered
  // bounds (checked directly via getBounds(), not estimated) reach up
  // over 100px above their wick-tip anchor, which left no real room for
  // a 60px-tall button between the title and the candles. Expressed as
  // offsets (in birthday-card.png's own native pixels) below the card's
  // measured opaque bottom edge, then scaled by the SAME paperWidth/848
  // factor as the card image and candle flames — not fixed local
  // constants — since those are per-site values (layout.finale.candles
  // is measured per-site too) and this has to track whatever the current
  // site's card scale actually is, not just the specific size this was
  // measured against.
  static FINALE_CARD_NATIVE_HALF_HEIGHT = 632; // 1264/2 — birthday-card.png's own canvas center
  static FINALE_CARD_NATIVE_OPAQUE_BOTTOM = 1117; // measured via its alpha channel
  static BLOW_WISH_TEXT_NATIVE_OFFSET = 24;
  static BLOW_STATUS_TEXT_NATIVE_OFFSET = 66;
  static BLOW_CONTROL_NATIVE_OFFSET = 119;
  static BLOW_BUTTON_WIDTH = 220;
  static BLOW_BUTTON_HEIGHT = 60;
  static BLOW_BAR_WIDTH = 220;
  static BLOW_BAR_HEIGHT = 22;

  // Builds the "make a wish" text, the tap-to-blow button, the error/
  // retry status text, and the progress bar for one page layer's finale
  // page — all nested inside the same container as the rest of that
  // layer's finale visuals, so they crossfade with everything else and
  // never need separate position bookkeeping. `layerRef` is the forward
  // reference described in buildPageLayer — the button's tap handler
  // reads `layerRef.current` when it actually fires, not now. `paperWidth`
  // is layout.paper.width, needed to scale the Y positions (see above)
  // and the text wrap widths to the current site's card size.
  buildBlowInteraction(container, layerRef, paperWidth) {
    const scale = paperWidth / 848; // same convention as buildFinaleVisuals/candles
    const cardBottomLocal = (PostcardScene.FINALE_CARD_NATIVE_OPAQUE_BOTTOM - PostcardScene.FINALE_CARD_NATIVE_HALF_HEIGHT) * scale;
    const wishTextY = cardBottomLocal + PostcardScene.BLOW_WISH_TEXT_NATIVE_OFFSET * scale;
    const statusTextY = cardBottomLocal + PostcardScene.BLOW_STATUS_TEXT_NATIVE_OFFSET * scale;
    const controlY = cardBottomLocal + PostcardScene.BLOW_CONTROL_NATIVE_OFFSET * scale;
    // Text wrap widths scale with the card too (70% of paperWidth, safely
    // inside the card's ~79%-wide opaque area) — a fixed pixel width
    // would spill past the edges of a much smaller card.
    const textWrapWidth = paperWidth * 0.7;

    const wishText = this.add
      .text(0, wishTextY, 'Make a wish, blow the candle', {
        fontFamily: 'Georgia, serif',
        fontSize: '24px',
        color: '#3a2f28',
        align: 'center',
        wordWrap: { width: textWrapWidth },
      })
      .setOrigin(0.5)
      .setVisible(false);
    container.add(wishText);

    const statusText = this.add
      .text(0, statusTextY, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#7a4a3a',
        align: 'center',
        wordWrap: { width: textWrapWidth },
      })
      .setOrigin(0.5)
      .setVisible(false);
    container.add(statusText);

    const btnW = PostcardScene.BLOW_BUTTON_WIDTH;
    const btnH = PostcardScene.BLOW_BUTTON_HEIGHT;
    const blowButton = this.add.container(0, controlY);
    const btnBg = this.add.rectangle(0, 0, btnW, btnH, 0x000000, 0.35).setStrokeStyle(1, 0xffffff, 0.6);
    const blowButtonText = this.add
      .text(0, 0, 'Tap to blow', { fontFamily: 'Georgia, serif', fontSize: '22px', color: '#ffffff' })
      .setOrigin(0.5);
    blowButton.add([btnBg, blowButtonText]);
    // Same one-shot setInteractive() pattern used by makeNavButton: full
    // hit-area/cursor config given once here, then only ever toggled via
    // disableInteractive() / bare setInteractive() afterward.
    blowButton.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    blowButton.disableInteractive();
    blowButton.setVisible(false);
    blowButton.on('pointerdown', () => this.handleBlowButtonTap(layerRef.current));
    container.add(blowButton);

    const barW = PostcardScene.BLOW_BAR_WIDTH;
    const barH = PostcardScene.BLOW_BAR_HEIGHT;
    const progressBarBg = this.add
      .rectangle(0, controlY, barW, barH, 0x000000, 0.2)
      .setStrokeStyle(1, 0xffffff, 0.5)
      .setVisible(false);
    // Origin (0, 0.5): anchored at its own left-center, positioned at the
    // bar's left edge, so growing `.width` extends it rightward — a
    // standard progress-fill setup.
    const progressBarFill = this.add
      .rectangle(-barW / 2, controlY, 1, barH - 4, 0xf2c14e, 0.9)
      .setOrigin(0, 0.5)
      .setVisible(false);
    container.add(progressBarBg);
    container.add(progressBarFill);

    return { wishText, statusText, blowButton, blowButtonText, progressBarBg, progressBarFill };
  }

  // A generic photo-overlay Image, re-skinned per page by renderPageLayer
  // below via each page's own optional `photo` field — not tied to one
  // fixed texture/position the way the old single `layout.paperPhoto`
  // was, since different pages want different images in different spots
  // (e.g. the polaroid on the "PS" page vs. a full photo on "One more
  // thing..."). Starts on Phaser's built-in placeholder texture since an
  // Image needs *some* texture at creation; renderPageLayer always swaps
  // it before ever showing it.
  buildPhotoOverlay(container) {
    const photoImage = this.add.image(0, 0, '__DEFAULT').setVisible(false);
    container.add(photoImage);
    return photoImage;
  }

  // How fast the typewriter types (ms between letters starting to fade
  // in) and how long each individual letter's own fade-in takes. The
  // interval is shorter than the fade duration on purpose — several
  // letters are mid-fade at once, which reads as a continuous reveal
  // rather than a strict "wait for this letter, then the next" crawl.
  static TYPEWRITER_CHAR_INTERVAL_MS = 60
  static TYPEWRITER_CHAR_FADE_DURATION = 180;
  // The photo overlay's own fade-in — intentionally a separate constant
  // from the two above, since the image is explicitly NOT synced to the
  // text's typing pace (see renderPageLayer).
  static PHOTO_FADE_DURATION = 2000;

  renderPageLayer(layer, index) {
    const page = this.pages[index];
    const isFinale = page.type === 'finale';
    const photo = page.photo;

    layer.paperImage.setVisible(!isFinale);
    if (layer.finaleImage) layer.finaleImage.setVisible(isFinale);

    // Typed text is rebuilt from scratch on every render (see
    // layOutTypedText/startTypewriter below), so whatever the previous
    // render left behind — on this same page, or this layer switching
    // to/from the finale page, which has no text of its own — needs
    // clearing first.
    this.clearTypewriter(layer);

    // `photo` on a page is { asset, width, x, y, rotation } — see the
    // schema comment in data.js. `x`/`y` are local offsets from the
    // paper's own center, same space as everything else on the page.
    // Fades in on its own schedule — killTweensOf guards against a
    // previous fade still running if the page flips again before it
    // finished — deliberately NOT tied to the text typewriter's timing.
    if (layer.photoImage) {
      this.tweens.killTweensOf(layer.photoImage);
      if (!isFinale && photo && this.textures.exists(photo.asset)) {
        const texture = this.textures.get(photo.asset).getSourceImage();
        const scale = photo.width / texture.width;
        layer.photoImage
          .setTexture(photo.asset)
          .setScale(scale)
          .setAngle(photo.rotation || 0)
          .setPosition(photo.x, photo.y)
          .setAlpha(0)
          .setVisible(true);
        this.tweens.add({
          targets: layer.photoImage,
          alpha: 1,
          duration: PostcardScene.PHOTO_FADE_DURATION,
          ease: 'Sine.easeOut',
        });
      } else {
        layer.photoImage.setVisible(false);
      }
    }

    if (isFinale) {
      // Fresh visit (or a re-visit after a previous blow-out) — reset the
      // whole blow interaction and re-light any extinguished flames.
      this.resetBlowInteraction(layer);
    } else {
      // Leaving the finale page (or it was never on it): make sure
      // nothing lingers — most importantly, release the mic if a session
      // was active, rather than leaving it listening in the background.
      this.stopListening(layer);
      layer.wishText.setVisible(false);
      layer.statusText.setVisible(false);
      layer.blowButton.setVisible(false).disableInteractive();
      layer.progressBarBg.setVisible(false);
      layer.progressBarFill.setVisible(false);
    }

    layer.flames.forEach((flame) => flame.setVisible(isFinale && !layer.candlesExtinguished));

    if (isFinale) return; // finale card is fully baked art — no text to lay out

    const { textAreaWidth, textTop, textBottom } = layer.textLayout;
    const gap = 20;
    // Typed in this order — title, then body, then (if present) the
    // closing line — as ONE continuous sequence on a single timer, not
    // three separate typewriters, so body picks up typing immediately
    // where title left off.
    const allChars = [];

    layer.titleText.setText(page.title);
    layer.titleText.setY(textTop);
    allChars.push(...this.layOutTypedText(layer, layer.titleText, textTop));

    const bodyTop = textTop + layer.titleText.height + 24;

    // `closing` (optional) is a short bold sign-off line, laid out AFTER
    // the body rather than folded into it — its own height is measured
    // first (fixed font size, not shrink-to-fit, since it's meant to be
    // short) so the body's available height can be reduced to leave room
    // for it, then it's positioned right below wherever the body actually
    // ended up ending.
    if (page.closing) {
      layer.closingText.setText(page.closing);
      const closingHeight = layer.closingText.height;

      layer.bodyText.setText(page.body);
      layer.bodyText.setY(bodyTop);
      const bodyMaxHeight = textBottom - bodyTop - gap - closingHeight;
      fitTextToBox(layer.bodyText, textAreaWidth, bodyMaxHeight, 26, 16);
      allChars.push(...this.layOutTypedText(layer, layer.bodyText, bodyTop));

      const closingTop = bodyTop + layer.bodyText.height + gap;
      layer.closingText.setY(closingTop);
      allChars.push(...this.layOutTypedText(layer, layer.closingText, closingTop));
    } else {
      layer.bodyText.setText(page.body);
      layer.bodyText.setY(bodyTop);
      const bodyMaxHeight = textBottom - bodyTop;
      fitTextToBox(layer.bodyText, textAreaWidth, bodyMaxHeight, 26, 16);
      allChars.push(...this.layOutTypedText(layer, layer.bodyText, bodyTop));
    }

    this.startTypewriter(layer, allChars);
  }

  // ---- typewriter text reveal -----------------------------------------

  // Destroys this layer's current set of per-character objects and stops
  // its reveal timer, if any — called at the start of every render so a
  // fresh page (or the finale page, which has none of its own) never
  // shows leftover characters from whatever this layer displayed before.
  clearTypewriter(layer) {
    if (layer.typewriter.event) {
      layer.typewriter.event.remove();
      layer.typewriter.event = null;
    }
    layer.typewriter.chars.forEach((c) => c.destroy());
    layer.typewriter.chars = [];
  }

  // Builds one already-wrapped text block (title/body/closing) as
  // individual, initially-invisible character Text objects matching
  // `sourceText`'s current style (font/size/weight/color) — rather than
  // ever making `sourceText` itself visible, since Phaser's Text can't
  // fade in individual characters within a single object. `sourceText`
  // stays in the scene purely as a measuring tool: its existing
  // wordWrap/fitTextToBox sizing (set by the caller before this runs) is
  // untouched, this just reads the result back via getWrappedText().
  //
  // Each line is centered the same way the original `align: 'center'`
  // would, using every character's own measured width — real Text
  // objects, so Phaser computes this synchronously right on creation.
  // Inserted into the container just before the photo overlay (which was
  // originally added last, specifically to stay on top of the text), so
  // photos still draw on top of these even though they're created well
  // after buildPageLayer's initial child order.
  layOutTypedText(layer, sourceText, startY) {
    if (!sourceText.text) return [];
    const lines = sourceText.getWrappedText();
    const lineHeight = sourceText.height / lines.length;
    const style = {
      fontFamily: sourceText.style.fontFamily,
      fontSize: sourceText.style.fontSize,
      fontStyle: sourceText.style.fontStyle,
      color: sourceText.style.color,
    };

    const chars = [];
    lines.forEach((line, lineIndex) => {
      const lineChars = [...line].map((ch) => {
        const charObj = this.add.text(0, 0, ch, style).setOrigin(0, 0).setAlpha(0);
        const photoIndex = layer.container.list.indexOf(layer.photoImage);
        layer.container.addAt(charObj, photoIndex);
        return charObj;
      });
      const lineWidth = lineChars.reduce((sum, c) => sum + c.width, 0);
      const lineY = startY + lineIndex * lineHeight;
      let cursorX = -lineWidth / 2;
      lineChars.forEach((c) => {
        c.setPosition(cursorX, lineY);
        cursorX += c.width;
      });
      chars.push(...lineChars);
    });

    layer.typewriter.chars.push(...chars);
    return chars;
  }

  // Reveals `chars` in order, one at a time, on a fixed low-frequency
  // timer — each character hard-starts invisible and fades in on its own
  // short tween rather than popping to full opacity instantly, which is
  // what makes this read as "typed, with each letter fading in" instead
  // of a classic hard-cut typewriter.
  startTypewriter(layer, chars) {
    if (chars.length === 0) return;
    let index = 0;
    layer.typewriter.event = this.time.addEvent({
      delay: PostcardScene.TYPEWRITER_CHAR_INTERVAL_MS,
      repeat: chars.length - 1,
      callback: () => {
        const charObj = chars[index];
        index += 1;
        this.tweens.add({
          targets: charObj,
          alpha: 1,
          duration: PostcardScene.TYPEWRITER_CHAR_FADE_DURATION,
          ease: 'Sine.easeOut',
        });
      },
    });
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

  // Poses for the idle flicker: subtle, hand-posed variations.
  static IDLE_FLAME_POSES = [
    { sx: 1.00, sy: 1.00, rot: 0, dx: 0, dy: 0 },
    { sx: 1.10, sy: 0.92, rot: -6, dx: -1, dy: -1 },
    { sx: 0.90, sy: 1.08, rot: 5, dx: 1, dy: 0 },
    { sx: 1.05, sy: 0.96, rot: 7, dx: 0, dy: -2 },
    { sx: 0.95, sy: 1.04, rot: -7, dx: -1, dy: 1 },
    { sx: 1.03, sy: 1.02, rot: 3, dx: 1, dy: -1 },
  ];

  // Poses used while the user is actively blowing on the candles — bigger
  // deltas, all leaning/stretching the same general direction (positive
  // rot/dx), so it reads as the flame being pushed by wind rather than
  // idly flickering. Still a hard-cut pose swap, same as the idle set,
  // just more dramatic and (see startFlameFlicker) ticked faster.
  static BLOWING_FLAME_POSES = [
    { sx: 0.80, sy: 1.30, rot: 20, dx: 7, dy: -4 },
    { sx: 0.65, sy: 1.40, rot: 28, dx: 10, dy: -5 },
    { sx: 0.90, sy: 1.15, rot: 14, dx: 5, dy: -3 },
    { sx: 0.72, sy: 1.35, rot: 24, dx: 9, dy: -4 },
  ];

  // Builds one layer's finale (cake card + candle flames) visuals into the
  // given container, so each of the two crossfading layers gets its own
  // fully independent copy — including its own flame flicker timers.
  // `blow` is the layer's shared blow-interaction state (see
  // buildPageLayer) — startFlameFlicker reads `blow.isBlowingNow` every
  // tick to pick which pose set to use. `flameFlickerEvents` collects
  // each flame's TimerEvent so resetBlowInteraction/extinguishFlame can
  // stop them later.
  buildFinaleVisuals(container, paperWidth, blow, flameFlickerEvents) {
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
      // The extinguish animation and the idle-state reset both need to
      // get back to "the resting pose" from wherever a flicker tick left
      // the flame — stashed on the object itself since extinguishFlame()
      // only receives the flame, not this whole closure's local scope.
      flame.setData({ baseX: candle.x, baseY: candle.y, baseScaleX: flameScale, baseScaleY: flameScale });
      container.add(flame);
      this.startFlameFlicker(flame, candle.x, candle.y, flameScale, blow, flameFlickerEvents);
      return flame;
    });

    return { finaleImage, flames };
  }

  // Stop-motion style flicker: a handful of hand-posed variations, snapped
  // between on a low-frequency timer with no easing — a hard cut every
  // tick, not a smooth tween. Each flame picks randomly from its own pose
  // set and runs on its own independently-randomized interval/phase, so
  // multiple candles never step in visible unison. While `blow.isBlowingNow`
  // is true, it swaps to the bigger BLOWING_FLAME_POSES set and a shorter
  // (independently re-randomized) interval — still hard-cut, just more
  // agitated — and eases back to the idle set/pace the moment it goes
  // false again.
  startFlameFlicker(flame, baseX, baseY, baseScale, blow, flameFlickerEvents) {
    const applyRandomPose = () => {
      const poses = blow.isBlowingNow ? PostcardScene.BLOWING_FLAME_POSES : PostcardScene.IDLE_FLAME_POSES;
      const pose = Phaser.Utils.Array.GetRandom(poses);
      flame.setScale(baseScale * pose.sx, baseScale * pose.sy);
      flame.setAngle(pose.rot);
      flame.setPosition(baseX + pose.dx, baseY + pose.dy);
    };

    const idleInterval = Phaser.Math.Between(90, 140);
    const startDelay = Phaser.Math.Between(0, idleInterval);

    applyRandomPose();
    this.time.delayedCall(startDelay, () => {
      const event = this.time.addEvent({
        delay: idleInterval,
        loop: true,
        callback: () => {
          applyRandomPose();
          // Re-randomized every tick (not just once) so the boosted pace
          // doesn't lock every candle into the same rhythm the moment
          // blowing starts.
          event.delay = blow.isBlowingNow ? Phaser.Math.Between(40, 65) : Phaser.Math.Between(90, 140);
        },
      });
      flame.setData('flickerEvent', event);
      flameFlickerEvents.push(event);
    });
  }

  // ---- blow-out-the-candles interaction --------------------------------

  // Mic-volume tuning. BLOW_VOLUME_THRESHOLD is the normalized-RMS level
  // (see candleMic.js's getVolume()) a real blow needs to cross — set
  // comfortably above typical room-noise floor, but this is exactly the
  // kind of number that benefits from checking against a real mic/room
  // if it ever feels off (too twitchy on background noise, or requiring
  // an unreasonably hard blow); nothing else in this method depends on
  // getting it exactly right. FILL/DECAY are progress-per-second while
  // above/below that threshold — at these rates a sustained blow fills
  // the bar in ~1.4s, and stopping mid-blow drains it fast enough that a
  // single short spike can't complete it by accident.
  static BLOW_VOLUME_THRESHOLD = 0.03;
  static BLOW_FILL_RATE = 0.7;
  static BLOW_DECAY_RATE = 0.4;
  static BLOW_TICK_MS = 50;

  // Re-armed every time the finale page is (re-)rendered — a fresh visit
  // after a previous blow-out gets unlit candles re-lit and a working
  // button again, since nothing else in the project defines an "after
  // finale" behavior to hand off to instead.
  resetBlowInteraction(layer) {
    this.stopListening(layer);
    layer.blow.state = 'idle';
    layer.blow.progress = 0;
    layer.blow.isBlowingNow = false;
    layer.candlesExtinguished = false;

    layer.wishText.setVisible(true);
    layer.statusText.setVisible(false).setText('');
    layer.blowButtonText.setText('Tap to blow');
    layer.blowButton.setVisible(true).setInteractive();
    layer.progressBarBg.setVisible(false);
    layer.progressBarFill.setVisible(false).setSize(1, PostcardScene.BLOW_BAR_HEIGHT - 4);

    layer.flames.forEach((flame) => {
      flame.setVisible(true).setAlpha(1);
      flame.setPosition(flame.getData('baseX'), flame.getData('baseY'));
      flame.setScale(flame.getData('baseScaleX'), flame.getData('baseScaleY'));
      flame.setAngle(0);
    });
  }

  // This is the direct user gesture getUserMedia() needs — called
  // straight from the button's pointerdown handler, not deferred.
  async handleBlowButtonTap(layer) {
    if (layer.blow.state !== 'idle' && layer.blow.state !== 'error') return;
    layer.blow.state = 'requesting';
    layer.blowButton.disableInteractive().setVisible(false);
    layer.statusText.setVisible(false);
    layer.blow.progress = 0;
    layer.progressBarFill.setSize(1, PostcardScene.BLOW_BAR_HEIGHT - 4);
    layer.progressBarBg.setVisible(true);
    layer.progressBarFill.setVisible(true);

    try {
      const session = await startMicVolumeMeter();
      // The user could have paged away while the permission prompt was
      // up — don't start listening into a page that's no longer showing.
      if (layer.blow.state !== 'requesting') {
        session.stop();
        return;
      }
      layer.blow.micSession = session;
      layer.blow.state = 'listening';
      this.startListening(layer);
    } catch (err) {
      if (layer.blow.state !== 'requesting') return;
      layer.blow.state = 'error';
      layer.progressBarBg.setVisible(false);
      layer.progressBarFill.setVisible(false);
      layer.statusText.setText('Mic access needed to blow out the candles — tap to try again').setVisible(true);
      layer.blowButtonText.setText('Try Again');
      layer.blowButton.setVisible(true).setInteractive();
    }
  }

  startListening(layer) {
    let lastTime = this.time.now;
    const tickEvent = this.time.addEvent({
      delay: PostcardScene.BLOW_TICK_MS,
      loop: true,
      callback: () => {
        const now = this.time.now;
        const dt = (now - lastTime) / 1000;
        lastTime = now;

        const volume = layer.blow.micSession.getVolume();
        layer.blow.isBlowingNow = volume > PostcardScene.BLOW_VOLUME_THRESHOLD;

        const rate = layer.blow.isBlowingNow ? PostcardScene.BLOW_FILL_RATE : -PostcardScene.BLOW_DECAY_RATE;
        layer.blow.progress = Phaser.Math.Clamp(layer.blow.progress + rate * dt, 0, 1);

        const fillWidth = Math.max(1, layer.blow.progress * (PostcardScene.BLOW_BAR_WIDTH - 4));
        layer.progressBarFill.setSize(fillWidth, PostcardScene.BLOW_BAR_HEIGHT - 4);

        if (layer.blow.progress >= 1) {
          this.completeBlowOut(layer);
        }
      },
    });
    layer.blow.tickEvent = tickEvent;
  }

  // Cleanup used both when a blow completes and when the user simply
  // navigates away mid-listening (called from goToPage) — releases the
  // mic stream rather than leaving it listening in the background.
  stopListening(layer) {
    if (layer.blow.tickEvent) {
      layer.blow.tickEvent.remove();
      layer.blow.tickEvent = null;
    }
    if (layer.blow.micSession) {
      layer.blow.micSession.stop();
      layer.blow.micSession = null;
    }
    layer.blow.isBlowingNow = false;
  }

  completeBlowOut(layer) {
    this.stopListening(layer);
    layer.blow.state = 'done';
    layer.progressBarBg.setVisible(false);
    layer.progressBarFill.setVisible(false);
    layer.candlesExtinguished = true;
    audio.play('candleBlow');

    layer.flames.forEach((flame) => this.extinguishFlame(flame, layer.container));
  }

  // The "blown out by wind" animation: a handful of discrete frames —
  // tilting, shrinking, and fading further at each step — hard-cut at a
  // low frame rate, same stop-motion aesthetic as the idle/blowing
  // flicker rather than a smoothly eased tween. No stretching the
  // flame's shape (scaleX/scaleY always move together). Finishes hidden
  // and reset back to its resting pose (so a future re-light via
  // resetBlowInteraction has a clean starting point), plus a small soft
  // puff at the wick.
  static EXTINGUISH_FRAME_DELAY_MS = 70;
  static EXTINGUISH_FRAMES = [
    { scale: 0.85, rot: 12, dx: 2, alpha: 0.85 },
    { scale: 0.65, rot: 22, dx: 4, alpha: 0.65 },
    { scale: 0.48, rot: 30, dx: 6, alpha: 0.45 },
    { scale: 0.30, rot: 37, dx: 8, alpha: 0.25 },
    { scale: 0.15, rot: 42, dx: 9, alpha: 0.08 },
    { scale: 0.02, rot: 45, dx: 10, alpha: 0 },
  ];

  extinguishFlame(flame, container) {
    const flickerEvent = flame.getData('flickerEvent');
    if (flickerEvent) flickerEvent.remove();

    const baseX = flame.getData('baseX');
    const baseY = flame.getData('baseY');
    const baseScaleX = flame.getData('baseScaleX');
    const baseScaleY = flame.getData('baseScaleY');
    const leanDir = Math.random() < 0.5 ? -1 : 1;
    const frames = PostcardScene.EXTINGUISH_FRAMES;

    let frameIndex = 0;
    this.time.addEvent({
      delay: PostcardScene.EXTINGUISH_FRAME_DELAY_MS,
      repeat: frames.length - 1,
      callback: () => {
        const f = frames[frameIndex];
        flame.setScale(baseScaleX * f.scale, baseScaleY * f.scale);
        flame.setAngle(leanDir * f.rot);
        flame.setAlpha(f.alpha);
        flame.setPosition(baseX + leanDir * f.dx, baseY);

        frameIndex += 1;
        if (frameIndex === frames.length) {
          flame
            .setVisible(false)
            .setAlpha(1)
            .setScale(baseScaleX, baseScaleY)
            .setAngle(0)
            .setPosition(baseX, baseY);
        }
      },
    });

    this.spawnPuff(container, baseX, baseY);
  }

  // Lightweight nice-to-have: a small soft circle that drifts up and
  // fades — no separate asset needed. Added into the same container as
  // the flame (rather than the scene root) so it inherits the page
  // layer's own position/scale/alpha for its short lifetime.
  spawnPuff(container, x, y) {
    const puff = this.add.circle(x, y, 10, 0xffffff, 0.5);
    container.add(puff);
    this.tweens.add({
      targets: puff,
      scale: 2.4,
      alpha: 0,
      y: y - 14,
      duration: 420,
      ease: 'Sine.easeOut',
      onComplete: () => puff.destroy(),
    });
  }

  // Shared duration (ms) for both halves of the page crossfade below.
  static PAGE_CROSSFADE_DURATION = 400

  goToPage(delta) {
    if (this.state !== 'reading' || this.isTransitioning) return;
    const next = this.currentIndex + delta;
    if (next < 0 || next >= this.pages.length) return; // no-op at ends

    this.isTransitioning = true;
    this.currentIndex = next;
    audio.play('paperFlip', { volume: 0.2 });


    const outgoing = this.pageLayers[this.activeLayerIndex];
    const incomingIndex = 1 - this.activeLayerIndex;
    const incoming = this.pageLayers[incomingIndex];

    // Release the mic immediately if the user navigates away mid-blow —
    // it should never keep listening in the background once the finale
    // page isn't the one showing.
    this.stopListening(outgoing);

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
}
