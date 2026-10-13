import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    // Overridable at Docker build time (VITE_BASE_PATH build arg) -- see PORTS.md "远程部署".
    base: process.env.VITE_BASE_PATH || '/account/',
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5179,
      strictPort: true,
      proxy: {
        // `/account/api/...` -> identity backend `/api/...` (see PORTS.md "本地统一网关").
        '/account/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3003',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/account/, ''),
          // Backend-to-backend only; never reachable through a browser-facing proxy.
          bypass: (req) => (req.url?.startsWith('/account/api/internal') ? false : undefined),
        },
      },
    },
  };
});
