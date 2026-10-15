// A résumé already stored in Core Record keeps the Core candidate another subsystem linked to it,
// so the same person isn't registered twice (once by Interview/Written, again by Screening).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ImportsService } = require('../dist/intake/imports.service');

function fakeDb(created) {
  const tx = {
    candidate: { create: async (args) => { created.push(args.data); return { id: args.data.id ?? 'local-generated' }; } },
    libraryEntry: { create: async () => ({}) },
    resumeVersion: { create: async () => ({ id: 'rv-1' }) },
    candidateSource: { create: async () => ({}) },
    auditRecord: { create: async () => ({}) },
  };
  return { $transaction: async (fn) => fn(tx) };
}

const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: [] };

test('a Core-stored résumé resolves to the candidate already linked to it', async () => {
  const calls = []; const created = [];
  const coreRecord = {
    resolveCandidateForMaterial: async (_i, input) => { calls.push(['resolve', input]); return { id: 'core-from-interview', created: false }; },
    createCandidate: async () => { calls.push(['create']); return { id: 'core-new' }; },
  };
  const service = new ImportsService(fakeDb(created), {}, {}, coreRecord);
  const result = await service['createCandidateFromMaterial'](identity, 'local-material', 'Lin_Chen.pdf', 'upload', 'core-material-1');
  assert.deepEqual(calls, [['resolve', { materialId: 'core-material-1', displayName: 'Lin Chen', source: 'upload' }]]);
  assert.equal(result.id, 'core-from-interview');
  assert.equal(created[0].id, 'core-from-interview', 'the local candidate takes the shared Core id');
});

test('without a Core material (mock mode or legacy file) a candidate is created as before', async () => {
  const calls = []; const created = [];
  const coreRecord = {
    resolveCandidateForMaterial: async () => { calls.push(['resolve']); return null; },
    createCandidate: async (_i, input, key) => { calls.push(['create', key]); return null; },
  };
  const service = new ImportsService(fakeDb(created), {}, {}, coreRecord);
  const result = await service['createCandidateFromMaterial'](identity, 'local-material', 'Lin_Chen.pdf', 'upload', null);
  assert.deepEqual(calls, [['create', 'screening:candidate:material:ws-1:local-material']]);
  assert.equal(result.id, 'local-generated');
});
