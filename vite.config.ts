import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// The installed Android (Capacitor) build ships every asset inside the APK and is served from
// capacitor://localhost, so a PWA service worker adds no offline benefit and actively risks
// serving a stale app shell across APK updates. CAP_BUILD=1 (set by the cap:* npm scripts)
// omits VitePWA for native builds; the web build keeps it.
const isCapacitorBuild = process.env.CAP_BUILD === '1';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        // The AI features call same-origin /api routes that only exist on the Express server
        // (server.js). Without this proxy they 404 under `npm run dev`, so agent mode can only be
        // exercised against a build. Run `npm start` alongside `npm run dev` to use them locally.
        proxy: {
          '/api': {
            target: process.env.DEV_API_TARGET || 'http://localhost:8080',
            changeOrigin: true,
            // Agent runs stream for minutes; don't let the dev proxy time them out or buffer them.
            timeout: 600000,
            proxyTimeout: 600000,
          },
        },
      },
      plugins: [
        react(),
        ...(isCapacitorBuild ? [] : [
        VitePWA({
          registerType: 'autoUpdate',
          injectRegister: 'auto',
          includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
          workbox: {
            maximumFileSizeToCacheInBytes: 5000000 // 5MB to accommodate the large chunk
          },
          manifest: {
            name: 'Teacher Planner',
            short_name: 'Planner',
            description: 'Plan lessons, meetings and projects — your way.',
            theme_color: '#5d7752',
            background_color: '#faf7f2',
            display: 'standalone',
            icons: [
              {
                src: '/pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: '/pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png'
              },
              {
                src: '/pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable'
              }
            ]
          }
        })
        ]),
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
