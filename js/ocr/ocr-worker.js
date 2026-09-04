import * as ort from 'onnxruntime-web';
import { preprocessDetectionCanvas, postprocessDetection, preprocessCropForRec } from './ocr-utils.js';
import { parseDictFromYml, ctcGreedyDecode, DEFAULT_PP_OCR_DICT } from './dict.js';
import { loadModule } from '../translation/cld3-loader.js';

// Configure ONNX Runtime Web for Web Worker environment
ort.env.wasm.numThreads = (typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated)
  ? Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1))
  : 1;
ort.env.wasm.proxy = false;

const DET_MODEL_CONFIG = {
  name: 'PP-OCRv5_mobile_det',
  url: 'https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_det_onnx/resolve/main/inference.onnx',
  sizeBytes: 4826518 // ~4.8 MB
};

const REC_MODELS = {
  latin: {
    name: 'PP-OCRv5_mobile_rec (Latin / Western)',
    url: 'https://huggingface.co/PaddlePaddle/latin_PP-OCRv5_mobile_rec_onnx/resolve/main/inference.onnx',
    dictUrl: 'https://huggingface.co/PaddlePaddle/latin_PP-OCRv5_mobile_rec_onnx/raw/main/inference.yml',
    sizeBytes: 8042023 // ~8.0 MB
  },
  cyrillic: {
    name: 'PP-OCRv5_mobile_rec (Cyrillic)',
    url: 'https://huggingface.co/PaddlePaddle/cyrillic_PP-OCRv5_mobile_rec_onnx/resolve/main/inference.onnx',
    dictUrl: 'https://huggingface.co/PaddlePaddle/cyrillic_PP-OCRv5_mobile_rec_onnx/raw/main/inference.yml',
    sizeBytes: 8200000
  },
  eslav: {
    name: 'PP-OCRv5_mobile_rec (East Slavic / Polish / Czech)',
    url: 'https://huggingface.co/PaddlePaddle/eslav_PP-OCRv5_mobile_rec_onnx/resolve/main/inference.onnx',
    dictUrl: 'https://huggingface.co/PaddlePaddle/eslav_PP-OCRv5_mobile_rec_onnx/raw/main/inference.yml',
    sizeBytes: 8100000
  },
  cjk: {
    name: 'PP-OCRv5_mobile_rec (CJK Multilingual)',
    url: 'https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_rec_onnx/resolve/main/inference.onnx',
    dictUrl: 'https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_rec_onnx/raw/main/inference.yml',
    sizeBytes: 16534782 // ~16.5 MB
  },
  korean: {
    name: 'PP-OCRv5_mobile_rec (Korean)',
    url: 'https://huggingface.co/PaddlePaddle/korean_PP-OCRv5_mobile_rec_onnx/resolve/main/inference.onnx',
    dictUrl: 'https://huggingface.co/PaddlePaddle/korean_PP-OCRv5_mobile_rec_onnx/raw/main/inference.yml',
    sizeBytes: 9500000
  },
  arabic: {
    name: 'PP-OCRv5_mobile_rec (Arabic)',
    url: 'https://huggingface.co/PaddlePaddle/arabic_PP-OCRv5_mobile_rec_onnx/resolve/main/inference.onnx',
    dictUrl: 'https://huggingface.co/PaddlePaddle/arabic_PP-OCRv5_mobile_rec_onnx/raw/main/inference.yml',
    sizeBytes: 8500000
  },
  devanagari: {
    name: 'PP-OCRv5_mobile_rec (Devanagari)',
    url: 'https://huggingface.co/PaddlePaddle/devanagari_PP-OCRv5_mobile_rec_onnx/resolve/main/inference.onnx',
    dictUrl: 'https://huggingface.co/PaddlePaddle/devanagari_PP-OCRv5_mobile_rec_onnx/raw/main/inference.yml',
    sizeBytes: 8500000
  },
  el: {
    name: 'PP-OCRv5_mobile_rec (Greek)',
    url: 'https://huggingface.co/PaddlePaddle/el_PP-OCRv5_mobile_rec_onnx/resolve/main/inference.onnx',
    dictUrl: 'https://huggingface.co/PaddlePaddle/el_PP-OCRv5_mobile_rec_onnx/raw/main/inference.yml',
    sizeBytes: 8100000
  },
  th: {
    name: 'PP-OCRv5_mobile_rec (Thai)',
    url: 'https://huggingface.co/PaddlePaddle/th_PP-OCRv5_mobile_rec_onnx/resolve/main/inference.onnx',
    dictUrl: 'https://huggingface.co/PaddlePaddle/th_PP-OCRv5_mobile_rec_onnx/raw/main/inference.yml',
    sizeBytes: 8300000
  }
};

