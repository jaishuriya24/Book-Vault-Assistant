/**
 * Book Vault - Page Alignment & Distance Guide
 * -----------------------------------------------
 * Detects the page's position within the camera frame and gives
 * directional guidance:
 *   - "Move back" when too close (page fills too much of the frame)
 *   - "Shift left" / "Shift right" when page is off-center horizontally
 *   - Detects WHICH side is being cut off when too close, so the
 *     message is specific ("Move back - right edge is cut off")
 *     instead of just a generic "too close" message.
 *
 * This implements/completes step 7 (Alignment Check) from the
 * original workflow doc.
 *
 * Usage: run alongside StabilityDetector.js, sharing the same video
 * element. Combine both scores before allowing auto-capture.
 */

export class AlignmentGuide {
  /**
   * @param {HTMLVideoElement} videoEl
   * @param {Object} options
   * @param {function} options.onGuidance - called every frame with
   *   { message, direction, coverage, isAligned }
   * @param {number} options.sampleWidth - downscale width for analysis (default 240)
   * @param {number} options.maxCoverage - coverage above this = too close (default 0.92)
   * @param {number} options.minCoverage - coverage below this = too far (default 0.35)
   * @param {number} options.centerTolerance - fraction of width allowed off-center before guiding (default 0.06)
   * @param {number} options.edgeMargin - px margin to consider bbox "touching" frame edge (default 4)
   */
  constructor(videoEl, options = {}) {
    this.video = videoEl;
    this.onGuidance = options.onGuidance || (() => {});
    this.sampleWidth = options.sampleWidth ?? 240;
    this.maxCoverage = options.maxCoverage ?? 0.92;
    this.minCoverage = options.minCoverage ?? 0.35;
    this.centerTolerance = options.centerTolerance ?? 0.06;
    this.edgeMargin = options.edgeMargin ?? 4;

    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.running = false;
  }

  start() {
    this.running = true;
    this._loop();
  }

  stop() {
    this.running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }

  _loop() {
    if (!this.running) return;
    this._rafId = requestAnimationFrame(() => this._processFrame());
  }

  _processFrame() {
    if (this.video.readyState < 2) {
      this._loop();
      return;
    }

    const scale = this.sampleWidth / this.video.videoWidth;
    const w = this.sampleWidth;
    const h = Math.round(this.video.videoHeight * scale);
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.drawImage(this.video, 0, 0, w, h);

    const frame = this.ctx.getImageData(0, 0, w, h);
    const gray = this._toGrayscale(frame.data, w, h);
    const mask = this._thresholdMask(gray, w, h);
    const bbox = this._boundingBox(mask, w, h);

    if (!bbox) {
      this.onGuidance({
        message: "No page detected - point camera at the book",
        direction: null,
        coverage: 0,
        isAligned: false,
      });
      this._loop();
      return;
    }

    const guidance = this._buildGuidance(bbox, w, h);
    this.onGuidance(guidance);

    this._loop();
  }

  _toGrayscale(data, w, h) {
    const gray = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return gray;
  }

  /**
   * Builds a binary mask of "page" pixels. Assumes the page is
   * brighter than its surroundings (true for the vast majority of
   * book/document scanning setups - white/cream page vs desk/hand/background).
   * Uses a threshold relative to the frame's own mean brightness so it
   * adapts to different lighting conditions instead of a fixed value.
   */
  _thresholdMask(gray, w, h) {
    let mean = 0;
    for (let i = 0; i < gray.length; i++) mean += gray[i];
    mean /= gray.length;

    const threshold = mean + 15; // page pixels expected brighter than scene average
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < gray.length; i++) {
      mask[i] = gray[i] > threshold ? 1 : 0;
    }
    return mask;
  }

  /**
   * Finds the bounding box of the page mask using row/column
   * projections (sum of mask pixels per row/column). This is the
   * standard lightweight approach for page-boundary estimation
   * without full contour detection - fast enough to run every frame.
   */
  _boundingBox(mask, w, h) {
    const colSums = new Uint32Array(w);
    const rowSums = new Uint32Array(h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = mask[y * w + x];
        colSums[x] += v;
        rowSums[y] += v;
      }
    }

    const colThresh = h * 0.15; // column counts as "page" if 15%+ of its pixels are page pixels
    const rowThresh = w * 0.15;

    let left = -1, right = -1, top = -1, bottom = -1;

    for (let x = 0; x < w; x++) {
      if (colSums[x] > colThresh) { left = x; break; }
    }
    for (let x = w - 1; x >= 0; x--) {
      if (colSums[x] > colThresh) { right = x; break; }
    }
    for (let y = 0; y < h; y++) {
      if (rowSums[y] > rowThresh) { top = y; break; }
    }
    for (let y = h - 1; y >= 0; y--) {
      if (rowSums[y] > rowThresh) { bottom = y; break; }
    }

    if (left === -1 || right === -1 || top === -1 || bottom === -1 || right <= left || bottom <= top) {
      return null; // no clear page-like region found
    }

    return { left, right, top, bottom, frameW: w, frameH: h };
  }

  _buildGuidance(bbox, w, h) {
    const { left, right, top, bottom, frameW, frameH } = bbox;
    const bboxW = right - left;
    const bboxH = bottom - top;
    const coverage = (bboxW * bboxH) / (frameW * frameH);

    const touchesLeft = left <= this.edgeMargin;
    const touchesRight = right >= frameW - this.edgeMargin;
    const touchesTop = top <= this.edgeMargin;
    const touchesBottom = bottom >= frameH - this.edgeMargin;

    const bboxCenterX = (left + right) / 2;
    const frameCenterX = frameW / 2;
    const offsetX = (bboxCenterX - frameCenterX) / frameW; // negative = page is left of center

    const tooClose = coverage > this.maxCoverage || touchesLeft || touchesRight || touchesTop || touchesBottom;
    const tooFar = coverage < this.minCoverage;

    // --- Too close: identify which side(s) are cut off and combine with shift direction ---
    if (tooClose) {
      const cutSides = [];
      if (touchesLeft) cutSides.push("left");
      if (touchesRight) cutSides.push("right");
      if (touchesTop) cutSides.push("top");
      if (touchesBottom) cutSides.push("bottom");

      let message = "Move back - too close";
      if (cutSides.length === 1) {
        message = `Move back - ${cutSides[0]} edge is cut off`;
      } else if (cutSides.length > 1) {
        message = `Move back - ${cutSides.join(" and ")} edges are cut off`;
      }

      // If cut off on one side only, also suggest shifting away from that side
      let direction = "back";
      if (touchesLeft && !touchesRight) {
        message += ", shift right";
        direction = "back-right";
      } else if (touchesRight && !touchesLeft) {
        message += ", shift left";
        direction = "back-left";
      }

      return { message, direction, coverage, isAligned: false };
    }

    // --- Too far ---
    if (tooFar) {
      return { message: "Move closer", direction: "forward", coverage, isAligned: false };
    }

    // --- Off-center left/right (normal distance, just needs shifting) ---
    if (Math.abs(offsetX) > this.centerTolerance) {
      if (offsetX < 0) {
        return { message: "Shift right - page is off to the left", direction: "right", coverage, isAligned: false };
      } else {
        return { message: "Shift left - page is off to the right", direction: "left", coverage, isAligned: false };
      }
    }

    // --- Aligned ---
    return { message: "Page centered - hold steady", direction: null, coverage, isAligned: true };
  }
}
