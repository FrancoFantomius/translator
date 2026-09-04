import { ocrService } from '../ocr/index.js';
import { translationService, getLanguageByCode } from '../translation/index.js';
import { t } from '../i18.js';

export class TranslatorOcrController {
  constructor(container, options) {
    this.container = container;
    this.options = options;

    this.currentImage = null;
    this.ocrBoxes = [];
    this.isOcrProcessing = false;
    this.ocrResizeObserver = null;

    this.sourceImagePreview = container.querySelector('#source-image-preview');
    this.sourcePreviewImg = container.querySelector('#source-preview-img');
    this.targetImagePreview = container.querySelector('#target-image-preview');
    this.targetPreviewImg = container.querySelector('#target-preview-img');

    this.sourceOcrOverlay = container.querySelector('#source-ocr-overlay');
    this.targetOcrOverlay = container.querySelector('#target-ocr-overlay');
    this.sourceOcrLoading = container.querySelector('#source-ocr-loading');
    this.targetOcrLoading = container.querySelector('#target-ocr-loading');
    this.sourceOcrStatus = container.querySelector('#source-ocr-status');
    this.targetOcrStatus = container.querySelector('#target-ocr-status');

    this.setupOcrListeners();
    this.setupOcrResizeObserver();
  }

  setupOcrListeners() {
    ocrService.onProgress((progress) => {
      if (!this.isOcrProcessing) return;
      if (progress && progress.status === 'progress' && this.sourceOcrStatus) {
        this.sourceOcrStatus.textContent = `Downloading ${progress.file} (${progress.percent}%)...`;
      }
    });

    ocrService.onStatusChange(({ status, message }) => {
      if (!this.isOcrProcessing) return;
      if (message && this.sourceOcrStatus) {
        this.sourceOcrStatus.textContent = message;
      }
    });
  }

  setupOcrResizeObserver() {
    const wrapper = this.container.querySelector('#source-image-wrapper');
    if (typeof ResizeObserver !== 'undefined' && wrapper) {
      this.ocrResizeObserver = new ResizeObserver(() => {
        if (this.ocrBoxes && this.ocrBoxes.length > 0) {
          this.fitOcrTextSizes();
        }
      });
      this.ocrResizeObserver.observe(wrapper);
    }
  }

  calculateFittedFontSize(text, boxWidthPx, boxHeightPx) {
    if (!text || boxHeightPx <= 0) return 12;
    let fontSize = Math.max(9, Math.min(36, boxHeightPx * 0.68));

    const avgCharWidth = fontSize * 0.54;
    const estimatedWidth = text.length * avgCharWidth;
    const availableWidth = Math.max(10, boxWidthPx - 6);

    if (estimatedWidth > availableWidth) {
      const scale = availableWidth / estimatedWidth;
      fontSize = Math.max(8, fontSize * scale);
    }
    return Math.round(fontSize);
  }

  fitOcrTextSizes() {
    const sourceWrapper = this.container.querySelector('#source-image-wrapper');
    const targetWrapper = this.container.querySelector('#target-image-wrapper');

    if (this.sourceOcrOverlay && sourceWrapper) {
      const w = sourceWrapper.clientWidth;
      const h = sourceWrapper.clientHeight;
      if (w > 0 && h > 0) {
        this.sourceOcrOverlay.querySelectorAll('.ocr-box-source').forEach((boxEl) => {
          const textEl = boxEl.querySelector('.ocr-box-source-text');
          const boxId = boxEl.dataset.boxId;
          const box = this.ocrBoxes.find(b => b.id === boxId);
          if (textEl && box) {
            const boxWPx = (box.pctWidth / 100) * w;
            const boxHPx = (box.pctHeight / 100) * h;
            const fontSize = this.calculateFittedFontSize(box.originalText, boxWPx, boxHPx);
            textEl.style.fontSize = `${fontSize}px`;
          }
        });
      }
    }

    if (this.targetOcrOverlay && targetWrapper) {
      const w = targetWrapper.clientWidth;
      const h = targetWrapper.clientHeight;
      if (w > 0 && h > 0) {
        this.targetOcrOverlay.querySelectorAll('.ocr-box-target').forEach((boxEl) => {
          const textEl = boxEl.querySelector('.ocr-box-target-text');
          const boxId = boxEl.dataset.boxId;
          const box = this.ocrBoxes.find(b => b.id === boxId);
          if (textEl && box) {
            const boxWPx = (box.pctWidth / 100) * w;
            const boxHPx = (box.pctHeight / 100) * h;
            const text = box.translatedText || box.originalText || '';
            const fontSize = this.calculateFittedFontSize(text, boxWPx, boxHPx);
            textEl.style.fontSize = `${fontSize}px`;
          }
        });
      }
    }
  }

