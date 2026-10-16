// #158 -- a correction needs a reason only when it touches a field a current recommendation or evaluation used;
// reasons are a quick choice plus a note (required with "other"); project descriptions can be corrected.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ProfilesService } = require('../dist/profiles/profiles.service');
const { referencedProfileFields } = require('../dist/profiles/correction-rules');

const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: [] };

/** A candidate with one profile, and whichever recommendations / evaluations the test gives it. */
function setup({ recommendations = [], evaluations = [] } = {}) {
  const profile = {
    id: 'p-1', version: 1, resumeVersionId: 'rv-1', displayName: 'Mai Tran', dataStatus: 'complete', parserVersion: 'x', parseStatus: 'succeeded',
    sourceEntries: [], resumeVersionRefs: [], employmentHistory: [], skills: [], education: [], certifications: [], languages: [],
    projects: [{ name: 'Sales dashboard', description: 'Weekly dashbords for sales' }],
    location: { value: 'Hanoi', status: 'known' }, workAuthorization: null, compensationExpectation: null, missingFields: [], corrections: [],
  };
  const created = []; const audits = []; const touchedMaterial = [];
  const matches = (rows, where) => rows.filter((row) => Object.entries(where).every(([key, value]) => {
    if (key === 'workspaceId' || key === 'candidateId' || key === 'application') return true;
    if (value && typeof value === 'object' && 'in' in value) return value.in.includes(row[key]);
    return row[key] === value;
  }));
  const db = {
    candidate: { findFirst: async () => ({ id: 'c-1', displayName: 'Mai Tran', email: null, phone: null, profiles: [profile] }), update: async () => ({}) },
    candidateJobRecommendation: { findFirst: async ({ where }) => matches(recommendations, where)[0] ?? null },
    screeningEvaluation: { findFirst: async ({ where }) => matches(evaluations, where)[0] ?? null },
    candidateProfile: { create: async ({ data }) => { created.push(data); return { id: 'p-2', ...data }; } },
    auditRecord: { create: async ({ data }) => { audits.push(data); return data; } },
    material: { update: async () => touchedMaterial.push(1) },
  };
  db.$transaction = async (fn) => fn(db);
  return { service: new ProfilesService(db, {}, {}, {}), created, audits, touchedMaterial, db };
}
const rejected = (code) => (e) => e.getStatus?.() === 422 && e.response.code === code;

test('#158 AC-1: with nothing current relying on the profile, a correction saves without a reason and logs that', async () => {
  const { service, created, audits, touchedMaterial } = setup();
  await service.correct(identity, 'c-1', { location: 'Ho Chi Minh City', projects: [{ index: 0, description: 'Weekly dashboards for sales teams' }] });
  assert.equal(created[0].location.value, 'Ho Chi Minh City');
  assert.equal(created[0].projects[0].description, 'Weekly dashboards for sales teams', 'a project description can be corrected');
  assert.equal(created[0].projects[0].name, 'Sales dashboard');
  const log = created[0].corrections;
  assert.deepEqual(log.map((c) => c.fieldPath).sort(), ['location', 'projects']);
  for (const entry of log) {
    assert.equal(entry.reason, '');
    assert.equal(entry.reasonType, null);
    assert.equal(entry.correctedBy, 'hr-1');
    assert.ok(entry.correctedAt);
  }
  assert.equal(audits[0].actorId, 'hr-1');
  assert.deepEqual(touchedMaterial, [], 'the original material is never rewritten');
});

test('#158 AC-2: a field a current evaluation used needs a reason, in the API too; with one it saves', async () => {
  const { service, created } = setup({ evaluations: [{ id: 'e-1', freshness: 'current' }] });
  await assert.rejects(service.correct(identity, 'c-1', { location: 'Ho Chi Minh City' }), rejected('INVALID_SCHEMA'));
  await assert.rejects(service.correct(identity, 'c-1', { location: 'Ho Chi Minh City', reason: 'moved' }), rejected('INVALID_SCHEMA'), 'a note alone is not a reason type');
  await service.correct(identity, 'c-1', { location: 'Ho Chi Minh City', reasonType: 'candidate_update' });
  assert.equal(created[0].corrections[0].reasonType, 'candidate_update');
  assert.equal(created[0].corrections[0].reasonRequired, true);
  // A field scoring doesn't read (the name, a project description) still saves without one.
  await service.correct(identity, 'c-1', { displayName: 'Mai Tran Thi' });
});

test('#158 AC-3: the reasons are the four choices; "other" needs a note, in the API too', async () => {
  const { service } = setup();
  await assert.rejects(service.correct(identity, 'c-1', { location: 'Da Nang', reasonType: 'other' }), rejected('INVALID_SCHEMA'));
  await assert.rejects(service.correct(identity, 'c-1', { location: 'Da Nang', reasonType: 'because' }), rejected('INVALID_SCHEMA'));
  for (const reasonType of ['parse_error', 'candidate_update', 'source_update']) {
    await service.correct(identity, 'c-1', { location: `Da Nang ${reasonType}`, reasonType });
  }
  await service.correct(identity, 'c-1', { location: 'Da Nang other', reasonType: 'other', reason: 'Recruiter call on 10-16' });
});

test('#158 AC-4: only effective references count — stale or dismissed recommendations and out-of-date evaluations do not', async () => {
  const stale = setup({
    recommendations: [{ id: 'r-1', status: 'stale', staleReason: 'Replaced by a newer discovery run.' }, { id: 'r-2', status: 'dismissed', staleReason: null }],
    evaluations: [{ id: 'e-1', freshness: 'stale' }],
  });
  assert.deepEqual(await referencedProfileFields(stale.db, 'ws-1', 'c-1'), []);
  await stale.service.correct(identity, 'c-1', { location: 'Ho Chi Minh City' });

  const recommended = setup({ recommendations: [{ id: 'r-3', status: 'proposed', staleReason: null }] });
  assert.deepEqual((await referencedProfileFields(recommended.db, 'ws-1', 'c-1')).sort(), ['employment_history', 'location', 'skills']);
  await assert.rejects(recommended.service.correct(identity, 'c-1', { location: 'Ho Chi Minh City' }), rejected('INVALID_SCHEMA'));
});
