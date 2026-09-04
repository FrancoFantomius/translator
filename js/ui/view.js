import {
  SUPPORTED_LANGUAGES,
  getLanguageByCode,
  AUTO_DETECT_LANGUAGE,
  translationService
} from '../translation/index.js';
import { t } from '../i18.js';
import {
  RECENT_SOURCE_KEY,
  RECENT_TARGET_KEY,
  DEFAULT_RECENT_SOURCE,
  getLocalizedLanguageName,
  getDefaultRecentTarget,
  saveLanguagePreferences,
  loadLanguagePreferences,
  loadRecentLangs,
  saveRecentLangs
} from './prefs.js';
import { TranslatorSpeechController } from './speech.js';
import { TranslatorOcrController } from './ocr.js';
import { TranslatorLanguagesController } from './languages.js';
import { TranslatorSourceController } from './source.js';
import { TranslatorOutputController } from './output.js';
import { detectCurrentLanguage, getWordCount } from './detection.js';
import { readUrlParams, parseUrlParamsForState, getShareUrl } from './url.js';

export class TranslatorView {
  constructor(container, modelsView, historyView, settingsDialog, onNotify) {
    this.container = container;
    this.modelsView = modelsView;
    this.historyView = historyView;
    this.settingsDialog = settingsDialog;
    this.onNotify = onNotify;

    const prefs = loadLanguagePreferences();
    this.isAutoDetect = prefs.isAutoDetect;
    this.detectedLang = null;
    this.sourceLang = prefs.sourceLang;
    this.targetLang = prefs.targetLang;

    this.sourceText = '';
    this.targetText = '';
    this.recentSourceLanguages = loadRecentLangs(RECENT_SOURCE_KEY, DEFAULT_RECENT_SOURCE);
    this.recentTargetLanguages = prefs.hasUserSetTarget
      ? loadRecentLangs(RECENT_TARGET_KEY, getDefaultRecentTarget())
      : getDefaultRecentTarget();

    this.isTranslating = false;
    this.downloadProgress = null;
    this.lastInferenceTimeMs = 0;

    const hadQueryParams = !!window.location.search;
    const urlState = readUrlParams();
    if (urlState.hadLangsParam) {
      this.isAutoDetect = urlState.isAutoDetect;
      if (urlState.sourceLang) this.sourceLang = urlState.sourceLang;
      if (urlState.targetLang) this.targetLang = urlState.targetLang;
    }
    if (urlState.sourceText) {
      this.sourceText = urlState.sourceText;
    }

    if (!this.isAutoDetect && this.sourceLang && this.sourceLang.code !== 'auto') {
      this.addRecentSource(this.sourceLang.code);
    }
    if (this.targetLang && (hadQueryParams || prefs.hasUserSetTarget)) {
      this.addRecentTarget(this.targetLang.code);
    }
    if (hadQueryParams) {
      saveLanguagePreferences(this.isAutoDetect, this.sourceLang, this.targetLang);
    }

    this.initControllers();
    this.bindEvents();
    this.setupTranslationListeners();
    this.render();

    if (hadQueryParams) {
      history.replaceState(null, '', window.location.pathname + window.location.hash);
    }
    if (this.sourceText.trim()) {
      if (this.isAutoDetect) {
        this.detectCurrentLanguage(this.sourceText).then(() => {
          this.triggerTranslate();
        });
      } else {
        this.triggerTranslate();
      }
    }
  }

  get currentImage() {
    return this.ocr?.currentImage || null;
  }
  set currentImage(val) {
    if (this.ocr) this.ocr.currentImage = val;
  }

  get ocrBoxes() {
    return this.ocr?.ocrBoxes || [];
  }
  set ocrBoxes(val) {
    if (this.ocr) this.ocr.ocrBoxes = val;
  }

  get isSpeaking() {
    return this.speech?.isSpeaking || false;
  }

  get activeTts() {
    return this.speech?.activeTts || null;
  }

