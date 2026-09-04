import { t, onLanguageChange } from './i18.js';

const STORAGE_KEY = 'translator_history';

function loadHistoryFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Failed to load history from localStorage:', e);
  }
  return [];
}

function saveHistoryToStorage(history) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.warn('Failed to save history to localStorage:', e);
  }
}

function isAlmostSameText(prevText, currentText) {
  if (!prevText || !currentText) return false;
  const p = prevText.trim();
  const c = currentText.trim();
  if (p === c) return true;

  const wordsPrev = p.split(/\s+/).filter(Boolean);
  const wordsCurr = c.split(/\s+/).filter(Boolean);

  const wordDiff = Math.abs(wordsPrev.length - wordsCurr.length);
  if (wordDiff > 5) return false;

  const pLower = p.toLowerCase();
  const cLower = c.toLowerCase();

  if (pLower.startsWith(cLower) || cLower.startsWith(pLower) || pLower.includes(cLower) || cLower.includes(pLower)) {
    return true;
  }

  let commonWords = 0;
  const minLen = Math.min(wordsPrev.length, wordsCurr.length);
  for (let i = 0; i < minLen; i++) {
    if (wordsPrev[i].toLowerCase() === wordsCurr[i].toLowerCase()) {
      commonWords++;
    }
  }

  return (minLen > 0 && (commonWords / minLen) >= 0.5) || (wordDiff <= 5 && commonWords >= minLen - 2);
}

export const INITIAL_HISTORY = [];

export class HistoryView {
  constructor(container, onNotify, onSelectItem) {
    this.container = container;
    this.history = loadHistoryFromStorage();
    this.searchQuery = '';
    this.onNotify = onNotify;
    this.onSelectItem = onSelectItem;
    this.isExpanded = false;
    this.sideSheetElement = document.getElementById('history-side-sheet') || document.getElementById('history-sheet');
    this.bottomSheetElement = document.getElementById('history-bottom-sheet');
    this.mediaQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 768px)') : null;

