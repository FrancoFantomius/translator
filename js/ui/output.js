import { t } from '../i18.js';
import { getModelInfo } from '../translation/index.js';
import { escapeHtml } from './prefs.js';

export class TranslatorOutputController {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.isStarred = false;

    this.outputEl = this.container.querySelector('#target-output-content');
    this.targetCard = this.container.querySelector('#target-card') || this.container.querySelectorAll('.translation-card')[1];
    this.starTargetBtn = this.container.querySelector('#star-target-btn');
    this.starTooltip = this.container.querySelector('#star-target-tooltip');
    this.copyTargetBtn = this.container.querySelector('#copy-target-btn');
    this.shareTargetBtn = this.container.querySelector('#share-target-btn');
    this.translateBtn = this.container.querySelector('#translate-action-btn');
  }

  scrollToTarget() {
    const target = this.targetCard || this.outputEl?.closest('.translation-card') || this.outputEl;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  setStarred(isStarred) {
    this.isStarred = !!isStarred;
    if (this.starTargetBtn) {
      this.starTargetBtn.selected = this.isStarred;
      if (this.starTooltip) {
        this.starTooltip.value = this.isStarred ? t('translator.starTooltipRemove') : t('translator.starTooltipAdd');
      }
    }
  }

  getStarred() {
    return this.isStarred;
  }

  render({ isTranslating = false, downloadProgress = null, targetText = '', hasOcrImage = false } = {}) {
    if (this.translateBtn) {
      this.translateBtn.loading = isTranslating;
    }

    if (hasOcrImage) {
      if (this.outputEl) this.outputEl.style.display = 'none';
      const preview = this.options.getOcrTargetImagePreview?.();
      if (preview) preview.style.display = 'flex';
      return;
    }

    if (!this.outputEl) return;
    this.outputEl.style.display = '';

    const effectiveSrc = this.options.getEffectiveSourceLang?.();
    const targetLang = this.options.getTargetLang?.();
    const currentModel = effectiveSrc && targetLang ? getModelInfo(effectiveSrc.code, targetLang.code) : null;

    if (isTranslating) {
      if (downloadProgress && (downloadProgress.status === 'progress' || downloadProgress.status === 'download' || downloadProgress.status === 'initiate')) {
        const percent = Math.min(100, Math.max(0, Math.round(downloadProgress.progress || 0)));
        const loadedMB = downloadProgress.loaded ? (downloadProgress.loaded / (1024 * 1024)).toFixed(1) : null;
        const totalMB = downloadProgress.total ? (downloadProgress.total / (1024 * 1024)).toFixed(1) : null;
        const sizeInfo = loadedMB && totalMB && parseFloat(totalMB) > 0 ? ` (${loadedMB} / ${totalMB} MB)` : '';

        this.outputEl.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 10px; padding: 20px 0; color: var(--md-sys-color-primary);">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 500;">
              <span>${escapeHtml(t('models.downloadingProgress', { title: currentModel?.shortTitle || '', details: sizeInfo }))}</span>
              <span>${percent}%</span>
            </div>
            <md-progress type="linear" value="${percent / 100}" wavy></md-progress>
          </div>
        `;
      } else {
        this.outputEl.innerHTML = `
          <div style="display: flex; align-items: center; gap: 12px; color: var(--md-sys-color-primary); padding: 24px 0;">
            <md-loading-indicator size="small"></md-loading-indicator>
            <span style="font-size: 15px;">${escapeHtml(t('translator.translating'))}</span>
          </div>
        `;
      }
    } else if (!targetText || !targetText.trim()) {
      this.outputEl.innerHTML = `<span class="target-output placeholder">${escapeHtml(t('translator.targetPlaceholder'))}</span>`;
    } else {
      this.outputEl.textContent = targetText;
    }
  }

  bindEvents() {
    if (this.copyTargetBtn) {
      this.copyTargetBtn.addEventListener('click', async () => {
        const text = this.options.getTargetText?.();
        if (!text) return;
        await navigator.clipboard.writeText(text);
        this.options.onNotify?.(t('notifications.translationCopied'));
      });
    }

    if (this.starTargetBtn) {
      this.starTargetBtn.addEventListener('click', () => {
        this.setStarred(!this.isStarred);
        this.options.onNotify?.(this.isStarred ? t('notifications.savedStarred') : t('notifications.removedFavorite'));
        this.options.onStarToggle?.(this.isStarred);
      });
    }

    if (this.shareTargetBtn) {
      this.shareTargetBtn.addEventListener('click', async () => {
        const shareUrl = this.options.getShareUrl?.();
        if (!shareUrl) return;
        if (navigator.share) {
          try {
            await navigator.share({ url: shareUrl });
            this.options.onNotify?.(t('notifications.linkShared'));
          } catch (err) {
            if (err && err.name === 'AbortError') return;
            await navigator.clipboard.writeText(shareUrl);
            this.options.onNotify?.(t('notifications.shareCopied'));
          }
        } else {
          await navigator.clipboard.writeText(shareUrl);
          this.options.onNotify?.(t('notifications.shareCopied'));
        }
      });
    }
  }
}

