// #392 -- a round's transcript error shows as what happened and what to do, in the interface language.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

function load() {
  const source = fs.readFileSync(path.join(__dirname, '../src/features/live-interview/transcript-errors.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports });
  return module.exports;
}
const { transcriptErrorText } = load();

test('the known codes read as a reason and a next step in both languages, never the bare code', () => {
  for (const code of ['TRANSCRIPT_LANGUAGE_UNSUPPORTED', 'RTMS_CREDENTIALS_REQUIRED', 'TRANSCRIPT_CONFIG_FAILED', 'JOIN_REJECTED', 'JOIN_FAILED', 'RTMS_START_FAILED', 'ZM_RTMS_CLIENT_REQUIRED']) {
    const zh = transcriptErrorText(code, 'zh');
    const en = transcriptErrorText(code, 'en');
    assert.ok(!zh.includes(code) && !en.includes(code), code);
    assert.match(zh, /[一-鿿]/, code);
    assert.match(en, /\b(Restart|Ask|Contact|Set)\b/, code);
  }
  assert.match(transcriptErrorText('TRANSCRIPT_LANGUAGE_UNSUPPORTED', 'zh'), /面试语言/);
});

test('a Zoom start refusal keeps its status code; an unknown code shows after a general explanation', () => {
  assert.match(transcriptErrorText('RTMS_START_403_2001', 'en'), /Zoom refused.*RTMS_START_403_2001/);
  assert.equal(transcriptErrorText('SOMETHING_NEW', 'en'), 'The transcript connection failed. Restart the meeting. (SOMETHING_NEW)');
  assert.equal(transcriptErrorText(null, 'zh'), '转写连接出错。请重新开始会议。');
});
