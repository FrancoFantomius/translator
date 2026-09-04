import { getTheme, setTheme, onThemeChange } from './theme.js';
import { APP_LANGUAGES, t, getLanguage, getLanguagePreference, isAutoLanguage, getCurrentLanguageInfo, setLanguage as setAppLanguage, onLanguageChange } from './i18.js';

export { APP_LANGUAGES };

export class SettingsDialog {
  constructor(historyView, onNotify) {
    this.dialogElement = null;
    this.historyView = historyView;
    this.onNotify = onNotify;

    this.selectedLanguage = getLanguagePreference();
    this.render();
    this.bindEvents();
    this.setupThemeSync();
    this.setupLanguageSync();
    this.setupHashSync();
  }

  getSettings() {
    return {
      theme: getTheme(),
      language: getLanguagePreference(),
      backend: 'wasm',
      autoTranslate: true
    };
  }

  getCurrentLanguage() {
    return getCurrentLanguageInfo();
  }

  setLanguage(code) {
    this.selectedLanguage = code;
    setAppLanguage(code, this.onNotify);
  }

  isOpen() {
    return !!(this.dialogElement && this.dialogElement.open);
  }

  open() {
    this._isOpening = true;
    if (this.dialogElement) {
      if (typeof this.dialogElement.showModal === 'function') {
        this.dialogElement.showModal();
      } else {
        this.dialogElement.open = true;
      }
      this.ensureDialogDimensions();

      const clearAutofocus = () => {
        const closeBtn = this.dialogElement?.querySelector('#settings-close-x-btn');
        if (closeBtn) {
          closeBtn.blur();
          const innerBtn = closeBtn.shadowRoot?.querySelector('button');
          if (innerBtn) innerBtn.blur();
        }
        const saveBtn = this.dialogElement?.querySelector('#settings-save-btn');
        if (saveBtn) {
          saveBtn.blur();
        }
        const innerDialog = this.dialogElement?.shadowRoot?.querySelector('dialog');
        if (innerDialog) {
          innerDialog.style.outline = 'none';
          innerDialog.style.border = 'none';
          innerDialog.scrollLeft = 0;
          innerDialog.blur();
        }
      };
      requestAnimationFrame(clearAutofocus);
      setTimeout(clearAutofocus, 40);
      setTimeout(clearAutofocus, 100);
    }
    if (window.location.hash.toLowerCase() !== '#settings') {
      window.location.hash = '#settings';
    }
    setTimeout(() => {
      this._isOpening = false;
      if (this.isOpen() && window.location.hash.toLowerCase() !== '#settings') {
        window.location.hash = '#settings';
      }
    }, 500);
  }

  ensureDialogDimensions() {
    const applyFix = () => {
      const isMobile = window.innerWidth <= 500;
      const inner = this.dialogElement?.shadowRoot?.querySelector('dialog');
      const iconEl = this.dialogElement?.shadowRoot?.querySelector('.icon');
      if (iconEl) {
        iconEl.style.display = 'none';
      }

      if (inner) {
        inner.style.border = 'none';
        inner.style.outline = 'none';
        inner.scrollLeft = 0;

        if (isMobile) {
          inner.style.width = '100%';
          inner.style.maxWidth = '100%';
          inner.style.height = '100%';
          inner.style.height = '100dvh';
          inner.style.maxHeight = '100%';
          inner.style.maxHeight = '100dvh';
          inner.style.borderRadius = '0';
          inner.style.margin = '0';
          inner.style.padding = '8px 16px 16px';
          inner.style.overflow = 'auto';
          inner.style.minHeight = '100%';
          inner.style.minHeight = '100dvh';
          inner.style.boxSizing = 'border-box';
          inner.style.inset = '0';
          inner.style.top = '0';
          inner.style.left = '0';
          inner.style.boxShadow = 'none';
        } else {
          inner.style.width = '';
          inner.style.maxWidth = '';
          inner.style.height = '';
          inner.style.maxHeight = '';
          inner.style.borderRadius = '';
          inner.style.margin = 'auto';
          inner.style.padding = '';
          inner.style.overflow = 'visible';
          inner.style.minHeight = '560px';
          inner.style.boxSizing = '';
          inner.style.inset = '0';
          inner.style.top = '';
          inner.style.left = '';
          inner.style.boxShadow = '';
        }
      }
      const container = this.dialogElement?.shadowRoot?.querySelector('.dialog-container');
      if (container) {
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.overflow = 'visible';
        container.style.width = '100%';
        container.style.maxWidth = '100%';
        container.style.boxSizing = 'border-box';
        if (isMobile) {
          container.style.minHeight = '100%';
          container.style.height = '100%';
          container.style.justifyContent = 'flex-start';
          container.style.gap = '12px';
        } else {
          container.style.minHeight = '510px';
          container.style.height = '';
          container.style.justifyContent = '';
          container.style.gap = '';
        }
      }
    };
    applyFix();
    if (this.dialogElement?.updateComplete) {
      this.dialogElement.updateComplete.then(applyFix);
    }
    setTimeout(applyFix, 50);
    setTimeout(applyFix, 160);
  }

