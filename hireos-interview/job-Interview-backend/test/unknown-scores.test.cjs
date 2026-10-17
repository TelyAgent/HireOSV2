const { test } = require('node:test');
const assert = require('node:assert/strict');
const { RoundsService } = require('../dist/intake/rounds.service');
const { TasksService } = require('../dist/intake/tasks.service');

function fixture() {
  const cards = [
    { id: 'known', requirement: 'Design', cardPriority: 'P0', weight: 40, expectedEvidence: 'Design example' },
    { id: 'unknown', requirement: 'Operations', cardPriority: 'P0', weight: 60, expectedEvidence: 'Incident example' },
  ];
  const rows = new Map([['known', { cardId: 'known', roundId: 'round', score: 4, note: 'Design evidence' }]]);
  const db = {
    interviewRound: { findFirst: async () => ({ taskId: 'task' }), findMany: async () => [{ id: 'round', sequence: 1, name: 'Round 1' }] },
    interviewTask: { findFirst: async () => ({ jobId: 'job' }), findUniqueOrThrow: async () => ({ jobId: 'job' }) },
    capabilityCard: { findFirst: async ({ where }) => cards.find(c => c.id === where.id) },
    rubricVersion: { findFirst: async ({ select }) => ({ cards: cards.map(card => Object.fromEntries(Object.keys(select.cards.select).map(key => [key, card[key]]))) }) },
    parseJob: { findFirst: async () => null },
    cardScore: {
      upsert: async ({ create, update }) => rows.set(create.cardId, { ...(rows.get(create.cardId) || create), ...update }),
      findMany: async ({ where }) => [...rows.values()].filter(row => !where.score || row.score !== null),
    },
  };
  return { rounds: new RoundsService(db), tasks: new TasksService(db) };
}

test('#288: Unknown survives save/read as null with its note and expected evidence', async () => {
  const { rounds } = fixture();
  await rounds.setScore({ workspaceId: 'ws' }, 'round', 'unknown', { score: 5, note: 'Initial score' });
  const saved = await rounds.setScore({ workspaceId: 'ws' }, 'round', 'unknown', { score: null, note: 'Need incident timeline' });
  assert.equal(JSON.parse(JSON.stringify(saved)).score, null);
  const read = await rounds.scores('ws', 'round');
  const entry = read.entries.find(e => e.card.id === 'unknown');
  assert.equal(entry.score, null);
  assert.equal(entry.note, 'Need incident timeline');
  assert.equal(entry.card.expectedEvidence, 'Incident example');
});

test('#288: Unknown does not contribute evaluated weight or become a failing numeric score', async () => {
  const { rounds, tasks } = fixture();
  await rounds.setScore({ workspaceId: 'ws' }, 'round', 'unknown', { score: null, note: 'Need incident timeline' });
  const summary = await tasks.debrief('ws', 'task');
  assert.equal(summary.scoredCount, 1);
  assert.equal(summary.evaluatedWeightPct, 40);
  assert.equal(summary.overall, null);
  assert.equal(summary.cards.find(c => c.id === 'unknown').score, null);
  assert.deepEqual(summary.unknownCards.map(c => c.id), ['unknown']);
  await rounds.setScore({ workspaceId: 'ws' }, 'round', 'known', { score: null, note: 'Recheck design evidence' });
  const empty = await tasks.debrief('ws', 'task');
  assert.equal(empty.scoredCount, 0);
  assert.equal(empty.evaluatedWeightPct, 0);
  assert.equal(empty.overall, null);
});
