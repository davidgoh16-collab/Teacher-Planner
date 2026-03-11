import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
          workbox: {
            maximumFileSizeToCacheInBytes: 5000000 // 5MB to accommodate the large chunk
          },
          manifest: {
            name: 'Teacher Planner',
            short_name: 'Planner',
            description: 'A comprehensive teacher planner for the 2025/2026 academic year',
            theme_color: '#16a34a',
            background_color: '#0f172a',
            display: 'standalone',
            icons: [
              {
                src: 'https://www.google.com/s2/favicons?domain=google.com&sz=192',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: 'https://www.google.com/s2/favicons?domain=google.com&sz=512',
                sizes: '512x512',
                type: 'image/png'
              }
            ]
          }
        })
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
