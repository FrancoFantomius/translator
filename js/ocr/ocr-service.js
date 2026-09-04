export const DEFAULT_OCR_SETTINGS = {
  minDetectionScore: 0.5,  // Minimum confidence score for text to be detected from 0-1 (Immich: 0.5)
  minRecognitionScore: 0.8, // Minimum confidence score for detected text to be recognised from 0-1 (Immich: 0.8)
  maxResolution: 736       // Previews above this resolution resized while preserving aspect ratio (Immich: 736)
};

export class OCRService {
  constructor(settings = {}) {
    this.settings = { ...DEFAULT_OCR_SETTINGS, ...settings };
    this.worker = null;
    this.pendingRequests = new Map();
    this.progressListeners = new Set();
    this.statusListeners = new Set();
    this.requestIdCounter = 0;
    this.isReady = false;
    this.isLoading = false;
    this.initWorker();
  }

  initWorker() {
    try {
      this.worker = new Worker(new URL('./ocr-worker.js', import.meta.url), {
        type: 'module'
      });

      this.worker.addEventListener('message', (event) => {
        this.handleWorkerMessage(event.data);
      });

      this.worker.addEventListener('error', (err) => {
        console.error('OCR worker error:', err);
        this.notifyStatus('error', { error: err?.message || 'Worker error' });
      });
    } catch (err) {
      console.error('Failed to initialize OCR worker:', err);
    }
  }

  setSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }

  getSettings() {
    return { ...this.settings };
  }

  onProgress(callback) {
    this.progressListeners.add(callback);
    return () => this.progressListeners.delete(callback);
  }

  onStatusChange(callback) {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  notifyProgress(data) {
    for (const listener of this.progressListeners) {
      try {
        listener(data);
      } catch (e) {
        console.error('OCR progress listener error:', e);
      }
    }
  }

  notifyStatus(status, data = {}) {
    for (const listener of this.statusListeners) {
      try {
        listener({ status, ...data });
      } catch (e) {
        console.error('OCR status listener error:', e);
      }
    }
  }

  handleWorkerMessage(data) {
    if (!data) return;
    const { type, id, status, progress, output, error, message } = data;

    if (type === 'progress') {
      this.notifyProgress(progress);
    } else if (type === 'status') {
      if (status === 'ready') {
        this.isReady = true;
        this.isLoading = false;
      } else if (status === 'loading') {
        this.isLoading = true;
      }
      this.notifyStatus(status, { message });
    }

    if (id && this.pendingRequests.has(id)) {
      const { resolve, reject } = this.pendingRequests.get(id);

      if (type === 'result') {
        this.pendingRequests.delete(id);
        resolve(output);
      } else if (type === 'error') {
        this.pendingRequests.delete(id);
        reject(new Error(error || 'OCR processing failed'));
      }
    }
  }

  /**
   * Load an HTMLImageElement or dataUrl into a Canvas
   */
  async loadToCanvas(imageSource) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        resolve({ canvas, img, width: canvas.width, height: canvas.height, ctx });
      };
      img.onerror = () => reject(new Error('Failed to load image for OCR'));
      if (typeof imageSource === 'string') {
        img.src = imageSource;
      } else if (imageSource instanceof Blob || imageSource instanceof File) {
        img.src = URL.createObjectURL(imageSource);
      } else if (imageSource instanceof HTMLImageElement) {
        img.src = imageSource.src;
      } else {
        reject(new Error('Unsupported image source'));
      }
    });
  }

  /**
   * Preload PP-OCR models in background
   */
  async preloadModels() {
    if (this.isReady) return;
    if (!this.worker) this.initWorker();

    const id = `ocr_init_${++this.requestIdCounter}`;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker.postMessage({ type: 'init', id });
    });
  }

  /**
   * Main entry point: Process image with PP-OCRv5 neural network
   */
  async processImage(imageSource, customSettings = {}) {
    const settings = { ...this.settings, ...customSettings };

    this.notifyStatus('init', { message: 'Preprocessing image for OCR...' });
    const { canvas, width, height, ctx } = await this.loadToCanvas(imageSource);
    const imgData = ctx.getImageData(0, 0, width, height);

    if (!this.worker) {
      this.initWorker();
    }

    const id = `ocr_req_${++this.requestIdCounter}`;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: (output) => {
          this.notifyStatus('done', { message: 'OCR processing complete' });
          resolve(output);
        },
        reject: (err) => {
          this.notifyStatus('error', { error: err?.message || String(err) });
          reject(err);
        }
      });

      // Send raw image pixel data to OCR worker
      this.worker.postMessage(
        {
          type: 'process',
          id,
          imageData: {
            data: imgData.data,
            width,
            height
          },
          settings
        }
      );
    });
  }
}

export const ocrService = new OCRService();


