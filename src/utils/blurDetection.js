export function isImageBlurry(imageElement, threshold = 100) {
  const maxDim = 600; // downscale first — full-res Laplacian in JS is slow
  const srcW = imageElement.naturalWidth || imageElement.width;
  const srcH = imageElement.naturalHeight || imageElement.height;
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(srcW * scale);
  canvas.height = Math.round(srcH * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gray = toGrayscale(data, width, height);
  const variance = laplacianVariance(gray, width, height);

  return { blurry: variance < threshold, variance };
}

function toGrayscale(data, width, height) {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return gray;
}

function laplacianVariance(gray, width, height) {
  const kernel = [0, 1, 0, 1, -4, 1, 0, 1, 0];
  const values = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      let k = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          sum += gray[(y + ky) * width + (x + kx)] * kernel[k];
          k++;
        }
      }
      values.push(sum);
    }
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return variance;
}
