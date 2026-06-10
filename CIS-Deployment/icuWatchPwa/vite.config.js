import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 7031,
    host: true,
    proxy: {
      '/api/alarm-config': {
        target: 'http://localhost:7020',
        changeOrigin: true,
      },
      '/api/alarm': {
        target: 'http://localhost:7020',
        changeOrigin: true,
      },
      '/api/notification': {
        target: 'http://localhost:7030',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/notification/, '/api'),
      },
      '/api/vitals': {
        target: 'http://localhost:7020',
        changeOrigin: true,
      },
      '/api/patients': {
        target: 'http://localhost:7020',
        changeOrigin: true,
      },
    },
  },
});
