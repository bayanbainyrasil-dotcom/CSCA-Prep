import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const firestoreDouble = fileURLToPath(new URL('./src/test/firebase/firestore.ts', import.meta.url));
const functionsDouble = fileURLToPath(new URL('./src/test/firebase/functions.ts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // The trusted backend in `functions/src` is exercised by these tests exactly
      // as it runs in production, so its Firebase entry points are swapped for
      // in-memory doubles. This file is loaded by Vitest only: `vite.config.ts`
      // has no such alias, so the shipped bundle is unaffected.
      { find: /^firebase-admin\/app$/, replacement: functionsDouble },
      { find: /^firebase-admin\/auth$/, replacement: functionsDouble },
      { find: /^firebase-admin\/firestore$/, replacement: firestoreDouble },
      { find: /^firebase-functions$/, replacement: functionsDouble },
      { find: /^firebase-functions\/params$/, replacement: functionsDouble },
      { find: /^firebase-functions\/v2$/, replacement: functionsDouble },
      { find: /^firebase-functions\/v2\/https$/, replacement: functionsDouble },
    ],
  },
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
