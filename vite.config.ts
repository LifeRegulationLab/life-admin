import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Text recognition runs on the device, so its engine and English data ship with the app under ocr/.
const need = createRequire(import.meta.url);
const OCR_FILES: Record<string, string> = {
  'ocr/worker.min.js': need.resolve('tesseract.js/dist/worker.min.js'),
  'ocr/tesseract-core-simd-lstm.wasm.js': need.resolve('tesseract.js-core/tesseract-core-simd-lstm.wasm.js'),
  'ocr/tesseract-core-lstm.wasm.js': need.resolve('tesseract.js-core/tesseract-core-lstm.wasm.js'),
  'ocr/eng.traineddata.gz': need.resolve('@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'),
};

function ocrFiles(): Plugin {
  return {
    name: 'ocr-files',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = OCR_FILES[(req.url ?? '').replace(/^\/+/, '').split('?')[0] ?? ''];
        if (!path) return next();
        res.setHeader('Content-Type', path.endsWith('.gz') ? 'application/octet-stream' : 'text/javascript');
        res.end(readFileSync(path));
      });
    },
    generateBundle() {
      for (const [fileName, path] of Object.entries(OCR_FILES)) this.emitFile({ type: 'asset', fileName, source: readFileSync(path) });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), ocrFiles()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'functions/src/**/*.test.ts'],
  },
});