    this.render();
    this.syncActiveSheet();
    this.setupSheetListeners();
    this.setupBottomSheetStyles();
    this.setupBottomSheetGestures();
    this.setupMediaWatcher();
    this.setupHashSync();
    this.setupLanguageSync();
  }

  isMobile() {
    return this.mediaQuery ? this.mediaQuery.matches : (typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  }

  resolveSheets() {
    if (!this.sideSheetElement) {
      this.sideSheetElement = document.getElementById('history-side-sheet') || document.getElementById('history-sheet');
    }
    if (!this.bottomSheetElement) {
      this.bottomSheetElement = document.getElementById('history-bottom-sheet');
    }
  }

  getActiveSheet() {
    this.resolveSheets();
    return (this.isMobile() && this.bottomSheetElement) ? this.bottomSheetElement : (this.sideSheetElement || this.bottomSheetElement);
  }

  getInactiveSheet() {
    this.resolveSheets();
    return (this.isMobile() && this.bottomSheetElement) ? this.sideSheetElement : this.bottomSheetElement;
  }

  get sheetElement() {
    return this.getActiveSheet();
  }

  set sheetElement(el) {
    if (this.isMobile()) {
      this.bottomSheetElement = el;
    } else {
      this.sideSheetElement = el;
    }
  }

  syncActiveSheet() {
    const active = this.getActiveSheet();
    const inactive = this.getInactiveSheet();

    if (active && this.container && this.container.parentElement !== active) {
      active.appendChild(this.container);
    }

    if (inactive && inactive.open) {
      inactive.open = false;
      if (active) {
        active.open = true;
      }
    }
  }

  setupBottomSheetStyles() {
    this.resolveSheets();
    if (!this.bottomSheetElement) return;

    const inject = () => {
      const root = this.bottomSheetElement?.shadowRoot;
      if (!root || root.querySelector('#history-bottom-sheet-custom-styles')) return;
      const style = document.createElement('style');
      style.id = 'history-bottom-sheet-custom-styles';
      style.textContent = `
        :host([open][type="modal"]) .sheet,
        :host([open][modal]) .sheet {
          height: 62dvh;
          min-height: 380px;
          max-height: calc(100dvh - 56px);
          transition: transform 300ms cubic-bezier(0.2, 0, 0, 1), height 300ms cubic-bezier(0.2, 0, 0, 1), visibility 300ms cubic-bezier(0.2, 0, 0, 1);
        }

        :host([open][data-expanded="true"]) .sheet {
          height: calc(100dvh - 56px);
        }

        .content {
          padding: 12px 16px 16px !important;
        }

        .drag-handle-container {
          cursor: grab;
          padding: 12px 0 8px 0;
          touch-action: none;
          user-select: none;
        }

        .drag-handle {
          width: 36px;
          height: 4px;
          border-radius: 2px;
        }

        .drag-handle-container:hover .drag-handle {
          background-color: var(--md-sys-color-on-surface-variant, #49454F);
        }
      `;
      root.appendChild(style);
    };

    if (this.bottomSheetElement.shadowRoot) {
      inject();
    } else {
      customElements.whenDefined('md-bottom-sheet').then(() => {
        setTimeout(inject, 0);
      });
    }
  }

  setExpanded(expanded, animate = true) {
    this.isExpanded = !!expanded;
    this.resolveSheets();
    if (!this.bottomSheetElement) return;

    const sheet = this.bottomSheetElement.shadowRoot?.querySelector('.sheet');
    if (sheet) {
      if (animate) {
        sheet.style.transition = 'height 300ms cubic-bezier(0.2, 0, 0, 1), transform 300ms cubic-bezier(0.2, 0, 0, 1)';
      } else {
        sheet.style.transition = 'none';
      }
      sheet.style.transform = 'translateY(0px)';
      sheet.style.height = this.isExpanded ? 'calc(100dvh - 56px)' : '62dvh';
    }

    if (this.isExpanded) {
      this.bottomSheetElement.setAttribute('data-expanded', 'true');
    } else {
      this.bottomSheetElement.removeAttribute('data-expanded');
    }
  }

  toggleExpanded() {
    this.setExpanded(!this.isExpanded, true);
  }

  setupBottomSheetGestures() {
    this.resolveSheets();
    if (!this.bottomSheetElement) return;

    const bind = () => {
      const root = this.bottomSheetElement?.shadowRoot;
      if (!root || root._interactiveGesturesAttached) return;
      root._interactiveGesturesAttached = true;

      const sheet = root.querySelector('.sheet');
      const handleContainer = root.querySelector('.drag-handle-container');
      const header = root.querySelector('.header');

      const onPointerDown = (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('button, md-icon-button, md-button, a, input, textarea, [role="button"]')) {
          return;
        }

        e.stopPropagation();

        const currentRect = sheet ? sheet.getBoundingClientRect() : null;
        if (!sheet || !currentRect) return;

        const startHeight = currentRect.height;
        const startY = e.clientY;
        const startTime = Date.now();
        let lastY = startY;
        let lastTime = startTime;
        let velocityY = 0;
        let isDragging = true;
        const pointerId = e.pointerId;

        sheet.classList.add('is-dragging');
        sheet.style.transition = 'none';

        try {
          e.currentTarget.setPointerCapture(pointerId);
        } catch {}

        const onPointerMove = (moveEvt) => {
          if (!isDragging) return;
          const now = Date.now();
          const dt = now - lastTime;
          if (dt > 0) {
            velocityY = (moveEvt.clientY - lastY) / dt;
          }
          lastY = moveEvt.clientY;
          lastTime = now;

          const deltaY = moveEvt.clientY - startY;
          const viewportHeight = window.innerHeight;
          const maxHeight = Math.round(viewportHeight - 56);
          const minHeight = 300;

          let targetHeight = startHeight - deltaY;

          // Damped resistance if dragging above maxHeight
          if (targetHeight > maxHeight) {
            targetHeight = maxHeight + (targetHeight - maxHeight) * 0.2;
          }

          if (targetHeight >= minHeight) {
            sheet.style.transform = 'translateY(0px)';
            sheet.style.height = `${Math.round(targetHeight)}px`;
          } else {
            sheet.style.height = `${minHeight}px`;
            const downOffset = Math.max(0, minHeight - targetHeight);
            sheet.style.transform = `translateY(${Math.round(downOffset)}px)`;
          }

          const normalH = Math.round(viewportHeight * 0.62);
          const scrim = root.querySelector('.scrim');
          if (scrim && targetHeight < normalH) {
            scrim.style.opacity = String(Math.max(0, Math.min(1, targetHeight / normalH)));
          }
        };

        const onPointerUp = (upEvt) => {
          if (!isDragging) return;
          isDragging = false;

          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          window.removeEventListener('pointercancel', onPointerUp);

          try {
            e.currentTarget.releasePointerCapture(pointerId);
          } catch {}

          sheet.classList.remove('is-dragging');

          const scrim = root.querySelector('.scrim');
          if (scrim) {
            scrim.style.opacity = '';
          }

          const totalDeltaY = upEvt.clientY - startY;
          const totalElapsed = Date.now() - startTime;
          const viewportHeight = window.innerHeight;
          const maxHeight = Math.round(viewportHeight - 56);
          const normalHeight = Math.round(viewportHeight * 0.62);
          const currentHeight = startHeight - totalDeltaY;

          // Simple tap: toggle expanded
          if (Math.abs(totalDeltaY) < 6 && totalElapsed < 300) {
            this.toggleExpanded();
            return;
          }

          const midpoint = (normalHeight + maxHeight) / 2;

          // Fast downward flick or dragged down far -> close
          if (velocityY > 0.6 || currentHeight < normalHeight * 0.65) {
            sheet.style.transition = 'transform 250ms cubic-bezier(0.2, 0, 0, 1)';
            sheet.style.transform = 'translateY(100%)';
            setTimeout(() => {
              this.close();
            }, 250);
            return;
          }

          // Fast upward flick or dragged above midpoint -> snap to expanded
          if (velocityY < -0.4 || currentHeight > midpoint) {
            this.setExpanded(true, true);
            return;
          }

          // Otherwise snap to normal height
          this.setExpanded(false, true);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
      };

      const onWheel = (e) => {
        if (e.deltaY < -8) {
          this.setExpanded(true, true);
        } else if (e.deltaY > 8) {
          if (this.isExpanded) {
            this.setExpanded(false, true);
          } else {
            this.close();
          }
        }
      };

      [handleContainer, header].filter(Boolean).forEach(el => {
        el.addEventListener('pointerdown', onPointerDown, { capture: true });
        el.addEventListener('wheel', onWheel, { passive: true });
      });
    };

    if (this.bottomSheetElement.shadowRoot) {
      bind();
    } else {
      customElements.whenDefined('md-bottom-sheet').then(() => {
        setTimeout(bind, 0);
      });
    }
  }

  setupMediaWatcher() {
    if (this.mediaQuery) {
      const handler = () => {
        this.syncActiveSheet();
      };
      if (typeof this.mediaQuery.addEventListener === 'function') {
        this.mediaQuery.addEventListener('change', handler);
      } else if (typeof this.mediaQuery.addListener === 'function') {
        this.mediaQuery.addListener(handler);
      }
    }
  }

  setupLanguageSync() {
    onLanguageChange(() => {
      this.render();
    });
  }

  setupSheetListeners() {
    this.resolveSheets();
    const sheets = [this.sideSheetElement, this.bottomSheetElement].filter(Boolean);
    sheets.forEach(sheet => {
      if (!sheet._hashCloseListenerAdded) {
        sheet.addEventListener('close', () => {
          this.setExpanded(false, false);
          if (window.location.hash.toLowerCase() === '#history') {
            history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        });
        sheet.addEventListener('close-click', () => {
          this.close();
        });
        sheet._hashCloseListenerAdded = true;
      }
    });
  }

  isOpen() {
    const active = this.getActiveSheet();
    return !!(active && active.open);
  }

  open() {
    this.syncActiveSheet();
    this.setupBottomSheetStyles();
    this.setupBottomSheetGestures();
    this.setupSheetListeners();
    this.setExpanded(false, false);
    const active = this.getActiveSheet();
    if (active) {
      this.render();
      active.open = true;
    }
    if (window.location.hash.toLowerCase() !== '#history') {
      window.location.hash = '#history';
    }
  }

  close() {
    this.resolveSheets();
    this.setExpanded(false, false);
    if (this.sideSheetElement) {
      this.sideSheetElement.open = false;
    }
    if (this.bottomSheetElement) {
      this.bottomSheetElement.open = false;
      const sheet = this.bottomSheetElement.shadowRoot?.querySelector('.sheet');
      if (sheet) {
        sheet.style.transform = '';
        sheet.style.height = '';
        sheet.style.transition = '';
      }
    }
    if (window.location.hash.toLowerCase() === '#history') {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  setupHashSync() {
    window.addEventListener('hashchange', () => {
      if (window.location.hash.toLowerCase() === '#history') {
        if (!this.isOpen()) {
          this.open();
        }
      } else {
        if (this.isOpen()) {
          this.close();
        }
      }
    });

    if (window.location.hash.toLowerCase() === '#history') {
      this.open();
      const waiting = [];
      if (!customElements.get('md-side-sheet')) {
        waiting.push(customElements.whenDefined('md-side-sheet'));
      }
      if (!customElements.get('md-bottom-sheet')) {
        waiting.push(customElements.whenDefined('md-bottom-sheet'));
      }
      if (waiting.length > 0) {
        Promise.all(waiting).then(() => {
          if (window.location.hash.toLowerCase() === '#history') {
            this.open();
          }
        });
      }
    }
  }

  setOnSelectItem(callback) {
    this.onSelectItem = callback;
  }

  addItem(sourceText, targetText, sourceLang, targetLang) {
    if (!sourceText || !sourceText.trim()) return;

    const now = Date.now();
    const lastItem = this.history.length > 0 ? this.history[0] : null;

    if (
      lastItem &&
      lastItem.sourceLang === sourceLang &&
      lastItem.targetLang === targetLang &&
      lastItem.rawTimestamp &&
      (now - lastItem.rawTimestamp <= 4000) &&
      isAlmostSameText(lastItem.sourceText, sourceText)
    ) {
      lastItem.sourceText = sourceText;
      lastItem.targetText = targetText;
      lastItem.rawTimestamp = now;
      lastItem.timestamp = t('history.justNow');
      saveHistoryToStorage(this.history);
      this.renderList();
      return;
    }

    const item = {
      id: 'h-' + now,
      sourceText,
      targetText,
      sourceLang,
      targetLang,
      timestamp: t('history.justNow'),
      rawTimestamp: now,
      starred: false
    };
    this.history.unshift(item);
    saveHistoryToStorage(this.history);
    this.renderList();
  }

  clearAll() {
    this.history = [];
    saveHistoryToStorage(this.history);
    this.renderList();
    this.onNotify?.(t('notifications.historyCleared'));
  }

  toggleStar(id) {
    const item = this.history.find(h => h.id === id);
    if (item) {
      item.starred = !item.starred;
      saveHistoryToStorage(this.history);
      this.renderList();
      this.onNotify?.(item.starred ? t('notifications.addedFavorite') : t('notifications.removedFavorite'));
    }
  }

  deleteItem(id) {
    this.history = this.history.filter(h => h.id !== id);
    saveHistoryToStorage(this.history);
    this.renderList();
    this.onNotify?.(t('notifications.itemDeleted'));
  }

  render() {
    this.container.innerHTML = `
      <div class="history-container">
        <div class="history-toolbar">
          <div class="history-search-wrapper">
            <md-text-field
              id="history-search-input"
              variant="outlined"
              placeholder="${escapeAttr(t('history.searchPlaceholder'))}"
              leading-icon="search"
              value="${escapeAttr(this.searchQuery)}"
              style="width: 100%;"
            >
              <md-icon-button
                slot="trailing-icon"
                id="clear-search-btn"
                icon="close"
                aria-label="${escapeAttr(t('history.clearSearchAria'))}"
                style="display: ${this.searchQuery ? 'inline-flex' : 'none'};"
              ></md-icon-button>
            </md-text-field>
          </div>
          <md-icon-button
            id="clear-history-btn"
            icon="delete_sweep"
            aria-label="${escapeAttr(t('history.clearAllAria'))}"
            ${this.history.length === 0 ? 'disabled' : ''}
          ></md-icon-button>
        </div>

        <div id="history-items-list" style="display: flex; flex-direction: column; gap: 12px;"></div>
      </div>
    `;

    // Bind toolbar events once
    const searchInput = this.container.querySelector('#history-search-input');
    const clearSearchBtn = this.container.querySelector('#clear-search-btn');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        if (clearSearchBtn) {
          clearSearchBtn.style.display = this.searchQuery ? 'inline-flex' : 'none';
        }
        this.renderList();
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.searchQuery = '';
        if (searchInput) {
          searchInput.value = '';
          searchInput.setAttribute('value', '');
          const nativeInput = searchInput.shadowRoot?.querySelector('input') || searchInput.inputElement;
          if (nativeInput) nativeInput.value = '';
          searchInput.focus();
        }
        clearSearchBtn.style.display = 'none';
        this.renderList();
      });
    }

    const clearBtn = this.container.querySelector('#clear-history-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearAll());
    }

    this.renderList();
  }

  renderList() {
    const listContainer = this.container.querySelector('#history-items-list');
    if (!listContainer) {
      this.render();
      return;
    }

    const clearBtn = this.container.querySelector('#clear-history-btn');
    if (clearBtn) {
      if (this.history.length === 0) {
        clearBtn.setAttribute('disabled', '');
        clearBtn.disabled = true;
      } else {
        clearBtn.removeAttribute('disabled');
        clearBtn.disabled = false;
      }
    }

    const filtered = this.history.filter(item => {
      const q = this.searchQuery.toLowerCase();
      return item.sourceText.toLowerCase().includes(q) || item.targetText.toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: var(--md-sys-color-outline);">
          <md-icon name="history" size="48" style="opacity: 0.5; margin-bottom: 12px;"></md-icon>
          <h4 style="font-size: 16px; font-weight: 500; color: var(--md-sys-color-on-surface);">${this.history.length === 0 ? t('history.emptyTitle') : t('history.emptyFilteredTitle')}</h4>
          <p style="font-size: 13px; margin-top: 4px;">${this.history.length === 0 ? t('history.emptyDesc') : t('history.emptyFilteredDesc')}</p>
        </div>
      `;
      this.renderTooltips(filtered);
      return;
    }

    listContainer.innerHTML = filtered.map(item => `
      <div class="history-card-item" data-id="${item.id}" role="button" tabindex="0" aria-label="${escapeAttr(t('history.itemAria'))}">
        <div class="history-card-header">
          <span class="history-languages">
            <span>${escapeHtml(item.sourceLang)}</span>
            <md-icon name="arrow_forward" size="16"></md-icon>
            <span>${escapeHtml(item.targetLang)}</span>
          </span>
        </div>
        <div class="history-text-col">
          <div class="history-source">${escapeHtml(item.sourceText)}</div>
          <div class="history-target">${escapeHtml(item.targetText)}</div>
        </div>
        <div class="history-card-footer">
          <span class="history-timestamp">${escapeHtml(item.timestamp)}</span>
          <div class="history-actions">
            <md-icon-button
              id="star-btn-${item.id}"
              class="star-item-btn"
              data-id="${item.id}"
              toggle
              ${item.starred ? 'selected' : ''}
              icon="star_border"
              selected-icon="star"
              aria-label="${escapeAttr(t('history.starItemAria'))}"
            ></md-icon-button>
            <md-icon-button
              id="copy-btn-${item.id}"
              class="copy-item-btn"
              data-text="${escapeAttr(item.targetText)}"
              icon="content_copy"
              aria-label="${escapeAttr(t('history.copyItemAria'))}"
            ></md-icon-button>
            <md-icon-button
              id="delete-btn-${item.id}"
              class="delete-item-btn"
              data-id="${item.id}"
              icon="delete"
              aria-label="${escapeAttr(t('history.deleteItemAria'))}"
            ></md-icon-button>
          </div>
        </div>
      </div>
    `).join('');

    this.renderTooltips(filtered);
    this.bindListEvents();
  }

  bindListEvents() {
    this.container.querySelectorAll('.history-card-item').forEach(card => {
      card.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const item = this.history.find(h => h.id === id);
        if (item && this.onSelectItem) {
          this.onSelectItem(item);
        }
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const id = e.currentTarget.dataset.id;
          const item = this.history.find(h => h.id === id);
          if (item && this.onSelectItem) {
            this.onSelectItem(item);
          }
        }
      });
    });

    this.container.querySelectorAll('.star-item-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        if (id) this.toggleStar(id);
      });
    });

    this.container.querySelectorAll('.copy-item-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const text = e.currentTarget.dataset.text;
        if (text) {
          await navigator.clipboard.writeText(text);
          this.onNotify?.(t('notifications.copiedClipboard'));
        }
      });
    });

    this.container.querySelectorAll('.delete-item-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        if (id) this.deleteItem(id);
      });
    });
  }

  renderTooltips(filtered) {
    let tooltipsContainer = document.getElementById('history-tooltips-container');
    if (!tooltipsContainer) {
      tooltipsContainer = document.createElement('div');
      tooltipsContainer.id = 'history-tooltips-container';
      document.body.appendChild(tooltipsContainer);
    }

    tooltipsContainer.innerHTML = `
      <md-tooltip for="clear-history-btn" value="${t('history.clearAllTooltip')}" position="bottom" show-delay="150"></md-tooltip>
      <md-tooltip for="clear-search-btn" value="${t('history.clearSearchTooltip')}" position="bottom" show-delay="150"></md-tooltip>
      ${filtered.map(item => `
        <md-tooltip for="star-btn-${item.id}" value="${item.starred ? t('history.starTooltipRemove') : t('history.starTooltipAdd')}" position="top" show-delay="150"></md-tooltip>
        <md-tooltip for="copy-btn-${item.id}" value="${t('history.copyTooltip')}" position="top" show-delay="150"></md-tooltip>
        <md-tooltip for="delete-btn-${item.id}" value="${t('history.deleteTooltip')}" position="top" show-delay="150"></md-tooltip>
      `).join('')}
    `;
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m] || m));
}

function escapeAttr(str) {
  return String(str || '').replace(/"/g, '&quot;');
}
