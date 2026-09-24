import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    // Overridable at Docker build time (VITE_BASE_PATH build arg) -- see
    // PORTS.md "远程部署" for why the real-server deploy needs a deeper prefix.
    base: process.env.VITE_BASE_PATH || '/screening/',
    plugins: [react(), tailwindcss()],
    server: {
      host: '127.0.0.1',
      port: 5174,
      strictPort: true,
      proxy: {
        // Prefix matches `base` above (see PORTS.md "本地统一网关") -- the app calls
        // `${import.meta.env.BASE_URL}api/...`, i.e. `/screening/api/...`, and this
        // strips the subsystem prefix back off before forwarding to the real backend,
        // which only knows its own `/api` prefix.
        '/screening/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3002',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/screening/, ''),
        },
      },
    },
  };
});
