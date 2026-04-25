import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174, // kiosk dùng 5173 — tránh conflict khi chạy 2 dev server
    host: '0.0.0.0', // listen mọi interface → điện thoại cùng WiFi truy cập được
  },
});
