// #181 #182 #183 -- a recommendation the résumé explicitly rules out is "not eligible" (quoted, and checked
// against the résumé); missing information never is; evidence quotes are checked against the text the match
// read; every recommendation says which profile version, criteria version and match run it came from, and a
// stale one keeps pointing at those.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DiscoveryService, toFrontendRecommendation, quoteInText } = require('../dist/discovery/discovery.service');

const BEN = `Ben Lim
Senior product manager, Example Fintech (2019-01 to present)
I can only work remotely from Singapore and cannot relocate to Beijing.
Skills: roadmap, SQL, user research`;
const LIN = `Lin Zhou
Product manager, Example Retail (2020-03 to present)
Skills: roadmap, SQL`;

function setup(aiAnswer) {
  const created = { evaluations: [], recommendations: [] };
  const db = {
    candidateJobRecommendation: {
      findFirst: async () => null,
      findMany: async () => [],
      updateMany: async () => ({}),
      create: async ({ data }) => { created.recommendations.push(data); return { id: 'r-1', ...data }; },
    },
    preLinkMatchEvaluation: { create: async ({ data }) => { created.evaluations.push(data); return { id: 'e-1', ...data }; } },
  };
  db.$transaction = async (fn) => fn(db);
  const ai = { isConfigured: () => true, evaluate: async () => aiAnswer };
  const service = new DiscoveryService(db, ai);
  service.createLinkConfirmationTask = async () => {};
  service.closeLinkConfirmationTask = async () => {};
  return { service, created };
}
const job = {
  id: 'j-bj', title: 'AI产品经理', team: '产品部', seniority: 'senior', location: 'Beijing, China (on-site)',
  criteriaVersions: [{ version: 3, requirements: [{ id: 'req-1', label: 'Product roadmap ownership', hard: true }], dimensions: [{ id: 'd-1', name: 'Skills', weight: 1 }] }],
};
const candidate = (text) => ({ id: 'c-1', displayName: 'Ben Lim', profiles: [{ version: 2, skills: [] }], resumeVersions: [{ material: { id: 'm-7', text } }] });
const answer = (over = {}) => ({
  overallScore: 82, coverage: 0.9, confidence: 0.85, rationale: 'Strong product background.',
  dimensionScores: [{ dimensionId: 'd-1', score: 80, rationale: '' }],
  requirementFindings: [{ requirementId: 'req-1', met: true, evidence: 'Senior product manager, Example Fintech' }],
  gaps: [], conflicts: [], ...over,
});

test('#181 AC-1: an explicit location conflict quoted from the résumé makes the recommendation "not eligible"', async () => {
  const { service, created } = setup(answer({ conflicts: [{ requirement: 'Job location', quote: 'I can only work remotely from Singapore and cannot relocate to Beijing.' }] }));
  await service['matchCandidateForJob']('ws-1', candidate(BEN), job, 'run-9');
  assert.equal(created.evaluations[0].eligibility, 'not_eligible');
  assert.deepEqual(created.evaluations[0].conflicts.map((c) => c.requirement), ['Job location']);
  assert.equal(created.recommendations.length, 1, 'the recommendation stays viewable');
});

test('#181 AC-1 (F06 FR-5): a ruled-out match is still shown as a recommendation even when its score is low', async () => {
  const { service, created } = setup(answer({ overallScore: 12, conflicts: [{ requirement: 'Job location', quote: 'cannot relocate to Beijing' }] }));
  const result = await service['matchCandidateForJob']('ws-1', candidate(BEN), job, 'run-9');
  assert.equal(result.recommendationsCreated, 1);
  assert.equal(created.evaluations[0].eligibility, 'not_eligible');
  const below = setup(answer({ overallScore: 12 }));
  assert.equal((await below.service['matchCandidateForJob']('ws-1', candidate(LIN), job, 'run-9')).recommendationsCreated, 0, 'a low score alone still is no match');
});

test('#181 AC-3: no explicit statement — or a "conflict" whose quote isn\'t in the résumé — is not a conflict', async () => {
  const unknown = setup(answer());
  await unknown.service['matchCandidateForJob']('ws-1', candidate(LIN), job, 'run-9');
  assert.equal(unknown.created.evaluations[0].eligibility, 'eligible');
  const invented = setup(answer({ conflicts: [{ requirement: 'Job location', quote: 'Lin refuses to work in Beijing.' }] }));
  await invented.service['matchCandidateForJob']('ws-1', candidate(LIN), job, 'run-9');
  assert.equal(invented.created.evaluations[0].eligibility, 'eligible');
  assert.deepEqual(invented.created.evaluations[0].conflicts, []);
});

