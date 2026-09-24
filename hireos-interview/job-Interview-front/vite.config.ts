import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Overridable at Docker build time (see Dockerfile's VITE_BASE_PATH build
// arg) -- the remote deploy nests everything one level deeper
// (/hireos/interview/) behind the shared production nginx, see PORTS.md
// "远程部署". Local dev and the local unified gateway both rely on the
// `/interview/` default staying unchanged.
const BASE_PATH = process.env.VITE_BASE_PATH || '/interview/';

// Isolate only the SDK document; leave the main app and OAuth popup unchanged.
const zoomIsolation = (): Plugin => {
  const install = (server: { middlewares: { use: (handler: (req: { url?: string }, res: { setHeader: (name: string, value: string) => void }, next: () => void) => void) => void } }) => {
    server.middlewares.use((req, res, next) => {
      if (req.url?.split('?')[0] === `${BASE_PATH}zoom-meeting/index.html`) {
        res.setHeader('Document-Isolation-Policy', 'isolate-and-credentialless');
      }
      next();
    });
  };
  return { name: 'zoom-document-isolation', configureServer: install, configurePreviewServer: install };
};

export default defineConfig({
  base: BASE_PATH,
  plugins: [react(), tailwindcss(), zoomIsolation()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      // Prefix matches `base` above (see PORTS.md "本地统一网关") -- the app calls
      // `${import.meta.env.BASE_URL}api/...`, i.e. `/interview/api/...`, and this
      // strips the subsystem prefix back off before forwarding to the real backend,
      // which only knows its own `/api` prefix.
      '/interview/api': {
        target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/interview/, ''),
      },
    },
  },
});
