const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile, readdir } = require('node:fs/promises');
const { PrismaClient } = require('@prisma/client');
const { rubricCardSource } = require('../dist/rubric/rubric-source');
const { RubricService } = require('../dist/rubric/rubric.service');
try { process.loadEnvFile('.env'); } catch { /* CI supplies the database URL. */ }
const draft = { requirement: 'Build reliable APIs', responsibilityType: 'lead', cardPriority: 'P0', competencyTags: ['API'], expectedEvidence: 'A project', levelAnchors: { l1: '1', l2: '2', l3: '3', l4: '4', l5: '5' }, weight: 100, segmentId: 's2', quote: 'Build reliable APIs for payments.' };
const input = { sourceId: 'jd:1', segments: [{ id: 's1', text: 'Build reliable APIs for reporting.' }, { id: 's2', text: draft.quote }] };
const result = { cards: [draft], warnings: [] };
const card = { requirement: draft.requirement, sourceRefs: [{ segmentId: draft.segmentId, quote: draft.quote }] };

test('#251 citations require exact frozen segment, generation result and version', () => {
  const source = { id: 'parse-1', inputVersion: 1, input, result };
  assert.equal(rubricCardSource(card, source).status, 'verified');
  assert.equal(rubricCardSource({ ...card, sourceRefs: [{ segmentId: 's1', quote: draft.quote }] }, source).status, 'not_recorded');
  assert.equal(rubricCardSource({ ...card, requirement: 'Human changed the requirement' }, source).status, 'not_recorded');
  for (const invalid of [undefined, { ...source, inputVersion: 2 }, { ...source, input: null }, { ...source, result: {} }, { ...source, input: { ...input, segments: [...input.segments, input.segments[1]] } }]) {
    assert.equal(rubricCardSource(card, invalid).status, 'not_recorded');
    assert.deepEqual(rubricCardSource(card, invalid).refs, []);
  }
  for (const refs of [[], null, [{ segmentId: 's2', quote: '   ' }], [{ segmentId: 's2', quote: 'Invented source' }]]) assert.equal(rubricCardSource({ ...card, sourceRefs: refs }, source).status, 'not_recorded');
});

test('#251 persisted provenance survives JD changes and reload; edits and foreign sources cannot impersonate JD', async () => {
  const schema = `rubric_source_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL); url.searchParams.set('schema', schema);
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  try {
    await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    for (const folder of (await readdir('prisma/migrations')).filter(n => /^\d/.test(n)).sort()) {
      for (const sql of (await readFile(`prisma/migrations/${folder}/migration.sql`, 'utf8')).split(';').filter(s => s.trim())) await db.$executeRawUnsafe(sql);
    }
    const identity = { workspaceId: 'source-test', actorId: 'reviewer' };
    const job = await db.job.create({ data: { workspaceId: identity.workspaceId, createdBy: identity.actorId, title: 'Synthetic role', jdText: draft.quote } });
    const parse = await db.parseJob.create({ data: { workspaceId: identity.workspaceId, jobId: job.id, type: 'capability_cards', inputVersion: 1, input, status: 'needs_review', result } });
    const svc = new RubricService(db, {});
    let read = await svc.getRubric(identity.workspaceId, job.id);
    const rubricId = read.rubric.id;
    assert.equal(read.rubric.cards[0].source.status, 'verified');
    assert.equal(read.rubric.cards[0].source.parseJobId, parse.id);
    await db.job.update({ where: { id: job.id }, data: { jdVersion: 2, jdText: 'Build reliable APIs for NEW products.' } });
    read = await new RubricService(db, {}).getRubric(identity.workspaceId, job.id);
    assert.equal(read.jdVersion, 2);
    assert.equal(read.rubric.cards[0].source.jdVersion, 1);
    assert.equal(read.rubric.cards[0].source.refs[0].quote, draft.quote);
    const toInput = c => ({ id: c.id, requirement: c.requirement, responsibilityType: c.responsibilityType, cardPriority: c.cardPriority, competencyTags: c.competencyTags.split(','), expectedEvidence: c.expectedEvidence, levelAnchors: c.levelAnchors, weight: c.weight });
    await svc.update(identity, job.id, { version: read.rubric.version, cards: [{ ...toInput(read.rubric.cards[0]), weight: 90 }] });
    read = await svc.getRubric(identity.workspaceId, job.id);
    assert.equal(read.rubric.cards[0].source.status, 'verified', 'weight change does not change provenance');
    await svc.update(identity, job.id, { version: read.rubric.version, cards: [{ ...toInput(read.rubric.cards[0]), requirement: 'Human-added responsibility' }] });
    read = await svc.getRubric(identity.workspaceId, job.id);
    assert.equal(read.rubric.cards[0].source.status, 'not_recorded');
    assert.deepEqual((await db.capabilityCard.findFirst({ where: { rubricVersionId: rubricId } })).sourceRefs, []);
    // Restore legacy refs to exercise fail-closed reading, not a production backfill.
    await db.capabilityCard.update({ where: { id: read.rubric.cards[0].id }, data: { requirement: draft.requirement, sourceRefs: card.sourceRefs } });
    const foreign = await db.parseJob.create({ data: { workspaceId: 'other', jobId: job.id, type: 'capability_cards', inputVersion: 1, input, status: 'needs_review', result } });
    await db.rubricVersion.update({ where: { id: rubricId }, data: { sourceParseJobId: foreign.id } });
    assert.equal((await svc.getRubric(identity.workspaceId, job.id)).rubric.cards[0].source.status, 'not_recorded');
    const otherJob = await db.job.create({ data: { workspaceId: identity.workspaceId, createdBy: identity.actorId, title: 'Other role', jdText: 'Other synthetic JD' } });
    await db.parseJob.update({ where: { id: foreign.id }, data: { workspaceId: identity.workspaceId, jobId: otherJob.id } });
    assert.equal((await svc.getRubric(identity.workspaceId, job.id)).rubric.cards[0].source.status, 'not_recorded');
    await db.rubricVersion.update({ where: { id: rubricId }, data: { sourceParseJobId: null } });
    assert.deepEqual((await svc.getRubric(identity.workspaceId, job.id)).rubric.cards[0].sourceRefs, []);
    await assert.rejects(svc.getRubric('other', job.id), e => e.getStatus() === 404);
  } finally {
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await db.$disconnect();
  }
});
