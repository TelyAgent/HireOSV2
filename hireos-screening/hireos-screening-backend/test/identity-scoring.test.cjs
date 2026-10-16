// #151 -- F03 §4.1–4.2: every identity signal is scored and added up, the total sorts the upload into one of
// three bands (≥ 70, 40–69, < 40), conflicts subtract, and nothing is ever merged automatically. Each check
// records its signals, points, total and policy version, and the review shows them with the two résumés' diff.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scoreIdentity, contentSimilarity, normalizeContent, IDENTITY_POLICY } = require('../dist/duplicates/identity-scoring');
const { DuplicatesService } = require('../dist/duplicates/duplicates.service');

const resume = (extra = '') => `Nina Torres
nina.torres@example.com | +1 415 555 0134
Experience
Senior Data Analyst, Example Retail — 2021-03 to present
Built pricing dashboards in SQL and Python for 120 stores and cut weekly reporting time by half.
Data Analyst, Sample Bank — 2018-07 to 2021-02
Maintained credit risk reports and automated the monthly reconciliation of 40 branch ledgers.
Education
Vietnam National University — B.Sc. Statistics (2014 – 2018)
${extra}`;
const existing = (over = {}) => ({
  name: 'Nina Torres', email: 'nina.torres@example.com', phone: '+1 415 555 0134', text: resume(),
  employment: [
    { company: 'Example Retail', title: 'Senior Data Analyst', start: '2021-03' },
    { company: 'Sample Bank', title: 'Data Analyst', start: '2018-07' },
  ],
  education: [{ school: 'Vietnam National University', major: 'Statistics', period: '2014 – 2018' }],
  ...over,
});
const keys = (score) => score.signals.map((s) => `${s.key}:${s.points}`);

test('#151 AC-1/AC-2: same email, phone, jobs, name and education — ≥ 70, a likely new version, all signals recorded', () => {
  const score = scoreIdentity(
    { name: 'Nina Torres', email: 'NINA.TORRES@example.com', phone: '+1 (415) 555-0134', text: resume('Led a pricing analytics guild across four regions and mentored six analysts.') },
    existing(),
  );
  assert.deepEqual(keys(score), ['email:40', 'phone:30', 'employment:20', 'name_exact:15', 'content:15', 'education:10']);
  assert.equal(score.band, 'new_resume_version');
  assert.equal(score.total, 100, 'capped at 100');
  assert.equal(score.policyVersion, IDENTITY_POLICY.version);
});

test('#151 AC-1/AC-2: 40–69 goes to review — same email and a near name, different phone', () => {
  const score = scoreIdentity(
    { name: 'Nina Tores', email: 'nina.torres@example.com', phone: '+1 212 555 0199', text: 'Short note.' },
    existing({ text: null, employment: [], education: [] }),
  );
  assert.deepEqual(keys(score), ['email:40', 'name_close:8']);
  assert.equal(score.total, 48);
  assert.equal(score.band, 'possible_same_person');
});

test('#151 AC-2/F03 AC-3: the same name alone is < 40 — no prompt, no review', () => {
  const score = scoreIdentity(
    { name: 'Nina Torres', email: null, phone: null, text: 'Nina Torres\nMarketing manager in Lisbon.' },
    existing({ text: null, employment: [], education: [] }),
  );
  assert.deepEqual(keys(score), ['name_exact:15']);
  assert.equal(score.band, 'none');
});

test('#151 AC-1: both sides have email and phone and both differ — the conflict subtracts 30', () => {
  const score = scoreIdentity(
    { name: 'Nina Torres', email: 'n.torres@other.example', phone: '+44 20 7946 0000', text: resume() },
    existing(),
  );
  assert.ok(keys(score).includes('contact_conflict:-30'));
  // Jobs 20 + name 15 + education 10 − 30 = 15: identical history alone, with every contact different, is no match.
  assert.equal(score.total, 15);
  assert.equal(score.band, 'none');
  assert.deepEqual(score.contact, { email: 'different', phone: 'different' });
});

test('#151 AC-1: content similarity — ≥ 0.95 is the same content, 0.80–0.95 a +15 signal, short texts not compared', () => {
  const base = resume();
  assert.equal(contentSimilarity(base, base.replace(/\n/g, '\n\n').toUpperCase()), 1, 'case, spacing and punctuation are ignored');
  const edited = base.replace('cut weekly reporting time by half', 'cut weekly reporting time by sixty percent');
  const similarity = contentSimilarity(base, edited);
  assert.ok(similarity >= 0.8 && similarity < 0.95, `similarity ${similarity}`);
  const score = scoreIdentity({ name: 'Someone Else', email: null, phone: null, text: edited }, existing({ name: 'Nina Torres', email: null, phone: null, employment: [], education: [], text: base }));
  assert.deepEqual(keys(score), ['content:15']);
  assert.equal(contentSimilarity('Nina Torres. Data analyst.', 'Nina Torres. Data analyst.'), null, 'under 200 characters');
});

