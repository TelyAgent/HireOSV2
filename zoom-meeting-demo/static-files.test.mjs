// #126 -- the demo's static route reads only files inside public/: parent segments, their encoded variants,
// absolute paths, backslashes, query strings and symbolic links pointing outside can't reach anything else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolveStaticPath } from './static-files.mjs';

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'zoom-static-'));
  const root = join(dir, 'public');
  mkdirSync(join(root, 'assets'), { recursive: true });
  writeFileSync(join(root, 'index.html'), '<h1>demo</h1>');
  writeFileSync(join(root, 'assets', 'app.js'), 'console.log(1)');
  writeFileSync(join(dir, 'canary.txt'), 'CANARY-OUTSIDE-PUBLIC');
  symlinkSync(join(dir, 'canary.txt'), join(root, 'link-out.txt'));
  return { dir, root };
}

test('#126 AC-1: parent segments and encoded variants never reach a file outside public/', async () => {
  const { dir, root } = sandbox();
  try {
    for (const path of ['/../canary.txt', '/assets/../../canary.txt', '/%2e%2e/canary.txt', '/%2E%2E%2Fcanary.txt', '/..%2fcanary.txt', '/%252e%252e/canary.txt',
      '/..\\canary.txt', '/%5c..%5ccanary.txt', `/${join(dir, 'canary.txt')}`, '//etc/passwd', '/%00index.html', '/%E0%A4%A']) {
      assert.equal(await resolveStaticPath(root, path), null, path);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('#126 AC-2/AC-3: the home page and assets are served; a symbolic link out of public/ and directories are not', async () => {
  const { dir, root } = sandbox();
  try {
    assert.ok((await resolveStaticPath(root, '/')).endsWith('index.html'));
    assert.ok((await resolveStaticPath(root, '/assets/app.js')).endsWith('app.js'));
    assert.equal(await resolveStaticPath(root, '/link-out.txt'), null, 'symlink pointing outside');
    assert.equal(await resolveStaticPath(root, '/assets'), null, 'a directory is not a file');
    assert.equal(await resolveStaticPath(root, '/missing.js'), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('#126 AC-2: over HTTP, a query string is not part of the file name and a refused path leaks nothing', async () => {
  const { dir, root } = sandbox();
  const server = createServer(async (req, res) => {
    const file = await resolveStaticPath(root, new URL(req.url, 'http://localhost').pathname);
    if (!file) { res.writeHead(404); res.end('Not found'); return; }
    res.end(await readFile(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const home = await fetch(`${base}/?file=../canary.txt`);
    assert.equal(await home.text(), '<h1>demo</h1>');
    for (const path of ['/..%2fcanary.txt', '/%2e%2e/canary.txt', '/link-out.txt']) {
      const res = await fetch(base + path);
      const body = await res.text();
      assert.equal(res.status, 404, path);
      assert.ok(!body.includes('CANARY'), path);
    }
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
