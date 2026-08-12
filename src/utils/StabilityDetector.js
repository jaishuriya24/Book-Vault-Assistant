/**
 * Book Vault - Live Camera Stability Detector
 * ---------------------------------------------
 * Runs on the live camera preview (before capture) to detect:
 *   1. Motion (camera shaking / moving)
 *   2. Blur (out of focus, or moving too fast for shutter)
 *
 * Only triggers auto-capture once the frame has been stable AND sharp
 * for a continuous hold time (default 1 second) - this directly
 * implements steps 4, 5, 9, and 10 from your workflow doc.
 */

export class StabilityDetector {
  /**
   * @param {HTMLVideoElement} videoEl - the live camera <video> element
   * @param {Object} options
   * @param {function} options.onScoreUpdate - called every frame with {motion, blur, overall, status}
   * @param {function} options.onAutoCapture - called once with the canvas when stable+sharp long enough
   * @param {number} options.motionThreshold - lower = more sensitive to shake (default 8)
   * @param {number} options.blurThreshold - higher = requires sharper image (default 60)
   * @param {number} options.holdTimeMs - how long it must stay stable before auto-capture (default 1000ms)
   * @param {number} options.sampleWidth - downscale width for analysis, speed vs accuracy (default 240)
   */
  constructor(videoEl, options = {}) {
    this.video = videoEl;
    this.onScoreUpdate = options.onScoreUpdate || (() => {});
    this.onAutoCapture = options.onAutoCapture || (() => {});
    this.motionThreshold = options.motionThreshold ?? 8;
    this.blurThreshold = options.blurThreshold ?? 60;
    this.holdTimeMs = options.holdTimeMs ?? 1000;
    this.sampleWidth = options.sampleWidth ?? 240;

    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.prevFrame = null;
    this.stableStartTime = null;
    this.running = false;
    this.captured = false;
  }

  start() {
    this.running = true;
    this.captured = false;
    this._loop();
  }

  stop() {
    this.running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }

  /** Reset so the detector can look for the next page after a capture */
  reset() {
    this.captured = false;
    this.stableStartTime = null;
    this.prevFrame = null;
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

    const motionScore = this._detectMotion(gray, w, h);
    const blurScore = this._detectBlur(gray, w, h);

    // Normalize into 0-100 "readiness" style scores (higher = better)
    const motionReadiness = Math.max(0, Math.min(100, 100 - motionScore * 4));
    const blurReadiness = Math.max(0, Math.min(100, (blurScore / this.blurThreshold) * 100));
    const overall = Math.round((motionReadiness + blurReadiness) / 2);

    const isStable = motionScore < this.motionThreshold;
    const isSharp = blurScore > this.blurThreshold;
    const status = !isStable ? "Hold camera steady..."
                 : !isSharp ? "Image blurry - hold still"
                 : "Ready";

    this.onScoreUpdate({
      motion: Math.round(motionReadiness),
      blur: Math.round(blurReadiness),
      overall,
      status,
    });

    // Auto-capture logic: must be stable+sharp continuously for holdTimeMs
    if (isStable && isSharp && !this.captured) {
      if (this.stableStartTime === null) {
        this.stableStartTime = performance.now();
      } else if (performance.now() - this.stableStartTime >= this.holdTimeMs) {
        this.captured = true;
        this._captureFullResFrame();
      }
    } else {
      this.stableStartTime = null;
    }

    this.prevFrame = gray;
    this._loop();
  }

  _captureFullResFrame() {
    // Capture at full video resolution, not the downscaled analysis size
    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = this.video.videoWidth;
    fullCanvas.height = this.video.videoHeight;
    const fullCtx = fullCanvas.getContext("2d");
    fullCtx.drawImage(this.video, 0, 0);
    this.onAutoCapture(fullCanvas);
  }

  _toGrayscale(data, w, h) {
    const gray = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      // Standard luminance weights
      gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return gray;
  }

  /**
   * Motion score = mean absolute pixel difference vs previous frame.
   * Higher score = more movement/shake.
   */
  _detectMotion(gray, w, h) {
    if (!this.prevFrame) return 999; // first frame, force "unstable"

    let diffSum = 0;
    for (let i = 0; i < gray.length; i++) {
      diffSum += Math.abs(gray[i] - this.prevFrame[i]);
    }
    return diffSum / gray.length;
  }

  /**
   * Blur score = variance of a simple Laplacian edge filter.
   * Higher variance = sharper image (more defined edges).
   */
  _detectBlur(gray, w, h) {
    const laplacian = new Float32Array(w * h);
    // Simple 4-neighbor Laplacian kernel: [[0,1,0],[1,-4,1],[0,1,0]]
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const value =
          gray[idx - w] + gray[idx + w] + gray[idx - 1] + gray[idx + 1] - 4 * gray[idx];
        laplacian[idx] = value;
      }
    }

    let mean = 0;
    for (let i = 0; i < laplacian.length; i++) mean += laplacian[i];
    mean /= laplacian.length;

    let variance = 0;
    for (let i = 0; i < laplacian.length; i++) {
      variance += (laplacian[i] - mean) ** 2;
    }
    variance /= laplacian.length;

    return variance;
  }
}
