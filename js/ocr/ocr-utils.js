/**
 * Preprocessing, Postprocessing and Geometry utilities for PP-OCR in the browser / Web Worker
 */

/**
 * Resize image and prepare tensor for DBNet detection
 * Previews above maxResolution (default: 736, matching Immich) are resized while preserving aspect ratio.
 * H and W must be multiples of 32
 */
export function preprocessDetectionCanvas(canvasOrImageData, maxSide = 736) {
  let origW, origH, data;

  if (typeof OffscreenCanvas !== 'undefined' && canvasOrImageData instanceof OffscreenCanvas) {
    origW = canvasOrImageData.width;
    origH = canvasOrImageData.height;
  } else if (typeof HTMLCanvasElement !== 'undefined' && canvasOrImageData instanceof HTMLCanvasElement) {
    origW = canvasOrImageData.width;
    origH = canvasOrImageData.height;
  } else if (canvasOrImageData && canvasOrImageData.data && canvasOrImageData.width) {
    origW = canvasOrImageData.width;
    origH = canvasOrImageData.height;
    data = canvasOrImageData.data;
  } else {
    throw new Error('Unsupported canvas or image data for detection preprocessing');
  }

  let scale = 1.0;
  if (Math.max(origW, origH) > maxSide) {
    scale = maxSide / Math.max(origW, origH);
  }

  let targetW = Math.round((origW * scale) / 32) * 32;
  let targetH = Math.round((origH * scale) / 32) * 32;

  targetW = Math.max(32, targetW);
  targetH = Math.max(32, targetH);

  let resizedData;

  if (typeof OffscreenCanvas !== 'undefined') {
    const offscreen = new OffscreenCanvas(targetW, targetH);
    const ctx = offscreen.getContext('2d', { willReadFrequently: true });
    if (data) {
      const srcCanvas = new OffscreenCanvas(origW, origH);
      const srcCtx = srcCanvas.getContext('2d');
      srcCtx.putImageData(new ImageData(data, origW, origH), 0, 0);
      ctx.drawImage(srcCanvas, 0, 0, targetW, targetH);
    } else {
      ctx.drawImage(canvasOrImageData, 0, 0, targetW, targetH);
    }
    resizedData = ctx.getImageData(0, 0, targetW, targetH).data;
  } else if (typeof document !== 'undefined') {
    const offscreen = document.createElement('canvas');
    offscreen.width = targetW;
    offscreen.height = targetH;
    const ctx = offscreen.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(canvasOrImageData, 0, 0, targetW, targetH);
    resizedData = ctx.getImageData(0, 0, targetW, targetH).data;
  } else {
    throw new Error('Canvas API not available in current environment');
  }

  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];

  // CHW format Float32Array: [3, targetH, targetW]
  const channelSize = targetW * targetH;
  const tensorData = new Float32Array(3 * channelSize);

  for (let i = 0; i < channelSize; i++) {
    const r = resizedData[i * 4] / 255.0;
    const g = resizedData[i * 4 + 1] / 255.0;
    const b = resizedData[i * 4 + 2] / 255.0;

    tensorData[i] = (r - mean[0]) / std[0];
    tensorData[channelSize + i] = (g - mean[1]) / std[1];
    tensorData[2 * channelSize + i] = (b - mean[2]) / std[2];
  }

  return {
    tensorData,
    width: targetW,
    height: targetH,
    origW,
    origH,
    scaleX: origW / targetW,
    scaleY: origH / targetH
  };
}

/**
 * Extract connected bounding boxes from DBNet probability heatmap
 * @param {Float32Array} predMap - shape [H, W] values 0..1
 * @param {number} height - H
 * @param {number} width - W
 * @param {number} scaleX - scaling factor to original image
 * @param {number} scaleY - scaling factor to original image
 * @param {number} origW - original image width
 * @param {number} origH - original image height
 * @param {number} thresh - binarization threshold (default: 0.3)
 * @param {number} boxThresh - minimum average score for box (default: 0.5)
 * @param {number} unclipRatio - DBNet polygon unclip expansion ratio (default: 1.6)
 */
