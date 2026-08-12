let model = null;

export async function loadModel() {
  if (model) return model;

  const cocoSsd = window.cocoSsd;
  if (!cocoSsd) {
    throw new Error("COCO-SSD library is not loaded. Check index.html CDN script tags.");
  }

  model = await cocoSsd.load();
  return model;
}

export async function detectObjects(mediaElement) {
  const loadedModel = await loadModel();
  if (!loadedModel) return [];
  return loadedModel.detect(mediaElement);
}
