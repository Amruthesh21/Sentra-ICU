import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:7020',
      '/device-ingestion': {
        target: 'http://localhost:7050',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/device-ingestion/, ''),
      },
    },
  },
});
