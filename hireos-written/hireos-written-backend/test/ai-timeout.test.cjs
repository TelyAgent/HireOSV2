// #120 -- the AI call's timeout covers the whole exchange: a provider that answers its headers at once and then
// trickles the body is cut off within the budget; every outcome clears the timer and keeps its error.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { callAiForJson, AiCallError } = require('../dist/ai/ai-json-client');
const { z } = require('zod');

function provider(handler) {
  const server = http.createServer(handler);
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}
const config = (port, seconds = '0.5') => ({ get: (key, d) => ({ HIREOS_AI_BASE_URL: `http://127.0.0.1:${port}/v1`, HIREOS_AI_API_KEY: 'k', HIREOS_AI_MODEL: 'm', HIREOS_AI_TIMEOUT_SECONDS: seconds })[key] ?? d });
const answer = (obj) => JSON.stringify({ choices: [{ message: { content: JSON.stringify(obj) } }] });

test('#120 AC-1: headers at once, then a slow body — stopped at the budget', async () => {
  const server = await provider((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.write('{"choices":[');
    const drip = setInterval(() => res.write(' '), 100); // never finishes on its own
    req.on('close', () => clearInterval(drip));
    res.on('close', () => clearInterval(drip));
  });
  const started = Date.now();
  try {
    await assert.rejects(callAiForJson(config(server.address().port), 's', 'u', z.object({})), (e) => e instanceof AiCallError && e.message === 'AI_TIMEOUT');
    const took = Date.now() - started;
    assert.ok(took < 1500, `stopped after ${took} ms with a 500 ms budget`);
  } finally {
    server.closeAllConnections(); server.close();
  }
});

test('#120 AC-2: success, HTTP error, invalid body and a slow error body keep their errors and leave no timer behind', async () => {
  let mode = 'ok';
  const server = await provider((req, res) => {
    if (mode === 'ok') { res.writeHead(200); res.end(answer({ a: 1 })); }
    else if (mode === 'http') { res.writeHead(503); res.end('busy'); }
    else if (mode === 'invalid') { res.writeHead(200); res.end('not json'); }
    else { res.writeHead(500); res.write('err'); }
  });
  const port = server.address().port;
  // Track the budget timers this client starts (5 s here) and whether each is cleared.
  const started = new Set();
  const realSet = globalThis.setTimeout;
  const realClear = globalThis.clearTimeout;
  globalThis.setTimeout = (fn, ms, ...rest) => { const t = realSet(fn, ms, ...rest); if (ms === 5000) started.add(t); return t; };
  globalThis.clearTimeout = (t) => { started.delete(t); return realClear(t); };
  try {
    assert.deepEqual(await callAiForJson(config(port, '5'), 's', 'u', z.object({ a: z.number() })), { a: 1 });
    mode = 'http';
    await assert.rejects(callAiForJson(config(port, '5'), 's', 'u', z.object({})), (e) => e instanceof AiCallError && /^AI_HTTP_503: busy/.test(e.message));
    mode = 'invalid';
    await assert.rejects(callAiForJson(config(port, '5'), 's', 'u', z.object({})), (e) => e instanceof AiCallError && e.message === 'AI_INVALID_RESPONSE_BODY');
    assert.equal(started.size, 0, 'every budget timer was cleared');
    mode = 'slow-error';
    await assert.rejects(callAiForJson(config(port, '0.3'), 's', 'u', z.object({})), (e) => e instanceof AiCallError && e.message === 'AI_TIMEOUT');
  } finally {
    globalThis.setTimeout = realSet; globalThis.clearTimeout = realClear;
    server.closeAllConnections(); server.close();
  }
});
