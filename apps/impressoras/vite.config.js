import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5180,
    host: true,
    proxy: {
      '/api/printers-data': {
        target: 'http://192.168.0.253:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/printers-data/, '/api'),
      },
    },
  },
  resolve: { alias: { '@shared': resolve(__dirname, '../../src') } },
});
