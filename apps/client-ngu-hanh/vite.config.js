import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@cjr/engine': path.resolve(__dirname, '../../packages/engine'),
            '@cjr/shared': path.resolve(__dirname, '../../packages/shared/src'),
            '@ngu-hanh': path.resolve(__dirname, '../../packages/games/ngu-hanh'),
        }
    }
});
