import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { resolveDeploymentConfiguration } from './src/lib/deployment-config.ts';

export default defineConfig(({ command, mode }) => {
  const environment = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const deployment = resolveDeploymentConfiguration(environment, {
    productionBuild: command === 'build',
    vercelEnvironment: environment.VERCEL_ENV,
  });
  const base = environment.VITE_BASE_PATH ?? '/';

  return {
    base,
    define: {
      'import.meta.env.VITE_DEPLOYMENT_MODE': JSON.stringify(deployment.mode),
    },
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
        start_url: base,
        scope: base,
        categories: ['education', 'productivity'],
        icons: [
          { src: `${base}icons/pwa-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${base}icons/pwa-512.png`, sizes: '512x512', type: 'image/png' },
          { src: `${base}icons/pwa-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: `${base}index.html`,
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
  };
});
