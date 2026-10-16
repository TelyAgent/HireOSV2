// #179 -- protected attributes, their proxies and unverifiable judgements can't become screening requirements:
// refused with a reason and an alternative, by the server too, with nothing written; ordinary requirements pass.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requirementProblem } = require('../dist/jobs/requirement-policy');
const { JobsService } = require('../dist/jobs/jobs.service');

const PROTECTED = ['限男性 35岁以下', 'Male only, under 35', 'age under 30', '女性优先', '已婚已育', '本地户口', 'Height 170cm+', 'No children', 'Must be Christian'];
const VAGUE = ['Great person', 'good attitude', 'Culture fit', '人品好'];
const FINE = [
  '5+ years of backend experience', 'Experience with single sign-on (SSO)', "Built products for women's fashion e-commerce", '有女性用户产品经验',
  'Led a team of over 10 engineers', 'Supported clients in over 20 countries', 'Healthy test coverage habits', 'Fluent English and Mandarin', '3 年以上 Java 开发经验',
];

test('#179 AC-1: protected attributes and proxies are refused, with an alternative', () => {
  for (const label of PROTECTED) {
    const problem = requirementProblem(label);
    assert.equal(problem?.kind, 'protected_attribute', label);
    assert.ok(problem.suggestion.length > 10, label);
  }
  assert.equal(requirementProblem('限男性 35岁以下').attribute, 'sex');
  assert.equal(requirementProblem('age under 30').attribute, 'age');
});

test('#179 AC-2: vague statements no résumé could verify are refused and asked to be rewritten', () => {
  for (const label of VAGUE) assert.equal(requirementProblem(label)?.kind, 'unverifiable', label);
});

test('#179 AC-4: ordinary, specific requirements are not caught', () => {
  for (const label of FINE) assert.equal(requirementProblem(label), null, label);
});

function service(criteriaStatus = 'draft') {
  const writes = [];
  const job = { id: 'j-1', workspaceId: 'ws-1', criteriaStatus, criteriaVersions: [{ id: 'cv-1', version: 2, requirements: [], dimensions: [] }] };
  const db = {
    job: { findFirst: async () => job, update: async (a) => writes.push(['job', a]) },
    jobCriteriaVersion: { update: async (a) => writes.push(['criteria', a]) },
  };
  db.$transaction = async (ops) => writes.push(['tx', ops]);
  const facade = { isRemote: () => false, update: async () => writes.push(['remote']), confirm: async () => writes.push(['remote']) };
  const s = new JobsService(db, {}, facade);
  s.find = async () => job;
  return { s, writes, job };
}
const dims = [{ id: 'd1', name: 'Skills', weight: 0.4, rubric: 'x' }, { id: 'd2', name: 'Experience', weight: 0.3, rubric: 'x' }, { id: 'd3', name: 'Seniority', weight: 0.3, rubric: 'x' }];
const req = (label) => ({ id: 'r1', label, dimension: 'd1', priority: 'must_have', hard: true, kind: 'other' });
const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: [] };

test('#179 AC-3: the edit and confirm endpoints refuse them too, writing nothing', async () => {
  for (const label of ['Male only, under 35', '限男性 35岁以下', 'Great person']) {
    const { s, writes } = service();
    await assert.rejects(s.updateCriteria(identity, 'j-1', { requirements: [req(label)], dimensions: dims }),
      (e) => e.getStatus() === 422 && e.response.code === 'REQUIREMENT_NOT_ALLOWED' && e.response.problems[0].requirementId === 'r1');
    assert.deepEqual(writes, [], label);
  }
  const { s, writes, job } = service();
  job.criteriaVersions[0].requirements = [req('age under 30')];
  job.criteriaVersions[0].dimensions = dims;
  await assert.rejects(s.confirmCriteria(identity, 'j-1', 'hr-1'), (e) => e.response.code === 'REQUIREMENT_NOT_ALLOWED');
  assert.deepEqual(writes, [], 'nothing confirmed, nothing rewritten');
});

test('#179 AC-4: a specific requirement saves as usual', async () => {
  const { s, writes } = service();
  s.get = async () => ({ ok: true });
  await s.updateCriteria(identity, 'j-1', { requirements: [req('5+ years of backend experience')], dimensions: dims });
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], 'criteria');
});