  get isStarred() {
    return this.output?.getStarred() || false;
  }
  set isStarred(val) {
    this.output?.setStarred(val);
  }

  get sourceInput() {
    return this.source?.sourceInput;
  }

  get clearBtn() {
    return this.source?.clearBtn;
  }

  get translateBtn() {
    return this.source?.translateBtn;
  }

  get outputEl() {
    return this.output?.outputEl;
  }

  get starTargetBtn() {
    return this.output?.starTargetBtn;
  }

  get targetCard() {
    return this.output?.targetCard;
  }

  get debounceTimer() {
    return this.source?.debounceTimer;
  }
  set debounceTimer(val) {
    if (this.source) this.source.debounceTimer = val;
  }

  initControllers() {
    this.speech = new TranslatorSpeechController(this.container, this.onNotify);
    this.speech.bindEvents({
      getSourceText: () => this.sourceText || this.source?.getValue() || '',
      getTargetText: () => this.targetText,
      getSourceLang: () => this.sourceLang,
      getTargetLang: () => this.targetLang
    });

    this.ocr = new TranslatorOcrController(this.container, {
      getSourceLang: () => this.sourceLang,
      getTargetLang: () => this.targetLang,
      getEffectiveSourceLang: () => this.getEffectiveSourceLang(),
      getIsAutoDetect: () => this.isAutoDetect,
      getSettings: () => this.settingsDialog?.getSettings?.() || { backend: 'wasm' },
      onBeforeLoad: () => this.stopSpeaking(),
      onNotify: (msg) => this.onNotify?.(msg),
      onImageLoaded: () => {
        this.sourceText = '';
        this.targetText = '';
        this.source?.setValue('');
        this.renderOutput();
      },
      onFileTextLoaded: (text, fileName) => {
        this.sourceText = text;
        this.source?.setValue(this.sourceText);
        this.source?.setClearDisabled(false);
        this.triggerTranslate();
        this.onNotify?.(t('notifications.loadedText', { name: fileName }));
      },
      onOcrDetectedLanguage: (code) => {
        if (this.isAutoDetect) {
          this.detectedLang = getLanguageByCode(code);
          this.languages.updateLanguageUI();
        }
      },
      onTextsExtracted: (sourceText, targetText) => {
        this.sourceText = sourceText;
        this.targetText = targetText;
      }
    });
    this.ocr.bindEvents();

    this.languages = new TranslatorLanguagesController(this.container, {
      getIsAutoDetect: () => this.isAutoDetect,
      getDetectedLang: () => this.detectedLang,
      getSourceLang: () => this.sourceLang,
      getTargetLang: () => this.targetLang,
      getEffectiveSourceLang: () => this.getEffectiveSourceLang(),
      getRecentSourceLanguages: () => this.recentSourceLanguages,
      getRecentTargetLanguages: () => this.recentTargetLanguages,
      onLanguageSelected: (type, lang) => {
        if (type === 'source') {
          this.setSourceLanguage(lang);
        } else {
          this.setTargetLanguage(lang);
        }
      },
      onSwap: () => this.swapLanguages()
    });
    this.languages.populateMenus();
    this.languages.bindEvents();

    this.source = new TranslatorSourceController(this.container, {
      getSourceText: () => this.sourceText,
      getSettings: () => this.settingsDialog?.getSettings?.() || { autoTranslate: true },
      getIsAutoDetect: () => this.isAutoDetect,
      onBeforeInput: () => {
        if (this.activeTts === 'source') {
          this.stopSpeaking();
        }
        if (this.ocr.currentImage) {
          this.ocr.clearImage();
        }
      },
      onInput: (text) => {
        this.sourceText = text;
        this.source.updateUI(!!this.sourceText, !!this.ocr.currentImage);
      },
      onEmpty: () => {
        if (this.isAutoDetect) {
          this.detectedLang = null;
          this.languages.updateLanguageUI();
        }
        this.targetText = '';
        this.renderOutput();
      },
      onDebouncedTranslate: async () => {
        if (this.isAutoDetect) {
          await this.detectCurrentLanguage(this.sourceText);
        }
        this.triggerTranslate();
      },
      onTranslate: () => {
        this.triggerTranslate();
        this.scrollToTarget();
      },
      onClear: () => {
        this.stopSpeaking();
        this.ocr.clearImage();
        this.sourceText = '';
        this.targetText = '';
        this.render();
      },
      onVoiceInput: (text) => {
        this.ocr.clearImage();
        this.sourceText = text;
        this.triggerTranslate();
      },
      onNotify: (msg) => this.onNotify?.(msg)
    });

    this.output = new TranslatorOutputController(this.container, {
      getTargetText: () => this.targetText,
      getEffectiveSourceLang: () => this.getEffectiveSourceLang(),
      getTargetLang: () => this.targetLang,
      getShareUrl: () => this.getShareUrl(),
      getOcrTargetImagePreview: () => this.ocr?.targetImagePreview,
      onNotify: (msg) => this.onNotify?.(msg)
    });
  }