  close() {
    this._isOpening = false;
    if (this.dialogElement) {
      if (typeof this.dialogElement.close === 'function') {
        this.dialogElement.close();
      } else {
        this.dialogElement.open = false;
      }
    }
    if (window.location.hash.toLowerCase() === '#settings') {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  setupHashSync() {
    window.addEventListener('hashchange', () => {
      if (window.location.hash.toLowerCase() === '#settings') {
        if (!this.isOpen()) {
          this.open();
        }
      } else {
        if (this.isOpen()) {
          this.close();
        }
      }
    });

    if (window.location.hash.toLowerCase() === '#settings') {
      this.open();
      if (!customElements.get('md-dialog')) {
        customElements.whenDefined('md-dialog').then(() => {
          this.open();
        });
      } else if (this.dialogElement?.updateComplete) {
        this.dialogElement.updateComplete.then(() => {
          this.open();
        });
      }
    }
  }

  setupThemeSync() {
    onThemeChange((currentTheme) => {
      if (!this.dialogElement) return;
      const segSet = this.dialogElement.querySelector('#theme-segmented-set');
      if (!segSet) return;
      const buttons = segSet.querySelectorAll('md-segmented-button');
      buttons.forEach(btn => {
        const isMatch = btn.getAttribute('value') === currentTheme;
        btn.selected = isMatch;
        if (isMatch) {
          btn.setAttribute('selected', '');
        } else {
          btn.removeAttribute('selected');
        }
      });
    });
  }

  setupLanguageSync() {
    onLanguageChange((code) => {
      this.selectedLanguage = code;
      const wasOpen = this.isOpen();
      this.render();
      this.bindEvents();
      if (wasOpen) {
        this.open();
      }
    });
  }

  render() {
    let dialog = document.getElementById('app-settings-dialog');
    if (!dialog) {
      dialog = document.createElement('md-dialog');
      dialog.id = 'app-settings-dialog';
      document.body.appendChild(dialog);
    }
    this.dialogElement = dialog;

    const currentTheme = getTheme();
    const currentLang = this.getCurrentLanguage();
    const isAuto = isAutoLanguage();

    dialog.innerHTML = `
      <div slot="headline" class="settings-dialog-header" tabindex="-1" style="outline: none;">
        <div class="settings-dialog-title-group">
          <md-icon name="settings" size="24" class="settings-header-icon"></md-icon>
          <span class="settings-dialog-title">${t('settings.dialogTitle')}</span>
        </div>
        <div class="settings-header-actions">
          <md-icon-button id="settings-close-x-btn" icon="close" aria-label="${t('settings.closeAria')}"></md-icon-button>
          <md-tooltip for="settings-close-x-btn" value="${t('settings.closeTooltip')}" position="bottom" show-delay="150"></md-tooltip>
        </div>
      </div>

      <div class="settings-dialog-content">
        <!-- Option 1: Language Selection (App Language) -->
        <div class="setting-dialog-section">
          <div class="setting-dialog-text">
            <div class="setting-dialog-title">${t('settings.languageTitle')}</div>
            <div class="setting-dialog-desc">${t('settings.languageDesc')}</div>
          </div>
          <div class="setting-dialog-control">
            <button type="button" class="app-lang-select-btn" id="app-language-trigger">
              <md-icon name="language" size="18"></md-icon>
              <span id="app-language-label">${currentLang.name}</span>
              <md-icon name="arrow_drop_down" size="18"></md-icon>
            </button>
            <md-menu id="app-language-menu" no-trigger>
              <md-menu-item
                headline="${t('languages.auto')}"
                value="auto"
                ${isAuto ? 'selected' : ''}
                class="app-language-menu-item"
              ></md-menu-item>
              <md-divider></md-divider>
              ${APP_LANGUAGES.map(lang => `
                <md-menu-item
                  headline="${lang.name}"
                  value="${lang.code}"
                  ${!isAuto && lang.code === currentLang.code ? 'selected' : ''}
                  class="app-language-menu-item"
                ></md-menu-item>
              `).join('')}
            </md-menu>
            <md-tooltip for="app-language-trigger" value="${t('settings.languageTriggerTooltip')}" position="bottom" show-delay="150"></md-tooltip>
          </div>
        </div>

        <md-divider></md-divider>

        <!-- Option 2: Theme Selection (Switch on separate line) -->
        <div class="setting-dialog-section">
          <div class="setting-dialog-text">
            <div class="setting-dialog-title">${t('settings.themeTitle')}</div>
            <div class="setting-dialog-desc">${t('settings.themeDesc')}</div>
          </div>
          <div class="setting-theme-switch-row">
            <md-segmented-button-set id="theme-segmented-set">
              <md-segmented-button
                value="system"
                icon="brightness_auto"
                label="${t('settings.themeSystem')}"
                ${currentTheme === 'system' ? 'selected' : ''}
              ></md-segmented-button>
              <md-segmented-button
                value="light"
                icon="light_mode"
                label="${t('settings.themeLight')}"
                ${currentTheme === 'light' ? 'selected' : ''}
              ></md-segmented-button>
              <md-segmented-button
                value="dark"
                icon="dark_mode"
                label="${t('settings.themeDark')}"
                ${currentTheme === 'dark' ? 'selected' : ''}
              ></md-segmented-button>
            </md-segmented-button-set>
          </div>
        </div>

        <md-divider></md-divider>

        <!-- Option 3: Clear History -->
        <div class="setting-dialog-section">
          <div class="setting-dialog-text">
            <div class="setting-dialog-title">${t('settings.clearHistoryTitle')}</div>
            <div class="setting-dialog-desc">${t('settings.clearHistoryDesc')}</div>
          </div>
          <div class="setting-dialog-control">
            <md-button id="setting-clear-history-btn" variant="outlined" icon="delete_sweep">
              ${t('settings.clearHistoryBtn')}
            </md-button>
            <md-tooltip for="setting-clear-history-btn" value="${t('settings.clearHistoryTooltip')}" position="top" show-delay="150"></md-tooltip>
          </div>
        </div>

        <md-divider></md-divider>

        <!-- Option 4: About & Attributions -->
        <div class="setting-dialog-section">
          <div class="setting-dialog-text">
            <div class="setting-dialog-title">${t('settings.aboutTitle')}</div>
            <div class="setting-dialog-desc">${t('settings.aboutDesc')}</div>
          </div>
          <div class="setting-dialog-control">
            <md-button id="setting-about-btn" variant="outlined" icon="info">
              ${t('settings.aboutBtn')}
            </md-button>
            <md-tooltip for="setting-about-btn" value="${t('settings.aboutTooltip')}" position="top" show-delay="150"></md-tooltip>
          </div>
        </div>
      </div>

      <div slot="actions">
        <md-button variant="filled" id="settings-save-btn">${t('settings.saveBtn')}</md-button>
        <md-tooltip for="settings-save-btn" value="${t('settings.saveTooltip')}" position="top" show-delay="150"></md-tooltip>
      </div>
    `;

    // Remove legacy external tooltip container if present
    const legacyTooltips = document.getElementById('settings-tooltips-container');
    if (legacyTooltips) {
      legacyTooltips.remove();
    }

    if (!dialog._hashCloseListenerAdded) {
      dialog.addEventListener('close', () => {
        if (this._isOpening || this.dialogElement?.open) {
          return;
        }
        if (window.location.hash.toLowerCase() === '#settings') {
          history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      });
      dialog._hashCloseListenerAdded = true;
    }
  }

  bindEvents() {
    if (!this.dialogElement) return;

    // Theme segmented button set
    const themeSet = this.dialogElement.querySelector('#theme-segmented-set');
    if (themeSet) {
      themeSet.addEventListener('change', (e) => {
        const val = e.detail?.value || e.target?.value;
        if (val) {
          setTheme(val, true);
        }
      });
    }

    // App language menu trigger and position/size sync
    const langTrigger = this.dialogElement.querySelector('#app-language-trigger');
    const langMenu = this.dialogElement.querySelector('#app-language-menu');

    const updateMenuPositionAndSize = () => {
      if (!langMenu) return;
      langMenu.style.setProperty('--md-menu-min-width', '100%');
      langMenu.style.setProperty('--md-menu-max-width', '100%');
      langMenu.style.setProperty('--md-menu-width', '100%');

      const surface = langMenu.shadowRoot?.querySelector('.menu-surface');
      if (surface) {
        surface.classList.remove('is-fixed');
        surface.style.position = 'absolute';
        surface.style.top = '0';
        surface.style.left = '0';
        surface.style.right = '0';
        surface.style.bottom = 'auto';
        surface.style.width = '100%';
        surface.style.minWidth = '100%';
        surface.style.maxWidth = '100%';
        surface.style.boxSizing = 'border-box';
        surface.style.borderRadius = 'var(--md-sys-shape-corner-medium, 16px)';
      }
    };

    const applyMenuItemCentering = () => {
      const items = this.dialogElement?.querySelectorAll('.app-language-menu-item');
      items?.forEach(item => {
        const shadow = item.shadowRoot;
        if (shadow) {
          const button = shadow.querySelector('.item');
          if (button) {
            button.style.justifyContent = 'center';
            button.style.textAlign = 'center';
          }
          const start = shadow.querySelector('.start');
          if (start) {
            start.style.display = 'none';
          }
          const content = shadow.querySelector('.content');
          if (content) {
            content.style.alignItems = 'center';
            content.style.textAlign = 'center';
            content.style.flex = '1';
          }
          const headline = shadow.querySelector('.headline');
          if (headline) {
            headline.style.textAlign = 'center';
          }
          const end = shadow.querySelector('.end');
          if (end) {
            end.style.position = 'absolute';
            end.style.right = '16px';
          }
        }
      });
    };

    if (langTrigger && langMenu) {
      langTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        langMenu.toggle();
        requestAnimationFrame(() => {
          updateMenuPositionAndSize();
          applyMenuItemCentering();
        });
        setTimeout(() => {
          updateMenuPositionAndSize();
          applyMenuItemCentering();
        }, 20);
      });

      langMenu.addEventListener('open', () => {
        requestAnimationFrame(() => {
          updateMenuPositionAndSize();
          applyMenuItemCentering();
        });
        setTimeout(() => {
          updateMenuPositionAndSize();
          applyMenuItemCentering();
        }, 20);
      });
    }

    if (langMenu) {
      langMenu.addEventListener('select', (e) => {
        const val = e.detail?.value || (e.detail?.item && e.detail.item.getAttribute('value'));
        if (val) {
          this.setLanguage(val);
        }
      });
    }

    const langItems = this.dialogElement.querySelectorAll('.app-language-menu-item');
    langItems.forEach(item => {
      item.addEventListener('click', () => {
        const val = item.getAttribute('value');
        if (val) {
          this.setLanguage(val);
        }
      });
    });

    customElements.whenDefined('md-menu-item').then(applyMenuItemCentering);
    setTimeout(applyMenuItemCentering, 50);

    // Clear history button
    const clearHistoryBtn = this.dialogElement.querySelector('#setting-clear-history-btn');
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => {
        if (confirm(t('settings.clearHistoryConfirm'))) {
          if (this.historyView && typeof this.historyView.clearAll === 'function') {
            this.historyView.clearAll();
          } else {
            this.onNotify?.(t('notifications.historyCleared'));
          }
        }
      });
    }

