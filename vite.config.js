import { defineConfig } from 'vite';
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Cornerstone's dependency graph includes xmlbuilder2 through its browser
// imaging/tooling stack. xmlbuilder2's callback builder extends Node's
// EventEmitter. Vite otherwise externalizes the Node `events` builtin in a
// browser build, leaving EventEmitter undefined at runtime. Force the
// browser-compatible `events` npm package instead.
export default defineConfig({
  plugins: [viteCommonjs()],
  assetsInclude: ['**/*.wasm'],
  resolve: {
    alias: [
      { find: /^events$/, replacement: path.resolve(rootDir, 'node_modules/events/events.js') },
      { find: /^node:events$/, replacement: path.resolve(rootDir, 'node_modules/events/events.js') },
    ],
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 2200,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  optimizeDeps: {
    exclude: ['@cornerstonejs/dicom-image-loader'],
    include: ['dicom-parser', 'events'],
  },
  worker: {
    format: 'es',
  },
});
