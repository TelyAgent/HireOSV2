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
    evidence: [{ requirement: 'Design APIs', score: 4, note: 'Clear tradeoffs', roundName: 'Technical', sourceRefs: [{ quote: 'I designed the API' }] }],
    hrConfirmedBy: 'hr-1', hrConfirmedAt: new Date('2026-01-01T01:00:00Z'), hmConfirmedBy: 'hm-1', hmConfirmedAt: new Date('2026-01-01T02:00:00Z'),
  }));
  assert.equal(pdf.subarray(0, 8).toString(), '%PDF-1.4');
  assert.match(pdf.toString('latin1'), /Design APIs/);
  assert.match(pdf.toString('latin1'), /I designed the API/);
  assert.match(pdf.toString('latin1'), /hr-1/);
});
