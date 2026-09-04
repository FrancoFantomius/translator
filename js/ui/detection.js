import { languageDetector, getLanguageByCode } from '../translation/index.js';

/**
 * Counts words in a string using Intl.Segmenter if available, falling back to whitespace splitting.
 * @param {string} text
 * @returns {number}
 */
export function getWordCount(text) {
  if (!text || typeof text !== 'string') return 0;
  const clean = text.trim();
  if (!clean) return 0;
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    try {
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
      let count = 0;
      for (const seg of segmenter.segment(clean)) {
        if (seg.isWordLike) count++;
      }
      return count;
    } catch {
      // Fallback to whitespace split
    }
  }
  return clean.split(/\s+/).filter(Boolean).length;
}

/**
 * Detects the language of a text string using the language detector service.
 * @param {string} text
 * @returns {Promise<object|null>} Detected language object or null
 */
export async function detectCurrentLanguage(text) {
  if (!text || !text.trim()) {
    return null;
  }
  try {
    const res = await languageDetector.detect(text);
    if (res && res.code) {
      return res.lang || getLanguageByCode(res.code);
    }
  } catch (e) {
    console.warn('Language detection error:', e);
  }
  return null;
}

