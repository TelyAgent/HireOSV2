// Issue #19 — what an evaluation records about how it was scored, and when a re-run reuses a result.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  AI_EVALUATOR, LOCAL_EVALUATOR, evaluationInputHash, canReuseEvaluation, evaluationMetadata,
} = require('../dist/screening/evaluation-identity');

const base = {
  evaluator: AI_EVALUATOR,
  modelVersion: 'gpt-5.6-luna',
  jobTitle: 'Senior Backend Engineer',
  dimensions: [{ id: 'd1', name: 'Skills', weight: 0.5, rubric: 'Node.js' }, { id: 'd2', name: 'Experience', weight: 0.5, rubric: '5y' }],
  hardRequirements: [{ id: 'r1', label: 'Mandarin', kind: 'language' }],
  profileVersion: 3,
  criteriaVersion: 2,
  materialId: 'm1',
  resumeText: 'Ten years of Node.js and PostgreSQL.',
};

test('AC-4: identical inputs hash identically, regardless of key order', () => {
  const reordered = { resumeText: base.resumeText, materialId: 'm1', criteriaVersion: 2, profileVersion: 3, hardRequirements: base.hardRequirements,
    dimensions: base.dimensions.map((d) => ({ rubric: d.rubric, weight: d.weight, name: d.name, id: d.id })), jobTitle: base.jobTitle, modelVersion: base.modelVersion, evaluator: AI_EVALUATOR };
  assert.equal(evaluationInputHash(base), evaluationInputHash(reordered));
});

test('AC-4: any input that can change a score changes the hash', () => {
  const h = evaluationInputHash(base);
  for (const change of [
    { resumeText: base.resumeText + ' Kubernetes.' },
    { profileVersion: 4 },
    { criteriaVersion: 3 },
    { modelVersion: 'another-model' },
    { evaluator: LOCAL_EVALUATOR, modelVersion: null },
    { jobTitle: 'Staff Backend Engineer' },
    { dimensions: [{ ...base.dimensions[0], weight: 0.6 }, { ...base.dimensions[1], weight: 0.4 }] },
    { hardRequirements: [] },
    { materialId: 'm2' },
  ]) {
    assert.notEqual(evaluationInputHash({ ...base, ...change }), h, JSON.stringify(change));
  }
});

test('AC-4: only a current, completed snapshot with the same input hash is reused', () => {
  const h = evaluationInputHash(base);
  const latest = { status: 'completed', freshness: 'current', inputManifest: { inputHash: h } };
  assert.equal(canReuseEvaluation(latest, h), true);
  assert.equal(canReuseEvaluation(latest, evaluationInputHash({ ...base, profileVersion: 9 })), false);
  assert.equal(canReuseEvaluation({ ...latest, freshness: 'stale' }, h), false);
  assert.equal(canReuseEvaluation({ ...latest, inputManifest: { evaluator: AI_EVALUATOR } }, h), false, 'pre-#19 rows have no hash');
  assert.equal(canReuseEvaluation(null, h), false);
});

test('AC-5/AC-7: metadata reflects how the evaluation was actually produced', () => {
  assert.deepEqual(evaluationMetadata(true, 0.83, 'gpt-5.6-luna'), { evaluationMode: 'ai', aiStatus: 'succeeded', confidence: 0.83, modelVersion: 'gpt-5.6-luna' });
  assert.deepEqual(evaluationMetadata(false, null, null), { evaluationMode: 'rules', aiStatus: 'not_used', confidence: null, modelVersion: null });
  assert.notEqual(evaluationMetadata(true, 0.83, 'm').confidence, evaluationMetadata(true, 0.41, 'm').confidence, 'confidence comes from the model, not a constant');
});
