import { t } from '../i18.js';
import { getWordCount } from './detection.js';

export class TranslatorSourceController {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;

    this.debounceTimer = null;
    this.sourceInput = this.container.querySelector('#source-input');
    this.clearBtn = this.container.querySelector('#clear-source-btn');
    this.translateBtn = this.container.querySelector('#translate-action-btn');
    this.voiceBtn = this.container.querySelector('#voice-input-btn');
  }

  getValue() {
    return this.sourceInput?.value || '';
  }

  setValue(text) {
    if (this.sourceInput && this.sourceInput.value !== text) {
      this.sourceInput.value = text;
    }
  }

  setClearDisabled(disabled) {
    if (this.clearBtn) {
      this.clearBtn.disabled = disabled;
    }
  }

  clearDebounce() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  updateUI(hasText, hasImage) {
    if (this.clearBtn) {
      this.clearBtn.disabled = !hasText && !hasImage;
    }
  }

  bindEvents() {
    if (this.sourceInput) {
      this.sourceInput.addEventListener('input', () => {
        this.options.onBeforeInput?.();

        const text = this.sourceInput.value;
        this.options.onInput?.(text);

        if (!text.trim()) {
          this.clearDebounce();
          this.options.onEmpty?.();
          return;
        }

        const settings = this.options.getSettings?.() || { autoTranslate: true };
        if (settings.autoTranslate) {
          this.clearDebounce();

          let delay = 400;
          if (this.options.getIsAutoDetect?.()) {
            const wordCount = getWordCount(text);
            // When auto-detect is active: wait 4.5 seconds after typing stops,
            // or when there are at least 4-5 words, kick in after normal typing pause (400ms).
            delay = wordCount >= 4 ? 400 : 4500;
          }

          this.debounceTimer = window.setTimeout(async () => {
            await this.options.onDebouncedTranslate?.();
          }, delay);
        }
      });
    }

    if (this.translateBtn) {
      this.translateBtn.addEventListener('click', () => {
        this.options.onTranslate?.();
      });
    }

    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => {
        this.clearDebounce();
        if (this.sourceInput) this.sourceInput.value = '';
        this.options.onClear?.();
      });
    }

    if (this.voiceBtn) {
      this.voiceBtn.addEventListener('click', () => {
        this.options.onNotify?.(t('notifications.listeningSpeech'));
        setTimeout(() => {
          const simulatedText = 'Speech recognition transcription completed successfully.';
          if (this.sourceInput) this.sourceInput.value = simulatedText;
          if (this.clearBtn) this.clearBtn.disabled = false;
          this.options.onVoiceInput?.(simulatedText);
        }, 1200);
      });
    }
  }
}