const LANG_TO_SCRIPT_MAP = {
  // Latin / Western European / Romance / Germanic
  en: 'latin', es: 'latin', fr: 'latin', de: 'latin', it: 'latin', pt: 'latin', nl: 'latin',
  sv: 'latin', da: 'latin', fi: 'latin', no: 'latin', ro: 'latin', hu: 'latin',
  tr: 'latin', id: 'latin', vi: 'latin', af: 'latin', ca: 'latin',
  gl: 'latin', eu: 'latin', ms: 'latin', tl: 'latin', sw: 'latin', xh: 'latin',

  // East Slavic / Slavic Latin
  pl: 'eslav', cs: 'eslav', sk: 'eslav',

  // Cyrillic
  ru: 'cyrillic', uk: 'cyrillic', bg: 'cyrillic', be: 'cyrillic', sr: 'cyrillic', mk: 'cyrillic', kk: 'cyrillic',

  // CJK
  zh: 'cjk', 'zh-cn': 'cjk', 'zh-tw': 'cjk', ja: 'cjk',

  // Korean
  ko: 'korean',

  // Arabic
  ar: 'arabic', fa: 'arabic', ur: 'arabic', ps: 'arabic',

  // Greek
  el: 'el',

  // Devanagari (Hindi)
  hi: 'devanagari', mr: 'devanagari', ne: 'devanagari', sa: 'devanagari',

  // Thai
  th: 'th'
};

const CODE_NORMALIZATION_MAP = {
  'zh-Latn': 'zh',
  'ru-Latn': 'ru',
  'bg-Latn': 'bg',
  'el-Latn': 'el',
  'hi-Latn': 'hi',
  'ja-Latn': 'ja',
  'iw': 'he',
  'jw': 'jv',
  'fil': 'tl'
};

let cldFactoryInstance = null;
let cldInitPromise = null;

async function getCldFactory() {
  if (cldFactoryInstance) return cldFactoryInstance;
  if (cldInitPromise) return cldInitPromise;
  cldInitPromise = (async () => {
    try {
      cldFactoryInstance = await loadModule();
      return cldFactoryInstance;
    } catch (e) {
      console.warn('Could not initialize cld3-asm in OCR worker:', e);
      return null;
    } finally {
      cldInitPromise = null;
    }
  })();
  return cldInitPromise;
}

async function detectLanguageWithCLD3(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.trim();
  if (clean.length < 2) return null;
  if (!/[^\d\s\p{P}\p{S}]/u.test(clean)) return null;

  try {
    const factory = await getCldFactory();
    if (!factory) return null;
    const identifier = factory.create(0, 2000);
    let result = null;
    try {
      result = identifier.findLanguage(clean);
    } finally {
      identifier.dispose();
    }
    if (result && result.language && result.language !== 'und') {
      const normalized = CODE_NORMALIZATION_MAP[result.language] || result.language.toLowerCase();
      return {
        language: normalized,
        probability: result.probability,
        isReliable: result.is_reliable
      };
    }
  } catch (err) {
    console.warn('Worker CLD3 detection error:', err);
  }
  return null;
}

