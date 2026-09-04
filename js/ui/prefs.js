import { SUPPORTED_LANGUAGES, AUTO_DETECT_LANGUAGE } from '../translation/index.js';
import { t, getBrowserLanguage } from '../i18.js';

export const RECENT_SOURCE_KEY = 'translator_recent_source_langs';
export const RECENT_TARGET_KEY = 'translator_recent_target_langs';
export const DEFAULT_RECENT_SOURCE = ['en', 'es', 'fr', 'de'];

export const PREF_SOURCE_LANG_KEY = 'translator_source_lang';
export const PREF_TARGET_LANG_KEY = 'translator_target_lang';
export const PREF_AUTO_DETECT_KEY = 'translator_auto_detect';
export const PREF_TARGET_SET_KEY = 'translator_target_lang_user_set';

export function getLocalizedLanguageName(lang) {
  if (!lang) return '';
  if (lang.code === 'auto') return t('languages.auto');
  const localized = t(`languages.${lang.code}`);
  return (localized && localized !== `languages.${lang.code}`) ? localized : lang.name;
}

export function getDefaultTargetLang() {
  const browserCode = getBrowserLanguage();
  return SUPPORTED_LANGUAGES.find(l => l.code === browserCode) ||
         SUPPORTED_LANGUAGES.find(l => l.code === 'en') ||
         SUPPORTED_LANGUAGES[0];
}

export function getDefaultRecentTarget() {
  const defaultTarget = getDefaultTargetLang();
  const base = [defaultTarget.code, 'en', 'es', 'fr', 'de'];
  return [...new Set(base)].filter(code => SUPPORTED_LANGUAGES.some(l => l.code === code)).slice(0, 4);
}

export function saveLanguagePreferences(isAutoDetect, sourceLang, targetLang) {
  try {
    localStorage.setItem(PREF_AUTO_DETECT_KEY, isAutoDetect ? 'true' : 'false');
    if (sourceLang && sourceLang.code) {
      localStorage.setItem(PREF_SOURCE_LANG_KEY, isAutoDetect ? 'auto' : sourceLang.code);
    }
    if (targetLang && targetLang.code) {
      localStorage.setItem(PREF_TARGET_LANG_KEY, targetLang.code);
      localStorage.setItem(PREF_TARGET_SET_KEY, 'true');
    }
  } catch (e) {
    console.warn('Failed to save language preferences:', e);
  }
}

export function loadLanguagePreferences() {
  try {
    const savedAuto = localStorage.getItem(PREF_AUTO_DETECT_KEY);
    const savedSource = localStorage.getItem(PREF_SOURCE_LANG_KEY);
    const savedTarget = localStorage.getItem(PREF_TARGET_LANG_KEY);
    const hasUserSetTarget = localStorage.getItem(PREF_TARGET_SET_KEY) === 'true';

    let isAutoDetect = true;
    let sourceLang = AUTO_DETECT_LANGUAGE;
    let targetLang = getDefaultTargetLang();

    if (savedAuto !== null) {
      isAutoDetect = savedAuto === 'true';
    }

    if (savedSource && savedSource !== 'auto') {
      const foundSource = SUPPORTED_LANGUAGES.find(l => l.code === savedSource);
      if (foundSource) {
        sourceLang = foundSource;
      }
    } else if (savedSource === 'auto') {
      isAutoDetect = true;
      sourceLang = AUTO_DETECT_LANGUAGE;
    }

    if (!isAutoDetect && sourceLang.code === 'auto') {
      sourceLang = SUPPORTED_LANGUAGES.find(l => l.code === 'en') || SUPPORTED_LANGUAGES[0];
    }

    if (savedTarget && hasUserSetTarget) {
      const foundTarget = SUPPORTED_LANGUAGES.find(l => l.code === savedTarget);
      if (foundTarget) {
        targetLang = foundTarget;
      }
    }

    return { isAutoDetect, sourceLang, targetLang, hasUserSetTarget };
  } catch (e) {
    console.warn('Failed to load language preferences:', e);
  }
  return {
    isAutoDetect: true,
    sourceLang: AUTO_DETECT_LANGUAGE,
    targetLang: getDefaultTargetLang(),
    hasUserSetTarget: false
  };
}

export function loadRecentLangs(storageKey, defaultList) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter(c => typeof c === 'string' && SUPPORTED_LANGUAGES.some(l => l.code === c));
        if (valid.length > 0) {
          const combined = [...valid];
          for (const d of defaultList) {
            if (!combined.includes(d)) combined.push(d);
          }
          return combined.slice(0, 10);
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load recent languages from storage:', e);
  }
  return [...defaultList];
}

export function saveRecentLangs(storageKey, list) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(list.slice(0, 10)));
  } catch (e) {
    console.warn('Failed to save recent languages to storage:', e);
  }
}

export function escapeAttr(str) {
  return String(str || '').replace(/"/g, '&quot;');
}

export function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m] || m));
}

