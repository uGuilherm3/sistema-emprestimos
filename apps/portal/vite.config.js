import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss(), nodePolyfills()],
  server: { port: 5177, host: true },
  resolve: { alias: { '@shared': resolve(__dirname, '../../src') } },
});
