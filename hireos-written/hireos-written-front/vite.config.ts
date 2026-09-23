import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    base: '/written/',
    plugins: [react(), tailwindcss()],
    server: {
      port: 5178,
      strictPort: true,
      proxy: {
        // Prefix matches `base` above (see PORTS.md "本地统一网关") -- once this app
        // makes real API calls it should call `${import.meta.env.BASE_URL}api/...`,
        // i.e. `/written/api/...`; this strips the subsystem prefix back off before
        // forwarding to the real backend, which only knows its own `/api` prefix.
        '/written/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3008',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/written/, ''),
        },
      },
    },
  };
});
