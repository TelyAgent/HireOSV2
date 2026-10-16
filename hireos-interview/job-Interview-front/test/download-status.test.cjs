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

test('classifies request failures as generation failures', () => {
  assert.equal(load().exportFailureCode('request'), 'EXPORT_FAILED');
});

test('classifies a generated blob failure as a download failure', () => {
  assert.equal(load().exportFailureCode('download'), 'DOWNLOAD_FAILED');
});
