import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// ตัวเกม (กติกา/ข้อมูลกระดาน/ห้อง) อยู่ใน backend/src/game และใช้ร่วมกันทั้งสองฝั่ง
const gameDir = fileURLToPath(new URL('../backend/src/game', import.meta.url));

export default defineConfig({
  base: './',
  plugins: [react()],
  envPrefix: ['VITE_', 'REACT_APP_'],
  resolve: {
    alias: { '@game': gameDir },
  },
  server: {
    port: 5173,
    fs: { allow: ['..'] },
    proxy: {
      '/socket.io': { target: 'http://localhost:3001', ws: true },
      '/api': { target: 'http://localhost:3001' },
    },
  },
  build: {
    outDir: 'build',
  },
});
