import { translationService, getModelInfo, OPUS_MT_PAIRS, DEFAULT_MULTILINGUAL_MODEL } from './translation/index.js';
import { t, onLanguageChange } from './i18.js';

export const INITIAL_MODELS = [
  {
    id: 'm2m100_418m',
    name: DEFAULT_MULTILINGUAL_MODEL,
    title: 'M2M-100 Multilingual (418M)',
    description: 'Universal direct translation between 100 languages without English pivot.',
    size: '485 MB',
    status: 'available',
    parameters: '418M (ONNX Q8)',
    backend: 'WASM (CPU SIMD)',
    languages: '100 languages',
    type: 'multilingual'
  },
  ...Object.entries(OPUS_MT_PAIRS).map(([pair, modelName]) => {
    const [src, tgt] = pair.split('-');
    const srcUpper = src.toUpperCase();
    const tgtUpper = tgt.toUpperCase();
    return {
      id: `opus_${src}_${tgt}`,
      name: modelName,
      title: `Helsinki-NLP Opus-MT (${srcUpper} → ${tgtUpper})`,
      description: `Fast bilingual neural model specialized for direct ${srcUpper} to ${tgtUpper} translation.`,
      size: '95 MB',
      status: 'available',
      parameters: '77M (ONNX Q8)',
      backend: 'WASM (CPU SIMD)',
      languages: `${srcUpper} → ${tgtUpper}`,
      type: 'bilingual',
      srcLang: src,
      tgtLang: tgt
    };
  })
];

export class ModelsView {
  constructor(container, onStatusChange) {
    this.container = container;
    this.models = [...INITIAL_MODELS];
    this.onStatusChangeCallback = onStatusChange;
    this.setupServiceListeners();
    this.setupLanguageSync();
    this.render();
  }

  setupLanguageSync() {
    onLanguageChange(() => {
      this.render();
    });
  }

  setupServiceListeners() {
    translationService.onProgress((progress) => {
      if (!progress) return;
      const targetModel = this.models.find(m => m.name === progress.model) || this.models[0];
      if (!targetModel) return;

      if (progress.status === 'progress' || progress.status === 'download' || progress.status === 'initiate') {
        targetModel.status = 'downloading';
        targetModel.progress = (progress.progress || 0) / 100;
        targetModel.loaded = progress.loaded;
        targetModel.total = progress.total;
        this.render();
      } else if (progress.status === 'done' && progress.progress >= 100) {
        targetModel.status = 'ready';
        targetModel.progress = undefined;
        this.render();
        this.onStatusChangeCallback?.();
      }
    });

    translationService.onStatusChange((status, detail) => {
      const modelName = detail?.model;
      const targetModel = modelName ? this.models.find(m => m.name === modelName) : this.models[0];
      if (!targetModel) return;

      if (status === 'ready') {
        targetModel.status = 'ready';
        targetModel.progress = undefined;
        this.render();
        this.onStatusChangeCallback?.();
      } else if (status === 'loading') {
        targetModel.status = 'downloading';
        this.render();
      }
    });
  }

  getReadyModels() {
    return this.models.filter(m => m.status === 'ready');
  }

  isPairReady(sourceCode, targetCode) {
    const info = getModelInfo(sourceCode, targetCode);
    return translationService.isModelReady(info.modelName) || this.models.some(m => m.name === info.modelName && m.status === 'ready');
  }

  async downloadModel(id, onDone) {
    const model = this.models.find(m => m.id === id) || this.models[0];
    if (!model) return;

    model.status = 'downloading';
    model.progress = 0.05;
    this.render();

    try {
      await translationService.preloadModel({
        modelName: model.name,
        isOpus: model.type === 'bilingual'
      });
      model.status = 'ready';
      model.progress = undefined;
      this.render();
      this.onStatusChangeCallback?.();
      onDone?.();
    } catch (err) {
      console.error('Failed to download model:', err);
      model.status = 'available';
      model.progress = undefined;
      this.render();
    }
  }