  stopSpeaking(notify = false) {
    this.speech?.stopSpeaking(notify);
  }

  startSpeaking(target = 'target') {
    const isSource = target === 'source';
    const text = isSource ? (this.sourceText || this.source?.getValue() || '') : this.targetText;
    const lang = isSource ? this.sourceLang : this.targetLang;
    this.speech?.startSpeaking(target, text, lang);
  }

  addRecentSource(code) {
    if (!code || code === 'auto') return;
    this.recentSourceLanguages = [code, ...this.recentSourceLanguages.filter(c => c !== code)].slice(0, 10);
    saveRecentLangs(RECENT_SOURCE_KEY, this.recentSourceLanguages);
  }

  addRecentTarget(code) {
    if (!code || code === 'auto') return;
    this.recentTargetLanguages = [code, ...this.recentTargetLanguages.filter(c => c !== code)].slice(0, 10);
    saveRecentLangs(RECENT_TARGET_KEY, this.recentTargetLanguages);
  }

  getEffectiveSourceLang() {
    if (this.isAutoDetect) {
      return this.detectedLang || SUPPORTED_LANGUAGES.find(l => l.code === 'en') || SUPPORTED_LANGUAGES[0];
    }
    return this.sourceLang;
  }

  getWordCount(text = this.sourceText) {
    return getWordCount(text);
  }

  async detectCurrentLanguage(text = this.sourceText) {
    if (!this.isAutoDetect) return null;
    if (!text || !text.trim()) {
      this.detectedLang = null;
      this.languages.updateLanguageUI();
      return null;
    }
    const lang = await detectCurrentLanguage(text);
    if (lang) {
      this.detectedLang = lang;
      this.languages.updateLanguageUI();
      return this.detectedLang;
    }
    return null;
  }

  setupTranslationListeners() {
    translationService.onProgress((progress) => {
      if (progress && (progress.status === 'progress' || progress.status === 'download')) {
        this.downloadProgress = progress;
        this.renderOutput();
      } else if (progress && progress.status === 'done') {
        this.downloadProgress = null;
        this.renderOutput();
      }
    });

    translationService.onStatusChange((status, detail) => {
      if (status === 'error') {
        this.isTranslating = false;
        this.downloadProgress = null;
        this.onNotify?.(t('notifications.translationError', { detail: detail || 'Unknown error' }));
        this.renderOutput();
      }
    });
  }