  renderSourceOcrOverlay() {
    if (!this.sourceOcrOverlay) return;
    this.sourceOcrOverlay.innerHTML = '';
    const wrapper = this.container.querySelector('#source-image-wrapper');
    const wrapperW = wrapper?.clientWidth || 0;
    const wrapperH = wrapper?.clientHeight || 0;

    for (const box of this.ocrBoxes) {
      const el = document.createElement('div');
      el.className = 'ocr-box ocr-box-source';
      el.style.left = `${box.pctX}%`;
      el.style.top = `${box.pctY}%`;
      el.style.width = `${box.pctWidth}%`;
      el.style.height = `${box.pctHeight}%`;
      el.dataset.boxId = box.id;
      if (box.originalText) {
        el.title = box.originalText;
      }

      if (box.originalText) {
        const textSpan = document.createElement('span');
        textSpan.className = 'ocr-box-source-text';
        textSpan.textContent = box.originalText;

        const boxWPx = wrapperW > 0 ? (box.pctWidth / 100) * wrapperW : box.width;
        const boxHPx = wrapperH > 0 ? (box.pctHeight / 100) * wrapperH : box.height;
        const fontSize = this.calculateFittedFontSize(box.originalText, boxWPx, boxHPx);
        textSpan.style.fontSize = `${fontSize}px`;

        el.appendChild(textSpan);
      }

      el.addEventListener('mouseenter', () => this.highlightBox(box.id, true));
      el.addEventListener('mouseleave', () => this.highlightBox(box.id, false));

      this.sourceOcrOverlay.appendChild(el);
    }
  }

  renderTargetOcrOverlay() {
    if (!this.targetOcrOverlay) return;
    this.targetOcrOverlay.innerHTML = '';
    const wrapper = this.container.querySelector('#target-image-wrapper');
    const wrapperW = wrapper?.clientWidth || 0;
    const wrapperH = wrapper?.clientHeight || 0;

    for (const box of this.ocrBoxes) {
      const el = document.createElement('div');
      el.className = 'ocr-box ocr-box-target';
      el.style.left = `${box.pctX}%`;
      el.style.top = `${box.pctY}%`;
      el.style.width = `${box.pctWidth}%`;
      el.style.height = `${box.pctHeight}%`;
      el.dataset.boxId = box.id;

      const textSpan = document.createElement('span');
      textSpan.className = 'ocr-box-target-text';
      const displayContent = box.translatedText || box.originalText || '';
      textSpan.textContent = displayContent;

      const boxWPx = wrapperW > 0 ? (box.pctWidth / 100) * wrapperW : box.width;
      const boxHPx = wrapperH > 0 ? (box.pctHeight / 100) * wrapperH : box.height;
      const fontSize = this.calculateFittedFontSize(displayContent, boxWPx, boxHPx);
      textSpan.style.fontSize = `${fontSize}px`;

      el.appendChild(textSpan);

      el.addEventListener('mouseenter', () => this.highlightBox(box.id, true));
      el.addEventListener('mouseleave', () => this.highlightBox(box.id, false));

      this.targetOcrOverlay.appendChild(el);
    }
  }

  highlightBox(boxId, isHighlighted) {
    const sourceBoxes = this.sourceOcrOverlay?.querySelectorAll(`[data-box-id="${boxId}"]`) || [];
    const targetBoxes = this.targetOcrOverlay?.querySelectorAll(`[data-box-id="${boxId}"]`) || [];

    sourceBoxes.forEach(b => b.classList.toggle('highlighted', isHighlighted));
    targetBoxes.forEach(b => b.classList.toggle('highlighted', isHighlighted));
  }

