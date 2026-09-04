import { SUPPORTED_LANGUAGES, AUTO_DETECT_LANGUAGE } from '../translation/index.js';

export function readUrlParams() {
  const params = new URLSearchParams(window.location.search);
  let isAutoDetect = false;
  let sourceLang = null;
  let targetLang = null;
  let sourceText = '';
  let hadLangsParam = false;

  const langsParam = params.get('langs');
  if (langsParam) {
    const parts = langsParam.split(/[-|,:_]/);
    if (parts.length >= 2) {
      hadLangsParam = true;
      const c1 = parts[0].trim().toLowerCase();
      const c2 = parts[1].trim().toLowerCase();
      if (c1 === 'auto' || c1 === 'autodetect' || c1 === 'auto-detect') {
        isAutoDetect = true;
        sourceLang = AUTO_DETECT_LANGUAGE;
      } else {
        const src = SUPPORTED_LANGUAGES.find(l => l.code.toLowerCase() === c1 || l.name.toLowerCase() === c1);
        if (src) {
          isAutoDetect = false;
          sourceLang = src;
        }
      }
      const tgt = SUPPORTED_LANGUAGES.find(l => l.code.toLowerCase() === c2 || l.name.toLowerCase() === c2);
      if (tgt) {
        targetLang = tgt;
      }
    }
  }

  const textParam = params.get('text');
  if (textParam !== null) {
    sourceText = textParam;
  }

  return {
    hadLangsParam,
    isAutoDetect,
    sourceLang,
    targetLang,
    sourceText
  };
}

export function parseUrlParamsForState(currentSourceLang, currentTargetLang, isCurrentlyAuto) {
  const params = new URLSearchParams(window.location.search);
  let changed = false;
  let newIsAuto = isCurrentlyAuto;
  let newSourceLang = currentSourceLang;
  let newTargetLang = currentTargetLang;
  let newSourceText = null;

  const langsParam = params.get('langs');
  if (langsParam) {
    const parts = langsParam.split(/[-|,:_]/);
    if (parts.length >= 2) {
      const c1 = parts[0].trim().toLowerCase();
      const c2 = parts[1].trim().toLowerCase();
      if (c1 === 'auto' || c1 === 'autodetect' || c1 === 'auto-detect') {
        if (!newIsAuto) {
          newIsAuto = true;
          newSourceLang = AUTO_DETECT_LANGUAGE;
          changed = true;
        }
      } else {
        const src = SUPPORTED_LANGUAGES.find(l => l.code.toLowerCase() === c1 || l.name.toLowerCase() === c1);
        if (src && (newIsAuto || src.code !== newSourceLang.code)) {
          newIsAuto = false;
          newSourceLang = src;
          changed = true;
        }
      }
      const tgt = SUPPORTED_LANGUAGES.find(l => l.code.toLowerCase() === c2 || l.name.toLowerCase() === c2);
      if (tgt && tgt.code !== newTargetLang.code) {
        newTargetLang = tgt;
        changed = true;
      }
    }
  }

  const textParam = params.get('text');
  if (textParam !== null) {
    newSourceText = textParam;
  }

  return { changed, isAutoDetect: newIsAuto, sourceLang: newSourceLang, targetLang: newTargetLang, sourceText: newSourceText };
}

export function getShareUrl(isAutoDetect, sourceLang, targetLang, sourceText) {
  const pathname = window.location.pathname.replace(/\/index\.html$/, '/');
  const url = new URL(window.location.origin + pathname);
  const srcCode = isAutoDetect ? 'auto' : (sourceLang ? sourceLang.code : 'auto');
  url.searchParams.set('langs', `${srcCode}-${targetLang ? targetLang.code : 'en'}`);
  if (sourceText) {
    url.searchParams.set('text', sourceText);
  }
  return url.toString();
}

