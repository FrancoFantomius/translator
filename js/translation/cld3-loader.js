import { getModuleLoader } from 'emscripten-wasm-loader';
import { cldLoader } from 'cld3-asm/dist/esm/cldLoader.js';
import cld3Default, * as cld3Namespace from 'cld3-asm/dist/esm/lib/browser/cld3.js';

export { log, enableLogger } from 'cld3-asm/dist/esm/util/logger.js';
export { LanguageCode } from 'cld3-asm/dist/esm/languageCode.js';

/**
 * Resolves the Emscripten factory function from the imported cld3 module.
 * In ES module bundlers (Vite / Rollup / esbuild), CommonJS exports may be wrapped
 * in an ESM namespace object ({ default: fn, Module: fn }), causing `cld3-asm`'s
 * native `loadModule` to pass an object instead of a function to `getModuleLoader`,
 * throwing `TypeError: runtimeModule is not a function`.
 *
 * @param {any} imported
 * @returns {Function|null}
 */
function resolveFactory(imported) {
  if (typeof imported === 'function') {
    return imported;
  }
  if (imported && typeof imported.default === 'function') {
    return imported.default;
  }
  if (imported && typeof imported.Module === 'function') {
    return imported.Module;
  }
  if (typeof window !== 'undefined' && typeof window.Module === 'function') {
    return window.Module;
  }
  if (typeof self !== 'undefined' && typeof self.Module === 'function') {
    return self.Module;
  }
  return null;
}

/**
 * Loads and initializes the cld3 WASM binary.
 *
 * @param {object} [initOptions]
 * @param {number} [initOptions.timeout=10000] - Timeout to wait for wasm compilation & load
 * @returns {Promise<import('cld3-asm').CldFactory>}
 */
export async function loadModule(initOptions = {}) {
  const { timeout = 10000 } = initOptions;

  const factory = resolveFactory(cld3Default) || resolveFactory(cld3Namespace);
  if (!factory) {
    throw new TypeError(
      `Failed to resolve cld3-asm WASM factory function. Received default type: ${typeof cld3Default}, namespace type: ${typeof cld3Namespace}`
    );
  }

  const moduleLoader = await getModuleLoader(
    (runtime) => cldLoader(runtime),
    factory,
    undefined,
    { timeout }
  );

  return moduleLoader();
}

export const loadCld3 = loadModule;

