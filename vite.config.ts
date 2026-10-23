import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_PAGES_BASE || '/',
  plugins: [react()],
  optimizeDeps: {
    // Prebundle the Pascal stack: howler, polygon-clipping and use-sync-external-store all
    // ship CJS/UMD-only entries that the browser cannot import as ESM named/default exports.
    include: [
      '@pascal-app/core',
      '@pascal-app/viewer',
      '@pascal-app/nodes',
      'howler',
      'next/link',
      // zustand imports these by their ".js" specifier, so the key must match it exactly.
      'use-sync-external-store/shim/with-selector.js',
      'use-sync-external-store/shim/index.js',
    ],
  },
  resolve: {
    alias: {
      // polygon-clipping's `browser` field points at its UMD bundle, which has no ESM
      // default export; @pascal-app/core imports it as one. Force its real ESM build.
      'polygon-clipping': 'polygon-clipping/dist/polygon-clipping.esm.js',
    },
  },
});
