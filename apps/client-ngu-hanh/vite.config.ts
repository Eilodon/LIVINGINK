import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import fs from 'fs'
import path from 'path'

const wgslPlugin = () => ({
  name: 'wgsl-loader',
  enforce: 'pre' as const,
  load(id: string) {
    if (id.endsWith('.wgsl') || id.includes('.wgsl')) {
      const filePath = id.split('?')[0];
      try {
        const code = fs.readFileSync(filePath, 'utf-8');
        return {
          code: `export default ${JSON.stringify(code)};`,
          map: null
        };
      } catch (e) {
        console.error("WGSL Load Error", e);
        return null;
      }
    }
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    wgslPlugin(),
    wasm(),
    topLevelAwait(),
    react()
  ],
  resolve: {
    alias: {
      '@cjr/engine': path.resolve(__dirname, '../../packages/engine/src/index.ts'),
      'ngu-hanh': path.resolve(__dirname, '../../packages/games/ngu-hanh'),
    }
  },
  optimizeDeps: {
    exclude: ['core-rust', '@cjr/engine'],
    esbuildOptions: {
      loader: {
        '.wgsl': 'text'
      }
    }
  }
})
