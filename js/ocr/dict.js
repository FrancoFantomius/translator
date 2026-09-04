/**
 * PP-OCR Character Dictionary and Decoding utilities
 * Covers Latin, Digits, Punctuation, and Common Multilingual Characters
 */

// Common PP-OCR character set (standard Latin + digits + punctuation + common CJK)
export const DEFAULT_PP_OCR_CHARSET = 
  '0123456789' +
  'abcdefghijklmnopqrstuvwxyz' +
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~ ' +
  'àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ' +
  'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß' +
  'ćčđšžĆČĐŠŽąćęłńóśźżĄĆĘŁŃÓŚŹŻ' +
  'αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ' +
  'абвгдеёжзийклмнопрстуфхцчшщъыьэюя' +
  'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ' +
  '的一是不了人我在有他这为之大来以个中上们到说国和地也子时道出而要于就下得可你年生自会那后着成主自发如前通';

export const DEFAULT_PP_OCR_DICT = ['blank', ...DEFAULT_PP_OCR_CHARSET.split(''), ' '];

/**
 * Parse character dictionary from PP-OCR inference.yml
 * @param {string} ymlContent
 * @returns {Array<string>}
 */
export function parseDictFromYml(ymlContent) {
  if (!ymlContent || typeof ymlContent !== 'string') {
    return DEFAULT_PP_OCR_DICT;
  }

  const lines = ymlContent.split(/\r?\n/);
  const dict = ['blank'];
  let inDict = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('character_dict:')) {
      inDict = true;
      continue;
    }

    if (inDict) {
      if (line.startsWith('  - ')) {
        // Raw character item
        let char = line.substring(4);
        if (char.startsWith("'") && char.endsWith("'") && char.length >= 2) {
          char = char.slice(1, -1);
        } else if (char.startsWith('"') && char.endsWith('"') && char.length >= 2) {
          char = char.slice(1, -1);
        }
        dict.push(char);
      } else if (line.trim() !== '' && !line.startsWith('  ')) {
        break;
      }
    }
  }

  // Ensure trailing space is added according to PaddleOCR convention
  if (dict.length > 1 && !dict.includes(' ')) {
    dict.push(' ');
  }

  return dict.length > 10 ? dict : DEFAULT_PP_OCR_DICT;
}

/**
 * CTC Greedy Decoder for Recognition Logits
 * @param {Float32Array|Array} probabilities - Shape [T, num_classes]
 * @param {number} timeSteps - T
 * @param {number} numClasses - Number of classes
 * @param {Array<string>} dict - Character dictionary
 * @returns {{ text: string, confidence: number }}
 */
export function ctcGreedyDecode(probabilities, timeSteps, numClasses, dict = DEFAULT_PP_OCR_DICT) {
  let text = '';
  let totalScore = 0;
  let count = 0;
  let lastIndex = 0;

  for (let t = 0; t < timeSteps; t++) {
    let maxProb = -Infinity;
    let maxIdx = 0;
    const offset = t * numClasses;

    for (let c = 0; c < numClasses; c++) {
      const prob = probabilities[offset + c];
      if (prob > maxProb) {
        maxProb = prob;
        maxIdx = c;
      }
    }

    // CTC Rule: ignore blank (0) and consecutive duplicates
    if (maxIdx > 0 && maxIdx !== lastIndex) {
      const char = dict[maxIdx] !== undefined ? dict[maxIdx] : '';
      if (char && char !== 'blank') {
        text += char;
        totalScore += maxProb;
        count++;
      }
    }
    lastIndex = maxIdx;
  }

  const confidence = count > 0 ? Math.min(1.0, Math.max(0.0, totalScore / count)) : 0;
  return { text: text.trim(), confidence };
}
