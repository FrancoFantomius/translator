import { t } from '../i18.js';
import { getLocalizedLanguageName } from './prefs.js';

export class TranslatorSpeechController {
  constructor(container, onNotify) {
    this.container = container;
    this.onNotify = onNotify;
    this.activeTts = null;
    this.isSpeaking = false;

    this.ttsSourceBtn = container.querySelector('#tts-source-btn');
    this.ttsSourceTooltip = container.querySelector('#tts-source-tooltip') || container.querySelector('md-tooltip[for="tts-source-btn"]');
    this.ttsTargetBtn = container.querySelector('#tts-target-btn');
    this.ttsTargetTooltip = container.querySelector('#tts-target-tooltip') || container.querySelector('md-tooltip[for="tts-target-btn"]');
  }

  setSpeakingState(activeTarget) {
    this.activeTts = activeTarget || null;
    this.isSpeaking = !!this.activeTts;

    // Update source button & tooltip
    if (this.ttsSourceBtn) {
      const isSourceSpeaking = this.activeTts === 'source';
      const sourceLabel = isSourceSpeaking ? t('translator.ttsStopTooltip') : t('translator.ttsSourceAria');
      const icon = isSourceSpeaking ? 'stop' : 'volume_up';
      this.ttsSourceBtn.icon = icon;
      this.ttsSourceBtn.setAttribute('icon', icon);
      this.ttsSourceBtn.selected = isSourceSpeaking;
      if (isSourceSpeaking) {
        this.ttsSourceBtn.setAttribute('selected', '');
      } else {
        this.ttsSourceBtn.removeAttribute('selected');
      }
      this.ttsSourceBtn.setAttribute('aria-label', sourceLabel);
      if (this.ttsSourceBtn.ariaLabel !== undefined) {
        this.ttsSourceBtn.ariaLabel = sourceLabel;
      }
    }
    if (this.ttsSourceTooltip) {
      const sourceLabel = this.activeTts === 'source' ? t('translator.ttsStopTooltip') : t('translator.ttsSourceTooltip');
      this.ttsSourceTooltip.value = sourceLabel;
      this.ttsSourceTooltip.setAttribute('value', sourceLabel);
      this.ttsSourceTooltip.hide?.();
    }

    // Update target button & tooltip
    if (this.ttsTargetBtn) {
      const isTargetSpeaking = this.activeTts === 'target';
      const targetLabel = isTargetSpeaking ? t('translator.ttsStopTooltip') : t('translator.ttsTargetAria');
      const icon = isTargetSpeaking ? 'stop' : 'volume_up';
      this.ttsTargetBtn.icon = icon;
      this.ttsTargetBtn.setAttribute('icon', icon);
      this.ttsTargetBtn.selected = isTargetSpeaking;
      if (isTargetSpeaking) {
        this.ttsTargetBtn.setAttribute('selected', '');
      } else {
        this.ttsTargetBtn.removeAttribute('selected');
      }
      this.ttsTargetBtn.setAttribute('aria-label', targetLabel);
      if (this.ttsTargetBtn.ariaLabel !== undefined) {
        this.ttsTargetBtn.ariaLabel = targetLabel;
      }
    }
    if (this.ttsTargetTooltip) {
      const targetLabel = this.activeTts === 'target' ? t('translator.ttsStopTooltip') : t('translator.ttsTargetTooltip');
      this.ttsTargetTooltip.value = targetLabel;
      this.ttsTargetTooltip.setAttribute('value', targetLabel);
      this.ttsTargetTooltip.hide?.();
    }

    this.ttsSourceBtn?.blur();
    this.ttsSourceBtn?.shadowRoot?.querySelector('button')?.blur();
    this.ttsTargetBtn?.blur();
    this.ttsTargetBtn?.shadowRoot?.querySelector('button')?.blur();
  }

  stopSpeaking(notify = false) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.setSpeakingState(null);
    if (notify && this.onNotify) {
      this.onNotify(t('notifications.stoppedReading'));
    }
  }

  startSpeaking(target = 'target', text = '', lang = null) {
    if (!text || !text.trim()) return;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (lang && lang.code) {
        utterance.lang = lang.code;
      }
      utterance.onend = () => {
        this.setSpeakingState(null);
      };
      utterance.onerror = () => {
        this.setSpeakingState(null);
      };
      this.setSpeakingState(target);
      window.speechSynthesis.speak(utterance);
      if (this.onNotify && lang) {
        this.onNotify(t('notifications.playingSpeech', { lang: getLocalizedLanguageName(lang) }));
      }
    } else if (this.onNotify) {
      this.onNotify(t('notifications.speechNotSupported'));
    }
  }

  bindEvents({ getSourceText, getTargetText, getSourceLang, getTargetLang }) {
    if (this.ttsSourceBtn) {
      this.ttsSourceBtn.addEventListener('click', () => {
        this.ttsSourceBtn.blur();
        this.ttsSourceBtn.shadowRoot?.querySelector('button')?.blur();
        this.ttsSourceTooltip?.close?.();
        if (this.activeTts === 'source') {
          this.stopSpeaking(true);
        } else {
          this.startSpeaking('source', getSourceText(), getSourceLang());
        }
      });
    }

    if (this.ttsTargetBtn) {
      this.ttsTargetBtn.addEventListener('click', () => {
        this.ttsTargetBtn.blur();
        this.ttsTargetBtn.shadowRoot?.querySelector('button')?.blur();
        this.ttsTargetTooltip?.close?.();
        if (this.activeTts === 'target') {
          this.stopSpeaking(true);
        } else {
          this.startSpeaking('target', getTargetText(), getTargetLang());
        }
      });
    }

    window.addEventListener('beforeunload', () => {
      this.stopSpeaking();
    });
  }
}

