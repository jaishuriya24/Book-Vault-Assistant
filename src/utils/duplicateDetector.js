/**
 * duplicateDetector.js
 * --------------------
 * Port of Text-detector's DuplicateChecker (dHash & Hamming Distance).
 * Generates 64-bit perceptual image difference hashes (dHash) and checks
 * for duplicate book pages captured by the camera.
 */

/**
 * Computes difference hash (dHash) for an image/canvas.
 * 1. Resizes image to (9 x 8)
 * 2. Converts to grayscale
 * 3. Compares adjacent horizontal pixels to produce 64 boolean bits
 * 4. Returns 16-character hex hash string
 * 
 * @param {HTMLCanvasElement|HTMLImageElement|HTMLVideoElement} source 
 * @param {number} hashSize Default 8 (creates 9x8 image)
 * @returns {string} 16-character hexadecimal hash
 */
export function computeDHash(source, hashSize = 8) {
  if (!source) return "";

  const canvas = document.createElement("canvas");
  const width = hashSize + 1; // 9
  const height = hashSize;    // 8
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, width, height);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Convert 9x8 frame to grayscale matrix
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  // Compute horizontal difference bits (8 bits per row * 8 rows = 64 bits)
  let binaryString = "";
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < hashSize; x++) {
      const leftPixel = gray[y * width + x];
      const rightPixel = gray[y * width + (x + 1)];
      binaryString += leftPixel < rightPixel ? "1" : "0";
    }
  }

  // Convert 64-bit binary string to 16-character hexadecimal
  let hexString = "";
  for (let i = 0; i < binaryString.length; i += 4) {
    const nibble = binaryString.substring(i, i + 4);
    hexString += parseInt(nibble, 2).toString(16);
  }

  return hexString.padStart(16, "0");
}

/**
 * Calculates the Hamming distance (number of differing bits) between two 16-hex hashes.
 * @param {string} hash1 
 * @param {string} hash2 
 * @returns {number} Distance (0 = identical, 64 = completely opposite)
 */
export function calculateHammingDistance(hash1, hash2) {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) {
    return 999;
  }

  try {
    const val1 = BigInt("0x" + hash1);
    const val2 = BigInt("0x" + hash2);
    let xorVal = val1 ^ val2;

    // Count number of set bits (1s) in xorVal
    let distance = 0;
    while (xorVal > 0n) {
      if ((xorVal & 1n) === 1n) {
        distance++;
      }
      xorVal >>= 1n;
    }
    return distance;
  } catch (e) {
    return 999;
  }
}

/**
 * Checks if a new image hash matches any existing captured hashes within maxDistance.
 * @param {string} newHash 
 * @param {Array<string>} existingHashes 
 * @param {number} maxDistance Default 5 (dist <= 5 is duplicate)
 * @returns {{isDuplicate: boolean, minDistance: number}}
 */
export function isDuplicateHash(newHash, existingHashes, maxDistance = 12) {
  if (!newHash || !existingHashes || existingHashes.length === 0) {
    return { isDuplicate: false, minDistance: 999 };
  }

  let minDistance = 999;
  for (const existing of existingHashes) {
    const dist = calculateHammingDistance(newHash, existing);
    if (dist < minDistance) {
      minDistance = dist;
    }
    if (dist <= maxDistance) {
      return { isDuplicate: true, minDistance: dist };
    }
  }

  return { isDuplicate: false, minDistance };
}