test('#151: normalization drops full-width forms, page numbers and repeated headers', () => {
  const a = 'ＮＩＮＡ　Torres\nConfidential\nPage 1 of 2\nSQL・Python\nConfidential\n2\nConfidential';
  assert.equal(normalizeContent(a), 'ninatorressqlpython');
});

test('#151 AC-3: the review returns every signal, points, total, policy version, both versions and the paragraph diff', async () => {
  const score = scoreIdentity({ name: 'Nina Torres', email: 'nina.torres@example.com', phone: '+1 415 555 0134', text: resume('New: Led the pricing guild.') }, existing());
  const check = {
    id: 'd-1', kind: 'new_resume_version', status: 'open', confidence: score.total / 100,
    basis: { ...score, kind: 'new_resume_version', lines: score.signals.map((s) => s.detail) },
    resolutionOutcome: null, resolutionNote: null, resolvedBy: null, resolvedAt: null,
    material: { id: 'm-2', name: 'nina-2026.txt', createdAt: new Date('2026-10-16'), readStatus: 'available', errorCode: null, confirmedIdentity: null, sourceType: 'manual_upload',
      segments: [{ id: 's1', text: 'Nina Torres' }, { id: 's2', text: 'Senior Data Analyst, Example Retail' }, { id: 's3', text: 'New: Led the pricing guild.' }] },
    existingCandidate: {
      id: 'c-1', displayName: 'Nina Torres', email: 'nina.torres@example.com', phone: '+14155550134', createdAt: new Date('2026-10-01'),
      resumeVersions: [{ version: 1, source: 'manual_upload', material: { name: 'nina.txt', createdAt: new Date('2026-10-01'),
        segments: [{ id: 's1', text: 'Nina Torres' }, { id: 's2', text: 'Senior Data Analyst,  Example Retail' }, { id: 's3', text: 'Old summary line.' }] } }],
      profiles: [{ employmentHistory: existing().employment, education: existing().education }],
    },
  };
  const db = { duplicateCheck: { findFirst: async () => check } };
  const profiles = { extractIdentitySignals: () => ({ displayName: 'Nina Torres', email: 'nina.torres@example.com', phone: '+14155550134', location: null }) };
  const review = await new DuplicatesService(db, profiles, {}).get({ workspaceId: 'ws-1', actorId: 'hr-1', roles: [] }, 'd-1');
  assert.equal(review.scoring.policyVersion, IDENTITY_POLICY.version);
  assert.equal(review.scoring.total, score.total);
  assert.deepEqual(review.scoring.signals.map((s) => s.key), score.signals.map((s) => s.key));
  assert.equal(review.uploaded.version, 2);
  assert.equal(review.existing.version, 1);
  assert.equal(review.existing.employment.length, 2);
  assert.deepEqual(review.differences, { added: ['New: Led the pricing guild.'], removed: ['Old summary line.'], unchanged: 2 });

  // A check made before scoring keeps working: readable lines, no breakdown.
  check.basis = ['Email on the resume matches an existing candidate\'s email: nina.torres@example.com'];
  const legacy = await new DuplicatesService(db, profiles, {}).get({ workspaceId: 'ws-1', actorId: 'hr-1', roles: [] }, 'd-1');
  assert.equal(legacy.scoring, null);
  assert.equal(legacy.basis.length, 1);
});

test('#154: the import batch returns, per flagged item, how its email and phone compare — the same comparison the review shows', async () => {
  const { ImportsService } = require('../dist/intake/imports.service');
  const score = scoreIdentity({ name: 'Nina Torres', email: 'nina.torres@example.com', phone: null, text: '' }, existing({ text: null }));
  assert.deepEqual(score.contact, { email: 'same', phone: 'missing_uploaded' }, 'a missing phone is not a different one');
  const item = { id: 'i-1', fileName: 'nina.txt', sizeKB: 1, outcome: 'possible_same_person', stage: 'needs_identity_review', status: 'needs_review',
    errorCode: null, errorMessage: null, retryable: false, attemptCount: 1, completedAt: null, materialId: 'm-1', duplicateOfMaterialId: null,
    candidateId: null, duplicateReviewId: 'd-1', businessConsumeStatus: 'pending' };
  const db = {
    importBatch: { findFirst: async () => ({ id: 'b-1', operationId: null, createdAt: new Date(), status: 'partial', targetJobId: null, items: [item, { ...item, id: 'i-2', duplicateReviewId: null, outcome: 'new_candidate', status: 'completed' }] }) },
    duplicateCheck: { findMany: async () => [{ id: 'd-1', basis: { ...score, lines: [] } }] },
  };
  const batch = await new ImportsService(db, {}, {}, {}).getBatch('ws-1', 'b-1');
  assert.deepEqual(batch.items[0].duplicateContact, { email: 'same', phone: 'missing_uploaded' });
  assert.equal(batch.items[1].duplicateContact, undefined);
});
