/**
 * opencvHelper.js
 * ---------------
 * Interfaces with OpenCV.js (loaded via CDN) to perform advanced computer vision tasks:
 * 1. Detect 4-corner book page contours (quadrilaterals).
 * 2. Perspective warp (flatten) the page to correct camera angle distortion.
 * 3. Enhance text visibility via adaptive thresholding for optimal OCR results.
 */

export function isOpenCvReady() {
  return typeof window !== "undefined" && window.cv && typeof window.cv.Mat === "function";
}

/**
 * Sorts 4 points into order: [top-left, top-right, bottom-right, bottom-left]
 * Using a simple and robust X-sorting division logic.
 * @param {Array<{x: number, y: number}>} pts
 * @returns {Array<{x: number, y: number}>}
 */
export function orderPoints(pts) {
  if (pts.length !== 4) return pts;

  // Sort points by x coordinate
  const sortedByX = [...pts].sort((a, b) => a.x - b.x);
  
  // The two left-most points and the two right-most points
  const leftMost = sortedByX.slice(0, 2);
  const rightMost = sortedByX.slice(2, 4);

  // Of the left-most points, the one with smaller y is top-left, the other is bottom-left
  const tl = leftMost[0].y < leftMost[1].y ? leftMost[0] : leftMost[1];
  const bl = leftMost[0].y < leftMost[1].y ? leftMost[1] : leftMost[0];

  // Of the right-most points, the one with smaller y is top-right, the other is bottom-right
  const tr = rightMost[0].y < rightMost[1].y ? rightMost[0] : rightMost[1];
  const br = rightMost[0].y < rightMost[1].y ? rightMost[1] : rightMost[0];

  return [tl, tr, br, bl];
}

/**
 * Detects the 4-corner quadrilateral boundary of a book page in a canvas.
 * @param {HTMLCanvasElement} canvasElement 
 * @returns {Object|null} Bounding details or null if no page found.
 */
export function detectBookQuadrilateral(canvasElement) {
  if (!isOpenCvReady()) return null;
  const cv = window.cv;

  let src;
  try {
    src = cv.imread(canvasElement);
  } catch (err) {
    console.error("OpenCV imread failed:", err);
    return null;
  }

  let gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

  // Smooth image using bilateral filtering or Gaussian blur
  let smoothed = new cv.Mat();
  try {
    cv.bilateralFilter(gray, smoothed, 9, 75, 75, cv.BORDER_DEFAULT);
  } catch (e) {
    cv.GaussianBlur(gray, smoothed, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
  }

  // Adaptive thresholding to handle uneven lighting conditions
  let thresh = new cv.Mat();
  cv.adaptiveThreshold(
    smoothed,
    thresh,
    255,
    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv.THRESH_BINARY_INV,
    11,
    2
  );

  // Morphological close to bridge gaps in page borders
  let kernel = cv.Mat.ones(5, 5, cv.CV_8U);
  let closed = new cv.Mat();
  cv.morphologyEx(thresh, closed, cv.MORPH_CLOSE, kernel);

  // Find external contours
  let contours = new cv.MatVector();
  let hierarchy = new cv.Mat();
  cv.findContours(closed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  let maxArea = 0;
  let bestApprox = null;
  const totalArea = canvasElement.width * canvasElement.height;

  for (let i = 0; i < contours.size(); ++i) {
    let cnt = contours.get(i);
    let area = cv.contourArea(cnt);
    // Ignore small noise/clutter
    if (area < totalArea * 0.12) continue;

    let peri = cv.arcLength(cnt, true);
    let approx = new cv.Mat();
    cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

    // Convex quadrilateral check
    if (approx.rows === 4 && cv.isContourConvex(approx)) {
      if (area > maxArea) {
        maxArea = area;
        if (bestApprox) bestApprox.delete();
        bestApprox = approx.clone();
      }
    }
    approx.delete();
  }

  let result = null;
  if (bestApprox) {
    let corners = [];
    for (let i = 0; i < 4; i++) {
      corners.push({
        x: bestApprox.data32S[i * 2],
        y: bestApprox.data32S[i * 2 + 1]
      });
    }
    result = {
      corners: orderPoints(corners),
      area: maxArea,
      frameWidth: canvasElement.width,
      frameHeight: canvasElement.height
    };
  }

  // Deallocate memory structures to prevent memory leaks
  src.delete();
  gray.delete();
  smoothed.delete();
  thresh.delete();
  kernel.delete();
  closed.delete();
  contours.delete();
  hierarchy.delete();
  if (bestApprox) bestApprox.delete();

  return result;
}

/**
 * Perspective warps a canvas given 4 corner points to a flat, rectangular output canvas.
 * @param {HTMLCanvasElement} srcCanvas 
 * @param {Array<{x: number, y: number}>} corners Ordered [tl, tr, br, bl]
 * @returns {HTMLCanvasElement} Rectified canvas.
 */
export function warpBookPage(srcCanvas, corners) {
  if (!isOpenCvReady()) return srcCanvas;
  const cv = window.cv;

  let src = cv.imread(srcCanvas);
  const [tl, tr, br, bl] = corners;

  // Compute maximum width of new image
  const widthA = Math.sqrt(Math.pow(br.x - bl.x, 2) + Math.pow(br.y - bl.y, 2));
  const widthB = Math.sqrt(Math.pow(tr.x - tl.x, 2) + Math.pow(tr.y - tl.y, 2));
  const maxWidth = Math.max(Math.floor(widthA), Math.floor(widthB));

  // Compute maximum height of new image
  const heightA = Math.sqrt(Math.pow(tr.x - br.x, 2) + Math.pow(tr.y - br.y, 2));
  const heightB = Math.sqrt(Math.pow(tl.x - bl.x, 2) + Math.pow(tl.y - bl.y, 2));
  const maxHeight = Math.max(Math.floor(heightA), Math.floor(heightB));

  // Source and target matrix configurations
  let srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
    tl.x, tl.y,
    tr.x, tr.y,
    br.x, br.y,
    bl.x, bl.y
  ]);
  let dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0,
    maxWidth - 1, 0,
    maxWidth - 1, maxHeight - 1,
    0, maxHeight - 1
  ]);

  let M = cv.getPerspectiveTransform(srcPts, dstPts);
  let warped = new cv.Mat();
  let dsize = new cv.Size(maxWidth, maxHeight);
  cv.warpPerspective(src, warped, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

  const destCanvas = document.createElement("canvas");
  destCanvas.width = maxWidth;
  destCanvas.height = maxHeight;
  cv.imshow(destCanvas, warped);

  // Cleanup
  src.delete();
  srcPts.delete();
  dstPts.delete();
  M.delete();
  warped.delete();

  return destCanvas;
}

/**
 * Enhances text readability via adaptive binarization (black and white thresholding).
 * @param {HTMLCanvasElement} canvas 
 * @returns {HTMLCanvasElement} Binarized canvas.
 */
export function enhanceWarpedPage(canvas) {
  if (!isOpenCvReady()) return canvas;
  const cv = window.cv;

  let src = cv.imread(canvas);
  let gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

  let thresh = new cv.Mat();
  // Thresholding optimized for documents (large block size to account for illumination gradients)
  cv.adaptiveThreshold(
    gray,
    thresh,
    255,
    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv.THRESH_BINARY,
    31,
    15
  );

  cv.imshow(canvas, thresh);

  src.delete();
  gray.delete();
  thresh.delete();

  return canvas;
}