export function postprocessDetection(
  predMap,
  height,
  width,
  scaleX,
  scaleY,
  origW,
  origH,
  thresh = 0.3,
  boxThresh = 0.5,
  unclipRatio = 1.6
) {
  // 1. Binarize
  const binary = new Uint8Array(height * width);
  for (let i = 0; i < predMap.length; i++) {
    binary[i] = predMap[i] > thresh ? 1 : 0;
  }

  // 2. Connected component labeling (two-pass disjoint-set)
  const labels = new Int32Array(height * width);
  const parent = [0];

  function find(i) {
    let root = i;
    while (root < parent.length && parent[root] !== root) {
      root = parent[root];
    }
    let curr = i;
    while (curr < parent.length && parent[curr] !== curr) {
      const next = parent[curr];
      parent[curr] = root;
      curr = next;
    }
    return root;
  }

  function union(i, j) {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) {
      parent[rootI] = rootJ;
    }
  }

  let nextLabel = 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (binary[idx] === 1) {
        const left = x > 0 ? labels[idx - 1] : 0;
        const top = y > 0 ? labels[idx - width] : 0;

        if (left === 0 && top === 0) {
          labels[idx] = nextLabel;
          parent.push(nextLabel);
          nextLabel++;
        } else if (left !== 0 && top === 0) {
          labels[idx] = left;
        } else if (left === 0 && top !== 0) {
          labels[idx] = top;
        } else {
          labels[idx] = left;
          if (left !== top) {
            union(left, top);
          }
        }
      }
    }
  }

  // Second pass: gather bounding box & confidence score per connected component
  const bboxes = new Map(); // rootLabel -> { minX, minY, maxX, maxY, count, sumScore }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (labels[idx] > 0) {
        const root = find(labels[idx]);
        labels[idx] = root;

        let comp = bboxes.get(root);
        if (!comp) {
          comp = { minX: x, minY: y, maxX: x, maxY: y, count: 0, sumScore: 0 };
          bboxes.set(root, comp);
        }

        comp.minX = Math.min(comp.minX, x);
        comp.minY = Math.min(comp.minY, y);
        comp.maxX = Math.max(comp.maxX, x);
        comp.maxY = Math.max(comp.maxY, y);
        comp.count++;
        comp.sumScore += predMap[idx];
      }
    }
  }

  const results = [];
  const minPixels = 16;

  for (const comp of bboxes.values()) {
    if (comp.count < minPixels) continue;
    const avgScore = comp.sumScore / comp.count;
    if (avgScore < boxThresh) continue;

    const boxW = comp.maxX - comp.minX + 1;
    const boxH = comp.maxY - comp.minY + 1;

    if (boxW < 4 || boxH < 4) continue;

    // Unclip formula: distance = Area * unclipRatio / Perimeter
    const area = boxW * boxH;
    const perimeter = 2 * (boxW + boxH);
    const distance = (area * unclipRatio) / Math.max(1, perimeter);

    // Expand bounding box by unclip distance
    const unclipMinX = Math.max(0, comp.minX - distance);
    const unclipMinY = Math.max(0, comp.minY - distance);
    const unclipMaxX = Math.min(width, comp.maxX + 1 + distance);
    const unclipMaxY = Math.min(height, comp.maxY + 1 + distance);

    // Map back to original image space
    const x1 = Math.max(0, unclipMinX * scaleX);
    const y1 = Math.max(0, unclipMinY * scaleY);
    const x2 = Math.min(origW, unclipMaxX * scaleX);
    const y2 = Math.min(origH, unclipMaxY * scaleY);

    const w = x2 - x1;
    const h = y2 - y1;

    if (w < 8 || h < 6) continue;

    results.push({
      x: x1,
      y: y1,
      width: w,
      height: h,
      pctX: (x1 / origW) * 100,
      pctY: (y1 / origH) * 100,
      pctWidth: (w / origW) * 100,
      pctHeight: (h / origH) * 100,
      score: Math.min(1.0, avgScore),
      confidence: Math.min(1.0, avgScore)
    });
  }

  // Sort boxes top-to-bottom, then left-to-right
  results.sort((a, b) => {
    if (Math.abs(a.y - b.y) > 12) {
      return a.y - b.y;
    }
    return a.x - b.x;
  });

  return results;
}

