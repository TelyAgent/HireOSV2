const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TasksService } = require('../dist/intake/tasks.service');

test('#324: conflicting rounds and Unknown keep their own notes, interviewer and citations', async () => {
  const rounds = [1, 2, 3].map(sequence => ({ id: `r${sequence}`, sequence, name: `Round ${sequence}`, interviewer: sequence === 3 ? null : { id: `i${sequence}`, name: `Reviewer ${sequence}` } }));
  const scores = [
    { cardId: 'card', roundId: 'r3', score: null, note: 'Need more evidence', updatedAt: new Date(), aiQuoteSegmentId: null, aiQuote: null },
    { cardId: 'card', roundId: 'r2', score: 4, note: 'Meets bar with recovery example', updatedAt: new Date(), aiQuoteSegmentId: 'line2', aiQuote: 'I tested recovery.' },
    { cardId: 'card', roundId: 'r1', score: 2, note: 'Below bar: no recovery plan', updatedAt: new Date(), aiQuoteSegmentId: 'line1', aiQuote: 'No recovery plan.' },
  ];
  const db = {
    interviewTask: { findFirst: async () => ({ jobId: 'job' }) },
    rubricVersion: { findFirst: async () => ({ cards: [{ id: 'card', requirement: 'Reliability', cardPriority: 'P0', weight: 100 }] }) },
    interviewRound: { findMany: async ({ where }) => { assert.deepEqual(where, { taskId: 'task', workspaceId: 'ws' }); return rounds; } },
    cardScore: { findMany: async ({ where }) => { assert.equal(where.workspaceId, 'ws'); assert.deepEqual(where.roundId.in, ['r1', 'r2', 'r3']); return scores; } },
    parseJob: { findFirst: async () => null },
  };
  const service = new TasksService(db);
  for (let read = 0; read < 2; read++) {
    const summary = await service.debrief('ws', 'task');
    const card = summary.cards[0];
    assert.equal(card.score, 4, 'existing headline calculation stays unchanged');
    assert.deepEqual(card.roundScores.map(r => r.score), [2, 4, null]);
    assert.deepEqual(card.roundScores.map(r => r.note), ['Below bar: no recovery plan', 'Meets bar with recovery example', 'Need more evidence']);
    assert.deepEqual(card.roundScores.map(r => r.interviewer?.name ?? null), ['Reviewer 1', 'Reviewer 2', null]);
    assert.deepEqual(card.roundScores[0].aiEvidence, { segmentId: 'line1', quote: 'No recovery plan.' });
    assert.deepEqual(card.roundScores[1].aiEvidence, { segmentId: 'line2', quote: 'I tested recovery.' });
    assert.equal(card.roundScores[2].aiEvidence, null);
  }
});
