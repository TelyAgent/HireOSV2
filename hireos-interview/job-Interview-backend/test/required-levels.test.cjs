const { test } = require('node:test');
const assert = require('node:assert/strict');
const { jdRequirements, cardLevel, requirementSegmentId } = require('../dist/rubric/required-levels');
const { RubricService } = require('../dist/rubric/rubric.service');
const { TasksService } = require('../dist/intake/tasks.service');

test('#325: only unique JD structured IDs and exact source quotes confer a required level', () => {
  const requirements = [{ id: 'a', label: 'Build APIs', requiredLevel: 4 }, { id: 'b', label: 'SQL', requiredLevel: 3 }];
  assert.deepEqual(cardLevel({ requirements }, requirementSegmentId('a'), 'Build APIs'), { requiredLevel: 4, sourceRequirementId: 'a' });
  assert.equal(cardLevel({ requirements }, 's1', 'Build APIs').requiredLevel, null);
  assert.equal(cardLevel({ requirements }, requirementSegmentId('a'), 'Invented').requiredLevel, null);
  assert.deepEqual(jdRequirements([...requirements, requirements[0]]).map(r => r.id), ['b']);
  for (const requiredLevel of [undefined, null, 0, 6, 3.5, '4']) assert.equal(jdRequirements([{ id: 'x', label: 'SQL', requiredLevel }])[0].requiredLevel, null);
});

test('#325: generated cards use the captured source version and clones preserve its requirements', async () => {
  const input = { requirements: [{ id: 'a', label: 'Build APIs', requiredLevel: 4 }] };
  const card = { requirement: 'Build APIs', cardPriority: 'P0', responsibilityType: 'lead', competencyTags: ['API'], expectedEvidence: 'Example', levelAnchors: {}, weight: 100, segmentId: requirementSegmentId('a'), quote: 'Build APIs' };
  let saved;
  const job = { jdVersion: 1, jdRequirements: [{ id: 'a', label: 'Build APIs', requiredLevel: 2 }], parseJobs: [{ id: 'p1', type: 'capability_cards', inputVersion: 1, status: 'needs_review', input, result: { cards: [card] } }] };
  const db = {
    job: { findFirst: async () => job }, interviewTask: { count: async () => 0 },
    rubricVersion: { findFirst: async () => saved ?? null, create: async ({ data }) => (saved = { ...data, id: 'r1', cards: data.cards.create }) },
  };
  db.$transaction = async fn => fn(db);
  const svc = new RubricService(db);
  const first = await svc.getRubric('ws', 'job');
  assert.equal(first.rubric.cards[0].requiredLevel, 4, 'not the current job value or an AI-invented value');
  assert.equal(first.rubric.sourceJdVersion, 1);
  saved.status = 'confirmed';
  await svc.newVersion({ workspaceId: 'ws', actorId: 'hr' }, 'job');
  assert.equal(saved.cards[0].requiredLevel, 4);
  assert.equal(saved.cards[0].sourceRequirementId, 'a');
});

test('#325: same project L3/L4 compare independently; missing legacy levels never pass', async () => {
  const cards = [3, 4].map((requiredLevel, i) => ({ id: `c${i}`, requirement: `Skill ${i}`, requiredLevel, cardPriority: 'P0', weight: 50 }));
  const db = {
    interviewTask: { findFirst: async () => ({ jobId: 'job' }) },
    rubricVersion: { findFirst: async () => ({ cards }) },
    interviewRound: { findMany: async () => [{ id: 'r1', sequence: 1, name: 'Round 1' }] },
    cardScore: { findMany: async () => cards.map(c => ({ cardId: c.id, roundId: 'r1', score: 3, note: '', updatedAt: new Date() })) },
    parseJob: { findFirst: async () => null },
  };
  const service = new TasksService(db);
  const result = await service.debrief('ws', 'task');
  assert.equal(result.mustHaveMet, 1);
  assert.equal(result.overall, 'fail');
  assert.deepEqual(result.cards.map(c => c.requiredLevel), [3, 4]);
  cards[1].requiredLevel = null;
  const legacy = await service.debrief('ws', 'task');
  assert.equal(legacy.mustHaveMet, 1);
  assert.equal(legacy.overall, null);
});
