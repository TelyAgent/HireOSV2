const { test } = require('node:test');
const assert = require('node:assert/strict');
const { changedImportedFields } = require('../dist/copilot/import-verbatim');
const { CopilotService } = require('../dist/copilot/copilot.service');
const { memoryDb } = require('./support/m3-harness.cjs');
const source = 'Customer Success Manager\nHelp customers adopt the product.\nResponsibilities\n- Support onboarding.\n- Track adoption.\n- Resolve customer issues.\nRequirements\n- Clear written communication.\n- No CRM experience required.\nNice to have\n- SQL familiarity.';
const fields = { title: 'Customer Success Manager', roleSummary: 'Help customers adopt the product.', responsibilities: ['Support onboarding.', 'Track adoption.', 'Resolve customer issues.'], mustHave: ['Clear written communication.', 'No CRM experience required.'], niceToHave: ['SQL familiarity.'] };
const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: ['hr'] };
test('#83 imported prose must match complete original lines, preserving negation and language', () => {
  assert.deepEqual(changedImportedFields(fields, source), []);
  for (const item of ['CRM experience required.', '具备 CRM 经验。', 'Excellent customer relationship skills.']) {
    assert.deepEqual(changedImportedFields({ ...fields, mustHave: [item] }, source), ['mustHave']);
  }
  assert.deepEqual(changedImportedFields({ ...fields, responsibilities: ['Support   onboarding.'] }, source), []);
});
test('#83 faithful extraction persists the source fields and an identical request replays', async () => {
  const db = memoryDb();
  const svc = new CopilotService(db, {}, {}, {}, {});
  let calls = 0;
  svc.runFileExtractTurn = async () => { calls++; return { fields, reply: 'Imported original text.', phase: 'ready_to_confirm', missingFields: [] }; };
  const input = { text: source };
  const meta = { idempotencyKey: 'original' };
  const first = await svc.importSource(identity, 'c1', input, meta);
  const second = await svc.importSource(identity, 'c1', input, meta);
  assert.deepEqual(first.fields.responsibilities, fields.responsibilities);
  assert.deepEqual(first.fields.mustHave, fields.mustHave);
  assert.deepEqual(first.fields.niceToHave, fields.niceToHave);
  assert.deepEqual(second.fields, first.fields);
  assert.equal(calls, 1);
  assert.equal(db.messages.length, 2);
});
test('#83 a changed extraction is rejected before any conversation mutation', async () => {
  const db = memoryDb();
  const svc = new CopilotService(db, {}, {}, {}, {});
  svc.runFileExtractTurn = async () => ({ fields: { ...fields, mustHave: [...fields.mustHave, 'CRM expertise required.'] }, reply: 'Extracted', phase: 'ready_to_confirm', missingFields: [] });
  await assert.rejects(svc.importSource(identity, 'c1', { text: source }, { idempotencyKey: 'rejected' }), e => e.getResponse().code === 'IMPORT_CONTENT_CHANGED');
  assert.deepEqual(db.conv.fields, {});
  assert.equal(db.conv.stateRevision, 1);
  assert.equal(db.messages.length, 0);
});
