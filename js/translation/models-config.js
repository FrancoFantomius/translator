/**
 * Language pair mapping for Helsinki-NLP (Opus-MT) models pre-converted to ONNX
 * for browser execution via @huggingface/transformers.
 */
export const OPUS_MT_PAIRS = {
  // English to Other
  'en-af': 'Xenova/opus-mt-en-af',
  'en-ar': 'Xenova/opus-mt-en-ar',
  'en-cs': 'Xenova/opus-mt-en-cs',
  'en-da': 'Xenova/opus-mt-en-da',
  'en-de': 'Xenova/opus-mt-en-de',
  'en-es': 'Xenova/opus-mt-en-es',
  'en-fi': 'Xenova/opus-mt-en-fi',
  'en-fr': 'Xenova/opus-mt-en-fr',
  'en-hi': 'Xenova/opus-mt-en-hi',
  'en-hu': 'Xenova/opus-mt-en-hu',
  'en-id': 'Xenova/opus-mt-en-id',
  'en-it': 'Xenova/opus-mt-en-it',
  'en-ja': 'Xenova/opus-mt-en-jap',
  'en-nl': 'Xenova/opus-mt-en-nl',
  'en-ro': 'Xenova/opus-mt-en-ro',
  'en-ru': 'Xenova/opus-mt-en-ru',
  'en-sv': 'Xenova/opus-mt-en-sv',
  'en-uk': 'Xenova/opus-mt-en-uk',
  'en-vi': 'Xenova/opus-mt-en-vi',
  'en-xh': 'Xenova/opus-mt-en-xh',
  'en-zh': 'Xenova/opus-mt-en-zh',

  // Other to English
  'af-en': 'Xenova/opus-mt-af-en',
  'ar-en': 'Xenova/opus-mt-ar-en',
  'cs-en': 'Xenova/opus-mt-cs-en',
  'da-en': 'Xenova/opus-mt-da-en',
  'de-en': 'Xenova/opus-mt-de-en',
  'es-en': 'Xenova/opus-mt-es-en',
  'et-en': 'Xenova/opus-mt-et-en',
  'fi-en': 'Xenova/opus-mt-fi-en',
  'fr-en': 'Xenova/opus-mt-fr-en',
  'hi-en': 'Xenova/opus-mt-hi-en',
  'hu-en': 'Xenova/opus-mt-hu-en',
  'id-en': 'Xenova/opus-mt-id-en',
  'it-en': 'Xenova/opus-mt-it-en',
  'ja-en': 'Xenova/opus-mt-ja-en',
  'ko-en': 'Xenova/opus-mt-ko-en',
  'nl-en': 'Xenova/opus-mt-nl-en',
  'pl-en': 'Xenova/opus-mt-pl-en',
  'ru-en': 'Xenova/opus-mt-ru-en',
  'sv-en': 'Xenova/opus-mt-sv-en',
  'th-en': 'Xenova/opus-mt-th-en',
  'tr-en': 'Xenova/opus-mt-tr-en',
  'uk-en': 'Xenova/opus-mt-uk-en',
  'vi-en': 'Xenova/opus-mt-vi-en',
  'xh-en': 'Xenova/opus-mt-xh-en',
  'zh-en': 'Xenova/opus-mt-zh-en',

  // Non-English Direct Pairs
  'da-de': 'Xenova/opus-mt-da-de',
  'de-es': 'Xenova/opus-mt-de-es',
  'de-fr': 'Xenova/opus-mt-de-fr',
  'es-de': 'Xenova/opus-mt-es-de',
  'es-fr': 'Xenova/opus-mt-es-fr',
  'es-it': 'Xenova/opus-mt-es-it',
  'es-ru': 'Xenova/opus-mt-es-ru',
  'fi-de': 'Xenova/opus-mt-fi-de',
  'fr-de': 'Xenova/opus-mt-fr-de',
  'fr-es': 'Xenova/opus-mt-fr-es',
  'fr-ro': 'Xenova/opus-mt-fr-ro',
  'fr-ru': 'Xenova/opus-mt-fr-ru',
  'it-es': 'Xenova/opus-mt-it-es',
  'it-fr': 'Xenova/opus-mt-it-fr',
  'nl-fr': 'Xenova/opus-mt-nl-fr',
  'no-de': 'Xenova/opus-mt-no-de',
  'ro-fr': 'Xenova/opus-mt-ro-fr',
  'ru-es': 'Xenova/opus-mt-ru-es',
  'ru-fr': 'Xenova/opus-mt-ru-fr',
  'ru-uk': 'Xenova/opus-mt-ru-uk',
  'uk-ru': 'Xenova/opus-mt-uk-ru'
};

export const DEFAULT_MULTILINGUAL_MODEL = 'Xenova/m2m100_418M';

/**
 * Checks if a direct Helsinki-NLP (Opus-MT) model is available for the given language pair.
 * @param {string} srcCode
 * @param {string} tgtCode
 * @returns {boolean}
 */
export function isOpusPairAvailable(srcCode, tgtCode) {
  if (!srcCode || !tgtCode) return false;
  const pairKey = `${srcCode.toLowerCase().trim()}-${tgtCode.toLowerCase().trim()}`;
  return Boolean(OPUS_MT_PAIRS[pairKey]);
}

/**
 * Returns model metadata for the given language pair, selecting Helsinki-NLP (Opus-MT)
 * when available and defaulting to M2M-100 otherwise.
 * @param {string} srcCode
 * @param {string} tgtCode
 * @returns {object}
 */
export function getModelInfo(srcCode, tgtCode) {
  const src = (srcCode || 'en').toLowerCase().trim();
  const tgt = (tgtCode || 'es').toLowerCase().trim();
  const pairKey = `${src}-${tgt}`;
  const opusModel = OPUS_MT_PAIRS[pairKey];

  if (opusModel) {
    const srcUpper = src.toUpperCase();
    const tgtUpper = tgt.toUpperCase();
    return {
      id: `opus_${src}_${tgt}`,
      modelName: opusModel,
      type: 'opus-mt',
      title: `Helsinki-NLP Opus-MT (${srcUpper} → ${tgtUpper})`,
      shortTitle: `Opus-MT (${srcUpper} → ${tgtUpper})`,
      description: `Direct bilingual neural network optimized for high-speed ${srcUpper} to ${tgtUpper} translation.`,
      size: '95 MB',
      parameters: '77M (ONNX Q8)',
      backend: 'WASM (CPU SIMD)',
      isOpus: true,
      srcLang: src,
      tgtLang: tgt
    };
  }

  return {
    id: 'm2m100_418m',
    modelName: DEFAULT_MULTILINGUAL_MODEL,
    type: 'm2m100',
    title: 'M2M-100 Multilingual (418M)',
    shortTitle: 'M2M-100',
    description: 'Universal direct translation between 100 languages without English pivot.',
    size: '485 MB',
    parameters: '418M (ONNX Q8)',
    backend: 'WASM (CPU SIMD)',
    isOpus: false,
    srcLang: src,
    tgtLang: tgt
  };
}