    // About & Attributions button
    const aboutBtn = this.dialogElement.querySelector('#setting-about-btn');
    if (aboutBtn) {
      aboutBtn.addEventListener('click', () => {
        this.openAbout();
      });
    }

    // Close X button
    const closeXBtn = this.dialogElement.querySelector('#settings-close-x-btn');
    if (closeXBtn) {
      closeXBtn.addEventListener('click', () => {
        this.close();
      });
    }

    // Save button
    const saveBtn = this.dialogElement.querySelector('#settings-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.close();
        this.onNotify?.(t('notifications.settingsSaved'));
      });
    }

    // Window resize handler to maintain responsive dialog size
    window.addEventListener('resize', () => {
      if (this.isOpen()) {
        this.ensureDialogDimensions();
        if (langMenu && langMenu.open) {
          updateMenuPositionAndSize();
        }
      }
    });
  }

  openAbout() {
    let aboutDialog = document.getElementById('app-about-dialog');
    if (!aboutDialog) {
      aboutDialog = document.createElement('md-dialog');
      aboutDialog.id = 'app-about-dialog';
      document.body.appendChild(aboutDialog);
    }

    aboutDialog.innerHTML = `
      <div slot="headline" class="settings-dialog-header" tabindex="-1" style="outline: none;">
        <div class="settings-dialog-title-group">
          <md-icon name="info" size="24" class="settings-header-icon"></md-icon>
          <span class="settings-dialog-title">${t('settings.aboutHeadline')}</span>
        </div>
        <div class="settings-header-actions">
          <md-icon-button id="about-close-x-btn" icon="close" aria-label="${t('settings.aboutCloseBtn')}"></md-icon-button>
          <md-tooltip for="about-close-x-btn" value="${t('settings.aboutCloseTooltip')}" position="bottom" show-delay="150"></md-tooltip>
        </div>
      </div>

      <div class="about-dialog-content" style="display: flex; flex-direction: column; gap: 14px; padding: 8px 0; max-height: 60vh; overflow-y: auto;">
        <p style="font-size: 13.5px; line-height: 1.5; color: var(--md-sys-color-on-surface-variant);">
          Translator executes all neural translation and OCR models locally on your device via WebAssembly and Web Workers. No text or image data is sent to external servers.
        </p>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <!-- Helsinki-NLP Opus-MT -->
          <div style="background: var(--md-sys-color-surface-container); border-radius: 12px; padding: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 600; font-size: 13.5px;">Helsinki-NLP Opus-MT</span>
              <span class="brand-badge" style="font-size: 11px; padding: 2px 8px; border-radius: 6px; background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container);">CC-BY-4.0</span>
            </div>
            <p style="font-size: 12px; color: var(--md-sys-color-on-surface-variant); margin-bottom: 6px; line-height: 1.4;">
              Fast bilingual neural translation models developed by Jörg Tiedemann &amp; Santhosh Thottingal at the University of Helsinki Language Technology Research Group. Converted to ONNX by Xenova.
            </p>
            <a href="https://aclanthology.org/2020.eamt-1.61/" target="_blank" rel="noopener noreferrer" style="font-size: 12px; color: var(--md-sys-color-primary); text-decoration: none;">View Paper (EAMT 2020) &rarr;</a>
          </div>

          <!-- Meta M2M-100 -->
          <div style="background: var(--md-sys-color-surface-container); border-radius: 12px; padding: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 600; font-size: 13.5px;">Meta M2M-100</span>
              <span class="brand-badge" style="font-size: 11px; padding: 2px 8px; border-radius: 6px; background: var(--md-sys-color-surface-container-highest); color: var(--md-sys-color-on-surface-variant);">MIT License</span>
            </div>
            <p style="font-size: 12px; color: var(--md-sys-color-on-surface-variant); margin-bottom: 6px; line-height: 1.4;">
              Universal multilingual direct translation model across 100 languages by Angela Fan et al. (Meta AI / FAIR). Converted to ONNX by Xenova.
            </p>
            <a href="https://arxiv.org/abs/2010.11125" target="_blank" rel="noopener noreferrer" style="font-size: 12px; color: var(--md-sys-color-primary); text-decoration: none;">View Paper (Fan et al. 2020) &rarr;</a>
          </div>

          <!-- PaddleOCR PP-OCRv5 -->
          <div style="background: var(--md-sys-color-surface-container); border-radius: 12px; padding: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 600; font-size: 13.5px;">PaddleOCR PP-OCRv5</span>
              <span class="brand-badge" style="font-size: 11px; padding: 2px 8px; border-radius: 6px; background: var(--md-sys-color-surface-container-highest); color: var(--md-sys-color-on-surface-variant);">Apache-2.0</span>
            </div>
            <p style="font-size: 12px; color: var(--md-sys-color-on-surface-variant); margin-bottom: 6px; line-height: 1.4;">
              Mobile DBNet text detection and multi-script CTC text recognition models by PaddlePaddle Authors (Baidu Inc.).
            </p>
            <a href="https://github.com/PaddlePaddle/PaddleOCR" target="_blank" rel="noopener noreferrer" style="font-size: 12px; color: var(--md-sys-color-primary); text-decoration: none;">View Repository &rarr;</a>
          </div>

          <!-- Google CLD3 -->
          <div style="background: var(--md-sys-color-surface-container); border-radius: 12px; padding: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 600; font-size: 13.5px;">Google CLD3 &amp; cld3-asm</span>
              <span class="brand-badge" style="font-size: 11px; padding: 2px 8px; border-radius: 6px; background: var(--md-sys-color-surface-container-highest); color: var(--md-sys-color-on-surface-variant);">Apache-2.0 / MIT</span>
            </div>
            <p style="font-size: 12px; color: var(--md-sys-color-on-surface-variant); margin-bottom: 6px; line-height: 1.4;">
              Compact Language Detector v3 by Google LLC. WebAssembly port by OJ Kwon.
            </p>
            <a href="https://github.com/google/cld3" target="_blank" rel="noopener noreferrer" style="font-size: 12px; color: var(--md-sys-color-primary); text-decoration: none;">View Repository &rarr;</a>
          </div>

          <!-- Frameworks & UI -->
          <div style="background: var(--md-sys-color-surface-container); border-radius: 12px; padding: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 600; font-size: 13.5px;">Libraries &amp; UI</span>
              <span class="brand-badge" style="font-size: 11px; padding: 2px 8px; border-radius: 6px; background: var(--md-sys-color-surface-container-highest); color: var(--md-sys-color-on-surface-variant);">MIT / Apache-2.0</span>
            </div>
            <p style="font-size: 12px; color: var(--md-sys-color-on-surface-variant); line-height: 1.4;">
              Built with Transformers.js (Apache-2.0), ONNX Runtime Web (MIT), and @francofantomius/material-components (MIT).
            </p>
          </div>
        </div>
      </div>

      <div slot="actions">
        <md-button variant="filled" id="about-close-btn">${t('settings.aboutCloseBtn')}</md-button>
        <md-tooltip for="about-close-btn" value="${t('settings.aboutCloseTooltip')}" position="top" show-delay="150"></md-tooltip>
      </div>
    `;

    const closeAbout = () => {
      if (typeof aboutDialog.close === 'function') {
        aboutDialog.close();
      } else {
        aboutDialog.open = false;
      }
    };

    aboutDialog.querySelector('#about-close-x-btn')?.addEventListener('click', closeAbout);
    aboutDialog.querySelector('#about-close-btn')?.addEventListener('click', closeAbout);

    if (typeof aboutDialog.showModal === 'function') {
      aboutDialog.showModal();
    } else {
      aboutDialog.open = true;
    }
  }
}
