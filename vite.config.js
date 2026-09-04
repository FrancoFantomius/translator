import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: './',
  resolve: {
    alias: [
      {
        find: /^cld3-asm$/,
        replacement: fileURLToPath(new URL('./js/translation/cld3-loader.js', import.meta.url))
      }
    ]
  },
  server: {
    port: 3000,
    open: false,
    headers: {
      // Required for Transformers.js / ONNX Runtime Web multi-threading (SharedArrayBuffer)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  optimizeDeps: {
    include: [
      '@francofantomius/material-components',
      'emscripten-wasm-loader'
    ]
  }
});
