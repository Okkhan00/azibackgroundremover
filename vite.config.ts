import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// base './' keeps every URL relative so the same build works on
// Cloudflare Pages, Vercel, a sub-folder, and inside the Capacitor Android WebView.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registered manually in src/main.tsx (skipped inside the Android app)
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'AIZAZ Background Remover Pro by AZI CREATION',
        short_name: 'BG Remover',
        description: 'On-device AI background remover. Your photos never leave your device.',
        theme_color: '#0a0e1f',
        background_color: '#0a0e1f',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Only the app shell is pre-cached. Big AI files are cached the first time they
        // are actually used, so nobody downloads a model they never choose.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        globIgnores: ['models/**', '**/*.wasm'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/models\/|\.wasm$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'azi-ai-files-v1',
              expiration: { maxEntries: 16 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  worker: { format: 'es' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
