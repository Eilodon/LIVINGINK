import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      test: {
        environment: 'jsdom',
        include: ['tests/**/*.test.ts'],
        setupFiles: ['./tests/setupTests.vitest.ts'],
        globals: true
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('pixi.js') || id.includes('@pixi')) return 'pixi';
            }
          }
        }
      }
    };
});
