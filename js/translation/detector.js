import { loadModule } from './cld3-loader.js';
import { SUPPORTED_LANGUAGES, getLanguageByCode } from './languages.js';

const CODE_NORMALIZATION_MAP = {
  'zh-Latn': 'zh',
  'ru-Latn': 'ru',
  'bg-Latn': 'bg',
  'el-Latn': 'el',
  'hi-Latn': 'hi',
  'ja-Latn': 'ja',
  'iw': 'he',
  'jw': 'jv',
  'fil': 'tl'
};

export class LanguageDetector {
  constructor() {
    this.cldFactory = null;
    this.initPromise = null;
    this.isReady = false;
  }

  /**
   * Initializes the cld3-asm WASM module
   */
  async init() {
    if (this.cldFactory) return this.cldFactory;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.cldFactory = await loadModule();
        this.isReady = true;
        return this.cldFactory;
      } catch (err) {
        console.error('Failed to load cld3-asm WASM module:', err);
        throw err;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Normalizes cld3 language code to standard language code supported in the application
   */
  normalizeLanguageCode(cldCode) {
    if (!cldCode || cldCode === 'und') return null;
    const mapped = CODE_NORMALIZATION_MAP[cldCode] || cldCode.toLowerCase();
    const found = SUPPORTED_LANGUAGES.find(l => l.code === mapped);
    return found ? found.code : mapped;
  }

  /**
   * Detects the language of a given text using cld3-asm
   * @param {string} text - The input text to identify
   * @param {object} [options]
   * @param {number} [options.minBytes=0] - Minimum bytes (set to 0 for short phrases)
   * @param {number} [options.maxBytes=1500] - Maximum bytes to analyze
   * @returns {Promise<{code: string, name: string, lang: object, probability: number, isReliable: boolean}|null>}
   */
  async detect(text, options = {}) {
    if (!text || typeof text !== 'string') return null;
    const clean = text.trim();
    if (!clean || clean.length < 2) return null;

    // Check if text has actual alphabetical/language characters (not just digits/punctuation)
    if (!/[^\d\s\p{P}\p{S}]/u.test(clean)) {
      return null;
    }

    try {
      const factory = await this.init();
      const minBytes = options.minBytes !== undefined ? options.minBytes : 0;
      const maxBytes = options.maxBytes !== undefined ? options.maxBytes : 2000;
      
      const identifier = factory.create(minBytes, maxBytes);
      let result = null;
      try {
        result = identifier.findLanguage(clean);
      } finally {
        identifier.dispose();
      }

      if (result && result.language && result.language !== 'und') {
        const normalizedCode = this.normalizeLanguageCode(result.language);
        if (normalizedCode) {
          const lang = getLanguageByCode(normalizedCode);
          return {
            code: normalizedCode,
            name: lang ? lang.name : normalizedCode,
            lang: lang || { code: normalizedCode, name: normalizedCode },
            probability: result.probability,
            isReliable: result.is_reliable,
            rawCode: result.language
          };
        }
      }
    } catch (err) {
      console.warn('Language detection failed:', err);
    }

    return null;
  }
}

export const languageDetector = new LanguageDetector();

