// Records real-model runs of the M3 upload flow for the replay tests (#79 #80). Not part of `npm test`:
//   npm run build && node --env-file=.env test/support/record-m3.cjs
const fs = require('node:fs');
const path = require('node:path');
const { ConfigService } = require('@nestjs/config');
const { LlmProvider } = require('../../dist/copilot/llm-provider');
const { FIXTURES, runUpload, recordingLlm } = require('./m3-harness.cjs');

const CASES = [
  ['docx-1', 'sales-manager.docx'], ['docx-2', 'sales-manager.docx'],
  ['pdf-1', 'sales-manager.pdf'], ['pdf-2', 'sales-manager.pdf'],
  ['txt-1', 'sales-manager.txt'], ['txt-2', 'sales-manager.txt'],
  ['injected', 'sales-manager-injected.docx'],
  ['renamed-docx', 'sales-manager.docx', 'cjk-jd.docx'],
  ['zh-pdf', 'sales-manager-zh.pdf', 'sales-zh.pdf'], ['zh-pdf-renamed', 'sales-manager-zh.pdf', 'cjk-jd.pdf'],
];

(async () => {
  const real = new LlmProvider(new ConfigService());
  const recordings = {};
  for (const [name, file, uploadName] of CASES) {
    const llm = recordingLlm(real);
    const result = await runUpload(llm, file, uploadName);
    recordings[name] = { file, uploadName: uploadName ?? file, model: process.env.HIREOS_AI_MODEL, calls: llm.calls.map(({ skill, raw }) => ({ skill, raw })), result };
    const f = result.fields;
    console.log(name.padEnd(15), JSON.stringify([f.title, f.location, f.employmentType, (f.mustHave || []).join(' | ')]), llm.calls.map((c) => c.skill).join('+'));
  }
  fs.writeFileSync(path.join(FIXTURES, 'recorded.json'), JSON.stringify(recordings, null, 2) + '\n');
})().catch((error) => { console.error(error); process.exitCode = 1; });
