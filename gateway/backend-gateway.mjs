// Local dev reverse proxy: one port (8090) for every HireOS backend, routed by
// subsystem path prefix. This is a *second*, independent entry point for curl/Postman/
// external API callers — browser JS never talks to it directly (it relative-fetches
// its own frontend origin instead, see PORTS.md "本地统一网关"), so no CORS handling
// is needed here.
import http from 'node:http';
import httpProxy from 'http-proxy';

const PORT = Number(process.env.BACKEND_GATEWAY_PORT || 8090);

// Each backend keeps its own internal prefix (`api` or, for core-record, `api/v1`) —
// the caller always includes it after the subsystem segment, e.g.
// `/screening/api/jobs` or `/core-record/api/v1/jobs`. We only strip the leading
// subsystem segment before forwarding; the rest of the path passes through unchanged.
const ROUTES = [
  { prefix: '/interview', target: 'http://127.0.0.1:3001' },
  { prefix: '/screening', target: 'http://127.0.0.1:3002' },
  { prefix: '/jd', target: 'http://127.0.0.1:3005' },
  { prefix: '/written', target: 'http://127.0.0.1:3008' },
  { prefix: '/core-record', target: 'http://127.0.0.1:3004' },
];

function matchRoute(url) {
  return ROUTES.find((r) => url === r.prefix || url.startsWith(r.prefix + '/'));
}

const proxy = httpProxy.createProxyServer();
proxy.on('error', (err, _req, res) => {
  console.error('[backend-gateway] proxy error:', err.message);
  if (res && res.writeHead && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 'BAD_GATEWAY', message: `Upstream backend not reachable: ${err.message}` }));
  }
});

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      service: 'hireos-backend-gateway',
      routes: ROUTES.map((r) => ({ prefix: r.prefix, target: r.target })),
    }, null, 2));
    return;
  }
  const route = matchRoute(req.url);
  if (!route) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 'NOT_FOUND', message: `No backend registered for ${req.url}` }));
    return;
  }
  req.url = req.url.slice(route.prefix.length) || '/';
  proxy.web(req, res, { target: route.target });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[backend-gateway] listening on http://127.0.0.1:${PORT}`);
  for (const r of ROUTES) console.log(`  ${r.prefix}/*  ->  ${r.target}/* (prefix stripped)`);
});
