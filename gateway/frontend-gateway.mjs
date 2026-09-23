// Local dev reverse proxy: one port (8080) for every HireOS frontend, routed by
// subsystem path prefix. Pure passthrough — each frontend's own Vite `base` already
// matches its prefix, so no path rewriting happens here (see PORTS.md "本地统一网关").
import http from 'node:http';
import httpProxy from 'http-proxy';

const PORT = Number(process.env.FRONTEND_GATEWAY_PORT || 8080);

const ROUTES = [
  { prefix: '/interview', target: 'http://127.0.0.1:5173', label: 'Interview' },
  { prefix: '/screening', target: 'http://127.0.0.1:5174', label: 'Screening' },
  { prefix: '/jd', target: 'http://127.0.0.1:5175', label: 'JD' },
  { prefix: '/written', target: 'http://127.0.0.1:5178', label: 'Written Test' },
];

function matchRoute(url) {
  return ROUTES.find((r) => url === r.prefix || url.startsWith(r.prefix + '/'));
}

const proxy = httpProxy.createProxyServer({ ws: true });
proxy.on('error', (err, _req, res) => {
  console.error('[frontend-gateway] proxy error:', err.message);
  if (res && res.writeHead && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Bad gateway: upstream not reachable (${err.message}). Is that subsystem's frontend running?`);
  }
});

const LANDING_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><title>HireOS — local gateway</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 64px auto; color: #111827; }
  h1 { font-size: 20px; }
  ul { padding-left: 0; list-style: none; }
  li { margin-bottom: 8px; }
  a { display: block; padding: 12px 16px; border: 1px solid #e5e7eb; border-radius: 10px; text-decoration: none; color: #0d9488; font-weight: 600; }
  a:hover { background: #f8fafc; }
  .tiny { color: #6b7280; font-size: 12px; margin-top: 24px; }
</style></head>
<body>
  <h1>HireOS — local frontend gateway</h1>
  <ul>
    ${ROUTES.map((r) => `<li><a href="${r.prefix}/">${r.label} — ${r.prefix}/</a></li>`).join('\n    ')}
  </ul>
  <div class="tiny">Only links whose subsystem is actually running will load — start it with <code>scripts/dev.sh start &lt;name&gt;</code>.</div>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(LANDING_HTML);
    return;
  }
  const route = matchRoute(req.url);
  if (!route) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`No frontend registered for ${req.url}`);
    return;
  }
  proxy.web(req, res, { target: route.target });
});

server.on('upgrade', (req, socket, head) => {
  const route = matchRoute(req.url);
  if (!route) {
    socket.destroy();
    return;
  }
  proxy.ws(req, socket, head, { target: route.target });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[frontend-gateway] listening on http://127.0.0.1:${PORT}`);
  for (const r of ROUTES) console.log(`  ${r.prefix}/*  ->  ${r.target}${r.prefix}/*`);
});