  swapLanguages() {
    this.stopSpeaking();
    const effectiveSrc = this.getEffectiveSourceLang();

    if (this.isAutoDetect) {
      this.isAutoDetect = false;
      this.sourceLang = this.targetLang;
      this.targetLang = effectiveSrc;
    } else {
      const temp = this.sourceLang;
      this.sourceLang = this.targetLang;
      this.targetLang = temp;
    }

    if (this.sourceLang && this.sourceLang.code !== 'auto') {
      this.addRecentSource(this.sourceLang.code);
    }
    if (this.targetLang) {
      this.addRecentTarget(this.targetLang.code);
    }

    saveLanguagePreferences(this.isAutoDetect, this.sourceLang, this.targetLang);

    const tempText = this.sourceText;
    this.sourceText = this.targetText;
    this.targetText = tempText;

    this.render();
    if (this.ocr.currentImage && this.ocr.ocrBoxes.length > 0) {
      this.ocr.translateOcrBoxes().then(() => {
        this.ocr.renderTargetOcrOverlay();
        if (this.ocr.targetOcrLoading) this.ocr.targetOcrLoading.style.display = 'none';
      });
    } else if (this.sourceText.trim()) {
      this.triggerTranslate();
    }
  }

  setSourceLanguage(lang) {
    if (!lang) return;

    if (lang.code === 'auto') {
      this.isAutoDetect = true;
      this.sourceLang = AUTO_DETECT_LANGUAGE;
      saveLanguagePreferences(this.isAutoDetect, this.sourceLang, this.targetLang);
      this.stopSpeaking();
      this.render();
      if (this.ocr.currentImage) {
        this.ocr.processImageOCR(this.ocr.currentImage);
      } else if (this.sourceText.trim()) {
        this.detectCurrentLanguage(this.sourceText).then(() => {
          this.triggerTranslate();
        });
      }
      return;
    }

    if (lang.code === this.targetLang.code) {
      this.swapLanguages();
      return;
    }
    this.isAutoDetect = false;
    this.stopSpeaking();
    this.sourceLang = lang;
    this.addRecentSource(lang.code);
    saveLanguagePreferences(this.isAutoDetect, this.sourceLang, this.targetLang);
    this.render();
    if (this.ocr.currentImage) {
      this.ocr.processImageOCR(this.ocr.currentImage);
    } else if (this.sourceText.trim()) {
      this.triggerTranslate();
    }
  }

  setTargetLanguage(lang) {
    if (!lang) return;

    const currentSourceCode = this.isAutoDetect ? (this.detectedLang?.code || null) : this.sourceLang.code;
    if (currentSourceCode && lang.code === currentSourceCode) {
      this.swapLanguages();
      return;
    }

    this.stopSpeaking();
    this.targetLang = lang;
    this.addRecentTarget(lang.code);
    saveLanguagePreferences(this.isAutoDetect, this.sourceLang, this.targetLang);
    this.render();
    if (this.ocr.currentImage && this.ocr.ocrBoxes.length > 0) {
      this.ocr.translateOcrBoxes().then(() => {
        this.ocr.renderTargetOcrOverlay();
        if (this.ocr.targetOcrLoading) this.ocr.targetOcrLoading.style.display = 'none';
      });
    } else if (this.sourceText.trim()) {
      this.triggerTranslate();
    }
  }

  updateModelStatus() {
    this.renderOutput();
  }

  scrollToTarget() {
    this.output?.scrollToTarget();
  }

  loadHistoryItem(item) {
    if (!item) return;
    this.stopSpeaking();
    this.ocr.clearImage();

    const src = getLanguageByCode(item.sourceLang);
    const tgt = getLanguageByCode(item.targetLang);

    if (src) {
      if (src.code === 'auto') {
        this.isAutoDetect = true;
        this.sourceLang = AUTO_DETECT_LANGUAGE;
      } else {
        this.isAutoDetect = false;
        this.sourceLang = src;
        this.addRecentSource(src.code);
      }
    }
    if (tgt) {
      this.targetLang = tgt;
      this.addRecentTarget(tgt.code);
    }
    saveLanguagePreferences(this.isAutoDetect, this.sourceLang, this.targetLang);

    this.sourceText = item.sourceText || '';
    this.targetText = item.targetText || '';
    this.isTranslating = false;
    this.downloadProgress = null;
    this.output?.setStarred(!!item.starred);

    this.render();
  }

