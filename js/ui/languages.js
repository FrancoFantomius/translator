import { SUPPORTED_LANGUAGES, getLanguageByCode } from '../translation/index.js';
import { t, onLanguageChange } from '../i18.js';
import { getLocalizedLanguageName, escapeAttr } from './prefs.js';

export class TranslatorLanguagesController {
  constructor(container, options) {
    this.container = container;
    this.options = options;
  }

  populateMenus() {
    const sourceMenu = this.container.querySelector('#source-lang-menu');
    const targetMenu = this.container.querySelector('#target-lang-menu');

    const isAuto = this.options.getIsAutoDetect();
    const detectedLang = this.options.getDetectedLang();
    const sourceLang = this.options.getSourceLang();
    const targetLang = this.options.getTargetLang();

    if (sourceMenu) {
      const initialSrcLabel = isAuto
        ? (detectedLang ? `${t('languages.auto')} (${getLocalizedLanguageName(detectedLang)})` : t('languages.auto'))
        : getLocalizedLanguageName(sourceLang);

      sourceMenu.innerHTML = `<button slot="trigger" class="language-select-btn active" id="source-lang-trigger"><md-icon name="translate" size="18"></md-icon><span id="source-lang-label">${escapeAttr(initialSrcLabel)}</span><md-icon name="arrow_drop_down" size="18"></md-icon></button>`;
      const grid = document.createElement('div');
      grid.className = 'language-menu-grid';

      // Auto option
      const autoItem = document.createElement('md-menu-item');
      autoItem.className = 'source-lang-item';
      autoItem.value = 'auto';
      autoItem.setAttribute('value', 'auto');
      autoItem.headline = t('languages.auto');
      autoItem.selected = isAuto;
      if (isAuto) autoItem.setAttribute('selected', '');
      grid.appendChild(autoItem);

      SUPPORTED_LANGUAGES.forEach(lang => {
        const item = document.createElement('md-menu-item');
        item.className = 'source-lang-item';
        item.value = lang.code;
        item.setAttribute('value', lang.code);
        item.headline = getLocalizedLanguageName(lang);
        item.selected = !isAuto && lang.code === sourceLang.code;
        if (!isAuto && lang.code === sourceLang.code) item.setAttribute('selected', '');
        grid.appendChild(item);
      });
      sourceMenu.appendChild(grid);
    }

    if (targetMenu) {
      targetMenu.innerHTML = '<button slot="trigger" class="language-select-btn active" id="target-lang-trigger"><span id="target-lang-label">' + escapeAttr(getLocalizedLanguageName(targetLang)) + '</span><md-icon name="arrow_drop_down" size="18"></md-icon></button>';
      const grid = document.createElement('div');
      grid.className = 'language-menu-grid';
      SUPPORTED_LANGUAGES.forEach(lang => {
        const item = document.createElement('md-menu-item');
        item.className = 'target-lang-item';
        item.value = lang.code;
        item.setAttribute('value', lang.code);
        item.headline = getLocalizedLanguageName(lang);
        item.selected = lang.code === targetLang.code;
        if (lang.code === targetLang.code) item.setAttribute('selected', '');
        grid.appendChild(item);
      });
      targetMenu.appendChild(grid);
    }
  }

  updateLanguageUI() {
    const isAuto = this.options.getIsAutoDetect();
    const effectiveSrc = this.options.getEffectiveSourceLang();
    const detectedLang = this.options.getDetectedLang();
    const sourceLang = this.options.getSourceLang();
    const targetLang = this.options.getTargetLang();

    const srcName = getLocalizedLanguageName(effectiveSrc);
    const tgtName = getLocalizedLanguageName(targetLang);

    const sourceLangLabel = this.container.querySelector('#source-lang-label');
    const targetLangLabel = this.container.querySelector('#target-lang-label');
    const sourceCardTitle = this.container.querySelector('#source-card-title');
    const targetCardTitle = this.container.querySelector('#target-card-title');

    if (sourceLangLabel) {
      sourceLangLabel.textContent = isAuto
        ? (detectedLang ? `${t('languages.auto')} (${getLocalizedLanguageName(detectedLang)})` : t('languages.auto'))
        : getLocalizedLanguageName(sourceLang);
    }
    if (targetLangLabel) targetLangLabel.textContent = tgtName;

    if (sourceCardTitle) {
      sourceCardTitle.textContent = isAuto
        ? (detectedLang ? t('translator.sourceCardTitle', { lang: getLocalizedLanguageName(detectedLang) }) : t('translator.sourceCardTitle', { lang: t('languages.auto') }))
        : t('translator.sourceCardTitle', { lang: srcName });
    }
    if (targetCardTitle) targetCardTitle.textContent = t('translator.targetCardTitle', { lang: tgtName });

    const sourceTrigger = this.container.querySelector('#source-lang-trigger');
    if (sourceTrigger) {
      const iconEl = sourceTrigger.querySelector('md-icon:first-child');
      if (iconEl && iconEl.name !== 'translate') {
        iconEl.name = 'translate';
        iconEl.setAttribute('name', 'translate');
      }
    }

    this.container.querySelectorAll('.source-lang-item').forEach(item => {
      const code = item.value || item.getAttribute('value');
      const isSelected = isAuto ? code === 'auto' : code === sourceLang.code;
      item.selected = isSelected;
      if (isSelected) {
        item.setAttribute('selected', '');
      } else {
        item.removeAttribute('selected');
      }
    });

    this.container.querySelectorAll('.target-lang-item').forEach(item => {
      const code = item.value || item.getAttribute('value');
      const isSelected = code === targetLang.code;
      item.selected = isSelected;
      if (isSelected) {
        item.setAttribute('selected', '');
      } else {
        item.removeAttribute('selected');
      }
    });

    this.renderChips();
  }

