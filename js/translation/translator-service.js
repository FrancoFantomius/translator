import { getModelInfo, DEFAULT_MULTILINGUAL_MODEL } from './models-config.js';

export class TranslationService {
  constructor() {
    this.worker = null;
    this.pendingRequests = new Map();
    this.progressListeners = new Set();
    this.statusListeners = new Set();
    this.requestIdCounter = 0;
    this.readyModels = new Set();
    this.loadingModels = new Set();
    this.isReady = false;
    this.isLoading = false;
    this.modelName = DEFAULT_MULTILINGUAL_MODEL;
    this.initWorker();
  }

  initWorker() {
    try {
      this.worker = new Worker(new URL('./worker.js', import.meta.url), {
        type: 'module'
      });

      this.worker.addEventListener('message', (event) => {
        this.handleWorkerMessage(event.data);
      });

      this.worker.addEventListener('error', (err) => {
        console.error('Translation worker encountered an error:', err);
        this.notifyStatus('error', err?.message || 'Worker error');
      });
    } catch (err) {
      console.error('Failed to initialize translation worker:', err);
    }
  }

  getModelForPair(srcLang, tgtLang) {
    return getModelInfo(srcLang, tgtLang);
  }

  isModelReady(modelName) {
    if (!modelName) return this.isReady;
    return this.readyModels.has(modelName);
  }

  isPairReady(srcLang, tgtLang) {
    const info = getModelInfo(srcLang, tgtLang);
    return this.isModelReady(info.modelName);
  }

  handleWorkerMessage(data) {
    if (!data) return;
    const { type, id, status, progress, output, inferenceTimeMs, error, src_lang, tgt_lang, model } = data;
    const activeModel = model || this.modelName;

    if (type === 'progress') {
      this.notifyProgress(progress);
    } else if (type === 'status') {
      if (status === 'ready') {
        this.readyModels.add(activeModel);
        this.loadingModels.delete(activeModel);
        this.isReady = true;
        this.isLoading = this.loadingModels.size > 0;
      } else if (status === 'loading') {
        this.loadingModels.add(activeModel);
        this.isLoading = true;
      }
      this.notifyStatus(status, { model: activeModel });
    }

    if (id && this.pendingRequests.has(id)) {
      const { resolve, reject, isTranslation, modelInfo } = this.pendingRequests.get(id);

      if (type === 'result') {
        this.pendingRequests.delete(id);
        resolve({
          translation: output,
          inferenceTimeMs: inferenceTimeMs || 0,
          srcLang: src_lang,
          tgtLang: tgt_lang,
          model: activeModel,
          modelInfo: modelInfo || getModelInfo(src_lang, tgt_lang)
        });
      } else if (type === 'error') {
        this.pendingRequests.delete(id);
        reject(new Error(error || 'Translation failed'));
      } else if (type === 'status' && status === 'ready' && !isTranslation) {
        this.pendingRequests.delete(id);
        resolve({ ready: true, model: activeModel });
      }
    }
  }

  onProgress(callback) {
    this.progressListeners.add(callback);
    return () => this.progressListeners.delete(callback);
  }

  onStatusChange(callback) {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  notifyProgress(progressData) {
    for (const listener of this.progressListeners) {
      try {
        listener(progressData);
      } catch (e) {
        console.error('Error in progress listener:', e);
      }
    }
  }

  notifyStatus(status, detail) {
    for (const listener of this.statusListeners) {
      try {
        listener(status, detail);
      } catch (e) {
        console.error('Error in status listener:', e);
      }
    }
  }

  preloadModel(options = {}) {
    let targetModel = options.modelName;
    let isOpus = options.isOpus;

    if (!targetModel && options.srcLang && options.tgtLang) {
      const info = getModelInfo(options.srcLang, options.tgtLang);
      targetModel = info.modelName;
      isOpus = info.isOpus;
    }

    if (!targetModel) {
      targetModel = DEFAULT_MULTILINGUAL_MODEL;
      isOpus = false;
    }

    if (this.readyModels.has(targetModel)) {
      return Promise.resolve({ ready: true, model: targetModel });
    }

    if (!this.worker) {
      this.initWorker();
    }

    const id = `load_${++this.requestIdCounter}`;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject, isTranslation: false, model: targetModel });
      this.worker.postMessage({
        type: 'load',
        id,
        model: targetModel,
        isOpus: Boolean(isOpus),
        device: options.device || 'wasm'
      });
    });
  }

  async translate(text, srcLang, tgtLang, options = {}) {
    const modelInfo = getModelInfo(srcLang, tgtLang);

    if (!text || !text.trim()) {
      return {
        translation: '',
        inferenceTimeMs: 0,
        srcLang,
        tgtLang,
        model: modelInfo.modelName,
        modelInfo
      };
    }

    if (!this.worker) {
      this.initWorker();
    }

    const id = `trans_${++this.requestIdCounter}`;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject, isTranslation: true, modelInfo });
      this.worker.postMessage({
        type: 'translate',
        id,
        text,
        model: modelInfo.modelName,
        isOpus: modelInfo.isOpus,
        src_lang: srcLang,
        tgt_lang: tgtLang,
        device: options.device || 'wasm'
      });
    });
  }
}

export const translationService = new TranslationService();


