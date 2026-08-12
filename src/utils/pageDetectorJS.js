/**
 * pageDetectorJS.js
 * -----------------
 * Strict OpenCV Page Contour Detector.
 * Only returns found: true when a real rectangular book page/paper sheet contour is in view.
 */

import { isOpenCvReady, orderPoints } from "./opencvHelper";

const CONFIG = {
  MIN_PAGE_AREA_RATIO: 0.08, // 8% minimum frame area for book pages
  MAX_PAGE_AREA_RATIO: 0.92, // 92% maximum frame area
  RECTANGLE_APPROX_EPSILON: 0.03, // Douglas-Peucker epsilon ratio
  STABILITY_DURATION_SEC: 1.5,
  MOVEMENT_THRESHOLD_PIXELS: 15.0,
};

/**
 * Detects page quadrilateral, corners, and centroid.
 * @param {HTMLCanvasElement} canvasElement 
 * @returns {{found: boolean, corners: Array<{x: number, y: number}>|null, center: {x: number, y: number}|null, area: number}}
 */
export function detectPageContour(canvasElement) {
  if (!canvasElement || canvasElement.width === 0 || canvasElement.height === 0) {
    return { found: false, corners: null, center: null, area: 0 };
  }

  // Reject immediately if a person/face/skin tone is dominant in camera view
  if (isPersonSkinOrFacePresent(canvasElement)) {
    return { found: false, corners: null, center: null, area: 0 };
  }

  const w = canvasElement.width;
  const h = canvasElement.height;
  const frameArea = w * h;

  // 1. OpenCV.js Detection (Primary Strict Engine)
  if (isOpenCvReady()) {
    const cv = window.cv;
    let src;
    try {
      src = cv.imread(canvasElement);
    } catch (err) {
      return fallbackCanvasDetect(canvasElement);
    }

    let gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    let blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

    let edged = new cv.Mat();
    cv.Canny(blurred, edged, 40, 120);

    let kernel = cv.Mat.ones(5, 5, cv.CV_8U);
    let closed = new cv.Mat();
    cv.morphologyEx(edged, closed, cv.MORPH_CLOSE, kernel);

    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(closed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let bestArea = 0;
    let bestCorners = null;
    let bestCentroid = null;

    for (let i = 0; i < contours.size(); ++i) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      const areaRatio = area / frameArea;

      if (areaRatio < CONFIG.MIN_PAGE_AREA_RATIO || areaRatio > CONFIG.MAX_PAGE_AREA_RATIO) {
        continue;
      }

      const peri = cv.arcLength(cnt, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(cnt, approx, CONFIG.RECTANGLE_APPROX_EPSILON * peri, true);

      // Require 4 to 8 vertices for paper sheet / book page contours
      if (approx.rows >= 4 && approx.rows <= 8) {
        if (area > bestArea) {
          const rect = cv.boundingRect(cnt);
          const aspect = rect.width / (rect.height || 1);

          // Realistic book aspect ratio (0.4 to 2.2)
          if (aspect >= 0.4 && aspect <= 2.2) {
            bestArea = area;
            const pts = [
              { x: rect.x, y: rect.y },
              { x: rect.x + rect.width, y: rect.y },
              { x: rect.x + rect.width, y: rect.y + rect.height },
              { x: rect.x, y: rect.y + rect.height },
            ];
            bestCorners = orderPoints(pts);
            bestCentroid = {
              x: Math.round(rect.x + rect.width / 2),
              y: Math.round(rect.y + rect.height / 2),
            };
          }
        }
      }
      approx.delete();
    }

    // Cleanup OpenCV Mat objects
    src.delete();
    gray.delete();
    blurred.delete();
    edged.delete();
    kernel.delete();
    closed.delete();
    contours.delete();
    hierarchy.delete();

    if (bestCorners && bestCentroid) {
      return {
        found: true,
        corners: bestCorners,
        center: bestCentroid,
        area: bestArea,
      };
    }
  }

  // 2. Adaptive Canvas paper edge fallback
  return fallbackCanvasDetect(canvasElement);
}

/**
 * Adaptive Canvas paper edge fallback.
 */
function fallbackCanvasDetect(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;

  const cols = 24;
  const rows = 18;
  const stepX = w / cols;
  const stepY = h / rows;
  const points = [];

  let totalBrightness = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = Math.floor(c * stepX + stepX / 2);
      const y = Math.floor(r * stepY + stepY / 2);
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      const b = 0.299 * pixel[0] + 0.587 * pixel[1] + 0.114 * pixel[2];
      points.push({ x, y, b });
      totalBrightness += b;
    }
  }

  const avgB = totalBrightness / points.length;
  // Adaptive contrast threshold (+18 luminance delta) for clear page paper contrast
  const threshold = Math.max(75, avgB + 18);
  const pagePoints = points.filter((p) => p.b > threshold);
  const coverage = pagePoints.length / points.length;

  // Strict check: if no clear paper region coverage exists, return found: false
  if (coverage < CONFIG.MIN_PAGE_AREA_RATIO || coverage > CONFIG.MAX_PAGE_AREA_RATIO) {
    return { found: false, corners: null, center: null, area: 0 };
  }

  const xs = pagePoints.map((p) => p.x);
  const ys = pagePoints.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const rectW = maxX - minX;
  const rectH = maxY - minY;
  const aspect = rectW / (rectH || 1);

  if (rectW < w * 0.25 || rectH < h * 0.25 || aspect < 0.40 || aspect > 2.2) {
    return { found: false, corners: null, center: null, area: 0 };
  }

  const corners = orderPoints([
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]);

  const center = {
    x: Math.round((minX + maxX) / 2),
    y: Math.round((minY + maxY) / 2),
  };

  return {
    found: true,
    corners,
    center,
    area: rectW * rectH,
  };
}

/**
 * Quick Skin Color & Face Pixel Check to reject non-book objects (person/face/skin).
 */
function isPersonSkinOrFacePresent(canvas) {
  try {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const w = canvas.width;
    const h = canvas.height;
    if (!w || !h) return false;
    
    const imgData = ctx.getImageData(0, 0, w, h).data;
    let skinPixelCount = 0;
    const totalSamples = Math.floor(imgData.length / 16);

    for (let i = 0; i < imgData.length; i += 16) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];
      
      // Standard RGB skin tone detection heuristic
      if (
        r > 95 && g > 40 && b > 20 &&
        r > g && r > b &&
        (Math.max(r, g, b) - Math.min(r, g, b) > 15) &&
        Math.abs(r - g) > 15
      ) {
        skinPixelCount++;
      }
    }

    const skinRatio = skinPixelCount / (totalSamples || 1);
    // If skin tone pixels cover > 10% of sampled frame, a person/face is present
    return skinRatio > 0.10;
  } catch (e) {
    return false;
  }
}
