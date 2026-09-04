import en from '../languages/en.json';
import es from '../languages/es.json';
import fr from '../languages/fr.json';
import de from '../languages/de.json';
import it from '../languages/it.json';
import pt from '../languages/pt.json';
import nl from '../languages/nl.json';
import ru from '../languages/ru.json';
import zh from '../languages/zh.json';
import ja from '../languages/ja.json';
import ar from '../languages/ar.json';
import hi from '../languages/hi.json';

export const TRANSLATIONS = {
  en,
  es,
  fr,
  de,
  it,
  pt,
  nl,
  ru,
  zh,
  ja,
  ar,
  hi
};

export const APP_LANGUAGES = [
  { code: 'en', name: 'English', dir: 'ltr' },
  { code: 'es', name: 'Español', dir: 'ltr' },
  { code: 'fr', name: 'Français', dir: 'ltr' },
  { code: 'de', name: 'Deutsch', dir: 'ltr' },
  { code: 'it', name: 'Italiano', dir: 'ltr' },
  { code: 'pt', name: 'Português', dir: 'ltr' },
  { code: 'nl', name: 'Nederlands', dir: 'ltr' },
  { code: 'ru', name: 'Русский', dir: 'ltr' },
  { code: 'zh', name: '中文 (简体)', dir: 'ltr' },
  { code: 'ja', name: '日本語', dir: 'ltr' },
  { code: 'ar', name: 'العربية', dir: 'rtl' },
  { code: 'hi', name: 'हिन्दी', dir: 'ltr' }
];

const STORAGE_KEY = 'app_language';
const listeners = new Set();

/**
 * Detect language code from browser settings
 * @returns {string} Supported language code or 'en'
 */
export function getBrowserLanguage() {
  try {
    const navLang = (navigator.language || navigator.userLanguage || '').split('-')[0].toLowerCase();
    if (navLang && TRANSLATIONS[navLang]) {
      return navLang;
    }
  } catch {
    // fallback
  }
  return 'en';
}

function getSavedLanguagePreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'auto' || (saved && TRANSLATIONS[saved])) {
      return saved;
    }
  } catch {
    // fallback
  }
  return 'auto';
}

let languagePreference = getSavedLanguagePreference();
let currentLanguage = languagePreference === 'auto' ? getBrowserLanguage() : languagePreference;

export function isAutoLanguage() {
  return languagePreference === 'auto';
}

export function getLanguagePreference() {
  return languagePreference;
}

function resolveKey(obj, keyPath) {
  if (!obj || !keyPath) return undefined;
  const parts = keyPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null || typeof current !== 'object') {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function interpolate(template, params) {
  if (typeof template !== 'string') return template;
  if (!params || typeof params !== 'object') return template;

  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}|\{\s*([a-zA-Z0-9_]+)\s*\}/g, (match, p1, p2) => {
    const key = p1 || p2;
    return params[key] !== undefined ? String(params[key]) : match;
  });
}

/**
 * Translate a key with optional parameter substitution
 * @param {string} key - Dot-separated key path, e.g. 'translator.translateBtn'
 * @param {Object} [params] - Replacement variables, e.g. { lang: 'Spanish' }
 * @returns {string}
 */
export function t(key, params) {
  if (!key) return '';

  const activeDict = TRANSLATIONS[currentLanguage];
  let val = resolveKey(activeDict, key);

  if (val === undefined && currentLanguage !== 'en') {
    val = resolveKey(TRANSLATIONS.en, key);
  }

  if (val === undefined) {
    return key;
  }

  return interpolate(val, params);
}

export function getLanguage() {
  return currentLanguage;
}

export function getCurrentLanguageInfo() {
  if (languagePreference === 'auto') {
    const detectedLang = APP_LANGUAGES.find(l => l.code === currentLanguage) || APP_LANGUAGES[0];
    return {
      code: 'auto',
      detectedCode: currentLanguage,
      name: `${t('languages.auto')} (${detectedLang.name})`,
      dir: detectedLang.dir || 'ltr'
    };
  }
  return APP_LANGUAGES.find(l => l.code === currentLanguage) || APP_LANGUAGES[0];
}

export function onLanguageChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Change the application display language
 * @param {string} code - Target language code or 'auto'
 * @param {Function} [onNotify] - Optional notification callback
 */
export function setLanguage(code, onNotify) {
  if (code === 'auto') {
    languagePreference = 'auto';
    currentLanguage = getBrowserLanguage();
    try {
      localStorage.setItem(STORAGE_KEY, 'auto');
    } catch {
      // ignore
    }

    const langInfo = getCurrentLanguageInfo();
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = currentLanguage;
      document.documentElement.dir = langInfo.dir || 'ltr';
      translateDOM(document.body);
    }

    for (const listener of listeners) {
      try {
        listener('auto', langInfo);
      } catch (e) {
        console.error('Language change listener error:', e);
      }
    }

    if (onNotify) {
      onNotify(t('notifications.appLanguageSet', { name: langInfo.name }));
    }
    return;
  }

  const langInfo = APP_LANGUAGES.find(l => l.code === code);
  if (!langInfo || !TRANSLATIONS[code]) return;

  languagePreference = code;
  currentLanguage = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // ignore
  }

  // Update HTML tag lang and direction
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = code;
    document.documentElement.dir = langInfo.dir || 'ltr';
    translateDOM(document.body);
  }

  for (const listener of listeners) {
    try {
      listener(code, langInfo);
    } catch (e) {
      console.error('Language change listener error:', e);
    }
  }

  if (onNotify) {
    onNotify(t('notifications.appLanguageSet', { name: langInfo.name }));
  }
}

/**
 * Automatically translates static DOM elements marked with data-i18n attributes
 * @param {HTMLElement} [root=document.body]
 */
export function translateDOM(root = document.body) {
  if (!root || typeof root.querySelectorAll !== 'function') return;

  // Text content
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });

  // Placeholder
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      el.setAttribute('placeholder', t(key));
      if ('placeholder' in el) {
        el.placeholder = t(key);
      }
    }
  });

  // Aria-label
  root.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria-label');
    if (key) {
      el.setAttribute('aria-label', t(key));
    }
  });

  // Tooltip value
  root.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
    const key = el.getAttribute('data-i18n-tooltip');
    if (key) {
      el.setAttribute('value', t(key));
      el.value = t(key);
    }
  });

  // Headline
  root.querySelectorAll('[data-i18n-headline]').forEach(el => {
    const key = el.getAttribute('data-i18n-headline');
    if (key) {
      el.setAttribute('headline', t(key));
      el.headline = t(key);
    }
  });

  // Label
  root.querySelectorAll('[data-i18n-label]').forEach(el => {
    const key = el.getAttribute('data-i18n-label');
    if (key) {
      el.setAttribute('label', t(key));
      el.label = t(key);
    }
  });

  // Alt
  root.querySelectorAll('[data-i18n-alt]').forEach(el => {
    const key = el.getAttribute('data-i18n-alt');
    if (key) {
      el.setAttribute('alt', t(key));
    }
  });
}

/**
 * Initialize i18n on page load
 */
export function initI18n() {
  const info = getCurrentLanguageInfo();
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = info.code;
    document.documentElement.dir = info.dir || 'ltr';
    translateDOM(document.body);
  }
}

