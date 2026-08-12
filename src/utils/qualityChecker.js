/**
 * qualityChecker.js
 * -----------------
 * Evaluates image quality parameters (resolution, blur, brightness, page visibility/cutoff).
 * Optimized for live webcams.
 */

const CONFIG = {
  MIN_WIDTH: 200,
  MIN_HEIGHT: 150,
  MIN_LAPLACIAN_VAR: 15.0,  // Realistic webcam blur threshold
  MIN_BRIGHTNESS: 15.0,     // Low light minimum
  MAX_BRIGHTNESS: 248.0,    // High glare maximum
  BORDER_MARGIN: 2,         // Safe margin near frame boundary
};

/**
 * Calculates Laplacian variance for blur detection on a canvas region or image.
 * @param {CanvasRenderingContext2D} ctx 
 * @param {number} x 
 * @param {number} y 
 * @param {number} w 
 * @param {number} h 
 * @returns {number} Blur score (higher = sharper)
 */
export function calculateLaplacianVariance(ctx, x = 0, y = 0, w, h) {
  const targetW = w || ctx.canvas.width;
  const targetH = h || ctx.canvas.height;
  if (!targetW || !targetH) return 100;

  const sampleCanvas = document.createElement("canvas");
  const scale = 0.3;
  const sw = Math.max(3, Math.floor(targetW * scale));
  const sh = Math.max(3, Math.floor(targetH * scale));
  sampleCanvas.width = sw;
  sampleCanvas.height = sh;
  
  const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
  sampleCtx.drawImage(ctx.canvas, x, y, targetW, targetH, 0, 0, sw, sh);

  const { data } = sampleCtx.getImageData(0, 0, sw, sh);

  const gray = new Float32Array(sw * sh);
  for (let i = 0; i < sw * sh; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  let lapSum = 0;
  let lapSumSq = 0;
  let count = 0;
  for (let row = 1; row < sh - 1; row++) {
    for (let col = 1; col < sw - 1; col++) {
      const center = row * sw + col;
      const lap =
        gray[center - sw] +
        gray[center - 1] +
        gray[center + 1] +
        gray[center + sw] -
        4 * gray[center];
      lapSum += lap;
      lapSumSq += lap * lap;
      count++;
    }
  }

  if (count === 0) return 100;
  const mean = lapSum / count;
  const variance = lapSumSq / count - mean * mean;
  return variance;
}

/**
 * Calculates average brightness level of a canvas or region.
 * @param {CanvasRenderingContext2D} ctx 
 * @param {number} x 
 * @param {number} y 
 * @param {number} w 
 * @param {number} h 
 * @returns {number} Average brightness (0 - 255)
 */
export function calculateAverageBrightness(ctx, x = 0, y = 0, w, h) {
  const targetW = w || ctx.canvas.width;
  const targetH = h || ctx.canvas.height;
  if (!targetW || !targetH) return 128;

  const sampleCanvas = document.createElement("canvas");
  const sw = Math.min(60, targetW);
  const sh = Math.min(60, targetH);
  sampleCanvas.width = sw;
  sampleCanvas.height = sh;

  const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
  sampleCtx.drawImage(ctx.canvas, x, y, targetW, targetH, 0, 0, sw, sh);

  const { data } = sampleCtx.getImageData(0, 0, sw, sh);
  let totalBrightness = 0;
  const count = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    totalBrightness += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  return count > 0 ? totalBrightness / count : 128;
}

/**
 * Checks quality parameters of a frame/canvas.
 * @param {HTMLCanvasElement} canvas 
 * @param {Array<{x: number, y: number}>|null} pageCorners 
 * @returns {{isValid: boolean, reason: string, metrics: {blur: number, brightness: number, resolution: string}}}
 */
export function checkFrameQuality(canvas, pageCorners = null) {
  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    return { isValid: false, reason: "Empty frame", metrics: {} };
  }

  const w = canvas.width;
  const h = canvas.height;

  if (w < CONFIG.MIN_WIDTH || h < CONFIG.MIN_HEIGHT) {
    return {
      isValid: false,
      reason: `Low Resolution (${w}x${h})`,
      metrics: { resolution: `${w}x${h}` },
    };
  }

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const blurScore = calculateLaplacianVariance(ctx, 0, 0, w, h);
  const brightnessScore = calculateAverageBrightness(ctx, 0, 0, w, h);

  if (brightnessScore < CONFIG.MIN_BRIGHTNESS) {
    return {
      isValid: false,
      reason: `Too Dark (${brightnessScore.toFixed(1)})`,
      metrics: { blur: blurScore, brightness: brightnessScore, resolution: `${w}x${h}` },
    };
  }

  return {
    isValid: true,
    reason: "OK",
    metrics: {
      blur: blurScore,
      brightness: brightnessScore,
      resolution: `${w}x${h}`,
    },
  };
}