  renderChips() {
    const sourceChipsContainer = this.container.querySelector('#source-quick-chips') || this.container.querySelectorAll('.quick-lang-chips')[0];
    const targetChipsContainer = this.container.querySelector('#target-quick-chips') || this.container.querySelectorAll('.quick-lang-chips')[1];
    const isAuto = this.options.getIsAutoDetect();
    const sourceLang = this.options.getSourceLang();
    const targetLang = this.options.getTargetLang();

    if (sourceChipsContainer) {
      const displaySourceCodes = this.options.getRecentSourceLanguages().slice(0, 4);
      sourceChipsContainer.innerHTML = displaySourceCodes.map(code => {
        const lang = getLanguageByCode(code);
        const isSelected = !isAuto && sourceLang.code === lang.code;
        return `<md-chip label="${escapeAttr(getLocalizedLanguageName(lang))}" ${isSelected ? 'selected' : ''} class="quick-source-chip" data-code="${escapeAttr(lang.code)}"></md-chip>`;
      }).join('');

      sourceChipsContainer.querySelectorAll('.quick-source-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
          const code = e.currentTarget.dataset.code;
          const lang = getLanguageByCode(code);
          if (lang) this.options.onLanguageSelected('source', lang);
        });
      });
    }

    if (targetChipsContainer) {
      const displayTargetCodes = this.options.getRecentTargetLanguages().slice(0, 4);
      targetChipsContainer.innerHTML = displayTargetCodes.map(code => {
        const lang = getLanguageByCode(code);
        const isSelected = targetLang.code === lang.code;
        return `<md-chip label="${escapeAttr(getLocalizedLanguageName(lang))}" ${isSelected ? 'selected' : ''} class="quick-target-chip" data-code="${escapeAttr(lang.code)}"></md-chip>`;
      }).join('');

      targetChipsContainer.querySelectorAll('.quick-target-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
          const code = e.currentTarget.dataset.code;
          const lang = getLanguageByCode(code);
          if (lang) this.options.onLanguageSelected('target', lang);
        });
      });
    }
  }

  bindEvents() {
    const swapBtn = this.container.querySelector('#swap-lang-btn');
    if (swapBtn) {
      swapBtn.addEventListener('click', () => this.options.onSwap());
    }

    const sourceMenu = this.container.querySelector('#source-lang-menu');
    if (sourceMenu) {
      sourceMenu.addEventListener('select', (e) => {
        const code = e.detail?.value || (e.detail?.item && (e.detail.item.value || e.detail.item.getAttribute('value')));
        if (code) {
          const lang = code === 'auto' ? { code: 'auto', name: 'Auto Detect' } : getLanguageByCode(code);
          if (lang) this.options.onLanguageSelected('source', lang);
        }
      });
    }

    this.container.querySelectorAll('.source-lang-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const code = e.currentTarget.value || e.currentTarget.getAttribute('value');
        const lang = code === 'auto' ? { code: 'auto', name: 'Auto Detect' } : getLanguageByCode(code);
        if (lang) this.options.onLanguageSelected('source', lang);
      });
    });

    const targetMenu = this.container.querySelector('#target-lang-menu');
    if (targetMenu) {
      targetMenu.addEventListener('select', (e) => {
        const code = e.detail?.value || (e.detail?.item && (e.detail.item.value || e.detail.item.getAttribute('value')));
        if (code) {
          const lang = getLanguageByCode(code);
          if (lang) this.options.onLanguageSelected('target', lang);
        }
      });
    }

    this.container.querySelectorAll('.target-lang-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const code = e.currentTarget.value || e.currentTarget.getAttribute('value');
        const lang = getLanguageByCode(code);
        if (lang) this.options.onLanguageSelected('target', lang);
      });
    });

    onLanguageChange(() => {
      this.populateMenus();
      this.updateLanguageUI();
    });
  }
}

