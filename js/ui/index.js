export { TranslatorView } from './view.js';
export {
  SUPPORTED_LANGUAGES,
  AUTO_DETECT_LANGUAGE
} from '../translation/index.js';
export {
  getLocalizedLanguageName,
  getDefaultTargetLang,
  getDefaultRecentTarget
} from './prefs.js';
export { TranslatorSpeechController } from './speech.js';
export { TranslatorOcrController } from './ocr.js';
export { TranslatorLanguagesController } from './languages.js';
export { TranslatorSourceController } from './source.js';
export { TranslatorOutputController } from './output.js';
export { detectCurrentLanguage, getWordCount } from './detection.js';