  async processImageOCR(imageSource) {
    if (!imageSource) return;
    this.isOcrProcessing = true;
    if (this.sourceOcrLoading) {
      this.sourceOcrLoading.style.display = 'flex';
      if (this.sourceOcrStatus) this.sourceOcrStatus.textContent = t('translator.ocrDetecting');
    }
    if (this.targetOcrLoading) {
      this.targetOcrLoading.style.display = 'flex';
      if (this.targetOcrStatus) this.targetOcrStatus.textContent = t('translator.ocrTranslating');
    }
    if (this.sourceOcrOverlay) this.sourceOcrOverlay.innerHTML = '';
    if (this.targetOcrOverlay) this.targetOcrOverlay.innerHTML = '';

    try {
      const sourceLang = this.options.getSourceLang();
      const isAuto = this.options.getIsAutoDetect();
      const ocrResult = await ocrService.processImage(imageSource, {
        language: isAuto ? 'auto' : (sourceLang?.code || 'en')
      });
      this.ocrBoxes = ocrResult.boxes || [];

      if (ocrResult.detectedLanguage && isAuto) {
        this.options.onOcrDetectedLanguage?.(ocrResult.detectedLanguage);
      }

      this.renderSourceOcrOverlay();
      if (this.sourceOcrLoading) this.sourceOcrLoading.style.display = 'none';

      await this.translateOcrBoxes();
      this.renderTargetOcrOverlay();
    } catch (err) {
      console.error('OCR processing error:', err);
      this.options.onNotify?.(t('notifications.ocrError', { detail: err.message || String(err) }));
    } finally {
      this.isOcrProcessing = false;
      if (this.sourceOcrLoading) this.sourceOcrLoading.style.display = 'none';
      if (this.targetOcrLoading) this.targetOcrLoading.style.display = 'none';
    }
  }

  async translateOcrBoxes() {
    if (!this.ocrBoxes || this.ocrBoxes.length === 0) return;
    const targetLang = this.options.getTargetLang();
    if (this.targetOcrLoading) {
      this.targetOcrLoading.style.display = 'flex';
      if (this.targetOcrStatus) {
        this.targetOcrStatus.textContent = `Translating into ${targetLang.name}...`;
      }
    }

    const settings = this.options.getSettings?.() || { backend: 'wasm' };
    const effectiveSrc = this.options.getEffectiveSourceLang();

    for (const box of this.ocrBoxes) {
      const textToTranslate = box.originalText || '';
      if (textToTranslate.trim()) {
        try {
          const res = await translationService.translate(
            textToTranslate,
            effectiveSrc.code,
            targetLang.code,
            { device: settings.backend || 'wasm' }
          );
          box.translatedText = res.translation || textToTranslate;
        } catch (e) {
          console.warn(`Translation failed for box ${box.id}:`, e);
          box.translatedText = textToTranslate;
        }
      } else {
        box.translatedText = '';
      }
    }

    const sourceText = this.ocrBoxes.map(b => b.originalText).filter(Boolean).join('\n');
    const targetText = this.ocrBoxes.map(b => b.translatedText || b.originalText).filter(Boolean).join('\n');
    this.options.onTextsExtracted?.(sourceText, targetText);
  }

  updateImageUI(hasSourceText = false) {
    const sourceInput = this.container.querySelector('#source-input');
    const outputEl = this.container.querySelector('#target-output-content');
    const clearBtn = this.container.querySelector('#clear-source-btn');

    if (this.currentImage) {
      if (sourceInput) sourceInput.style.display = 'none';
      if (outputEl) outputEl.style.display = 'none';
      if (this.sourceImagePreview) {
        this.sourceImagePreview.style.display = 'flex';
        if (this.sourcePreviewImg) this.sourcePreviewImg.src = this.currentImage;
      }
      if (this.targetImagePreview) {
        this.targetImagePreview.style.display = 'flex';
        if (this.targetPreviewImg) this.targetPreviewImg.src = this.currentImage;
      }
      if (clearBtn) clearBtn.disabled = false;
    } else {
      if (sourceInput) sourceInput.style.display = '';
      if (outputEl) outputEl.style.display = '';
      if (this.sourceImagePreview) {
        this.sourceImagePreview.style.display = 'none';
        if (this.sourcePreviewImg) this.sourcePreviewImg.removeAttribute('src');
      }
      if (this.targetImagePreview) {
        this.targetImagePreview.style.display = 'none';
        if (this.targetPreviewImg) this.targetPreviewImg.removeAttribute('src');
      }
      if (this.sourceOcrOverlay) this.sourceOcrOverlay.innerHTML = '';
      if (this.targetOcrOverlay) this.targetOcrOverlay.innerHTML = '';
      if (this.sourceOcrLoading) this.sourceOcrLoading.style.display = 'none';
      if (this.targetOcrLoading) this.targetOcrLoading.style.display = 'none';
      this.ocrBoxes = [];
      if (clearBtn) clearBtn.disabled = !hasSourceText;
    }
  }

