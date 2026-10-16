const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

function load() {
  const source = fs.readFileSync(path.join(__dirname, '../src/features/project-intake/download-status.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports });
  return module.exports;
}

function loadApi() {
  const source = fs.readFileSync(path.join(__dirname, '../src/features/project-intake/api.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  let authFetch = async () => ({ ok: true, blob: async () => new Blob(['pdf']) });
  const sandbox = {
    module,
    exports: module.exports,
    Blob,
    FormData,
    require(request) {
      if (request.endsWith('/apiBase')) return { API_BASE_URL: 'http://test/' };
      if (request.endsWith('/session')) return { authFetch: (...args) => authFetch(...args) };
      if (request.endsWith('/download-status')) return load();
      throw new Error(`unexpected import: ${request}`);
    },
    setAuthFetch(value) { authFetch = value; },
  };
  vm.runInNewContext(output, sandbox);
  return { api: module.exports, setAuthFetch: sandbox.setAuthFetch };
}

test('classifies request failures as generation failures', () => {
  assert.equal(load().exportFailureCode('request'), 'EXPORT_FAILED');
});

test('classifies a generated blob failure as a download failure', () => {
  assert.equal(load().exportFailureCode('download'), 'DOWNLOAD_FAILED');
});

test('downloads a generated PDF blob successfully', async () => {
  const loaded = loadApi();
  let requested;
  loaded.setAuthFetch(async (...args) => { requested = args; return { ok: true, blob: async () => new Blob(['pdf']) }; });
  const blob = await loaded.api.downloadApi('/tasks/1/package.pdf');
  assert.equal(await blob.text(), 'pdf');
  assert.equal(requested[0], 'http://test/api/tasks/1/package.pdf');
});

test('reports generation and post-generation download failures separately', async () => {
  const loaded = loadApi();
  loaded.setAuthFetch(async () => ({ ok: false }));
  await assert.rejects(loaded.api.downloadApi('/tasks/1/package.pdf'), (error) => error.code === 'EXPORT_FAILED');
  loaded.setAuthFetch(async () => ({ ok: true, blob: async () => { throw new Error('blob failed'); } }));
  await assert.rejects(loaded.api.downloadApi('/tasks/1/package.pdf'), (error) => error.code === 'DOWNLOAD_FAILED');
});
