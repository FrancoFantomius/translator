import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const LANGUAGES_DIR = path.join(ROOT_DIR, 'languages');
const SOURCE_CODE_DIRS = [
  path.join(ROOT_DIR, 'js'),
  path.join(ROOT_DIR, 'index.html')
];

function flattenKeys(obj, prefix = '') {
  let keys = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(keys, flattenKeys(value, fullKey));
    } else {
      keys[fullKey] = value;
    }
  }
  return keys;
}

function getAllFiles(dir, exts = ['.js', '.html']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  const stat = fs.statSync(dir);
  if (stat.isFile()) {
    return [dir];
  }

  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const fileStat = fs.statSync(fullPath);
    if (fileStat && fileStat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        results = results.concat(getAllFiles(fullPath, exts));
      }
    } else if (exts.some(ext => file.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function scanKeysInCode(files) {
  const referencedKeys = new Set();

  const patterns = [
    /\bt\(\s*['"`]([a-zA-Z0-9_.]+)['"`]/g,
    /data-i18n(?:-[a-z-]+)?=["']([a-zA-Z0-9_.]+)["']/g
  ];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        referencedKeys.add(match[1]);
      }
    }
  }

  return referencedKeys;
}

function checkLocalizations() {
  console.log('🔍 Checking localization consistency...\n');

  const enPath = path.join(LANGUAGES_DIR, 'en.json');
  if (!fs.existsSync(enPath)) {
    console.error('❌ Error: languages/en.json source file not found!');
    process.exit(1);
  }

  let enJson;
  try {
    enJson = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
  } catch (err) {
    console.error(`❌ Error parsing languages/en.json: ${err.message}`);
    process.exit(1);
  }

  const enKeys = flattenKeys(enJson);
  const enKeySet = new Set(Object.keys(enKeys));
  console.log(`📘 Source English dictionary has ${enKeySet.size} keys.\n`);

  const langFiles = fs.readdirSync(LANGUAGES_DIR).filter(f => f.endsWith('.json'));
  let hasErrors = false;

  console.log('--- Language Dictionary Parity Checks ---');
  for (const file of langFiles) {
    const langCode = path.basename(file, '.json');
    const filePath = path.join(LANGUAGES_DIR, file);

    let content;
    try {
      content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      console.error(`❌ [${langCode}] Failed to parse ${file}: ${err.message}`);
      hasErrors = true;
      continue;
    }

    const langKeys = flattenKeys(content);
    const langKeySet = new Set(Object.keys(langKeys));

    const missingKeys = [...enKeySet].filter(k => !langKeySet.has(k));
    const extraKeys = [...langKeySet].filter(k => !enKeySet.has(k));
    const emptyKeys = [...langKeySet].filter(k => {
      const v = langKeys[k];
      return v === '' || v === null || v === undefined;
    });

    if (missingKeys.length === 0 && extraKeys.length === 0 && emptyKeys.length === 0) {
      console.log(`✅ [${langCode.padEnd(5)}] 100% complete (${langKeySet.size} keys)`);
    } else {
      hasErrors = true;
      console.error(`❌ [${langCode.padEnd(5)}] Issues detected:`);
      if (missingKeys.length > 0) {
        console.error(`   - Missing ${missingKeys.length} keys: ${missingKeys.slice(0, 5).join(', ')}${missingKeys.length > 5 ? '...' : ''}`);
      }
      if (extraKeys.length > 0) {
        console.error(`   - Extra ${extraKeys.length} keys: ${extraKeys.slice(0, 5).join(', ')}${extraKeys.length > 5 ? '...' : ''}`);
      }
      if (emptyKeys.length > 0) {
        console.error(`   - Empty ${emptyKeys.length} keys: ${emptyKeys.slice(0, 5).join(', ')}${emptyKeys.length > 5 ? '...' : ''}`);
      }
    }
  }

  console.log('\n--- Codebase Key Reference Validation ---');
  const codeFiles = SOURCE_CODE_DIRS.flatMap(dir => getAllFiles(dir));
  const referencedKeys = scanKeysInCode(codeFiles);
  console.log(`Found ${referencedKeys.size} distinct i18n keys referenced in code.`);

  const missingFromEn = [...referencedKeys].filter(k => !enKeySet.has(k));
  if (missingFromEn.length > 0) {
    hasErrors = true;
    console.error(`❌ ${missingFromEn.length} keys used in code are missing in languages/en.json:`);
    for (const k of missingFromEn) {
      console.error(`   - ${k}`);
    }
  } else {
    console.log('✅ All keys referenced in code exist in languages/en.json');
  }

  console.log('\n-----------------------------------------');
  if (hasErrors) {
    console.error('❌ Localization check failed. Please resolve the errors above.\n');
    process.exit(1);
  } else {
    console.log('🎉 All localizations are valid, complete, and synchronized!\n');
    process.exit(0);
  }
}

checkLocalizations();

