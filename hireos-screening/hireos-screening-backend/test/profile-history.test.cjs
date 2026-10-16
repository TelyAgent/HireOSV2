// #159 -- every profile version is kept and listed newest first; a correction records the old and new value,
// who, when and why; older corrections (logged before values were kept) get them from neighbouring versions.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ProfilesService } = require('../dist/profiles/profiles.service');

const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: [] };
const base = {
  resumeVersionId: 'rv-1', dataStatus: 'complete', parserVersion: 'x', parseStatus: 'succeeded', sourceEntries: [], resumeVersionRefs: [],
  employmentHistory: [], skills: [], education: [], certifications: [], languages: [], workAuthorization: { value: 'citizen' },
  projects: [{ name: 'Dashboard', description: 'old text' }], compensationExpectation: null, missingFields: [],
};

function setup(initial) {
  const profiles = initial.map((p) => ({ ...base, ...p }));
  const writes = [];
  const db = {
    candidate: { findFirst: async () => ({ id: 'c-1', displayName: 'Mai Tran', email: null, phone: null, profiles: [profiles.at(-1)] }), update: async () => ({}) },
    candidateProfile: {
      findMany: async () => [...profiles].sort((a, b) => a.version - b.version),
      create: async ({ data }) => { const row = { id: `p-${data.version}`, createdAt: new Date(), ...data }; profiles.push(row); return row; },
    },
    candidateJobRecommendation: { findFirst: async () => null },
    screeningEvaluation: { findFirst: async () => null },
    auditRecord: { create: async ({ data }) => data },
    // Any write to the source material or résumé version would land here (#159 AC-3).
    material: { update: async () => writes.push('material'), updateMany: async () => writes.push('material') },
    resumeVersion: { update: async () => writes.push('resumeVersion'), updateMany: async () => writes.push('resumeVersion') },
  };
  db.$transaction = async (fn) => fn(db);
  return { service: new ProfilesService(db, {}, {}, {}), profiles, writes };
}

test('#159 AC-1/AC-3: a correction adds a version; history lists both, newest first, with old/new value, who, when, why', async () => {
  const { service, profiles, writes } = setup([{ id: 'p-1', version: 1, createdAt: new Date('2026-10-01'), displayName: 'Mai Tran', location: { value: 'Hanoi' }, corrections: [] }]);
  const before = JSON.stringify(profiles[0]);
  await service.correct(identity, 'c-1', { location: 'Da Nang', reasonType: 'candidate_update', reason: 'Moved in September' });
  assert.equal(profiles.length, 2);
  assert.equal(JSON.stringify(profiles[0]), before, 'the previous version is kept exactly as it was');
  assert.deepEqual(writes, [], 'AC-3: the source material and résumé version are never written');
  const history = await service.history(identity, 'c-1');
  assert.equal(history.current, 2);
  assert.deepEqual(history.versions.map((v) => [v.version, v.kind]), [[2, 'corrected'], [1, 'parsed']]);
  const [entry] = history.versions[0].corrections;
  assert.equal(entry.fieldPath, 'location');
  assert.equal(entry.oldValue, 'Hanoi');
  assert.equal(entry.newValue, 'Da Nang');
  assert.equal(entry.reasonType, 'candidate_update');
  assert.equal(entry.reason, 'Moved in September');
  assert.equal(entry.correctedBy, 'hr-1');
  assert.ok(entry.correctedAt);
  assert.equal(history.versions[1].location, 'Hanoi', 'the previous version can be read');
  assert.equal(history.versions[1].resumeVersionId, 'rv-1', 'each version points at its source material');
});

test('#159 AC-2: project description corrections show before and after', async () => {
  const { service } = setup([{ id: 'p-1', version: 1, createdAt: new Date(), displayName: 'Mai Tran', location: null, corrections: [] }]);
  await service.correct(identity, 'c-1', { projects: [{ index: 0, description: 'new text' }] });
  const [entry] = (await service.history(identity, 'c-1')).versions[0].corrections;
  assert.deepEqual(entry.oldValue, [{ index: 0, description: 'old text' }]);
  assert.deepEqual(entry.newValue, [{ index: 0, description: 'new text' }]);
});

test('#159: corrections logged before values were kept read them from the neighbouring versions; restricted fields stay out', async () => {
  const legacy = { fieldPath: 'location', reason: 'typo', correctedBy: 'hr-2', correctedAt: '2026-10-02T00:00:00Z' };
  const { service } = setup([
    { id: 'p-1', version: 1, createdAt: new Date('2026-10-01'), displayName: 'Mai Tran', location: { value: 'Hanio' }, corrections: [] },
    { id: 'p-2', version: 2, createdAt: new Date('2026-10-02'), displayName: 'Mai Tran', location: { value: 'Hanoi' }, corrections: [legacy] },
  ]);
  const history = await service.history(identity, 'c-1');
  const [entry] = history.versions[0].corrections;
  assert.equal(entry.oldValue, 'Hanio');
  assert.equal(entry.newValue, 'Hanoi');
  assert.equal(entry.reasonType, null);
  for (const version of history.versions) assert.equal('workAuthorization' in version, false);
});
