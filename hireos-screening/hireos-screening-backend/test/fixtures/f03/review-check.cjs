// #151 AC-3 -- one stored duplicate check and the records around it, as the review API reads them. Shared by the
// backend test and by scripts/gen-duplicate-review-fixture.cjs, which writes the API's answer for the frontend's
// rendering test, so both sides check the same review.
const { scoreIdentity } = require('../../../dist/duplicates/identity-scoring');
const { DuplicatesService } = require('../../../dist/duplicates/duplicates.service');

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

function reviewCheck() {
  const score = scoreIdentity({ name: 'Nina Torres', email: 'nina.torres@example.com', phone: '+1 415 555 0134', text: resume('New: Led the pricing guild.') }, existing());
  const check = {
    id: 'd-1', kind: 'new_resume_version', status: 'open', confidence: score.total / 100,
    basis: { ...score, kind: 'new_resume_version', lines: score.signals.map((s) => s.detail) },
    resolutionOutcome: null, resolutionNote: null, resolvedBy: null, resolvedAt: null,
    material: { id: 'm-2', name: 'nina-2026.txt', createdAt: new Date('2026-10-16T09:30:00Z'), readStatus: 'available', errorCode: null, confirmedIdentity: null, sourceType: 'manual_upload',
      segments: [{ id: 's1', text: 'Nina Torres' }, { id: 's2', text: 'Senior Data Analyst, Example Retail' }, { id: 's3', text: 'New: Led the pricing guild.' }] },
    existingCandidate: {
      id: 'c-1', displayName: 'Nina Torres', email: 'nina.torres@example.com', phone: '+14155550134', createdAt: new Date('2026-10-01T08:00:00Z'),
      resumeVersions: [{ version: 1, source: 'manual_upload', material: { name: 'nina.txt', createdAt: new Date('2026-10-01T08:00:00Z'),
        segments: [{ id: 's1', text: 'Nina Torres' }, { id: 's2', text: 'Senior Data Analyst,  Example Retail' }, { id: 's3', text: 'Old summary line.' }] } }],
      profiles: [{ employmentHistory: existing().employment, education: existing().education }],
    },
  };
  return { score, check };
}

/** The review API's answer for that check. */
async function reviewResponse(check = reviewCheck().check) {
  const db = { duplicateCheck: { findFirst: async () => check } };
  const profiles = { extractIdentitySignals: () => ({ displayName: 'Nina Torres', email: 'nina.torres@example.com', phone: '+14155550134', location: null }) };
  return new DuplicatesService(db, profiles, {}).get({ workspaceId: 'ws-1', actorId: 'hr-1', roles: [] }, 'd-1');
}

module.exports = { resume, existing, reviewCheck, reviewResponse };
