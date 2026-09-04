import { pipeline, env } from '@huggingface/transformers';

// Configure environment for browser execution
env.allowLocalModels = false;
env.useBrowserCache = true;

class TranslationPipelineManager {
  static task = 'translation';
  static instances = new Map();
  static loadingPromises = new Map();

  static async getInstance(modelName = 'Xenova/m2m100_418M', progress_callback = null, device = 'wasm') {
    if (this.instances.has(modelName)) {
      return this.instances.get(modelName);
    }

    if (this.loadingPromises.has(modelName)) {
      return this.loadingPromises.get(modelName);
    }

    const loadPromise = (async () => {
      try {
        const pipelineOptions = {
          progress_callback,
          dtype: 'q8',
          device: 'wasm'
        };

        const instance = await pipeline(this.task, modelName, pipelineOptions);
        this.instances.set(modelName, instance);
        return instance;
      } catch (err) {
        console.warn(`Pipeline load failed for ${modelName}:`, err);
        throw err;
      } finally {
        this.loadingPromises.delete(modelName);
      }
    })();

    this.loadingPromises.set(modelName, loadPromise);
    return loadPromise;
  }
}

// Track cumulative progress per model
const modelProgressMaps = new Map();
const ESTIMATED_M2M_BYTES = 610.3 * 1024 * 1024; // ~610.3 MB for m2m100_418M ONNX Q8
const ESTIMATED_OPUS_BYTES = 95 * 1024 * 1024; // ~95 MB for Helsinki-NLP Opus-MT ONNX Q8

function aggregateProgress(data, modelName, isOpus = false) {
  if (!data) return null;

  if (!modelProgressMaps.has(modelName)) {
    modelProgressMaps.set(modelName, new Map());
  }
  const fileProgressMap = modelProgressMaps.get(modelName);

  const { status, file, loaded, total } = data;
  const key = file || 'model';

  if (status === 'initiate' || status === 'download') {
    if (!fileProgressMap.has(key)) {
      fileProgressMap.set(key, {
        loaded: 0,
        total: total || 0,
        status: 'download'
      });
    }
  } else if (status === 'progress') {
    fileProgressMap.set(key, {
      loaded: loaded || 0,
      total: total || 0,
      status: 'progress'
    });
  } else if (status === 'done') {
    const existing = fileProgressMap.get(key) || {};
    const finalTotal = total || existing.total || existing.loaded || 0;
    fileProgressMap.set(key, {
      loaded: finalTotal,
      total: finalTotal,
      status: 'done'
    });
  }

  let totalBytes = 0;
  let loadedBytes = 0;
  let totalFilesCount = fileProgressMap.size;
  let completedFilesCount = 0;

  for (const item of fileProgressMap.values()) {
    if (item.total > 0) {
      totalBytes += item.total;
      loadedBytes += Math.min(item.loaded, item.total);
    } else {
      loadedBytes += item.loaded;
    }
    if (item.status === 'done') {
      completedFilesCount++;
    }
  }

  const estimatedBytes = isOpus ? ESTIMATED_OPUS_BYTES : ESTIMATED_M2M_BYTES;
  const effectiveTotal = Math.max(totalBytes, estimatedBytes);
  const currentPercent = effectiveTotal > 0 ? (loadedBytes / effectiveTotal) * 100 : 0;
  const progressPercent = Math.min(100, Math.max(0, currentPercent));

  return {
    status: status || 'progress',
    file: key,
    loaded: loadedBytes,
    total: effectiveTotal,
    progress: progressPercent,
    completedFiles: completedFilesCount,
    totalFiles: totalFilesCount,
    model: modelName
  };
}

function splitIntoSentences(text, langCode) {
  if (!text || !text.trim()) return [];
  const clean = text.trim();

  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    try {
      const segmenter = new Intl.Segmenter(langCode || undefined, { granularity: 'sentence' });
      const sentences = [];
      for (const { segment } of segmenter.segment(clean)) {
        const trimmed = segment.trim();
        if (trimmed) sentences.push(trimmed);
      }
      if (sentences.length > 0) return sentences;
    } catch {
      // Fallback below
    }
  }

  // Fallback: split by terminal punctuation followed by space or end of string
  const matches = clean.match(/[^.!?]+(?:[.!?]+(?:\s+|$)|$)/g);
  if (matches) {
    const res = matches.map(s => s.trim()).filter(Boolean);
    if (res.length > 0) return res;
  }
  return [clean];
}