  loadImage(file) {
    if (!file) return;
    this.options.onBeforeLoad?.();
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      if (dataUrl) {
        this.currentImage = dataUrl;
        this.ocrBoxes = [];
        this.updateImageUI(false);
        this.options.onImageLoaded?.(dataUrl);
        this.options.onNotify?.(t('notifications.loadedImage', { name: file.name || 'image' }));
        await this.processImageOCR(dataUrl);
      }
    };
    reader.onerror = () => {
      this.options.onNotify?.(t('notifications.failedReadImage'));
    };
    reader.readAsDataURL(file);
  }

  loadFile(file) {
    if (!file) return;
    if (file.type && file.type.startsWith('image/')) {
      this.loadImage(file);
      return;
    }
    this.clearImage();
    this.options.onBeforeLoad?.();
    this.options.onNotify?.(t('notifications.uploadingFile', { name: file.name }));
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      if (typeof content === 'string' && content.trim()) {
        this.options.onFileTextLoaded?.(content.trim(), file.name);
      } else {
        this.options.onNotify?.(t('notifications.couldNotReadText', { name: file.name }));
      }
    };
    reader.onerror = () => {
      this.options.onNotify?.(t('notifications.failedReadFile', { name: file.name }));
    };
    reader.readAsText(file);
  }

  clearImage() {
    this.currentImage = null;
    this.ocrBoxes = [];
    this.updateImageUI(false);
  }

  bindEvents() {
    // Camera button
    const cameraBtn = this.container.querySelector('#camera-btn');
    const cameraInput = this.container.querySelector('#camera-file-input');
    if (cameraBtn) {
      cameraBtn.addEventListener('click', () => {
        if (cameraInput) cameraInput.click();
      });
    }

    if (cameraInput) {
      cameraInput.addEventListener('change', () => {
        const file = cameraInput.files && cameraInput.files[0];
        if (file) this.loadImage(file);
        cameraInput.value = '';
      });
    }

    // Attachment button
    const attachmentBtn = this.container.querySelector('#attachment-btn');
    const attachmentInput = this.container.querySelector('#attachment-file-input');
    if (attachmentBtn) {
      attachmentBtn.addEventListener('click', () => {
        if (attachmentInput) attachmentInput.click();
      });
    }

    if (attachmentInput) {
      attachmentInput.addEventListener('change', () => {
        const file = attachmentInput.files && attachmentInput.files[0];
        if (file) {
          this.loadFile(file);
          attachmentInput.value = '';
        }
      });
    }

    // Drag & Drop
    const sourceContainer = this.container.querySelector('.text-area-container');
    if (sourceContainer) {
      let dragCounter = 0;

      sourceContainer.addEventListener('dragenter', (e) => {
        if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
          e.preventDefault();
          dragCounter++;
          sourceContainer.classList.add('drag-over');
        }
      });

      sourceContainer.addEventListener('dragover', (e) => {
        if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      });

      sourceContainer.addEventListener('dragleave', () => {
        dragCounter--;
        if (dragCounter <= 0) {
          dragCounter = 0;
          sourceContainer.classList.remove('drag-over');
        }
      });

      sourceContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        sourceContainer.classList.remove('drag-over');

        const files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length > 0) {
          this.loadFile(files[0]);
        }
      });

      window.addEventListener('dragover', (e) => {
        if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
          e.preventDefault();
        }
      });

      window.addEventListener('drop', (e) => {
        if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
          e.preventDefault();
        }
      });
    }
  }
}

