// #156 -- total experience is derived from the employment dates: overlapping months count once, an open-ended
// job runs to the current month, and without usable dates it is unknown, never estimated.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { totalExperience, formatMonth } = require('../dist/profiles/experience');
const { CandidatesService } = require('../dist/library/candidates.service');

const NOW = new Date(2026, 9, 16); // October 2026, fixed
const overlapping = [
  { company: 'Example Co', title: 'Analyst', start: '2020-06', end: '2022-06', achievements: [] },
  { company: 'Other Co', title: 'Senior analyst', start: '2022-01', end: 'present', achievements: [] },
];

test('#156 AC-1: overlapping jobs count their shared months once (2022-01 to 2022-06), present runs to now', () => {
  // 2020-06 .. 2026-10 is 77 months; counting the overlap twice would give 83.
  assert.deepEqual(totalExperience(overlapping, NOW), { status: 'derived', months: 77, years: 6.4 });
});

test('#156 AC-2: no usable start and end dates means unknown, not an estimate', () => {
  assert.deepEqual(totalExperience([], NOW), { status: 'unknown' });
  assert.deepEqual(totalExperience([{ company: 'X', start: '', end: '' }, { company: 'Y', start: '2019', end: '2021' }], NOW), { status: 'unknown' });
  assert.deepEqual(totalExperience(null, NOW), { status: 'unknown' });
});

test('#156 AC-3: dates read as YYYY-MM whatever the résumé wrote, and the total is the same on every read', () => {
  assert.equal(formatMonth('2020/6'), '2020-06');
  assert.equal(formatMonth('2020年6月'), '2020-06');
  assert.equal(formatMonth('06/2020'), '2020-06');
  assert.equal(formatMonth('present'), null);
  const mixed = [{ start: '2020年6月', end: '2022/06' }, { start: '2022.01', end: '至今' }];
  assert.deepEqual(totalExperience(mixed, NOW), totalExperience(overlapping, NOW));
  assert.deepEqual(totalExperience(overlapping, NOW), totalExperience(overlapping, NOW));
});

test('#156: the candidate API returns the derived total and YYYY-MM dates', () => {
  const service = new CandidatesService({}, {}, {}, {});
  const candidate = { id: 'c-1', displayName: 'Mai Tran', identityStatus: 'provisional', email: null, phone: null, ownerId: 'hr-1', createdAt: new Date(), lastMatchedAt: null, retention: 'standard' };
  const profile = { displayName: 'Mai Tran', dataStatus: 'complete', parseStatus: 'succeeded', location: null, workAuthorization: null, skills: [], education: [], compensationExpectation: null, missingFields: [],
    employmentHistory: [{ ...overlapping[0], start: '2020/6' }, overlapping[1]] };
  const result = service.toFrontendCandidate(candidate, profile);
  assert.equal(result.employment[0].start, '2020-06');
  assert.equal(result.employment[1].end, 'present');
  assert.equal(result.totalExperience.status, 'derived');
});
