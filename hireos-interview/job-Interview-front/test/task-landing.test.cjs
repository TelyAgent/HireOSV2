const assert = require('node:assert/strict');
const test = require('node:test');

test('#303: each unambiguous task state opens its specified screen', async () => {
  const { taskLandingScreen } = await import('../src/utils/taskLanding.ts');
  const expected = { draft: 'overview', requirements_ready: 'rubric', planning: 'plan', ready_to_schedule: 'schedule', interview_in_progress: 'live', evidence_requested: 'debrief', awaiting_confirmation: 'decision', package_published: 'package', on_hold: 'overview' };
  for (const [status, screen] of Object.entries(expected)) assert.equal(taskLandingScreen(status), screen, status);
  for (const status of ['unknown', 'review_pending', 'not_proceeding', 'withdrawn', '__proto__']) assert.equal(taskLandingScreen(status), 'overview');
});

test('#303: navigation continues to enforce the existing locked-stage guard', async () => {
  const { flowGateReason } = await import('../src/utils/flowGate.ts');
  assert.match(flowGateReason({ stages: [{ stage: 'live', unlocked: false }] }, 'live', false), /Generate the Interview Brief/);
  assert.equal(flowGateReason({ stages: [{ stage: 'live', unlocked: true }] }, 'live', false), null);
  assert.match(flowGateReason({ stages: [{ stage: 'rubric', needsRepair: true }] }, 'live', false), /needs repair/);
});
