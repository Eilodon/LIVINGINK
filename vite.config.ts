/// <reference types="node" />
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import glsl from 'vite-plugin-glsl'; // EIDOLON-V: REAL PLUGIN - not fake!

export default defineConfig({
  server: {
    port: 5173,
    host: '0.0.0.0'
  },
  plugins: [
    react(),
    glsl() // REAL PLUGIN with #include support
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // Standard alias
      '@services': path.resolve(__dirname, './services'),
      '@components': path.resolve(__dirname, './components'),
      '@assets': path.resolve(__dirname, './assets'),
    }
  },
  build: {
    target: 'esnext', // SOTA 2026: Optimize for modern browsers
    minify: 'esbuild',
    sourcemap: false, // Disable sourcemaps in production for smaller bundle
    rollupOptions: {
      output: {
        manualChunks: {
          // EIDOLON-V P3: Better chunk splitting for faster initial load
          'pixi-core': ['pixi.js'],           // PixiJS renderer
          'colyseus': ['colyseus.js'],        // Networking
          'ui-framework': ['react', 'react-dom'],
        }
      }
    },
    // EIDOLON-V P3: Increase warning limit since game engines are inherently large
    chunkSizeWarningLimit: 700
  }
});