self.addEventListener('message', async (event) => {
  const { type, id, text, src_lang, tgt_lang, model, isOpus, device } = event.data || {};
  const targetModel = model || 'Xenova/m2m100_418M';
  const modelIsOpus = isOpus !== undefined ? Boolean(isOpus) : targetModel.includes('opus-mt');

  if (type === 'load') {
    try {
      self.postMessage({ type: 'status', status: 'loading', id, model: targetModel });
      await TranslationPipelineManager.getInstance(targetModel, (rawProgress) => {
        const aggregated = aggregateProgress(rawProgress, targetModel, modelIsOpus);
        if (aggregated) {
          self.postMessage({ type: 'progress', progress: aggregated, id, model: targetModel });
        }
      }, device);
      self.postMessage({ type: 'status', status: 'ready', id, model: targetModel });
    } catch (error) {
      self.postMessage({
        type: 'error',
        id,
        model: targetModel,
        error: error?.message || String(error)
      });
    }
    return;
  }

  if (type === 'translate') {
    if (!text || !text.trim()) {
      self.postMessage({
        type: 'result',
        id,
        output: '',
        inferenceTimeMs: 0,
        src_lang,
        tgt_lang,
        model: targetModel
      });
      return;
    }

    try {
      const startTime = performance.now();
      self.postMessage({ type: 'status', status: 'translating', id, model: targetModel });

      const translator = await TranslationPipelineManager.getInstance(targetModel, (rawProgress) => {
        const aggregated = aggregateProgress(rawProgress, targetModel, modelIsOpus);
        if (aggregated) {
          self.postMessage({ type: 'progress', progress: aggregated, id, model: targetModel });
        }
      }, device);

      // Sentence-level and line-level segmentation to prevent MarianMT / M2M100
      // from truncating or omitting sentences across newlines.
      const rawLines = text.split(/\r?\n/);
      const lineSentences = rawLines.map(line => splitIntoSentences(line, src_lang));

      const allSentences = [];
      lineSentences.forEach((sentences, lineIdx) => {
        sentences.forEach((sentence, sentIdx) => {
          allSentences.push({ lineIdx, sentIdx, text: sentence });
        });
      });

      const generateOptions = modelIsOpus
        ? { max_new_tokens: 256 }
        : {
            src_lang: src_lang || 'en',
            tgt_lang: tgt_lang || 'es',
            max_new_tokens: 256
          };

      const translatedLines = rawLines.map(() => []);

      if (allSentences.length > 0) {
        const textsToTranslate = allSentences.map(s => s.text);
        const BATCH_SIZE = 8;
        const allOutputs = [];

        for (let i = 0; i < textsToTranslate.length; i += BATCH_SIZE) {
          const batch = textsToTranslate.slice(i, i + BATCH_SIZE);
          try {
            const batchOutput = await translator(batch, generateOptions);
            if (Array.isArray(batchOutput)) {
              allOutputs.push(...batchOutput);
            } else if (batchOutput) {
              allOutputs.push(batchOutput);
            }
          } catch (batchErr) {
            console.warn('Batch translation failed, falling back to sentence-by-sentence:', batchErr);
            for (const singleText of batch) {
              const singleOutput = await translator(singleText, generateOptions);
              if (Array.isArray(singleOutput)) {
                allOutputs.push(singleOutput[0]);
              } else if (singleOutput) {
                allOutputs.push(singleOutput);
              }
            }
          }
        }

        allSentences.forEach((meta, idx) => {
          const item = allOutputs[idx];
          const translation = item?.translation_text !== undefined
            ? item.translation_text
            : (typeof item === 'string' ? item : '');
          translatedLines[meta.lineIdx].push(translation.trim());
        });
      }

      const translationText = translatedLines
        .map(sentencesInLine => sentencesInLine.join(' '))
        .join('\n');

      const inferenceTimeMs = Math.round(performance.now() - startTime);

      self.postMessage({
        type: 'result',
        id,
        output: translationText,
        inferenceTimeMs,
        src_lang,
        tgt_lang,
        model: targetModel
      });
    } catch (error) {
      self.postMessage({
        type: 'error',
        id,
        model: targetModel,
        error: error?.message || String(error)
      });
    }
  }
});