  async deleteModel(id) {
    const model = this.models.find(m => m.id === id) || this.models[0];
    if (!model) return;

    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          if (name.includes('transformers') || name.includes('onnx') || name.includes('huggingface')) {
            await caches.delete(name);
          }
        }
      }
    } catch (e) {
      console.warn('Could not clear browser cache:', e);
    }

    model.status = 'available';
    model.progress = undefined;
    if (model.name) {
      translationService.readyModels.delete(model.name);
    }
    translationService.isReady = translationService.readyModels.size > 0;
    this.render();
    this.onStatusChangeCallback?.();
  }

  render() {
    if (!this.container) return;
    const readyCount = this.models.filter(m => m.status === 'ready').length;
    const totalSize = this.models
      .filter(m => m.status === 'ready')
      .reduce((acc, m) => acc + parseFloat(m.size), 0)
      .toFixed(1);

    this.container.innerHTML = `
      <div class="storage-card">
        <div class="storage-header">
          <div>
            <h3 style="font-size: 16px; font-weight: 500; margin-bottom: 4px;">${t('models.cacheTitle')}</h3>
            <p style="font-size: 13px; color: var(--md-sys-color-outline);">
              ${t('models.cacheDesc')}
            </p>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 18px; font-weight: 600; color: var(--md-sys-color-primary);">${totalSize} MB</span>
            <div style="font-size: 12px; color: var(--md-sys-color-outline);">${t('models.cachedCount', { ready: readyCount, total: this.models.length })}</div>
          </div>
        </div>
        <md-progress type="linear" value="${this.models.length > 0 ? readyCount / this.models.length : 0}" wavy></md-progress>
      </div>

      <div class="models-grid">
        ${this.models.map(model => `
          <md-card variant="${model.status === 'ready' ? 'elevated' : 'outlined'}">
            <div class="model-card-body">
              <div class="model-title-row">
                <div>
                  <div class="model-name">${model.title}</div>
                  <div class="model-pair-tag">${model.name}</div>
                </div>
                ${model.status === 'ready' ? `
                  <span class="brand-badge" style="background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); display: flex; align-items: center; gap: 4px;">
                    <md-icon name="check_circle" size="14" filled></md-icon> ${t('models.statusReady')}
                  </span>
                ` : model.status === 'downloading' ? `
                  <span class="brand-badge" style="background: #fef3c7; color: #92400e; display: flex; align-items: center; gap: 4px;">
                    <md-icon name="sync" size="14"></md-icon> ${t('models.statusDownloading')}
                  </span>
                ` : `
                  <span class="brand-badge" style="background: var(--md-sys-color-surface-container-highest); color: var(--md-sys-color-on-surface-variant);">
                    ${t('models.statusAvailable')}
                  </span>
                `}
              </div>

              <p style="font-size: 12.5px; color: var(--md-sys-color-on-surface-variant); margin: 6px 0;">
                ${model.description}
              </p>

              <div class="model-specs">
                <span class="spec-chip">Size: ${model.size}</span>
                <span class="spec-chip">${model.parameters}</span>
                <span class="spec-chip">${model.backend}</span>
              </div>

              ${model.status === 'downloading' ? `
                <div style="margin: 6px 0;">
                  <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; color: var(--md-sys-color-outline);">
                    <span>${t('models.downloadingProgress', { title: model.title, details: model.loaded && model.total ? ` (${(model.loaded / (1024*1024)).toFixed(1)} / ${(model.total / (1024*1024)).toFixed(1)} MB)` : '' })}</span>
                    <span>${Math.round((model.progress || 0) * 100)}%</span>
                  </div>
                  <md-progress type="linear" value="${model.progress || 0.05}" wavy></md-progress>
                </div>
              ` : ''}

              <div class="model-actions-row">
                <span style="font-size: 12px; color: var(--md-sys-color-outline);">
                  ${model.status === 'ready' ? t('models.offlineReady') : t('models.requiresDownload')}
                </span>
                <div>
                  ${model.status === 'ready' ? `
                    <md-button id="delete-model-${model.id}" variant="text" icon="delete" class="delete-model-btn" data-id="${model.id}">
                      ${t('models.removeBtn')}
                    </md-button>
                    <md-tooltip for="delete-model-${model.id}" value="${t('models.removeTooltip')}" position="top"></md-tooltip>
                  ` : model.status === 'downloading' ? `
                    <md-button id="downloading-model-${model.id}" variant="tonal" loading disabled>
                      ${t('models.downloadingBtn')}
                    </md-button>
                    <md-tooltip for="downloading-model-${model.id}" value="${t('models.downloadingTooltip')}" position="top"></md-tooltip>
                  ` : `
                    <md-button id="download-model-${model.id}" variant="filled" icon="download" class="download-model-btn" data-id="${model.id}">
                      ${t('models.downloadBtn')}
                    </md-button>
                    <md-tooltip for="download-model-${model.id}" value="${t('models.downloadTooltip')}" position="top"></md-tooltip>
                  `}
                </div>
              </div>
            </div>
          </md-card>
        `).join('')}
      </div>
    `;

    // Bind event handlers
    this.container.querySelectorAll('.download-model-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        if (id) this.downloadModel(id);
      });
    });

    this.container.querySelectorAll('.delete-model-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        if (id) this.deleteModel(id);
      });
    });
  }
}
