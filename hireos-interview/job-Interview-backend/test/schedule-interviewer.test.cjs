const { test } = require('node:test');
const assert = require('node:assert/strict');
const { RoundsService } = require('../dist/intake/rounds.service');

test('#260 schedule rejects a missing interviewer before writes and saves an assigned round', async () => {
  let writes = 0;
  const round = { id: 'round', taskId: 'task', interviewerId: null, version: 1, task: { jobId: 'job', planConfirmedAt: new Date() } };
  const db = {
    interviewRound: {
      findFirst: async () => round,
      updateMany: async ({ data }) => { writes++; Object.assign(round, data); return { count: 1 }; },
      findUniqueOrThrow: async () => ({ ...round, interviewer: { id: 'interviewer', name: 'Reviewer' } }),
    },
    interviewTask: {
      findFirstOrThrow: async () => ({ jobId: 'job', planConfirmedAt: new Date(), rounds: [], decision: null }),
      updateMany: async () => ({ count: 1 }),
    },
    rubricVersion: { findFirst: async () => ({ id: 'rubric', versionNumber: 1 }) },
    interviewQuestion: { count: async () => 1 },
  };
  const service = new RoundsService(db);
  const input = { version: 1, scheduledAt: '2026-11-01T10:00:00.000Z', timezone: 'UTC', meetingLink: '' };
  await assert.rejects(service.schedule({ workspaceId: 'ws' }, 'round', input), e => e.getResponse().code === 'INTERVIEWER_REQUIRED');
  assert.equal(writes, 0);
  assert.equal(round.scheduledAt, undefined);
  round.interviewerId = 'interviewer';
  const saved = await service.schedule({ workspaceId: 'ws' }, 'round', input);
  assert.equal(writes, 1);
  assert.equal(saved.interviewer.name, 'Reviewer');
  assert.equal(saved.scheduledAt.toISOString(), input.scheduledAt);
});
