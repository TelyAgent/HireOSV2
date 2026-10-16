// #151 -- F03 §4.1–4.2: every identity signal is scored and added up, the total sorts the upload into one of
// three bands (≥ 70, 40–69, < 40), conflicts subtract, and nothing is ever merged automatically. Each check
// records its signals, points, total and policy version, and the review shows them with the two résumés' diff.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scoreIdentity, contentSimilarity, normalizeContent, IDENTITY_POLICY } = require('../dist/duplicates/identity-scoring');
const { DuplicatesService } = require('../dist/duplicates/duplicates.service');

const { resume, existing, reviewCheck, reviewResponse } = require('./fixtures/f03/review-check.cjs');
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
  const { score, check } = reviewCheck();
  const db = { duplicateCheck: { findFirst: async () => check } };
  const profiles = { extractIdentitySignals: () => ({ displayName: 'Nina Torres', email: 'nina.torres@example.com', phone: '+14155550134', location: null }) };
  const review = await reviewResponse(check);
  // The frontend renders exactly this answer in its test: the file it reads must be the API's current output.
  const fixture = JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname, '../../hireos-screening-front/test/unit/fixtures/duplicate-review.json'), 'utf8'));
  assert.deepEqual(fixture, JSON.parse(JSON.stringify(review)), 'regenerate it: node scripts/gen-duplicate-review-fixture.cjs');
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

test('#151 AC-1 (review): jobs count as shared only entry by entry — swapped start months are not the same jobs', () => {
  const swapped = `Nina Torres
nina.torres@example.com
Experience
Senior Data Analyst, Example Retail — 2018-07 to 2021-02
Built pricing dashboards in SQL and Python for 120 stores.
Data Analyst, Sample Bank — 2021-03 to present
Maintained credit risk reports.`;
  const score = scoreIdentity({ name: 'Nina Torres', email: 'nina.torres@example.com', phone: null, text: swapped }, existing());
  assert.ok(!keys(score).includes('employment:20'), keys(score).join(','));
  // The same jobs written company on one line, title and dates below, and with month names, still count.
  const splitLines = `Nina Torres
Example Retail
Senior Data Analyst · Mar 2021 – present
Sample Bank
Data Analyst · Jul 2018 – Feb 2021`;
  const again = scoreIdentity({ name: 'Nina Torres', email: null, phone: null, text: splitLines }, existing());
  assert.ok(keys(again).includes('employment:20'), keys(again).join(','));
});

test('#151 AC-1/AC-2 (review): every candidate is scored — the best match is found past 50 same-name records, and without any contact or name hit', async () => {
  const { ImportsService } = require('../dist/intake/imports.service');
  const record = (id, over = {}) => ({
    id, displayName: 'Nina Torres', email: null, phone: null,
    profiles: [{ employmentHistory: [], education: [] }],
    resumeVersions: [{ material: { id: `m-${id}`, text: 'An unrelated résumé about warehouse logistics and forklift safety training.' } }],
    ...over,
  });
  const scan = async (rows, signals, text) => {
    const db = {
      candidate: {
        findMany: async ({ take, cursor }) => {
          const from = cursor ? rows.findIndex((r) => r.id === cursor.id) + 1 : 0;
          return rows.slice(from, from + take);
        },
      },
    };
    const service = new ImportsService(db, {}, {}, {});
    return service['findPossibleDuplicate']('ws-1', { id: 'm-new', name: 'new.pdf', normalizedTextHash: null, text }, signals);
  };
  // 60 people of the same name first, then the real one with the same phone: 15 each vs 45.
  const crowd = Array.from({ length: 60 }, (_, i) => record(`c${String(i).padStart(3, '0')}`));
  const real = record('c999', { phone: '+1 415 555 0134' });
  const found = await scan([...crowd, real], { displayName: 'Nina Torres', email: null, phone: '+1 415 555 0134' }, resume());
  assert.equal(found?.candidate.id, 'c999');
  assert.equal(found.kind, 'possible_same_person');
  // A different name and no contact at all, but similar content, both jobs and the same education: 45, a review.
  const quiet = record('c500', {
    displayName: 'N. Torres-Lee',
    profiles: [{ employmentHistory: existing().employment, education: existing().education }],
    resumeVersions: [{ material: { id: 'm-c500', text: resume('Hobbies: chess.') } }],
  });
  const byContent = await scan([...crowd.slice(0, 5), quiet], { displayName: 'Nina Torres-Lee', email: null, phone: null }, resume('Hobbies: tennis and hiking.'));
  assert.equal(byContent?.candidate.id, 'c500');
  assert.ok(byContent.basis.signals.some((s) => s.key === 'content') && byContent.basis.signals.some((s) => s.key === 'employment'), JSON.stringify(byContent.basis.signals));
});
