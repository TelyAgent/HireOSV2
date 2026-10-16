const { test } = require('node:test');
const assert = require('node:assert/strict');
const { taskStages } = require('../dist/intake/task-stages');
const { buildPackagePdf, packagePdfLines } = require('../dist/intake/package-pdf');

function dbFor({ rubric = null, questions = 0, parseJobs = 0, planConfirmedAt = null, rounds = [] } = {}) {
  return {
    interviewTask: { findFirstOrThrow: async () => ({ jobId: 'job-1', planConfirmedAt, reviewConfirmedAt: null, debriefConfirmedAt: null, decision: null, rounds }) },
    rubricVersion: { findFirst: async () => rubric },
    interviewQuestion: { count: async () => questions },
    parseJob: { count: async () => parseJobs },
  };
}

test('marks a historical plan/schedule inconsistency for repair', async () => {
  const stages = await taskStages(dbFor({ planConfirmedAt: new Date(), rounds: [{ scheduledAt: new Date(), status: 'Planned' }] }), 'ws-1', 'task-1');
  const byName = Object.fromEntries(stages.map((stage) => [stage.stage, stage]));
  assert.equal(byName.rubric.done, false);
  assert.equal(byName.plan.done, false);
  assert.equal(byName.schedule.done, false);
  assert.equal(byName.plan.unlocked, false);
  assert.equal(byName.plan.needsRepair, true);
  assert.equal(byName.plan.repairCode, 'RUBRIC_NOT_CONFIRMED');
});

test('keeps a confirmed rubric flow healthy and preserves later-stage completion', async () => {
  const stages = await taskStages(dbFor({
    rubric: { id: 'rubric-1', versionNumber: 2 },
    questions: 1,
    planConfirmedAt: new Date(),
    rounds: [{ scheduledAt: new Date(), status: 'completed' }],
  }), 'ws-1', 'task-1');
  const byName = Object.fromEntries(stages.map((stage) => [stage.stage, stage]));
  assert.equal(byName.rubric.done, true);
  assert.equal(byName.plan.done, true);
  assert.equal(byName.schedule.done, true);
  assert.equal(byName.live.done, true);
  assert.equal(byName.plan.needsRepair, undefined);
});

test('renders a downloadable PDF manifest with scores, evidence and confirmations', () => {
  const pdf = buildPackagePdf(packagePdfLines({
    candidateName: 'Candidate', jobTitle: 'Engineer', decision: 'recommend_offer', decisionAt: new Date('2026-01-01T00:00:00Z'),
    needsReview: true, reviewReason: 'RUBRIC_UPDATED', invalidatedAt: new Date('2026-01-02T00:00:00Z'),
    evidence: [{ requirement: '设计 API', expectedEvidence: 'Explains tradeoffs', levelAnchors: { l1: 'basic' }, score: 4, note: 'Clear tradeoffs'.repeat(3), roundId: 'round-1', roundName: 'Technical', sourceRefs: [{ segmentId: 'line-1', quote: 'I designed the API' }] }],
    hrConfirmedBy: 'hr-1', hrConfirmedAt: new Date('2026-01-01T01:00:00Z'), hrConfirmationNote: 'Reviewed evidence', hmConfirmedBy: 'hm-1', hmConfirmedAt: new Date('2026-01-01T02:00:00Z'), hmConfirmationNote: 'Approved for handoff',
  }));
  assert.equal(pdf.subarray(0, 8).toString(), '%PDF-1.4');
  assert.match(pdf.toString('latin1'), /STSong-Light/);
  assert.match(pdf.toString('latin1'), /0049002000640065007300690067006e0065006400200074006800650020004100500049/);
  assert.match(pdf.toString('latin1'), /00480052003a002000680072002d0031/);
  assert.match(pdf.toString('latin1'), /005200450056004900450057002000520045005100550049005200450044/);
  assert.match(pdf.toString('latin1'), /00450076006900640065006e006300650020006c0069006e006b003a0020002f0068006900720065006f0073002f0069006e0074006500720076006900650077002f006100700069/);
  assert.match(pdf.toString('latin1'), /0031002f007400720061006e007300630072006900700074002f006c0069006e0065002d0031/);
  assert.match(pdf.toString('latin1'), /004800520020006e006f00740065003a002000520065007600690065007700650064002000650076006900640065006e00630065/);
});

test('paginates long package manifests instead of overflowing the printable page', () => {
  const pdf = buildPackagePdf(Array.from({ length: 100 }, (_, i) => ({ text: `Evidence row ${i}` })));
  assert.match(pdf.toString('latin1'), /\/Count 3/);
});
