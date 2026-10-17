const { test } = require('node:test');
const assert = require('node:assert/strict');
const { RoundsService } = require('../dist/intake/rounds.service');

test('#282 rejects blank reasons without writes; valid reason saves and reads back', async () => {
  let record = { score: 2, note: 'Original evidence', aiScore: 3, aiRationale: 'AI evidence' };
  let writes = 0;
  const db = {
    interviewRound: { findFirst: async () => ({ taskId: 'task' }) },
    interviewTask: { findUniqueOrThrow: async () => ({ jobId: 'job' }) },
    capabilityCard: { findFirst: async () => ({ id: 'card' }) },
    rubricVersion: { findFirst: async () => ({ cards: [{ id: 'card' }] }) },
    parseJob: { findFirst: async () => null },
    cardScore: {
      upsert: async ({ update }) => { writes++; record = { ...record, ...update }; },
      findMany: async () => [{ cardId: 'card', ...record }],
    },
  };
  const service = new RoundsService(db);
  for (const note of ['', '   ', '\n\t', '\u3000']) {
    await assert.rejects(service.setScore({ workspaceId: 'ws' }, 'round', 'card', { score: 4, note }), e => e.getStatus() === 422 && e.getResponse().code === 'INVALID_SCHEMA');
    assert.equal(writes, 0);
    assert.equal(record.score, 2);
    assert.equal(record.note, 'Original evidence');
  }
  await service.setScore({ workspaceId: 'ws' }, 'round', 'card', { score: 4, note: 'Recovery demonstrated' });
  const read = await service.scores('ws', 'round');
  assert.equal(read.entries[0].score, 4);
  assert.equal(read.entries[0].note, 'Recovery demonstrated');
  assert.equal(read.entries[0].aiScore, 3);
  assert.equal(read.entries[0].aiRationale, 'AI evidence');
  // Unknown remains distinct from a numeric score; this issue does not add a new gate to it.
  await service.setScore({ workspaceId: 'ws' }, 'round', 'card', { score: null, note: '' });
  assert.equal(record.score, null);
});
