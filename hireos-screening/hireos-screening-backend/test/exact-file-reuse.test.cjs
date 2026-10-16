// #153 -- re-uploading a file already on record (renamed or not) creates nothing new, records this upload as
// another source of the candidate it belongs to, and the result points at that candidate.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ImportsService } = require('../dist/intake/imports.service');
const { CandidatesService } = require('../dist/library/candidates.service');

const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: [] };

function setup() {
  const writes = { sources: [], items: [], candidates: 0, versions: 0, jobs: 0 };
  const db = {
    resumeVersion: { findUnique: async ({ where }) => (where.materialId === 'm-1' ? { candidateId: 'c-nina' } : null), create: async () => { writes.versions += 1; } },
    candidateSource: { create: async ({ data }) => { writes.sources.push(data); return data; } },
    importItem: { update: async ({ data }) => { writes.items.push(data); return { id: 'i-1', materialId: data.materialId, candidateId: data.candidateId, stage: data.stage, status: data.status, outcome: data.outcome, errorCode: null }; } },
    activityEvent: { create: async () => ({}) },
    candidate: { create: async () => { writes.candidates += 1; } },
    processingJob: { create: async () => { writes.jobs += 1; } },
  };
  return { service: new ImportsService(db, {}, {}, {}), writes };
}

for (const fileName of ['f03_nina_20261015.txt', 'f03_nina_renamed_20261015.txt']) {
  test(`#153 AC-1/AC-3: an identical file (${fileName}) points at the candidate it belongs to and creates nothing new`, async () => {
    const { service, writes } = setup();
    await service['processSavedMaterial'](identity, 'op-1', 'b-1', 'i-1', { kind: 'exact_file', material: { id: 'm-1', name: fileName } }, 'manual_upload');
    assert.deepEqual(writes.sources.map((s) => [s.materialId, s.candidateId, s.channel]), [['m-1', 'c-nina', 'manual_upload']], 'this upload is a source of that candidate');
    assert.equal(writes.items[0].outcome, 'exact_file');
    assert.equal(writes.items[0].candidateId, 'c-nina');
    assert.equal(writes.items[0].status, 'duplicate');
    assert.deepEqual([writes.candidates, writes.versions, writes.jobs], [0, 0, 0], 'no candidate, version or analysis job');
  });
}

test('#153 AC-1: the batch names the existing candidate for an identical file', async () => {
  const item = { id: 'i-1', fileName: 'renamed.txt', sizeKB: 1, outcome: 'exact_file', stage: 'duplicate', status: 'duplicate', errorCode: null, errorMessage: null,
    retryable: false, attemptCount: 1, completedAt: null, materialId: 'm-1', duplicateOfMaterialId: 'm-1', candidateId: 'c-nina', duplicateReviewId: null, businessConsumeStatus: 'skipped' };
  const db = {
    importBatch: { findFirst: async () => ({ id: 'b-1', operationId: null, createdAt: new Date(), status: 'completed', targetJobId: null, items: [item] }) },
    duplicateCheck: { findMany: async () => [] },
    candidate: { findMany: async ({ where }) => (where.id.in.includes('c-nina') && where.workspaceId === 'ws-1' ? [{ id: 'c-nina', displayName: 'Nina Torres' }] : []) },
  };
  const batch = await new ImportsService(db, {}, {}, {}).getBatch('ws-1', 'b-1');
  assert.deepEqual(batch.items[0].existingCandidate, { id: 'c-nina', displayName: 'Nina Torres' });
});

test('#153 AC-3: the candidate lists this upload among its source records, alongside the original version', async () => {
  const candidate = {
    id: 'c-nina', displayName: 'Nina Torres', identityStatus: 'provisional', email: null, phone: null, ownerId: 'hr-1', createdAt: new Date(), lastMatchedAt: null, retention: 'standard',
    profiles: [], recommendations: [], applications: [],
    resumeVersions: [{ id: 'rv-1', version: 1, materialId: 'm-1', uploadedAt: new Date('2026-10-15'), source: 'manual_upload', parseStatus: 'succeeded', isLatest: true,
      material: { id: 'm-1', name: 'f03_nina_20261015.txt', readStatus: 'available', errorCode: null, createdAt: new Date(), segments: [] } }],
    sources: [
      { id: 's-2', channel: 'manual_upload', receivedAt: new Date('2026-10-16'), materialId: 'm-1', material: { id: 'm-1', name: 'f03_nina_20261015.txt' } },
      { id: 's-1', channel: 'manual_upload', receivedAt: new Date('2026-10-15'), materialId: 'm-1', material: { id: 'm-1', name: 'f03_nina_20261015.txt' } },
    ],
  };
  const db = { candidate: { findFirst: async () => candidate }, candidateJobRecommendation: { findFirst: async () => null }, screeningEvaluation: { findFirst: async () => null } };
  const detail = await new CandidatesService(db, {}, { getMatchingStatuses: async () => new Map() }).get(identity, 'c-nina');
  assert.equal(detail.resumeVersions.length, 1, 'still one résumé version');
  assert.deepEqual(detail.sources.map((s) => s.id), ['s-2', 's-1']);
});
