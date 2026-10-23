import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 4000 },
  // em desenvolvimento, as rotas de conta vão para o servidor do jogo (npm start, porta 8080)
  server: { proxy: { '/api': 'http://localhost:8080' } },
  test: { globals: true, environment: 'node', testTimeout: 120000 },
});
