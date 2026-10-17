// #393 -- a result is published only with both approvals; a request without them changes nothing.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { InvitationsService } = require('../dist/invitations/invitations.service');

const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: ['hr'] };
const body = { overall: 60, showScore: true, outcomeText: 'o', feedbackText: 'f', nextStepText: 'n', assessmentOutcome: 'not_met' };

function service() {
  const touched = [];
  const db = new Proxy({}, { get: (_t, model) => new Proxy({}, { get: (_m, op) => async () => { touched.push(`${String(model)}.${String(op)}`); return null; } }) });
  return { svc: new InvitationsService(db, {}, { get: (_k, d) => d }, {}, { advance: async () => {}, lockCase: async () => null }), touched };
}

test('#393 AC-3: without one or both approvals the request is refused with 422 and nothing is read or written', async () => {
  for (const approvals of [{}, { reviewComplete: true }, { disclosureApproved: true }, { reviewComplete: false, disclosureApproved: true }]) {
    const { svc, touched } = service();
    await assert.rejects(svc.releaseResult(identity, 'case-1', { ...body, ...approvals }), (e) => {
      assert.equal(e.getStatus(), 422);
      assert.equal(e.getResponse().code, 'INVALID_SCHEMA');
      const expected = ['reviewComplete', 'disclosureApproved'].filter((k) => approvals[k] !== true);
      assert.deepEqual(e.getResponse().fieldPaths.sort(), expected.sort());
      return true;
    }, JSON.stringify(approvals));
    assert.deepEqual(touched, [], 'no database call');
  }
});

test('#393: the HTTP validation also requires both to be true', async () => {
  const { plainToInstance } = require('class-transformer');
  const { validate } = require('class-validator');
  const { ReleaseResultDto } = require('../dist/invitations/case-result.dto');
  const errors = async (extra) => (await validate(plainToInstance(ReleaseResultDto, { ...body, ...extra }))).map((e) => e.property).sort();
  assert.deepEqual(await errors({}), ['disclosureApproved', 'reviewComplete']);
  assert.deepEqual(await errors({ reviewComplete: 'true', disclosureApproved: true }), ['reviewComplete']);
  assert.deepEqual(await errors({ reviewComplete: true, disclosureApproved: true }), []);
});

test('#397: new releases require a structured human outcome; free text and score cannot substitute', async () => {
  for (const assessmentOutcome of [undefined, null, '', 'passed', 'unknown']) {
    const { svc, touched } = service();
    await assert.rejects(svc.releaseResult(identity, 'case-1', { ...body, assessmentOutcome, reviewComplete: true, disclosureApproved: true }), e => {
      assert.deepEqual(e.getResponse().fieldPaths, ['assessmentOutcome']);
      return true;
    });
    assert.deepEqual(touched, []);
  }
});
