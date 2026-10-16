const { test } = require('node:test');
const assert = require('node:assert/strict');
const { offerTimelineIssue } = require('../dist/intake/tasks.service');

const date = (value) => new Date(`2026-01-01T00:0${value}:00Z`);
const complete = { decision: 'recommend_offer', decisionAt: date(1), hrConfirmedAt: date(2), hmConfirmedAt: date(3), offerSentAt: date(4) };

test('offer handoff timeline accepts a strictly ordered package', () => {
  assert.equal(offerTimelineIssue(complete), null);
});

test('offer handoff timeline rejects a handoff before any prerequisite', () => {
  assert.equal(offerTimelineIssue({ ...complete, offerSentAt: date(1) }), 'OFFER_BEFORE_DECISION');
  assert.equal(offerTimelineIssue({ ...complete, offerSentAt: date(2) }), 'OFFER_BEFORE_HR_CONFIRMATION');
  assert.equal(offerTimelineIssue({ ...complete, offerSentAt: date(3) }), 'OFFER_BEFORE_HM_CONFIRMATION');
});

test('offer handoff timeline flags legacy records missing prerequisites', () => {
  assert.equal(offerTimelineIssue({ ...complete, decisionAt: null }), 'OFFER_PREREQUISITES_INCOMPLETE');
});
