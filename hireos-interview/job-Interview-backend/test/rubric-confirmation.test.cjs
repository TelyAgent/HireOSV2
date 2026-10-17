const { test } = require('node:test');
const assert = require('node:assert/strict');
const { RubricService } = require('../dist/rubric/rubric.service');

test('#254: confirmation belongs to the rubric version and its original JD, not the current JD', async () => {
  let rubric = { id: 'r1', versionNumber: 1, status: 'confirmed', confirmedBy: 'reviewer-1', confirmedAt: new Date('2026-10-01T00:00:00Z'), sourceParseJobId: 'parse-1', cards: [] };
  const db = {
    job: { findFirst: async () => ({ jdVersion: 9, parseJobs: [{ id: 'parse-1', type: 'capability_cards', inputVersion: 2, status: 'failed' }] }) },
    rubricVersion: {
      findFirst: async () => rubric,
      create: async ({ data }) => { rubric = { ...data, id: 'r2', confirmedBy: null, confirmedAt: null, cards: [] }; return rubric; },
    },
    interviewTask: { count: async () => 0 },
  };
  const service = new RubricService(db);
  const first = (await service.getRubric('ws', 'job')).rubric;
  assert.equal(first.confirmedBy, 'reviewer-1');
  assert.equal(first.sourceJdVersion, 2);
  await service.newVersion({ workspaceId: 'ws', actorId: 'editor' }, 'job');
  const draft = (await service.getRubric('ws', 'job')).rubric;
  assert.equal(draft.versionNumber, 2);
  assert.equal(draft.status, 'draft');
  assert.equal(draft.confirmedBy, null);
  assert.equal(draft.confirmedAt, null);
  assert.equal(draft.sourceJdVersion, 2);
  rubric = { ...rubric, status: 'confirmed', confirmedBy: 'reviewer-2', sourceParseJobId: null };
  const legacy = (await service.getRubric('ws', 'job')).rubric;
  assert.equal(legacy.sourceJdVersion, null);
  assert.equal(legacy.confirmedBy, 'reviewer-2');
});
