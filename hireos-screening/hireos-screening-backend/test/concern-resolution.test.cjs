// #193 -- handling a concern needs a note (material references optional) and is recorded with the status before
// and after, who and when; it happens once; a mistaken handling is reopened with a note and nothing is erased;
// linked verification items are not touched.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ScreeningService } = require('../dist/screening/screening.service');

const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: [] };
function setup(status = 'open') {
  const concern = { id: 'k-1', workspaceId: 'ws-1', applicationId: 'a-1', evaluationId: 'e-1', type: 'gap', title: 'Unclear dates at Example Retail', severity: 'high',
    confidence: 0.7, basis: 'missing_information', status, requirementIds: [], verificationItemIds: ['v-1'], restricted: false, resolution: null, resolutionHistory: [] };
  const audits = [];
  const touched = [];
  const db = {
    screeningConcern: {
      findFirst: async () => ({ ...concern }),
      findUniqueOrThrow: async () => ({ ...concern }),
      updateMany: async ({ where, data }) => {
        if (concern.status !== where.status) return { count: 0 };
        if (where.resolutionHistory && JSON.stringify(concern.resolutionHistory) !== JSON.stringify(where.resolutionHistory.equals)) return { count: 0 };
        Object.assign(concern, data);
        return { count: 1 };
      },
    },
    auditRecord: { create: async ({ data }) => audits.push(data) },
    verificationItem: { update: async () => touched.push('v'), updateMany: async () => touched.push('v') },
  };
  db.$transaction = async (fn) => fn(db);
  return { service: new ScreeningService(db, {}), concern, audits, touched };
}
const invalid = (e) => e.getStatus() === 422 && e.response.code === 'INVALID_SCHEMA';

test('#193 AC-1: confirming or dismissing without a note is refused; status and audit unchanged', async () => {
  const { service, concern, audits } = setup();
  await assert.rejects(service.resolveConcern(identity, 'k-1', { resolution: 'confirmed' }), invalid);
  await assert.rejects(service.resolveConcern(identity, 'k-1', { resolution: 'dismissed', note: '   ' }), invalid);
  await assert.rejects(service.resolveConcern(identity, 'k-1', { resolution: 'approved', note: 'x' }), invalid);
  assert.equal(concern.status, 'open');
  assert.deepEqual(audits, []);
});

test('#193 AC-2/AC-5: a handled concern keeps its text and records before/after, note, material, who and when; verification items untouched', async () => {
  const { service, concern, audits, touched } = setup();
  const out = await service.resolveConcern(identity, 'k-1', { resolution: 'confirmed', note: 'Candidate confirmed by phone', evidenceRefs: [{ materialId: 'm-1', label: 'mai.pdf (v2)' }] });
  assert.equal(out.status, 'confirmed');
  assert.equal(out.title, 'Unclear dates at Example Retail', 'the original concern stays as it was');
  const [entry] = out.history;
  assert.deepEqual([entry.action, entry.fromStatus, entry.toStatus, entry.note, entry.actorId], ['resolve', 'open', 'confirmed', 'Candidate confirmed by phone', 'hr-1']);
  assert.deepEqual(entry.evidenceRefs, [{ materialId: 'm-1', label: 'mai.pdf (v2)' }]);
  assert.ok(entry.at);
  assert.equal(audits[0].action, 'screening_concern_resolved');
  assert.deepEqual(touched, [], 'the linked verification item stays open');
  assert.deepEqual(concern.verificationItemIds, ['v-1']);
  // Material references are optional.
  const other = setup();
  assert.equal((await other.service.resolveConcern(identity, 'k-1', { resolution: 'dismissed', note: 'Not relevant to this role' })).status, 'dismissed');
});

test('#193: a concern is handled once — a second or concurrent attempt is a conflict that writes nothing', async () => {
  const { service, audits } = setup();
  const results = await Promise.allSettled([
    service.resolveConcern(identity, 'k-1', { resolution: 'confirmed', note: 'a' }),
    service.resolveConcern(identity, 'k-1', { resolution: 'dismissed', note: 'b' }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), ['fulfilled', 'rejected']);
  assert.equal(results.find((r) => r.status === 'rejected').reason.response.code, 'CONCERN_CHANGED');
  assert.equal(audits.length, 1);
});

test('#193 AC-4: a mistaken handling is reopened with a note, and the earlier handling stays in the history', async () => {
  const { service, concern, audits } = setup();
  await service.resolveConcern(identity, 'k-1', { resolution: 'confirmed', note: 'Checked' });
  await assert.rejects(service.reopenConcern(identity, 'k-1', {}), invalid);
  const reopened = await service.reopenConcern(identity, 'k-1', { note: 'Marked confirmed by mistake' });
  assert.equal(reopened.status, 'open');
  assert.equal(concern.resolution, null);
  assert.deepEqual(reopened.history.map((h) => [h.action, h.fromStatus, h.toStatus]), [['resolve', 'open', 'confirmed'], ['reopen', 'confirmed', 'open']]);
  assert.deepEqual(audits.map((a) => a.action), ['screening_concern_resolved', 'screening_concern_reopened']);
  await assert.rejects(service.reopenConcern(identity, 'k-1', { note: 'again' }), (e) => e.response.code === 'CONCERN_ALREADY_OPEN');
});

test('#193 (review): a handling read before another went open → confirmed → open again is a conflict, and that history stays', async () => {
  const { service, concern, audits } = setup('open');
  const stale = { ...concern, resolutionHistory: [] };
  // B handles and reopens it while A still holds what it read.
  await service.resolveConcern(identity, 'k-1', { resolution: 'confirmed', note: 'Checked with the candidate.' });
  await service.reopenConcern(identity, 'k-1', { note: 'Confirmed by mistake.' });
  assert.equal(concern.status, 'open');
  const historyAfterB = concern.resolutionHistory.map((h) => h.action);
  // A resumes with the open concern it read earlier.
  service.db.screeningConcern.findFirst = async () => ({ ...stale });
  await assert.rejects(service.resolveConcern(identity, 'k-1', { resolution: 'dismissed', note: 'Not relevant.' }), (e) => e.getStatus() === 409 && e.response.code === 'CONCERN_CHANGED');
  assert.deepEqual(concern.resolutionHistory.map((h) => h.action), historyAfterB, 'B\'s handling and reopening are still there');
  assert.deepEqual(historyAfterB, ['resolve', 'reopen']);
  assert.equal(audits.length, 2, 'nothing recorded for A');
});