  async triggerTranslate() {
    this.source?.clearDebounce();
    this.stopSpeaking();

    if (this.ocr.currentImage && this.ocr.ocrBoxes.length > 0) {
      this.isTranslating = true;
      try {
        await this.ocr.translateOcrBoxes();
        this.ocr.renderTargetOcrOverlay();
      } finally {
        this.isTranslating = false;
        if (this.ocr.targetOcrLoading) this.ocr.targetOcrLoading.style.display = 'none';
      }
      return;
    }

    if (!this.sourceText.trim()) {
      this.targetText = '';
      this.renderOutput();
      return;
    }

    if (this.isAutoDetect) {
      await this.detectCurrentLanguage(this.sourceText);
    }

    const effectiveSrc = this.getEffectiveSourceLang();

    this.isTranslating = true;
    this.renderOutput();

    const settings = this.settingsDialog?.getSettings?.() || { backend: 'wasm' };

    try {
      const res = await translationService.translate(
        this.sourceText,
        effectiveSrc.code,
        this.targetLang.code,
        { device: settings.backend || 'wasm' }
      );

      this.isTranslating = false;
      this.downloadProgress = null;
      this.targetText = res.translation;
      this.lastInferenceTimeMs = res.inferenceTimeMs;
      this.renderOutput();

      if (this.historyView && res.translation) {
        this.historyView.addItem(
          this.sourceText,
          this.targetText,
          getLocalizedLanguageName(effectiveSrc),
          getLocalizedLanguageName(this.targetLang)
        );
      }
    } catch (err) {
      console.error('Translation error:', err);
      this.isTranslating = false;
      this.downloadProgress = null;
      this.onNotify?.(t('notifications.translationError', { detail: err.message || String(err) }));
      this.renderOutput();
    }
  }

  renderOutput() {
    this.output?.render({
      isTranslating: this.isTranslating,
      downloadProgress: this.downloadProgress,
      targetText: this.targetText,
      hasOcrImage: !!this.ocr?.currentImage
    });
  }

  render() {
    this.languages?.updateLanguageUI();
    this.ocr?.updateImageUI(!!this.sourceText);
    this.source?.setValue(this.sourceText);
    this.source?.updateUI(!!this.sourceText, !!this.ocr?.currentImage);
    this.renderOutput();
  }

  loadFromUrl() {
    const res = parseUrlParamsForState(this.sourceLang, this.targetLang, this.isAutoDetect);
    let changed = res.changed;
    if (res.changed) {
      this.isAutoDetect = res.isAutoDetect;
      this.sourceLang = res.sourceLang;
      this.targetLang = res.targetLang;
      if (this.sourceLang && this.sourceLang.code !== 'auto') {
        this.addRecentSource(this.sourceLang.code);
      }
      if (this.targetLang) {
        this.addRecentTarget(this.targetLang.code);
      }
    }

    if (res.sourceText !== null && res.sourceText !== this.sourceText) {
      this.sourceText = res.sourceText;
      changed = true;
    }

    if (changed) {
      saveLanguagePreferences(this.isAutoDetect, this.sourceLang, this.targetLang);
      this.stopSpeaking();
      this.render();
      if (this.sourceText.trim()) {
        if (this.isAutoDetect) {
          this.detectCurrentLanguage(this.sourceText).then(() => {
            this.triggerTranslate();
          });
        } else {
          this.triggerTranslate();
        }
      }
    }
  }

  getShareUrl() {
    return getShareUrl(this.isAutoDetect, this.sourceLang, this.targetLang, this.sourceText);
  }

  bindEvents() {
    this.source?.bindEvents();
    this.output?.bindEvents();

    window.addEventListener('popstate', () => {
      if (window.location.search) {
        this.loadFromUrl();
        history.replaceState(null, '', window.location.pathname + window.location.hash);
      }
    });
  }
}