/**
 * Preprocess a cropped image box for PP-OCRv5 Recognition
 * Target height is 48px, variable width (multiple of 8, max 640)
 */
export function preprocessCropForRec(canvasOrImageData, box, targetH = 48, maxW = 640) {
  let origW, origH, srcCanvas;

  if (typeof OffscreenCanvas !== 'undefined' && canvasOrImageData instanceof OffscreenCanvas) {
    srcCanvas = canvasOrImageData;
    origW = canvasOrImageData.width;
    origH = canvasOrImageData.height;
  } else if (typeof HTMLCanvasElement !== 'undefined' && canvasOrImageData instanceof HTMLCanvasElement) {
    srcCanvas = canvasOrImageData;
    origW = canvasOrImageData.width;
    origH = canvasOrImageData.height;
  } else if (canvasOrImageData && canvasOrImageData.data && canvasOrImageData.width) {
    origW = canvasOrImageData.width;
    origH = canvasOrImageData.height;
    if (typeof OffscreenCanvas !== 'undefined') {
      srcCanvas = new OffscreenCanvas(origW, origH);
      srcCanvas.getContext('2d').putImageData(new ImageData(canvasOrImageData.data, origW, origH), 0, 0);
    } else if (typeof document !== 'undefined') {
      srcCanvas = document.createElement('canvas');
      srcCanvas.width = origW;
      srcCanvas.height = origH;
      srcCanvas.getContext('2d').putImageData(new ImageData(canvasOrImageData.data, origW, origH), 0, 0);
    }
  }

  const sx = Math.max(0, Math.floor(box.x));
  const sy = Math.max(0, Math.floor(box.y));
  const sw = Math.min(origW - sx, Math.ceil(box.width));
  const sh = Math.min(origH - sy, Math.ceil(box.height));

  const aspect = sw / Math.max(1, sh);
  let targetW = Math.round((targetH * aspect) / 8) * 8;
  targetW = Math.min(maxW, Math.max(32, targetW));

  let cropData;

  if (typeof OffscreenCanvas !== 'undefined') {
    const cropCanvas = new OffscreenCanvas(targetW, targetH);
    const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
    cropCtx.fillStyle = '#ffffff';
    cropCtx.fillRect(0, 0, targetW, targetH);
    if (srcCanvas && sw > 0 && sh > 0) {
      cropCtx.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, targetW, targetH);
    }
    cropData = cropCtx.getImageData(0, 0, targetW, targetH).data;
  } else if (typeof document !== 'undefined') {
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = targetW;
    cropCanvas.height = targetH;
    const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
    cropCtx.fillStyle = '#ffffff';
    cropCtx.fillRect(0, 0, targetW, targetH);
    if (srcCanvas && sw > 0 && sh > 0) {
      cropCtx.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, targetW, targetH);
    }
    cropData = cropCtx.getImageData(0, 0, targetW, targetH).data;
  }

  const channelSize = targetW * targetH;
  const tensorData = new Float32Array(3 * channelSize);

  // Normalize: (pixel / 255 - 0.5) / 0.5
  for (let i = 0; i < channelSize; i++) {
    const r = (cropData[i * 4] / 255.0 - 0.5) / 0.5;
    const g = (cropData[i * 4 + 1] / 255.0 - 0.5) / 0.5;
    const b = (cropData[i * 4 + 2] / 255.0 - 0.5) / 0.5;

    tensorData[i] = r;
    tensorData[channelSize + i] = g;
    tensorData[2 * channelSize + i] = b;
  }

  return {
    tensorData,
    width: targetW,
    height: targetH
  };
}


