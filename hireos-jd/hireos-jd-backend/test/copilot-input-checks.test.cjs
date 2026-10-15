// #75 / #82 -- inputs Copilot can't use are refused up front with a reason, before any AI run.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PayloadTooLargeException } = require('@nestjs/common');
const { titleVariantsInputSchema } = require('../dist/copilot/types');
const { AttachmentTooLargeFilter, CopilotController, MAX_ATTACHMENT_BYTES } = require('../dist/copilot/copilot.controller');

test('#75: a title needs at least one letter; short or digit-bearing real titles pass', () => {
  for (const title of ['', '   ', '123', '???', '— —']) {
    assert.equal(titleVariantsInputSchema.safeParse({ title }).success, false, `"${title}" should be refused`);
  }
  for (const title of ['CFO', 'UI设计师', '3D 设计师', 'Finance Manager']) {
    assert.equal(titleVariantsInputSchema.safeParse({ title }).success, true, `"${title}" should pass`);
  }
});

test('#82: an over-limit upload is a coded 413 that states the limit', () => {
  let status; let body;
  const host = { switchToHttp: () => ({ getResponse: () => ({ status: (code) => { status = code; return { json: (b) => { body = b; } }; } }) }) };
  new AttachmentTooLargeFilter().catch(new PayloadTooLargeException('File too large'), host);
  assert.equal(status, 413);
  assert.equal(body.code, 'ATTACHMENT_TOO_LARGE');
  assert.equal(body.maxBytes, MAX_ATTACHMENT_BYTES);
  assert.match(body.message, /10 MB/);
});

test('#82: a 0-byte file is refused as empty before any extraction or AI run', () => {
  let called = false;
  const controller = new CopilotController({ processAttachment: () => { called = true; } });
  const file = { originalname: 'empty.txt', mimetype: 'text/plain', size: 0, buffer: Buffer.alloc(0) };
  assert.throws(
    () => controller.uploadAttachment({ identity: {} }, {}, 'c1', file),
    (e) => e.getStatus() === 400 && e.getResponse().code === 'ATTACHMENT_FILE_EMPTY',
  );
  assert.equal(called, false);
});

test('#90: a 200-character manual title is accepted, 201 is a field error on fields.title', () => {
  const { setFieldsInputSchema } = require('../dist/copilot/types');
  const body = (title) => ({ fields: { title, location: 'Shanghai', headcount: 1, responsibilities: ['a'], mustHave: ['b'] }, label: `Create Manually: ${title}` });
  assert.equal(setFieldsInputSchema.safeParse(body('x'.repeat(200))).success, true);
  const refused = setFieldsInputSchema.safeParse(body('x'.repeat(201)));
  assert.equal(refused.success, false);
  assert.deepEqual(refused.error.issues.map((i) => i.path.join('.')), ['fields.title']);
});
