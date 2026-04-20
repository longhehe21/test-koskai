import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    publicDir: resolve('public'),
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
        '@components': resolve('src/renderer/components'),
        '@pages': resolve('src/renderer/pages'),
        '@services': resolve('src/renderer/services'),
        '@store': resolve('src/renderer/store'),
        '@styles': resolve('src/renderer/styles'),
        '@assets': resolve('public/assets'),
        '@hooks': resolve('src/renderer/hooks'),
      },
    },
  },
});
