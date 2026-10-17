// #214 -- the decision's handoff state comes from its outbox event: none for record-only, else queued until sent.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handoffStatusOf, serializeDecision } = require('../dist/decisions/decisions.service');

test('handoff status from the decision and its events', () => {
  assert.equal(handoffStatusOf({ nextStepTarget: 'record_only' }, []), 'none');
  assert.equal(handoffStatusOf({ nextStepTarget: 'move_to_interview' }, []), 'queued');
  assert.equal(handoffStatusOf({ nextStepTarget: 'move_to_interview' }, [{ status: 'pending' }]), 'queued');
  assert.equal(handoffStatusOf({ nextStepTarget: 'send_assessment' }, [{ status: 'sending' }]), 'queued');
  assert.equal(handoffStatusOf({ nextStepTarget: 'send_assessment' }, [{ status: 'dispatched' }]), 'sent');
  assert.equal(handoffStatusOf({ nextStepTarget: 'move_to_interview' }, [{ status: 'failed' }]), 'failed');
});

test('serializing without a status leaves the field out (withdrawn history)', () => {
  const decision = { id: 'd', applicationId: 'a', outcome: 'hold', reason: 'r', actorId: 'u', createdAt: new Date(), status: 'withdrawn', overrideAi: false, nextStepTarget: 'record_only' };
  assert.equal('handoffStatus' in serializeDecision(decision), false);
  assert.equal(serializeDecision(decision, 'none').handoffStatus, 'none');
});