test('#183 AC-1: evidence quotes are checked against the text the match read, with the requirement and the material', async () => {
  const { service, created } = setup(answer({ requirementFindings: [
    { requirementId: 'req-1', met: true, evidence: 'Senior product manager, Example Fintech' },
    { requirementId: 'req-1', met: true, evidence: 'Led a team of 40 engineers' },
    { requirementId: 'req-1', met: true, evidence: '有多年产品经验', quote: 'Skills: roadmap, SQL, user research' },
  ] }));
  await service['matchCandidateForJob']('ws-1', candidate(BEN), job, 'run-9');
  const evidence = created.evaluations[0].evidence;
  assert.deepEqual(evidence.map((e) => [e.requirementLabel, e.verified, e.sourceMaterialId]), [
    ['Product roadmap ownership', true, 'm-7'],
    ['Product roadmap ownership', false, 'm-7'],
    ['Product roadmap ownership', true, 'm-7'],
  ]);
  assert.equal(evidence[2].evidence, 'Skills: roadmap, SQL, user research', 'the verbatim excerpt is what is shown');
  assert.equal(evidence[2].explanation, '有多年产品经验');
  assert.equal(quoteInText('SENIOR product manager — Example Fintech', BEN), true, 'case, dashes and spacing are ignored');
});

const rec = (over = {}) => ({
  id: 'r-1', candidateId: 'c-1', jobId: 'j-bj', status: 'proposed', createdAt: new Date('2026-10-15'), confidence: 0.85, rationale: 'Strong.',
  gaps: [], staleReason: null, proposalSource: 'ai', applicationRef: null, discoveryRunId: 'run-9',
  prelinkEvaluation: {
    profileVersion: 2, criteriaVersion: 3, discoveryRunId: 'run-9', createdAt: new Date('2026-10-15T08:00:00Z'), eligibility: 'not_eligible',
    conflicts: [{ requirement: 'Job location', quote: 'cannot relocate to Beijing' }],
    evidence: [{ requirementId: 'req-1', requirementLabel: 'Product roadmap ownership', evidence: 'Senior product manager', sourceMaterialId: 'm-7', verified: true }],
  },
  ...over,
});

test('#181 AC-2 / #183 AC-2: the API returns eligibility, conflicts, evidence with its check, and the versions and run used', () => {
  const out = toFrontendRecommendation(rec());
  assert.equal(out.eligibility, 'not_eligible');
  assert.deepEqual(out.conflicts, [{ requirement: 'Job location', quote: 'cannot relocate to Beijing' }]);
  assert.deepEqual(out.basis, { profileVersion: 2, criteriaVersion: 3, discoveryRunId: 'run-9', evaluatedAt: '2026-10-15T08:00:00.000Z' });
  assert.deepEqual(out.evidence[0], { requirementId: 'req-1', requirementLabel: 'Product roadmap ownership', quote: 'Senior product manager', sourceMaterialId: 'm-7', verification: 'found' });
});

test('#182 / #183 AC-3: a stale recommendation keeps the versions it was made from; older evidence reads as unchecked', () => {
  const stale = toFrontendRecommendation(rec({ status: 'stale', staleReason: 'Replaced by a newer discovery run.', prelinkEvaluation: {
    ...rec().prelinkEvaluation, eligibility: null, conflicts: null, evidence: [{ requirementId: 'req-1', evidence: 'Product manager' }],
  } }));
  assert.equal(stale.status, 'stale');
  assert.equal(stale.basis.profileVersion, 2, 'not the newer profile');
  assert.equal(stale.eligibility, undefined);
  assert.equal(stale.evidence[0].verification, 'unchecked');
});

test('#182 AC-2: a stale recommendation cannot be confirmed through the API either', async () => {
  const { LinkingService } = require('../dist/linking/linking.service');
  const db = { candidateJobRecommendation: { findFirst: async () => ({ ...rec({ status: 'stale' }), applicationRef: null, job: { criteriaVersions: [] }, candidate: { profiles: [] } }) } };
  const service = new LinkingService(db, {}, {}, {});
  await assert.rejects(service.confirmRecommendation({ workspaceId: 'ws-1', actorId: 'hr-1', roles: [] }, 'r-1'),
    (e) => e.getStatus() === 409 && e.response.code === 'RECOMMENDATION_NOT_CONFIRMABLE' && e.response.status === 'stale');
});
