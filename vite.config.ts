import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/icon.svg', 'offline.html'],
      manifest: {
        name: 'CSCA Prep',
        short_name: 'CSCA',
        description: 'Adaptive Mathematics and Physics preparation for CSCA.',
        theme_color: '#101a3a',
        background_color: '#f5f7fb',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['education', 'productivity'],
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/__/],
        // Keep installation light: route JavaScript and fonts are cached on first use,
        // while the HTML shell, styles, icons, and offline fallback are precached.
        globPatterns: ['**/*.{css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(?:www\.googleapis\.com|firestore\.googleapis\.com|identitytoolkit\.googleapis\.com)/,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ request, url }) => url.origin === self.location.origin
              && ['script', 'style', 'font'].includes(request.destination),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'csca-app-assets-v1',
              expiration: { maxEntries: 140, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'csca-images-v1',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    sourcemap: false,
    cssCodeSplit: true,
  },
});
