let workerPromise = null;
let currentWorkerLang = "eng";

async function getWorker(lang = "eng") {
  if (!workerPromise || currentWorkerLang !== lang) {
    if (workerPromise) {
      try {
        const oldWorker = await workerPromise;
        await oldWorker.terminate();
      } catch (e) {
        console.warn("Worker termination error:", e);
      }
    }
    const { createWorker } = await import("tesseract.js");
    // Support English and Tamil; fallback to 'eng' if composite fails
    workerPromise = (async () => {
      try {
        const worker = await createWorker(lang);
        currentWorkerLang = lang;
        return worker;
      } catch (err) {
        console.warn(`Failed to initialize Tesseract worker with ${lang}, falling back to 'eng':`, err);
        const worker = await createWorker("eng");
        currentWorkerLang = "eng";
        return worker;
      }
    })();
  }
  return workerPromise;
}

/**
 * Extract text from an image source (data URL, Blob, File, or image element)
 * @param {string|Blob|File} imageSource
 * @param {Object} options
 * @param {Function} [options.onProgress]
 * @param {string} [options.lang]
 * @returns {Promise<string>}
 */
export async function extractText(imageSource, { onProgress, lang = "eng" } = {}) {
  // 1. Try Backend Spring Boot OCR service if available
  try {
    const springApiUrl = import.meta.env.VITE_SPRING_BOOT_API_URL || import.meta.env.VITE_SERVER_URL || "http://localhost:8082";
    let blobToSend = null;

    if (typeof imageSource === "string" && imageSource.startsWith("data:")) {
      const arr = imageSource.split(",");
      const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      blobToSend = new Blob([u8arr], { type: mime });
    } else if (imageSource instanceof Blob || (typeof File !== "undefined" && imageSource instanceof File)) {
      blobToSend = imageSource;
    }

    if (blobToSend) {
      if (onProgress) onProgress({ status: "uploading_backend", progress: 20 });
      const formData = new FormData();
      formData.append("file", blobToSend, "ocr_page.jpg");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout for backend

      try {
        const response = await fetch(`${springApiUrl}/api/ocr/extract`, {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data && data.success && data.text && data.text.trim().length > 0) {
            if (onProgress) onProgress({ status: "done", progress: 100 });
            return data.text.trim();
          }
        }
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        // Fallback to browser Tesseract OCR
      }
    }
  } catch (backendErr) {
    console.debug("Backend OCR check skipped:", backendErr);
  }

  // 2. Client-side Tesseract.js OCR
  if (onProgress) onProgress({ status: "initializing_ocr", progress: 30 });
  const worker = await getWorker(lang);

  if (onProgress) onProgress({ status: "recognizing_text", progress: 60 });
  const { data } = await worker.recognize(imageSource);
  
  if (onProgress) onProgress({ status: "done", progress: 100 });
  return (data?.text || "").trim();
}

/**
 * Batch extract text for multiple pages sequentially or in controlled parallel
 * @param {Array<{dataUrl: string, id?: any}>} pagesList
 * @param {Function} [onPageProgress] callback(pageIndex, progressObj)
 * @returns {Promise<Array<{dataUrl: string, extractedText: string}>>}
 */
export async function batchExtractText(pagesList, onPageProgress) {
  const results = [];
  for (let i = 0; i < pagesList.length; i++) {
    const page = pagesList[i];
    const imageSrc = page.dataUrl || page.image || page;
    try {
      if (onPageProgress) onPageProgress(i, { status: "processing", progress: 20 });
      const text = await extractText(imageSrc, {
        onProgress: (p) => onPageProgress && onPageProgress(i, p),
      });
      results.push({
        ...page,
        extractedText: text || "",
        status: "done",
      });
    } catch (err) {
      console.warn(`Error extracting text for page ${i + 1}:`, err);
      results.push({
        ...page,
        extractedText: "",
        status: "error",
        error: err.message,
      });
    }
  }
  return results;
}

export async function terminateOcr() {
  if (workerPromise) {
    try {
      const worker = await workerPromise;
      await worker.terminate();
    } catch (e) {
      console.warn("Terminate OCR error:", e);
    }
    workerPromise = null;
  }
}
