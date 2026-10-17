// #93 -- Publish called directly (bypassing the button) is refused on the same conditions: AI-written text not yet
// kept, no AI Analyze on the saved revision, or one with issues left -- and refusing it publishes nothing.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { VersionsService } = require('../dist/drafts/versions.service');

const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: ['hr'], kind: 'user' };
const BLOCKS = [{ id: 'b1', kind: 'h2', text: 'Ops Lead', level: 'public' }, { id: 'b2', kind: 'p', text: 'Runs ops.', level: 'public' }];
const CLEAN = { verdict: 'ready', summary: '', items: [{ severity: 'suggestion', reason: 'Could add a team size.' }] };

function setup(doc) {
  const touched = [];
  const db = {
    jobDocument: { findUnique: async () => doc },
    jobDocumentVersion: {
      findFirst: async () => null,
      create: async ({ data }) => { touched.push('version'); return { id: 'v1', publishedAt: new Date(), ...data }; },
    },
    jdCode: { findUnique: async () => ({ code: 'JD-1' }), findFirst: async () => null, create: async ({ data }) => data },
    $executeRaw: async () => 1,
  };
  db.$transaction = async (fn) => fn(db);
  const core = {
    getJob: async () => { touched.push('core.getJob'); return { id: 'job-1', status: 'open' }; },
    updateJob: async () => { touched.push('core.updateJob'); return { id: 'job-1', status: 'open' }; },
  };
  return { versions: new VersionsService(db, core), touched };
}
const doc = (over = {}) => ({ workspaceId: 'ws-1', jobId: 'job-1', audience: 'internal', blocks: BLOCKS, revision: 3, aiAnalysis: CLEAN, aiAnalysisRevision: 3, ...over });
const refusedWith = (code) => (e) => e.getStatus() === 409 && e.getResponse().code === code;

test('AC-1/AC-5: an AI-written block not yet kept refuses Publish, with nothing published', async () => {
  const { versions, touched } = setup(doc({ blocks: [BLOCKS[0], { ...BLOCKS[1], aiDraft: true }] }));
  await assert.rejects(versions.publish(identity, 'job-1', { revision: 3 }), refusedWith('AI_DRAFT_UNCONFIRMED'));
  assert.deepEqual(touched, []);
});

test('AC-3/AC-5: no AI Analyze on the saved revision, or an old one, refuses Publish', async () => {
  for (const over of [{ aiAnalysis: null, aiAnalysisRevision: null }, { aiAnalysisRevision: 2 }]) {
    const { versions, touched } = setup(doc(over));
    await assert.rejects(versions.publish(identity, 'job-1', { revision: 3 }), refusedWith('ANALYSIS_REQUIRED'));
    assert.deepEqual(touched, []);
  }
});

test('AC-2/AC-5: an analysis with an item to revise refuses Publish; suggestions alone do not', async () => {
  const revise = { ...CLEAN, items: [...CLEAN.items, { severity: 'revise', reason: 'D1 too many requirements' }] };
  const blocked = setup(doc({ aiAnalysis: revise }));
  await assert.rejects(blocked.versions.publish(identity, 'job-1', { revision: 3 }), refusedWith('ANALYSIS_NOT_READY'));
  assert.deepEqual(blocked.touched, []);
  const ok = setup(doc());
  await ok.versions.publish(identity, 'job-1', { revision: 3 });
  assert.ok(ok.touched.includes('version'));
});