let detSession = null;
let detInitPromise = null;
const recSessions = new Map(); // scriptKey -> { session, charDict }
const recLoadingPromises = new Map();

/**
 * Fetch a resource with progress reporting and CacheStorage caching
 */
async function fetchWithCache(url, modelKey, estimatedBytes, onProgress) {
  let cache = null;
  try {
    if (typeof caches !== 'undefined') {
      cache = await caches.open('ocr-models-v1');
      const cachedResponse = await cache.match(url);
      if (cachedResponse) {
        onProgress?.({
          file: modelKey,
          loaded: 100,
          total: 100,
          status: 'cached'
        });
        return await cachedResponse.arrayBuffer();
      }
    }
  } catch (e) {
    console.warn('Cache check failed:', e);
  }

  onProgress?.({
    file: modelKey,
    loaded: 0,
    total: estimatedBytes || 0,
    status: 'downloading'
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${modelKey} from ${url}: ${response.statusText}`);
  }

  const contentLength = Number(response.headers.get('content-length')) || estimatedBytes || 0;
  
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    if (cache) {
      try {
        await cache.put(url, new Response(buffer.slice(0)));
      } catch (_) {}
    }
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let receivedLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    receivedLength += value.length;
    if (onProgress && contentLength > 0) {
      onProgress({
        file: modelKey,
        loaded: receivedLength,
        total: contentLength,
        percent: Math.min(100, Math.round((receivedLength / contentLength) * 100)),
        status: 'progress'
      });
    }
  }

  const allChunks = new Uint8Array(receivedLength);
  let position = 0;
  for (const chunk of chunks) {
    allChunks.set(chunk, position);
    position += chunk.length;
  }

  if (cache) {
    try {
      await cache.put(url, new Response(allChunks.buffer.slice(0)));
    } catch (_) {}
  }

  onProgress?.({
    file: modelKey,
    loaded: receivedLength,
    total: receivedLength,
    percent: 100,
    status: 'done'
  });

  return allChunks.buffer;
}

/**
 * Initialize detection ONNX session
 */
async function initDetModel(onProgress) {
  if (detSession) return detSession;
  if (detInitPromise) return detInitPromise;

  detInitPromise = (async () => {
    self.postMessage({ type: 'status', status: 'loading', message: 'Loading DBNet text detector...' });
    const detBuffer = await fetchWithCache(DET_MODEL_CONFIG.url, 'det_model', DET_MODEL_CONFIG.sizeBytes, onProgress);
    detSession = await ort.InferenceSession.create(detBuffer, {
      executionProviders: ['wasm']
    });
    return detSession;
  })();

  try {
    return await detInitPromise;
  } finally {
    detInitPromise = null;
  }
}

/**
 * Initialize language-specific recognition model
 */
async function initRecModel(scriptKey = 'latin', onProgress) {
  const config = REC_MODELS[scriptKey] || REC_MODELS.latin;
  const effectiveKey = REC_MODELS[scriptKey] ? scriptKey : 'latin';

  if (recSessions.has(effectiveKey)) {
    return recSessions.get(effectiveKey);
  }

  if (recLoadingPromises.has(effectiveKey)) {
    return recLoadingPromises.get(effectiveKey);
  }

  const loadPromise = (async () => {
    self.postMessage({
      type: 'status',
      status: 'loading',
      message: `Loading ${config.name}...`
    });

    try {
      // 1. Download & parse character dictionary
      let charDict = DEFAULT_PP_OCR_DICT;
      try {
        const dictBuffer = await fetchWithCache(config.dictUrl, `${effectiveKey}_dict`, 150000, onProgress);
        const decoder = new TextDecoder('utf-8');
        const ymlText = decoder.decode(dictBuffer);
        charDict = parseDictFromYml(ymlText);
      } catch (e) {
        console.warn(`Could not fetch online dict for ${effectiveKey}, using fallback charset:`, e);
      }

      // 2. Download and create ONNX session
      const recBuffer = await fetchWithCache(config.url, `${effectiveKey}_rec_model`, config.sizeBytes, onProgress);
      const session = await ort.InferenceSession.create(recBuffer, {
        executionProviders: ['wasm']
      });

      const entry = { session, charDict, config };
      recSessions.set(effectiveKey, entry);
      return entry;
    } catch (err) {
      console.error(`Failed to load recognition model for ${effectiveKey}:`, err);
      throw err;
    } finally {
      recLoadingPromises.delete(effectiveKey);
    }
  })();

  recLoadingPromises.set(effectiveKey, loadPromise);
  return loadPromise;
}

/**
 * Recognize text for a list of detected bounding box crops using the provided recognition model entry
 */
async function recognizeBoxes(detectedBoxes, recEntry, imageData, origW, origH, minDetectionScore) {
  const recognizedBoxes = [];
  const recSession = recEntry.session;
  const charDict = recEntry.charDict;
  const recInputName = recSession.inputNames[0] || 'x';
  const recOutputName = recSession.outputNames[0] || 'save_infer_model/scale_0.tmp_1';

  for (let i = 0; i < detectedBoxes.length; i++) {
    const box = detectedBoxes[i];
    try {
      const crop = preprocessCropForRec({ data: imageData.data, width: origW, height: origH }, box, 48, 640);
      const recInputTensor = new ort.Tensor('float32', crop.tensorData, [1, 3, crop.height, crop.width]);

      const recResults = await recSession.run({ [recInputName]: recInputTensor });
      const recOutputTensor = recResults[recOutputName] || Object.values(recResults)[0];

      const dims = recOutputTensor.dims; // [1, timeSteps, numClasses]
      const timeSteps = dims[1];
      const numClasses = dims[2];

      const { text, confidence } = ctcGreedyDecode(recOutputTensor.data, timeSteps, numClasses, charDict);

      recognizedBoxes.push({
        id: `ocr_box_${i + 1}`,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        pctX: box.pctX,
        pctY: box.pctY,
        pctWidth: box.pctWidth,
        pctHeight: box.pctHeight,
        originalText: text,
        translatedText: '',
        score: box.score,
        confidence: confidence || box.confidence || minDetectionScore
      });
    } catch (cropErr) {
      console.warn(`Recognition failed for box ${i}:`, cropErr);
      recognizedBoxes.push({
        id: `ocr_box_${i + 1}`,
        ...box,
        originalText: '',
        translatedText: '',
        confidence: box.confidence || minDetectionScore
      });
    }
  }

  return recognizedBoxes;
}

/**
 * Run end-to-end OCR processing:
 * 1. Detect text regions using DBNet
 * 2. Recognize text with default model (Latin/Western)
 * 3. Pass recognized text to cld3-asm to detect language
 * 4. If recognized as specialized language/script (e.g. Cyrillic, CJK, Korean, Arabic, Devanagari, Greek, Thai, East Slavic),
 *    re-recognize with that specialized model for optimal accuracy.
 */
async function processOCR(imageData, settings = {}) {
  const minDetectionScore = settings.minDetectionScore ?? 0.5;
  const minRecognitionScore = settings.minRecognitionScore ?? 0.8;
  const maxResolution = settings.maxResolution ?? 736;
  const { width: origW, height: origH, data } = imageData;

  // 1. Ensure Detection Model is ready
  await initDetModel((progress) => {
    self.postMessage({ type: 'progress', progress });
  });

  self.postMessage({ type: 'status', status: 'detecting', message: 'Running DBNet text detection...' });

  // 2. Preprocess for DBNet Detection
  const prepped = preprocessDetectionCanvas({ data, width: origW, height: origH }, maxResolution);
  const detInputTensor = new ort.Tensor('float32', prepped.tensorData, [1, 3, prepped.height, prepped.width]);

  const detInputName = detSession.inputNames[0] || 'x';
  const detOutputName = detSession.outputNames[0] || 'save_infer_model/scale_0.tmp_1';

  const detResults = await detSession.run({ [detInputName]: detInputTensor });
  const detOutputTensor = detResults[detOutputName] || Object.values(detResults)[0];
  const predMap = detOutputTensor.data;

  // 3. Postprocess DBNet heatmap into bounding boxes
  const detectedBoxes = postprocessDetection(
    predMap,
    prepped.height,
    prepped.width,
    prepped.scaleX,
    prepped.scaleY,
    origW,
    origH,
    0.3,                 // binarization threshold
    minDetectionScore,   // min box confidence
    1.6                  // unclip expansion ratio
  );

  if (detectedBoxes.length === 0) {
    return {
      imageWidth: origW,
      imageHeight: origH,
      boxes: [],
      modelName: 'None',
      detectedLanguage: 'en'
    };
  }

  // 4. Initial Recognition with Default Model (Latin / Western)
  const defaultScriptKey = 'latin';
  let recEntry = await initRecModel(defaultScriptKey, (progress) => {
    self.postMessage({ type: 'progress', progress });
  });

  self.postMessage({
    type: 'status',
    status: 'recognizing',
    message: `Detecting text in ${detectedBoxes.length} regions with default model...`,
    count: detectedBoxes.length
  });

  let recognizedBoxes = await recognizeBoxes(detectedBoxes, recEntry, imageData, origW, origH, minDetectionScore);

  // 5. Pass extracted text to cld3-asm to detect language
  const combinedText = recognizedBoxes.map(b => b.originalText).filter(Boolean).join(' ');
  const detection = await detectLanguageWithCLD3(combinedText);
  const detectedLangCode = detection?.language || null;

  const userForcedLang = (settings.language && settings.language !== 'auto') ? settings.language.toLowerCase() : null;
  const effectiveLangCode = userForcedLang || detectedLangCode || 'en';
  const specializedScript = LANG_TO_SCRIPT_MAP[effectiveLangCode] || (REC_MODELS[effectiveLangCode] ? effectiveLangCode : 'latin');

  // 6. If language is recognized as requiring a specialized model, re-recognize
  if (specializedScript && specializedScript !== defaultScriptKey && REC_MODELS[specializedScript]) {
    const specConfig = REC_MODELS[specializedScript];
    self.postMessage({
      type: 'status',
      status: 'recognizing',
      message: `Identified ${detectedLangCode || effectiveLangCode}. Re-recognizing with specialized ${specConfig.name}...`,
      count: detectedBoxes.length
    });

    recEntry = await initRecModel(specializedScript, (progress) => {
      self.postMessage({ type: 'progress', progress });
    });

    recognizedBoxes = await recognizeBoxes(detectedBoxes, recEntry, imageData, origW, origH, minDetectionScore);
  }

  return {
    imageWidth: origW,
    imageHeight: origH,
    boxes: recognizedBoxes,
    modelName: recEntry.config.name,
    detectedLanguage: effectiveLangCode
  };
}

// Worker message listener
self.addEventListener('message', async (event) => {
  const { type, id, imageData, settings, language } = event.data || {};

  if (type === 'init') {
    try {
      const scriptKey = LANG_TO_SCRIPT_MAP[(language || 'en').toLowerCase()] || 'latin';
      await initDetModel((progress) => {
        self.postMessage({ type: 'progress', id, progress });
      });
      await initRecModel(scriptKey, (progress) => {
        self.postMessage({ type: 'progress', id, progress });
      });
      self.postMessage({ type: 'status', id, status: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', id, error: err?.message || String(err) });
    }
  } else if (type === 'process') {
    try {
      const result = await processOCR(imageData, settings);
      self.postMessage({ type: 'result', id, output: result });
    } catch (err) {
      console.error('OCR Worker processing error:', err);
      self.postMessage({ type: 'error', id, error: err?.message || String(err) });
    }
  }
});

