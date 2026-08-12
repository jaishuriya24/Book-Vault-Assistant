let workerPromise = null;

async function getWorker() {
  if (!workerPromise) {
    const { createWorker } = await import("tesseract.js");
    workerPromise = createWorker(["tam", "eng"]);
  }
  return workerPromise;
}

export async function extractText(imageSource) {
  const worker = await getWorker();
  const { data } = await worker.recognize(imageSource);
  return data.text.trim();
}

export async function terminateOcr() {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
  }
}
