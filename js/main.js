import '../css/theme.css';

// Import all required Material Design 3 Web Components
import '@francofantomius/material-components/button';
import '@francofantomius/material-components/icon-button';
import '@francofantomius/material-components/icon';
import '@francofantomius/material-components/card';
import '@francofantomius/material-components/top-app-bar';
import '@francofantomius/material-components/tabs';
import '@francofantomius/material-components/chip';
import '@francofantomius/material-components/dialog';
import '@francofantomius/material-components/segmented-button';
import '@francofantomius/material-components/progress';
import '@francofantomius/material-components/loading-indicator';
import '@francofantomius/material-components/switch';
import '@francofantomius/material-components/radio';
import '@francofantomius/material-components/snackbar';
import '@francofantomius/material-components/tooltip';
import '@francofantomius/material-components/divider';
import '@francofantomius/material-components/menu';
import '@francofantomius/material-components/badge';
import '@francofantomius/material-components/text-field';
import '@francofantomius/material-components/side-sheet';
import '@francofantomius/material-components/bottom-sheet';

// Ensure tooltips maintain proper spacing from their target buttons
const MdTooltip = customElements.get('md-tooltip');
if (MdTooltip?.prototype?.updatePosition) {
  MdTooltip.prototype.updatePosition = function () {
    if (!this.tooltipPanel) return;
    const anchor = this.resolveAnchorElement();
    if (!anchor) return;

    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = this.tooltipPanel.getBoundingClientRect();
    const width = panelRect.width || (this.rich ? 220 : 80);
    const height = panelRect.height || (this.rich ? 80 : 24);

    const customSpacing = parseFloat(getComputedStyle(this).getPropertyValue('--md-tooltip-offset'));
    const spacing = !isNaN(customSpacing) ? customSpacing : (this.rich ? 14 : 10);

    let top = 0;
    let left = 0;

    switch (this.position) {
      case 'top':
        top = anchorRect.top - height - spacing;
        left = anchorRect.left + (anchorRect.width - width) / 2;
        break;
      case 'bottom':
        top = anchorRect.bottom + spacing;
        left = anchorRect.left + (anchorRect.width - width) / 2;
        break;
      case 'left':
        top = anchorRect.top + (anchorRect.height - height) / 2;
        left = anchorRect.left - width - spacing;
        break;
      case 'right':
        top = anchorRect.top + (anchorRect.height - height) / 2;
        left = anchorRect.right + spacing;
        break;
    }

    const margin = 8;
    const dialog = this.closest('md-dialog');
    if (dialog) {
      const innerDialog = dialog.shadowRoot?.querySelector('dialog') || dialog;
      const dialogRect = innerDialog.getBoundingClientRect();
      top -= dialogRect.top;
      left -= dialogRect.left;

      const dWidth = dialogRect.width || 400;
      const dHeight = dialogRect.height || 400;
      left = Math.max(margin, Math.min(left, dWidth - width - margin));
      top = Math.max(margin, Math.min(top, dHeight - height - margin));
    } else {
      const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
      const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 768;
      left = Math.max(margin, Math.min(left, windowWidth - width - margin));
      top = Math.max(margin, Math.min(top, windowHeight - height - margin));
    }

    this.tooltipPanel.style.top = `${top}px`;
    this.tooltipPanel.style.left = `${left}px`;
  };
}

import { initI18n, t } from './i18.js';
import { ModelsView } from './models.js';
import { HistoryView } from './history.js';
import { SettingsDialog } from './settings.js';
import { TranslatorView } from './ui/index.js';
import { initTheme } from './theme.js';

function notify(message) {
  const snackbar = document.getElementById('global-snackbar');
  if (snackbar) {
    snackbar.message = message;
    snackbar.open = true;
  }
}

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  initI18n();

  const translatorContainer = document.getElementById('view-translator');
  const historyContainer = document.getElementById('view-history');

  if (!translatorContainer || !historyContainer) return;

  // Models Manager
  const modelsView = new ModelsView(null, () => {
    translatorView?.updateModelStatus();
  });

  // History View
  let translatorView;
  const historyView = new HistoryView(historyContainer, notify, (item) => {
    if (translatorView) {
      translatorView.loadHistoryItem(item);
      historyView.close();
      notify(t('notifications.loadedFromHistory'));
    }
  });

  // Settings Dialog
  const settingsDialog = new SettingsDialog(historyView, notify);

  // Translator View
  translatorView = new TranslatorView(
    translatorContainer,
    modelsView,
    historyView,
    settingsDialog,
    notify
  );

  // Settings button trigger
  const settingsBtn = document.getElementById('settings-action-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      settingsDialog.open();
    });
  }

  // Theme Management
  initTheme(notify);

  // History sheet trigger & close buttons
  const historyBtn = document.getElementById('history-action-btn');
  const historyCloseBtns = document.querySelectorAll('.history-close-btn, #history-sheet-close-btn, #history-bottom-sheet-close-btn');

  if (historyBtn) {
    historyBtn.addEventListener('click', () => {
      historyView.open();
    });
  }

  historyCloseBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      historyView.close();
    });
  });
});
